import channels from '../common/channels.cjs';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { requireString, secureHandle } from './ipc-guards.js';
import type { StoryMemoryDraft } from '../services/story-memory/story-memory-actions.js';
import { BrowserWindow } from 'electron';

export function registerStoryMemoryIpcHandlers(
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  const broadcastChanged = () => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channels.workspace.treeChanged);
    }
  };
  secureHandle(channels.storyMemory.generate, async (_, targetPath) => {
    const result = await workspaceService.generateStoryMemory(
      requireString(targetPath, 'targetPath'),
    );
    broadcastChanged();
    return result;
  });
  secureHandle(channels.storyMemory.save, async (_, targetPath, draft: StoryMemoryDraft) => {
    const result = await workspaceService.saveStoryMemory(
      requireString(targetPath, 'targetPath'),
      draft,
    );
    broadcastChanged();
    return result;
  });
  secureHandle(channels.storyMemory.getLatest, async (_, groupPath) => {
    return workspaceService.getLatestStoryMemory(requireString(groupPath, 'groupPath'));
  });
}
