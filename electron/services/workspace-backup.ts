import { AppError } from '../common/app-error.js';
import {
  readBackupStatus,
  recordSuccessfulBackup,
} from '../repositories/backup-status-repository.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import { all, run, withDatabase, withTransaction } from '../db/connection.js';
import { getWorkspaceDatabaseFilePath, getReadableWorkspaceDatabasePath } from '../common/paths.js';
import { atomicWrite } from './atomic-file.js';
import { readStore } from './workspace/store.js';
import { buildNodeInfo } from './workspace/nodes.js';
import { getWorkspaceScriptDataFilePath } from '../common/paths.js';
import { readDocumentContent } from './workspace/script-files.js';
import type { WorkspaceServiceContext } from './workspace-service-context.js';

async function copyRegularTree(source: string, target: string) {
  let entries;
  try {
    entries = await fs.readdir(source, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  await fs.mkdir(target, { recursive: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new AppError('BACKUP_SYMLINK_NOT_ALLOWED');
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) await copyRegularTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
    else throw new AppError('BACKUP_FILE_UNSUPPORTED');
  }
}

async function checkDatabase(databasePath: string) {
  if (!(await fs.lstat(databasePath)).isFile()) throw new AppError('BACKUP_DATABASE_INVALID');
  const db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const connection = new sqlite3.Database(databasePath, sqlite3.OPEN_READONLY, (error) => {
      if (error) reject(error);
      else resolve(connection);
    });
  });
  try {
    const result = await all<Record<string, string>>(db, 'PRAGMA integrity_check');
    if (result.length !== 1 || Object.values(result[0])[0] !== 'ok')
      throw new AppError('BACKUP_DATABASE_CORRUPT');
  } finally {
    await new Promise<void>((resolve, reject) =>
      db.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function assertOutsideWorkspace(workspace: string, destination: string) {
  const relative = path.relative(path.resolve(workspace), path.resolve(destination));
  if (
    !relative ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  ) {
    throw new AppError('BACKUP_LOCATION_INVALID');
  }
}

export function createWorkspaceBackupActions(context: WorkspaceServiceContext) {
  return {
    async getWorkspaceBackupStatus() {
      return readBackupStatus(await context.getCurrentWorkspacePath());
    },
    async backupWorkspace(parentPath: string) {
      const workspace = await context.getCurrentWorkspacePath();
      assertOutsideWorkspace(workspace, parentPath);
      const store = await readStore(workspace);
      if (!store) throw new AppError('BACKUP_WORKSPACE_NOT_FOUND');
      for (const document of store.documents) await readDocumentContent(workspace, document.id);
      const target = await fs.mkdtemp(path.join(parentPath, 'groomi-backup-'));
      await withDatabase(workspace, async (db) => {
        await run(db, 'VACUUM INTO ?', [getWorkspaceDatabaseFilePath(target)]);
      });
      await copyRegularTree(path.join(workspace, 'scripts'), path.join(target, 'scripts'));
      await copyRegularTree(path.join(workspace, 'images'), path.join(target, 'images'));
      const createdAt = new Date().toISOString();
      // Written last: incomplete backups are never offered as restorable backups.
      await atomicWrite(
        path.join(target, 'groomi-backup.json'),
        JSON.stringify(
          {
            formatVersion: 1,
            createdAt,
            sourcePath: workspace,
          },
          null,
          2,
        ),
      );
      await recordSuccessfulBackup(workspace, createdAt);
      return { path: target };
    },
    async restoreWorkspaceBackup(source: string, parentPath: string) {
      const currentWorkspace = await context.getCurrentWorkspacePath();
      assertOutsideWorkspace(currentWorkspace, parentPath);
      assertOutsideWorkspace(source, parentPath);
      const manifest = JSON.parse(
        await fs.readFile(path.join(source, 'groomi-backup.json'), 'utf8'),
      );
      if (manifest.formatVersion !== 1 || typeof manifest.sourcePath !== 'string') {
        throw new AppError('BACKUP_FOLDER_INVALID');
      }
      await checkDatabase(getReadableWorkspaceDatabasePath(source));
      const target = await fs.mkdtemp(path.join(parentPath, 'groomi-restored-'));
      await fs.copyFile(
        getReadableWorkspaceDatabasePath(source),
        getWorkspaceDatabaseFilePath(target),
      );
      await copyRegularTree(path.join(source, 'scripts'), path.join(target, 'scripts'));
      await copyRegularTree(path.join(source, 'images'), path.join(target, 'images'));
      const store = await readStore(target);
      if (!store) throw new AppError('BACKUP_WORKSPACE_INFO_MISSING');
      for (const document of store.documents) {
        if (!/^[a-zA-Z0-9-]+$/.test(document.id)) throw new AppError('BACKUP_DOCUMENT_ID_INVALID');
        await readDocumentContent(target, document.id);
      }
      const rebaseCover = (cover: string) => {
        if (!cover) return '';
        const originalPath = cover.startsWith('file://') ? fileURLToPath(cover) : cover;
        const relative = path.relative(path.join(manifest.sourcePath, 'images'), originalPath);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
        return path.join(target, 'images', relative);
      };
      const { nodeById } = buildNodeInfo(target, store);
      // Update paths in place: deleting/reinserting nodes would cascade-delete
      // the generated comments linked to those nodes.
      await withDatabase(target, async (db) => {
        await withTransaction(db, async () => {
          await run(db, 'UPDATE workspace_nodes SET path = ? WHERE id = ?', [
            target,
            store.workspace.id,
          ]);
          for (const node of nodeById.values()) {
            await run(db, 'UPDATE workspace_nodes SET path = ? WHERE id = ?', [node.path, node.id]);
          }
          for (const group of [store.workspace, ...store.groups]) {
            await run(db, 'UPDATE group_info SET coverPath = ? WHERE nodeId = ?', [
              rebaseCover(group.coverPath),
              group.id,
            ]);
          }
          for (const document of store.documents) {
            const scriptPath = getWorkspaceScriptDataFilePath(target, document.id);
            await run(
              db,
              'UPDATE document_info SET draftPath = ?, manuscriptPath = ? WHERE nodeId = ?',
              [scriptPath, scriptPath, document.id],
            );
          }
          await run(db, 'DELETE FROM recent_visits');
        });
      });
      // Switching happens only after every file and DB has been checked.
      return context.setCurrentWorkspacePath(target);
    },
  };
}
