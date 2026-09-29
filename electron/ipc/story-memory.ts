import { ipcMain } from 'electron';
import channels from '../common/channels.cjs';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { requireString } from './ipc-guards.js';
import type { StoryMemoryDraft } from '../services/story-memory/story-memory-actions.js';

export function registerStoryMemoryIpcHandlers(
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  ipcMain.handle(channels.storyMemory.generate, async (_, targetPath) => {
    return workspaceService.generateStoryMemory(requireString(targetPath, 'targetPath'));
  });
  ipcMain.handle(channels.storyMemory.save, async (_, targetPath, draft: StoryMemoryDraft) => {
    return workspaceService.saveStoryMemory(requireString(targetPath, 'targetPath'), draft);
  });
  ipcMain.handle(channels.storyMemory.getLatest, async (_, groupPath) => {
    return workspaceService.getLatestStoryMemory(requireString(groupPath, 'groupPath'));
  });
}
