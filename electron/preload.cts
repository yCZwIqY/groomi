import type { IpcRendererEvent } from 'electron';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');
// Sandboxed preload scripts cannot require local modules, so the narrow IPC
// channel allowlist is kept directly in this file.
const channels = {
  folder: { select: 'folder:select' },
  file: {
    read: 'file:read',
    readImage: 'file:read-image',
    remove: 'file:remove',
    saveImage: 'file:save-image',
    showInFolder: 'show-in-folder',
  },
  workspace: {
    backup: 'workspace:backup',
    backupStatus: 'workspace:backup-status',
    restoreBackup: 'workspace:restore-backup',
    getWorkspaceTree: 'workspace:get-tree',
    getTrashItems: 'workspace:get-trash-items',
    treeChanged: 'workspace:tree-changed',
    getCurrentPath: 'workspace:get-current-path',
    initCurrent: 'workspace:init-current',
    selectPath: 'workspace:select-path',
    resetPath: 'workspace:reset-path',
    updateRoot: 'workspace:update-root',
    createWorkspace: 'workspace:create',
    renameWorkspace: 'workspace:rename',
    removeWorkspace: 'workspace:remove',
    purgeWorkspace: 'workspace:purge',
    restoreWorkspace: 'workspace:restore',
    getWorkspaceInfo: 'workspace:get-info',
    updateWorkspaceInfo: 'workspace:update-info',
  },
  document: {
    recoverDocument: 'document:recover',
    createDocument: 'document:create',
    getDocument: 'document:get',
    removeDocument: 'document:remove',
    purgeDocument: 'document:purge',
    restoreDocument: 'document:restore',
    updateDocument: 'document:update',
  },
  setting: {
    getInfo: 'setting:get-info',
    updateSelectedEmbeddingModel: 'setting:update-selected-embedding-model',
    updateSelectedLLMModel: 'setting:update-selected-llm-model',
  },
  storyMemory: {
    generate: 'story-memory:generate',
    save: 'story-memory:save',
    getLatest: 'story-memory:get-latest',
  },
  ollama: {
    isRunning: 'ollama:is-running',
    listModels: 'ollama:list-models',
  },
  comment: {
    addExample: 'comment:add-example',
    generateComments: 'comment:generateComments',
    listExamples: 'comment:list-examples',
    removeExample: 'comment:remove-example',
    listGenerated: 'comment:list-generated',
    removeGenerated: 'comment:remove-generated',
  },
} as const;
type WorkspaceUpdatePayload = Record<string, unknown>;
type DocumentUpdatePayload = Record<string, unknown>;
type GenerateCommentsPayload = Record<string, unknown>;
type AddCommentExamplePayload = Record<string, unknown>;
type StoryMemoryDraft = Record<string, unknown>;

contextBridge.exposeInMainWorld('electronMeta', {
  preloadReady: true,
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) {
      element.innerText = text;
    }
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency] ?? '');
  }
});

const fileApi = {
  selectFolder: () => ipcRenderer.invoke(channels.folder.select),
  readFile: (filePath: string) => ipcRenderer.invoke(channels.file.read, filePath),
  readImage: (filePath: string) => ipcRenderer.invoke(channels.file.readImage, filePath),
  saveImage: (workflowPath: string, fileName: string, buffer: number[]) =>
    ipcRenderer.invoke(channels.file.saveImage, workflowPath, fileName, buffer),
  removeFile: (filePath: string) => ipcRenderer.invoke(channels.file.remove, filePath),
  showInFolder: (filePath: string) => ipcRenderer.invoke(channels.file.showInFolder, filePath),
};

