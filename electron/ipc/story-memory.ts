import channels from '../common/channels.cjs';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { requireString, secureHandle } from './ipc-guards.js';
import type { StoryMemoryDraft } from '../services/story-memory/story-memory-actions.js';

export function registerStoryMemoryIpcHandlers(
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  secureHandle(channels.storyMemory.generate, async (_, targetPath) => {
    return workspaceService.generateStoryMemory(requireString(targetPath, 'targetPath'));
  });
  secureHandle(channels.storyMemory.save, async (_, targetPath, draft: StoryMemoryDraft) => {
    return workspaceService.saveStoryMemory(requireString(targetPath, 'targetPath'), draft);
  });
  secureHandle(channels.storyMemory.getLatest, async (_, groupPath) => {
    return workspaceService.getLatestStoryMemory(requireString(groupPath, 'groupPath'));
  });
}
