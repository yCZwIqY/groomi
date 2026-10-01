import fs from 'node:fs';

import { BrowserWindow, dialog, shell, type App } from 'electron';

import channels from '../common/channels.cjs';
import { ensureDirectory } from '../services/file-system.js';
import { parseWorkspaceUpdatePayload } from '../services/workspace/payloads.js';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { optionalString, requireNumberArray, requireString, secureHandle } from './ipc-guards.js';

export function registerWorkspaceIpcHandlers(
  app: App,
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  let workspaceWatcher: fs.FSWatcher | null = null;
  let watchedWorkspacePath: string | null = null;
  let notifyTreeChangedTimer: NodeJS.Timeout | null = null;

  function broadcastWorkspaceTreeChanged() {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channels.workspace.treeChanged);
      }
    }
  }

  function scheduleWorkspaceTreeChanged() {
    if (notifyTreeChangedTimer) {
      clearTimeout(notifyTreeChangedTimer);
    }

    notifyTreeChangedTimer = setTimeout(() => {
      notifyTreeChangedTimer = null;
      broadcastWorkspaceTreeChanged();
    }, 100);
  }

  function stopWorkspaceWatcher() {
    workspaceWatcher?.close();
    workspaceWatcher = null;
    watchedWorkspacePath = null;
  }

  function startWorkspaceWatcher(workspacePath: string) {
    if (!workspacePath || watchedWorkspacePath === workspacePath) {
      return;
    }

    stopWorkspaceWatcher();

    workspaceWatcher = fs.watch(
      workspacePath,
      {
        recursive: true,
      },
      () => {
        scheduleWorkspaceTreeChanged();
      },
    );

    workspaceWatcher.on('error', () => {
      stopWorkspaceWatcher();
    });

    watchedWorkspacePath = workspacePath;
  }

  secureHandle(channels.workspace.getWorkspaceTree, async (_, targetPath) => {
    const rootWorkspace = await workspaceService.getCurrentWorkspaceInfo();
    startWorkspaceWatcher(rootWorkspace.path);
    return workspaceService.getWorkspaceTree(optionalString(targetPath, 'targetPath'));
  });

  secureHandle(channels.workspace.getCurrentPath, async () => {
    const workspaceInfo = await workspaceService.getCurrentWorkspaceInfo();
    startWorkspaceWatcher(workspaceInfo.path);
    return workspaceInfo;
  });

  secureHandle(channels.workspace.backupStatus, async () =>
    workspaceService.getWorkspaceBackupStatus(),
  );

  secureHandle(channels.workspace.backup, async () => {
    const destination = await dialog.showOpenDialog({
      title: '백업을 보관할 폴더 선택',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (destination.canceled || !destination.filePaths[0]) return null;
    return workspaceService.backupWorkspace(destination.filePaths[0]);
  });

  secureHandle(channels.workspace.restoreBackup, async () => {
    const source = await dialog.showOpenDialog({
      title: '그루미 백업 폴더 선택',
      properties: ['openDirectory'],
    });
    if (source.canceled || !source.filePaths[0]) return null;
    const destination = await dialog.showOpenDialog({
      title: '복원할 새 작업 폴더의 상위 폴더 선택',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (destination.canceled || !destination.filePaths[0]) return null;
    const result = await workspaceService.restoreWorkspaceBackup(
      source.filePaths[0],
      destination.filePaths[0],
    );
    startWorkspaceWatcher(result.path);
    scheduleWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.workspace.initCurrent, async () => {
    const workspaceInfo = await workspaceService.initCurrentWorkspace();
    startWorkspaceWatcher(workspaceInfo.path);
    return workspaceInfo;
  });

  secureHandle(channels.workspace.selectPath, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const workspacePath = result.filePaths[0];
    await ensureDirectory(workspacePath);

    const workspaceInfo = await workspaceService.setCurrentWorkspacePath(workspacePath);
    startWorkspaceWatcher(workspaceInfo.path);
    scheduleWorkspaceTreeChanged();
    return workspaceInfo;
  });

  secureHandle(channels.workspace.resetPath, async () => {
    const workspaceInfo = await workspaceService.resetWorkspacePath();
    startWorkspaceWatcher(workspaceInfo.path);
    scheduleWorkspaceTreeChanged();
    return workspaceInfo;
  });

  secureHandle(channels.workspace.createWorkspace, async (_, name, novelType) => {
    const workspace = await workspaceService.createWorkspace(
      requireString(name, 'name'),
      novelType === 'short' ? 'short' : 'long',
    );
    scheduleWorkspaceTreeChanged();
    return workspace;
  });

  secureHandle(channels.workspace.renameWorkspace, async (_, oldWorkspacePath, newName) => {
    const workspace = await workspaceService.renameWorkspace(
      requireString(oldWorkspacePath, 'oldWorkspacePath'),
      requireString(newName, 'newName'),
    );
    scheduleWorkspaceTreeChanged();
    return workspace;
  });

  secureHandle(channels.workspace.removeWorkspace, async (_, targetPath) => {
    const result = await workspaceService.removeWorkspace(requireString(targetPath, 'targetPath'));
    scheduleWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.workspace.purgeWorkspace, async (_, targetPath) => {
    const result = await workspaceService.purgeWorkspace(requireString(targetPath, 'targetPath'));
    scheduleWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.workspace.restoreWorkspace, async (_, targetPath) => {
    const result = await workspaceService.restoreWorkspace(requireString(targetPath, 'targetPath'));
    scheduleWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.workspace.updateRoot, async (_, targetPath) => {
    const workspaceInfo = await workspaceService.updateRoot(
      requireString(targetPath, 'targetPath'),
    );
    startWorkspaceWatcher(workspaceInfo.path);
    scheduleWorkspaceTreeChanged();
    return workspaceInfo;
  });

  secureHandle(channels.workspace.getWorkspaceInfo, async (_, targetPath) => {
    const data = await workspaceService.getWorkflowInfo(requireString(targetPath, 'targetPath'));
    return data;
  });

  secureHandle(channels.workspace.getTrashItems, async () => {
    return workspaceService.getTrashItems();
  });

  secureHandle(channels.workspace.updateWorkspaceInfo, async (_, targetPath, workflowInfo) => {
    const data = await workspaceService.updateWorkspaceInfo(
      requireString(targetPath, 'targetPath'),
      parseWorkspaceUpdatePayload(workflowInfo),
    );
    return data;
  });

  app.on('before-quit', () => {
    if (notifyTreeChangedTimer) {
      clearTimeout(notifyTreeChangedTimer);
    }

    stopWorkspaceWatcher();
  });

  secureHandle(channels.file.saveImage, async (_, workflowPath, fileName, buffer) => {
    return workspaceService.saveImage(
      requireString(workflowPath, 'workflowPath'),
      requireString(fileName, 'fileName'),
      requireNumberArray(buffer, 'buffer'),
    );
  });

  secureHandle(channels.file.remove, async (_, filePath) => {
    await workspaceService.removeFile(requireString(filePath, 'filePath'));
  });

  secureHandle(channels.file.showInFolder, async (_, filePath) => {
    const inputPath = requireString(filePath, 'filePath');
    const targetPath = workspaceService.toFileSystemPath(inputPath);
    await workspaceService.assertInsideWorkspace(targetPath);

    shell.showItemInFolder(targetPath);

    return targetPath;
  });
}
