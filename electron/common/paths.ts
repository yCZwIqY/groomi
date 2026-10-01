import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';

// Only retained to open workspaces and backups created by older releases.
export const LEGACY_DATABASE_NAME = 'echo-draft.sqlite';
export function getLegacyDefaultWorkspacePath() {
  return path.join(os.homedir(), 'Documents', 'draft-novel');
}

export function getDefaultWorkspacePath() {
  return path.join(os.homedir(), 'Documents', 'groomi');
}

export function getWorkspaceDatabaseFilePath(workspacePath: string) {
  return path.join(workspacePath, 'groomi.sqlite');
}

export function getReadableWorkspaceDatabasePath(workspacePath: string) {
  const current = getWorkspaceDatabaseFilePath(workspacePath);
  return existsSync(current) ? current : path.join(workspacePath, LEGACY_DATABASE_NAME);
}

export function getWorkspaceScriptsDirectoryPath(workspacePath: string) {
  return path.join(workspacePath, 'scripts');
}

export function getWorkspaceScriptDataFilePath(workspacePath: string, documentId: string) {
  return path.join(getWorkspaceScriptsDirectoryPath(workspacePath), `${documentId}.json`);
}

export function getWorkspaceImagesDirectoryPath(rootWorkspacePath: string) {
  return path.join(rootWorkspacePath, 'images');
}