const workspaceApi = {
  getWorkspaceBackupStatus: () => ipcRenderer.invoke(channels.workspace.backupStatus),
  backupWorkspace: () => ipcRenderer.invoke(channels.workspace.backup),
  restoreWorkspaceBackup: () => ipcRenderer.invoke(channels.workspace.restoreBackup),
  getWorkspaceTree: (targetPath?: string) =>
    ipcRenderer.invoke(channels.workspace.getWorkspaceTree, targetPath),
  getTrashItems: () => ipcRenderer.invoke(channels.workspace.getTrashItems),
  onWorkspaceTreeChanged: (listener: () => void) => {
    const wrappedListener = (_event: IpcRendererEvent) => listener();
    ipcRenderer.on(channels.workspace.treeChanged, wrappedListener);

    return () => {
      ipcRenderer.removeListener(channels.workspace.treeChanged, wrappedListener);
    };
  },
  getCurrentWorkspacePath: () => ipcRenderer.invoke(channels.workspace.getCurrentPath),
  initCurrentWorkspace: () => ipcRenderer.invoke(channels.workspace.initCurrent),
  selectWorkspacePath: () => ipcRenderer.invoke(channels.workspace.selectPath),
  resetWorkspacePath: () => ipcRenderer.invoke(channels.workspace.resetPath),
  updateWorkspaceRoot: (targetPath: string) =>
    ipcRenderer.invoke(channels.workspace.updateRoot, targetPath),
  createWorkspace: (name: string, novelType?: string) =>
    ipcRenderer.invoke(channels.workspace.createWorkspace, name, novelType),
  renameWorkspace: (oldWorkspacePath: string, newName: string) =>
    ipcRenderer.invoke(channels.workspace.renameWorkspace, oldWorkspacePath, newName),
  removeWorkspace: (targetPath: string) =>
    ipcRenderer.invoke(channels.workspace.removeWorkspace, targetPath),
  purgeWorkspace: (targetPath: string) =>
    ipcRenderer.invoke(channels.workspace.purgeWorkspace, targetPath),
  restoreWorkspace: (targetPath: string) =>
    ipcRenderer.invoke(channels.workspace.restoreWorkspace, targetPath),
  getWorkspaceInfo: (targetPath: string) =>
    ipcRenderer.invoke(channels.workspace.getWorkspaceInfo, targetPath),
  updateWorkspaceInfo: (targetPath: string, workspaceInfo: WorkspaceUpdatePayload) =>
    ipcRenderer.invoke(channels.workspace.updateWorkspaceInfo, targetPath, workspaceInfo),
};

const documentApi = {
  recoverDocument: (documentPath: string) =>
    ipcRenderer.invoke(channels.document.recoverDocument, documentPath),
  createDocument: (workspacePath: string, name?: string) =>
    ipcRenderer.invoke(channels.document.createDocument, workspacePath, name),
  getDocument: (documentPath: string) =>
    ipcRenderer.invoke(channels.document.getDocument, documentPath),
  removeDocument: (documentPath: string) =>
    ipcRenderer.invoke(channels.document.removeDocument, documentPath),
  purgeDocument: (documentPath: string) =>
    ipcRenderer.invoke(channels.document.purgeDocument, documentPath),
  restoreDocument: (documentPath: string) =>
    ipcRenderer.invoke(channels.document.restoreDocument, documentPath),
  updateDocument: (documentPath: string, data: DocumentUpdatePayload) =>
    ipcRenderer.invoke(channels.document.updateDocument, documentPath, data),
};

const settingApi = {
  getSettingInfo: () => ipcRenderer.invoke(channels.setting.getInfo),
  updateSelectedEmbeddingModel: (selectedEmbeddingModel: string | null) =>
    ipcRenderer.invoke(channels.setting.updateSelectedEmbeddingModel, selectedEmbeddingModel),
  updateSelectedLLMModel: (selectedLLMModel: string | null) =>
    ipcRenderer.invoke(channels.setting.updateSelectedLLMModel, selectedLLMModel),
};

const storyMemoryApi = {
  generateStoryMemory: (targetPath: string) =>
    ipcRenderer.invoke(channels.storyMemory.generate, targetPath),
  saveStoryMemory: (targetPath: string, draft: StoryMemoryDraft) =>
    ipcRenderer.invoke(channels.storyMemory.save, targetPath, draft),
  getLatestStoryMemory: (groupPath: string) =>
    ipcRenderer.invoke(channels.storyMemory.getLatest, groupPath),
};

const ollamaApi = {
  isOllamaRunning: () => ipcRenderer.invoke(channels.ollama.isRunning),
  listOllamaModels: () => ipcRenderer.invoke(channels.ollama.listModels),
};

const commentApi = {
  addCommentExample: (payload: AddCommentExamplePayload) =>
    ipcRenderer.invoke(channels.comment.addExample, payload),
  generateComments: (payload: GenerateCommentsPayload) =>
    ipcRenderer.invoke(channels.comment.generateComments, payload),
  listCommentExamples: () => ipcRenderer.invoke(channels.comment.listExamples),
  removeCommentExample: (id: string) => ipcRenderer.invoke(channels.comment.removeExample, id),
  listGeneratedComments: (documentPath: string) =>
    ipcRenderer.invoke(channels.comment.listGenerated, documentPath),
  removeGeneratedComment: (documentPath: string, commentId: string | string[]) =>
    ipcRenderer.invoke(channels.comment.removeGenerated, documentPath, commentId),
};

contextBridge.exposeInMainWorld('electronAPI', {
  ...fileApi,
  ...workspaceApi,
  ...documentApi,
  ...settingApi,
  ...storyMemoryApi,
  ...ollamaApi,
  ...commentApi,
});
