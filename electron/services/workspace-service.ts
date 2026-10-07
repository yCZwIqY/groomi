import { createReviewActions } from './review/review-actions.js';
import { createDocumentActions } from './document-actions.js';
import { createFileActions } from './file-actions.js';
import { createSettingActions } from './setting-actions.js';
import { createWorkspaceActions } from './workspace-actions.js';
import { createWorkspaceServiceContext } from './workspace-service-context.js';
import type { App } from 'electron';
import { createCommentExampleActions } from './comment/comment-example-actions.js';
import { createCommentStoreActions } from './comment/comment-store-actions.js';
import { createStoryMemoryActions } from './story-memory/story-memory-actions.js';
import { createCommentGenerationActions } from './comment/comment-generation-actions.js';
import { createWorkspaceBackupActions } from './workspace-backup.js';
import { serializeWorkspaceOperation } from './workspace-operation.js';

export function createWorkspaceService(app: Pick<App, 'getPath'>) {
  const context = createWorkspaceServiceContext(app);
  const workspaceActions = createWorkspaceActions(context);
  const documentActions = createDocumentActions(context);
  const fileActions = createFileActions(context);
  const settingActions = createSettingActions(context);
  const storyMemoryActions = createStoryMemoryActions(context);
  const commentGenerationActions = createCommentGenerationActions(context);
  const commentExampleActions = createCommentExampleActions(context);
  const commentStoreActions = createCommentStoreActions(context);

  const reviewActions = createReviewActions(context);
  const service = {
    generateManuscriptReview: reviewActions.generateManuscriptReview,
    ...createWorkspaceBackupActions(context),
    recoverDocument: documentActions.recoverDocument,
    assertInsideWorkspace: context.assertInsideWorkspace,
    addRecentVisit: context.addRecentVisit,
    createDocument: documentActions.createDocument,
    createWorkspace: workspaceActions.createWorkspace,
    getCurrentWorkspaceInfo: context.getCurrentWorkspaceInfo,
    getCurrentWorkspacePath: context.getCurrentWorkspacePath,
    getDocument: documentActions.getDocument,
    getStoreNodeByPath: context.getStoreNodeByPath,
    getSettingInfo: settingActions.getSettingInfo,
    updateAiSettings: settingActions.updateAiSettings,
    getTrashItems: workspaceActions.getTrashItems,
    getWorkflowInfo: workspaceActions.getWorkflowInfo,
    getWorkspaceInfo: context.getWorkspaceInfo,
    getWorkspaceTree: workspaceActions.getWorkspaceTree,
    initCurrentWorkspace: context.initCurrentWorkspace,
    purgeDocument: documentActions.purgeDocument,
    purgeWorkspace: workspaceActions.purgeWorkspace,
    removeDocument: documentActions.removeDocument,
    removeFile: fileActions.removeFile,
    removeWorkspace: workspaceActions.removeWorkspace,
    restoreDocument: documentActions.restoreDocument,
    restoreWorkspace: workspaceActions.restoreWorkspace,
    renameWorkspace: workspaceActions.renameWorkspace,
    resetWorkspacePath: context.resetWorkspacePath,
    saveImage: fileActions.saveImage,
    setCurrentWorkspacePath: context.setCurrentWorkspacePath,
    toFileSystemPath: fileActions.toFileSystemPath,
    updateDocument: documentActions.updateDocument,
    updateRoot: context.updateRoot,
    updateSelectedEmbeddingModel: settingActions.updateSelectedEmbeddingModel,
    updateSelectedLLMModel: settingActions.updateSelectedLLMModel,
    updateWorkflowInfo: workspaceActions.updateWorkflowInfo,
    updateWorkspaceInfo: workspaceActions.updateWorkspaceInfo,

    //storyMemoryActions
    generateStoryMemory: storyMemoryActions.generateStoryMemory,
    saveStoryMemory: storyMemoryActions.saveStoryMemory,
    getLatestStoryMemory: storyMemoryActions.getLatestStoryMemory,

    //commentGenerationActions
    addCommentExample: commentExampleActions.addCommentExample,
    generateComments: commentGenerationActions.generateComments,
    listCommentExamples: commentExampleActions.listCommentExamples,
    removeCommentExample: commentExampleActions.removeCommentExample,

    //commentStoreActions
    listGeneratedComments: commentStoreActions.listGeneratedComments,
    removeGeneratedComment: commentStoreActions.removeGeneratedComment,
  };
  // Inference only reads snapshots and must not block writing a manuscript.
  const concurrent = new Set([
    'generateManuscriptReview',
    'generateStoryMemory',
    'generateComments',
    'toFileSystemPath',
  ]);
  return Object.fromEntries(
    Object.entries(service).map(([name, action]) => [
      name,
      concurrent.has(name)
        ? action
        : (...args: unknown[]) =>
            serializeWorkspaceOperation(() =>
              (action as (...args: unknown[]) => Promise<unknown>)(...args),
            ),
    ]),
  ) as typeof service;
}
