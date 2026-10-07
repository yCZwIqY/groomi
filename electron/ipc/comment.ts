import type { createWorkspaceService } from '../services/workspace-service.js';
import channels from '../common/channels.cjs';
import { requireString, secureHandle } from './ipc-guards.js';

export function registerCommentIpcHandlers(
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  secureHandle(channels.comment.addExample, async (_, payload) => {
    return workspaceService.addCommentExample(payload);
  });

  secureHandle(channels.comment.generateComments, async (_, payload) => {
    return workspaceService.generateComments(payload);
  });

  secureHandle(channels.comment.listExamples, async () => {
    return workspaceService.listCommentExamples();
  });

  secureHandle(channels.comment.removeExample, async (_, id) => {
    return workspaceService.removeCommentExample(
      Array.isArray(id) ? id.map((value) => requireString(value, 'id')) : requireString(id, 'id'),
    );
  });

  secureHandle(channels.comment.listGenerated, async (_, documentPath) => {
    return workspaceService.listGeneratedComments(requireString(documentPath, 'documentPath'));
  });

  secureHandle(channels.comment.removeGenerated, async (_, documentPath, commentId) => {
    return workspaceService.removeGeneratedComment(
      requireString(documentPath, 'documentPath'),
      Array.isArray(commentId)
        ? commentId.map((id) => requireString(id, 'commentId'))
        : requireString(commentId, 'commentId'),
    );
  });
}
