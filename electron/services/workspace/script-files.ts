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
    throw new Error('원고 파일 형식이 올바르지 않습니다.');
  }
  for (const field of ['draft', 'manuscript'] as const) {
    if (value[field] !== undefined && (!value[field] || typeof value[field].content !== 'string')) {
      throw new Error('원고 내용 형식이 올바르지 않습니다.');
    }
  }
  if (value.title !== undefined && typeof value.title !== 'string') {
    throw new Error('원고 제목 형식이 올바르지 않습니다.');
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
    throw new Error(
      '원고 파일을 읽을 수 없습니다. 파일을 보존했습니다. 이전 저장본 또는 작업 폴더 백업으로 복구해주세요.',
      { cause: error },
    );
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
