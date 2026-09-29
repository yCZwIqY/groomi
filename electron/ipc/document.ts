import { BrowserWindow } from 'electron';
import channels from '../common/channels.cjs';
import { parseDocumentUpdatePayload } from '../services/workspace/payloads.js';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { optionalString, requireString, secureHandle } from './ipc-guards.js';

export function registerDocumentIpcHandlers(
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  function broadcastWorkspaceTreeChanged() {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channels.workspace.treeChanged);
      }
    }
  }

  secureHandle(channels.document.createDocument, async (_, workspace, name) => {
    const result = await workspaceService.createDocument(
      requireString(workspace, 'workspace'),
      optionalString(name, 'name'),
    );
    broadcastWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.document.getDocument, async (_, documentPath) => {
    return workspaceService.getDocument(requireString(documentPath, 'documentPath'));
  });

  secureHandle(channels.document.removeDocument, async (_, documentPath) => {
    const result = await workspaceService.removeDocument(requireString(documentPath, 'documentPath'));
    broadcastWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.document.purgeDocument, async (_, documentPath) => {
    const result = await workspaceService.purgeDocument(requireString(documentPath, 'documentPath'));
    broadcastWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.document.restoreDocument, async (_, documentPath) => {
    const result = await workspaceService.restoreDocument(requireString(documentPath, 'documentPath'));
    broadcastWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.document.updateDocument, async (_, documentPath, data) => {
    const result = await workspaceService.updateDocument(
      requireString(documentPath, 'documentPath'),
      parseDocumentUpdatePayload(data),
    );
    broadcastWorkspaceTreeChanged();
    return result;
  });
}
