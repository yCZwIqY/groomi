import { AppError } from '../../common/app-error.js';
import fs from 'node:fs/promises';
import type sqlite3 from 'sqlite3';
import {
  getWorkspaceScriptDataFilePath,
  getWorkspaceScriptsDirectoryPath,
} from '../../common/paths.js';
import { all, initializeSchema, run, withDatabase, withTransaction } from '../../db/connection.js';
import { ensureDirectory } from '../file-system.js';
import { atomicWrite } from '../atomic-file.js';
import type { StoredDocumentContent } from './store-types.js';

export function parseDocumentContent(raw: string): StoredDocumentContent {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('MANUSCRIPT_FILE_INVALID');
  }
  for (const field of ['draft', 'manuscript'] as const) {
    if (value[field] !== undefined && (!value[field] || typeof value[field].content !== 'string')) {
      throw new AppError('MANUSCRIPT_CONTENT_INVALID');
    }
  }
  if (value.title !== undefined && typeof value.title !== 'string') {
    throw new AppError('MANUSCRIPT_TITLE_INVALID');
  }
  return value;
}

export async function ensureScriptsDirectory(workspacePath: string) {
  await ensureDirectory(getWorkspaceScriptsDirectoryPath(workspacePath));
}

// SQLite's committed token decides which complete file version survives a crash.
async function recoverInterruptedSave(workspacePath: string, documentId: string) {
  const filePath = getWorkspaceScriptDataFilePath(workspacePath, documentId);
  let journalRaw: string;
  try {
    journalRaw = await fs.readFile(`${filePath}.pending`, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const journal = JSON.parse(journalRaw) as { token: string; previous: string; next: string };
  parseDocumentContent(journal.previous);
  parseDocumentContent(journal.next);
  const committed = await withDatabase(workspacePath, async (db) => {
    await initializeSchema(db);
    const rows = await all<{ token: string }>(
      db,
      'SELECT token FROM document_file_commits WHERE documentId = ?',
      [documentId],
    );
    return rows[0]?.token === journal.token;
  });
  await atomicWrite(filePath, committed ? journal.next : journal.previous);
  await fs.unlink(`${filePath}.pending`);
}

export async function readDocumentContent(
  workspacePath: string,
  documentId: string,
): Promise<StoredDocumentContent> {
  try {
    await recoverInterruptedSave(workspacePath, documentId);
    return parseDocumentContent(
      await fs.readFile(getWorkspaceScriptDataFilePath(workspacePath, documentId), 'utf8'),
    );
  } catch (error) {
    throw new AppError('MANUSCRIPT_READ_FAILED', { cause: error });
  }
}

export async function writeDocumentContent(
  workspacePath: string,
  documentId: string,
  data: StoredDocumentContent,
) {
  const filePath = getWorkspaceScriptDataFilePath(workspacePath, documentId);
  await recoverInterruptedSave(workspacePath, documentId);
  const next = JSON.stringify(data, null, 2);
  parseDocumentContent(next);
  let previous: string | undefined;
  try {
    previous = await fs.readFile(filePath, 'utf8');
    parseDocumentContent(previous);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous !== undefined) await atomicWrite(`${filePath}.bak`, previous);
  await atomicWrite(filePath, next);
}

export async function updateDocumentContentWithMetadata(
  workspacePath: string,
  documentId: string,
  data: StoredDocumentContent,
  updateMetadata: (db: sqlite3.Database) => Promise<void>,
) {
  await recoverInterruptedSave(workspacePath, documentId);
  const filePath = getWorkspaceScriptDataFilePath(workspacePath, documentId);
  const previous = await fs.readFile(filePath, 'utf8');
  parseDocumentContent(previous);
  const next = JSON.stringify(data, null, 2);
  parseDocumentContent(next);
  const token = crypto.randomUUID();
  await atomicWrite(`${filePath}.bak`, previous);
  await atomicWrite(`${filePath}.pending`, JSON.stringify({ token, previous, next }));
  try {
    await withDatabase(workspacePath, async (db) => {
      await initializeSchema(db);
      await withTransaction(db, async () => {
        await updateMetadata(db);
        await atomicWrite(filePath, next);
        await run(
          db,
          'INSERT INTO document_file_commits (documentId, token) VALUES (?, ?) ON CONFLICT(documentId) DO UPDATE SET token = excluded.token',
          [documentId, token],
        );
      });
    });
  } catch (error) {
    await recoverInterruptedSave(workspacePath, documentId);
    throw error;
  }
  await fs.unlink(`${filePath}.pending`).catch(() => {});
}

export async function restorePreviousDocumentContent(workspacePath: string, documentId: string) {
  await recoverInterruptedSave(workspacePath, documentId);
  const filePath = getWorkspaceScriptDataFilePath(workspacePath, documentId);
  const backup = await fs.readFile(`${filePath}.bak`, 'utf8');
  parseDocumentContent(backup);
  try {
    await fs.copyFile(filePath, `${filePath}.recovered-${Date.now()}-${crypto.randomUUID()}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await atomicWrite(filePath, backup);
}
