import channels from '../common/channels.cjs';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { requireString, secureHandle } from './ipc-guards.js';
export function registerReviewIpcHandlers(
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  secureHandle(channels.review.generate, async (_, targetPath) =>
    workspaceService.generateManuscriptReview(requireString(targetPath, 'targetPath')),
  );
}
