import type { App } from 'electron';

import { getDefaultWorkspacePath, getLegacyDefaultWorkspacePath } from '../common/paths.js';
import { createCurrentWorkspaceRepository } from '../repositories/current-workspace-repository.js';
import { pathExists } from './file-system.js';
import { normalizePath } from './workspace/shared.js';
import { ensureStore } from './workspace/store.js';

export function createWorkspaceSettings(app: Pick<App, 'getPath'>) {
  const currentWorkspaceRepository = createCurrentWorkspaceRepository(app);

  async function getCurrentWorkspacePath() {
    const saved = await currentWorkspaceRepository.getCurrentWorkspacePath();
    if (saved) return saved;
    const current = getDefaultWorkspacePath();
    if (await pathExists(current)) return current;
    const legacy = getLegacyDefaultWorkspacePath();
    return (await pathExists(legacy)) ? legacy : current;
  }

  async function getWorkspaceInfo(workspacePath: string) {
    const normalizedWorkspacePath = normalizePath(workspacePath);

    return {
      path: normalizedWorkspacePath,
      exists: await pathExists(normalizedWorkspacePath),
    };
  }

  async function getCurrentWorkspaceInfo() {
    return getWorkspaceInfo(await getCurrentWorkspacePath());
  }

  async function setCurrentWorkspacePath(workspacePath: string) {
    const normalizedWorkspacePath = normalizePath(workspacePath);

    await ensureStore(normalizedWorkspacePath);
    await currentWorkspaceRepository.setCurrentWorkspacePath(normalizedWorkspacePath);

    return {
      path: normalizedWorkspacePath,
      exists: true,
    };
  }

  async function initCurrentWorkspace() {
    const workspacePath = await getCurrentWorkspacePath();
    await ensureStore(workspacePath);

    return {
      path: workspacePath,
      exists: true,
    };
  }

  async function resetWorkspacePath() {
    const defaultWorkspacePath = getDefaultWorkspacePath();
    await ensureStore(defaultWorkspacePath);

    return setCurrentWorkspacePath(defaultWorkspacePath);
  }

  async function updateRoot(targetPath: string) {
    const normalizedTargetPath = normalizePath(targetPath);

    await ensureStore(normalizedTargetPath);
    await currentWorkspaceRepository.setCurrentWorkspacePath(normalizedTargetPath);

    return {
      path: normalizedTargetPath,
      exists: await pathExists(normalizedTargetPath),
    };
  }

  return {
    getCurrentWorkspaceInfo,
    getCurrentWorkspacePath,
    getWorkspaceInfo,
    initCurrentWorkspace,
    resetWorkspacePath,
    setCurrentWorkspacePath,
    updateRoot,
  };
}
