import fs from 'node:fs';

import { BrowserWindow, dialog, ipcMain, shell, type App } from 'electron';

import channels from '../common/channels.cjs';
import { ensureDirectory } from '../services/file-system.js';
import { parseWorkspaceUpdatePayload } from '../services/workspace/payloads.js';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { optionalString, requireNumberArray, requireString } from './ipc-guards.js';

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

  ipcMain.handle(channels.workspace.getWorkspaceTree, async (_, targetPath) => {
    const rootWorkspace = await workspaceService.getCurrentWorkspaceInfo();
    startWorkspaceWatcher(rootWorkspace.path);
    return workspaceService.getWorkspaceTree(optionalString(targetPath, 'targetPath'));
  });

  ipcMain.handle(channels.workspace.getCurrentPath, async () => {
    const workspaceInfo = await workspaceService.getCurrentWorkspaceInfo();
    startWorkspaceWatcher(workspaceInfo.path);
    return workspaceInfo;
  });

  ipcMain.handle(channels.workspace.initCurrent, async () => {
    const workspaceInfo = await workspaceService.initCurrentWorkspace();
    startWorkspaceWatcher(workspaceInfo.path);
    return workspaceInfo;
  });

  ipcMain.handle(channels.workspace.selectPath, async () => {
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

  ipcMain.handle(channels.workspace.resetPath, async () => {
    const workspaceInfo = await workspaceService.resetWorkspacePath();
    startWorkspaceWatcher(workspaceInfo.path);
    scheduleWorkspaceTreeChanged();
    return workspaceInfo;
  });

  ipcMain.handle(channels.workspace.createWorkspace, async (_, name, novelType) => {
    const workspace = await workspaceService.createWorkspace(
      requireString(name, 'name'),
      novelType === 'short' ? 'short' : 'long',
    );
    scheduleWorkspaceTreeChanged();
    return workspace;
  });

  ipcMain.handle(channels.workspace.renameWorkspace, async (_, oldWorkspacePath, newName) => {
    const workspace = await workspaceService.renameWorkspace(
      requireString(oldWorkspacePath, 'oldWorkspacePath'),
      requireString(newName, 'newName'),
    );
    scheduleWorkspaceTreeChanged();
    return workspace;
  });

  ipcMain.handle(channels.workspace.removeWorkspace, async (_, targetPath) => {
    const result = await workspaceService.removeWorkspace(requireString(targetPath, 'targetPath'));
    scheduleWorkspaceTreeChanged();
    return result;
  });

  ipcMain.handle(channels.workspace.purgeWorkspace, async (_, targetPath) => {
    const result = await workspaceService.purgeWorkspace(requireString(targetPath, 'targetPath'));
    scheduleWorkspaceTreeChanged();
    return result;
  });

  ipcMain.handle(channels.workspace.restoreWorkspace, async (_, targetPath) => {
    const result = await workspaceService.restoreWorkspace(requireString(targetPath, 'targetPath'));
    scheduleWorkspaceTreeChanged();
    return result;
  });

  ipcMain.handle(channels.workspace.updateRoot, async (_, targetPath) => {
    const workspaceInfo = await workspaceService.updateRoot(requireString(targetPath, 'targetPath'));
    startWorkspaceWatcher(workspaceInfo.path);
    scheduleWorkspaceTreeChanged();
    return workspaceInfo;
  });

  ipcMain.handle(channels.workspace.getWorkspaceInfo, async (_, targetPath) => {
    const data = await workspaceService.getWorkflowInfo(requireString(targetPath, 'targetPath'));
    return data;
  });

  ipcMain.handle(channels.workspace.getTrashItems, async () => {
    return workspaceService.getTrashItems();
  });

  ipcMain.handle(channels.workspace.updateWorkspaceInfo, async (_, targetPath, workflowInfo) => {
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

  ipcMain.handle(channels.file.saveImage, async (_, workflowPath, fileName, buffer) => {
    return workspaceService.saveImage(
      requireString(workflowPath, 'workflowPath'),
      requireString(fileName, 'fileName'),
      requireNumberArray(buffer, 'buffer'),
    );
  });

  ipcMain.handle(channels.file.remove, async (_, filePath) => {
    await workspaceService.removeFile(requireString(filePath, 'filePath'));
  });

  ipcMain.handle(channels.file.showInFolder, async (_, filePath) => {
    const inputPath = requireString(filePath, 'filePath');
    const targetPath = workspaceService.toFileSystemPath(inputPath);

    console.log('[showInFolder] input:', inputPath.slice(0, 100));
    console.log('[showInFolder] target:', targetPath.slice(0, 100));

    shell.showItemInFolder(targetPath);

    return targetPath;
  });
}
