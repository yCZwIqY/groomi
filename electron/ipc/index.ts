import { registerDirectoryIpcHandlers } from './directory.js';
import { registerSettingIpcHandlers } from './setting.js';
import { registerWorkspaceIpcHandlers } from './workspace.js';
import { registerDocumentIpcHandlers } from './document.js';
import { createWorkspaceService } from '../services/workspace-service.js';
import type { App } from 'electron';
import { registerStoryMemoryIpcHandlers } from './story-memory.js';
import { registerCommentIpcHandlers } from './comment.js';
import { registerOllamaIpcHandlers } from './ollama.js';

export function registerIpcHandlers(app: App) {
  const workspaceService = createWorkspaceService(app);

  registerDirectoryIpcHandlers(workspaceService.assertInsideWorkspace);
  registerWorkspaceIpcHandlers(app, workspaceService);
  registerDocumentIpcHandlers(workspaceService);
  registerSettingIpcHandlers(workspaceService);
  registerStoryMemoryIpcHandlers(workspaceService);
  registerCommentIpcHandlers(workspaceService);
  registerOllamaIpcHandlers();
}
