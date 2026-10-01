import { requireElectronApi } from './client';
import { flushPendingDocument } from '../pending-document';

export async function backupWorkspace() {
  await flushPendingDocument();
  const result = await requireElectronApi().backupWorkspace();
  if (result) window.dispatchEvent(new Event('workspace-backup-completed'));
  return result;
}

export async function restoreWorkspaceBackup() {
  await flushPendingDocument();
  return requireElectronApi().restoreWorkspaceBackup();
}

export async function getWorkspaceTree(path?: string) {
  return requireElectronApi().getWorkspaceTree(path);
}

export async function getTrashItems() {
  return requireElectronApi().getTrashItems();
}

export function onWorkspaceTreeChanged(listener: () => void) {
  return requireElectronApi().onWorkspaceTreeChanged(listener);
}

export async function getCurrentWorkspacePath() {
  return requireElectronApi().getCurrentWorkspacePath();
}

export async function initCurrentWorkspace() {
  return requireElectronApi().initCurrentWorkspace();
}

export async function selectWorkspacePath() {
  await flushPendingDocument();
  return requireElectronApi().selectWorkspacePath();
}

export async function updateWorkspaceRootPath(targetPath: string) {
  await flushPendingDocument();
  return requireElectronApi().updateWorkspaceRoot(targetPath);
}

export async function createWorkspace(path: string, novelType?: NovelType) {
  return requireElectronApi().createWorkspace(path, novelType);
}

export async function removeWorkspace(path: string) {
  await flushPendingDocument();
  return requireElectronApi().removeWorkspace(path);
}

export async function purgeWorkspace(path: string) {
  await flushPendingDocument();
  return requireElectronApi().purgeWorkspace(path);
}

export async function restoreWorkspace(path: string) {
  return requireElectronApi().restoreWorkspace(path);
}

export async function getWorkspaceInfo(path: string) {
  return requireElectronApi().getWorkspaceInfo(path);
}

export async function updateWorkspaceInfo(path: string, workspaceInfo: WorkspaceUpdatePayload) {
  return requireElectronApi().updateWorkspaceInfo(path, workspaceInfo);
}

export function getWorkspaceBackupStatus() {
  return requireElectronApi().getWorkspaceBackupStatus();
}
