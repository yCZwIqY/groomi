import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite } from '../services/atomic-file.js';

const STATUS_FILENAME = '.groomi-backup-status.json';
export const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function isBackupOverdue(lastBackupAt: string | null, now = Date.now()) {
  if (!lastBackupAt) return true;
  const timestamp = Date.parse(lastBackupAt);
  return !Number.isFinite(timestamp) || now - timestamp >= BACKUP_REMINDER_INTERVAL_MS;
}

export async function readBackupStatus(workspace: string) {
  try {
    const value = JSON.parse(await fs.readFile(path.join(workspace, STATUS_FILENAME), 'utf8'));
    const lastBackupAt =
      typeof value.lastBackupAt === 'string' && Number.isFinite(Date.parse(value.lastBackupAt))
        ? value.lastBackupAt
        : null;
    return { workspacePath: workspace, lastBackupAt, overdue: isBackupOverdue(lastBackupAt) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError))
      throw error;
    return { workspacePath: workspace, lastBackupAt: null, overdue: true };
  }
}

export async function recordSuccessfulBackup(workspace: string, lastBackupAt: string) {
  await atomicWrite(
    path.join(workspace, STATUS_FILENAME),
    JSON.stringify({ lastBackupAt }, null, 2),
  );
}
