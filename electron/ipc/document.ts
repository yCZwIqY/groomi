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

  secureHandle(channels.document.recoverDocument, async (_, documentPath) => {
    const confirm = await import('electron').then(({ dialog }) =>
      dialog.showMessageBox({
        type: 'warning',
        buttons: ['취소', '이전 저장본 복구'],
        defaultId: 0,
        cancelId: 0,
        message: '이전 저장본으로 복구하시겠습니까?',
        detail: '마지막 수정 내용은 이전 저장본에 없을 수 있습니다. 현재 파일은 별도로 보존합니다.',
      }),
    );
    if (confirm.response !== 1) throw new Error('복구를 취소했습니다.');
    const result = await workspaceService.recoverDocument(
      requireString(documentPath, 'documentPath'),
    );
    broadcastWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.document.removeDocument, async (_, documentPath) => {
    const result = await workspaceService.removeDocument(
      requireString(documentPath, 'documentPath'),
    );
    broadcastWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.document.purgeDocument, async (_, documentPath) => {
    const result = await workspaceService.purgeDocument(
      requireString(documentPath, 'documentPath'),
    );
    broadcastWorkspaceTreeChanged();
    return result;
  });

  secureHandle(channels.document.restoreDocument, async (_, documentPath) => {
    const result = await workspaceService.restoreDocument(
      requireString(documentPath, 'documentPath'),
    );
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
