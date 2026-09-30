import path from 'node:path';
import fs from 'node:fs/promises';
import type { App } from 'electron';

import {
  getWorkspaceScriptDataFilePath,
  getWorkspaceImagesDirectoryPath,
} from '../common/paths.js';
import { all, run, withTransaction } from '../db/connection.js';
import { deleteFile, pathExists } from './file-system.js';
import { withWorkspaceRepositories } from './workspace-repository-context.js';
import { createWorkspaceSettings } from './workspace-settings.js';
import { buildNodeInfo, toRecentVisit, type WorkspaceNodeData } from './workspace/nodes.js';
import { ensureStore } from './workspace/store.js';
import { mergeRecentVisits, normalizePath, toFileSystemPath } from './workspace/shared.js';
import type { WorkspaceStore } from './workspace/store-types.js';

export function createWorkspaceServiceContext(app: Pick<App, 'getPath'>) {
  const workspaceSettings = createWorkspaceSettings(app);

  async function assertInsideWorkspace(targetPath: string) {
    const workspacePath = await workspaceSettings.getCurrentWorkspacePath();
    const resolvedWorkspacePath = normalizePath(workspacePath);
    const resolvedTargetPath = normalizePath(targetPath);
    const relativePath = path.relative(resolvedWorkspacePath, resolvedTargetPath);
    const isOutside = relativePath.startsWith('..') || path.isAbsolute(relativePath);

    if (isOutside) {
      throw new Error('작업 폴더 밖의 경로에는 접근할 수 없습니다.');
    }
  }

  async function getStoreNodeByPath(targetPath: string) {
    const workspacePath = await workspaceSettings.getCurrentWorkspacePath();
    const store = await ensureStore(workspacePath);
    const normalizedTargetPath = normalizePath(targetPath);
    const { nodeByPath } = buildNodeInfo(workspacePath, store);

    return {
      workspacePath,
      store,
      node: nodeByPath.get(normalizedTargetPath) ?? null,
    };
  }

  async function addRecentVisit(_workflowPath: string, visit: WorkspaceNodeData) {
    const workspacePath = await workspaceSettings.getCurrentWorkspacePath();
    const store = await ensureStore(workspacePath);
    const nextRecentVisits = mergeRecentVisits(store.recentVisits, toRecentVisit(visit));

    await withWorkspaceRepositories(workspacePath, async ({ db, recentVisits }) => {
      await withTransaction(db, async () => {
        await recentVisits.deleteAllRecentVisits();
        await recentVisits.insertRecentVisits(nextRecentVisits);
      });
    });
  }

  function getUpdatedNodeById(workspacePath: string, store: WorkspaceStore, targetId: string) {
    const { nodeById } = buildNodeInfo(workspacePath, store);
    return nodeById.get(targetId) ?? null;
  }

  async function removeCoverImage(coverPath?: string | null) {
    if (!coverPath) {
      return;
    }

    const filePath = toFileSystemPath(coverPath);
    const workspacePath = await workspaceSettings.getCurrentWorkspacePath();
    const relative = path.relative(getWorkspaceImagesDirectoryPath(workspacePath), filePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return;
    const store = await ensureStore(workspacePath);
    if (
      [store.workspace, ...store.groups].some(
        (group) =>
          group.coverPath &&
          normalizePath(toFileSystemPath(group.coverPath)) === normalizePath(filePath),
      )
    )
      return;
    if (await pathExists(filePath)) {
      await deleteFile(filePath);
    }
  }

  async function removeDocumentContentFile(workspacePath: string, documentId: string) {
    const documentDataPath = getWorkspaceScriptDataFilePath(workspacePath, documentId);
    const files = await fs.readdir(path.dirname(documentDataPath));
    for (const file of files) {
      if (file === `${documentId}.json` || file.startsWith(`${documentId}.json.`)) {
        await fs.rm(path.join(path.dirname(documentDataPath), file), { force: true });
      }
    }
  }

  async function cleanupDeletedDocumentFiles(workspacePath: string) {
    await withWorkspaceRepositories(workspacePath, async ({ db }) => {
      const pending = await all<{ documentId: string }>(
        db,
        'SELECT documentId FROM pending_document_deletions WHERE documentId NOT IN (SELECT id FROM workspace_nodes)',
      );
      for (const item of pending) {
        try {
          await removeDocumentContentFile(workspacePath, item.documentId);
          await run(db, 'DELETE FROM pending_document_deletions WHERE documentId = ?', [
            item.documentId,
          ]);
          await run(db, 'DELETE FROM document_file_commits WHERE documentId = ?', [
            item.documentId,
          ]);
        } catch (error) {
          throw new Error(
            '항목은 삭제했지만 원고 파일을 정리하지 못했습니다. 파일을 사용하는 프로그램을 닫고 그루미를 다시 실행하면 재시도합니다.',
            { cause: error },
          );
        }
      }
    });
  }

  return {
    addRecentVisit,
    assertInsideWorkspace,
    getCurrentWorkspaceInfo: workspaceSettings.getCurrentWorkspaceInfo,
    getCurrentWorkspacePath: workspaceSettings.getCurrentWorkspacePath,
    getStoreNodeByPath,
    getUpdatedNodeById,
    getWorkspaceInfo: workspaceSettings.getWorkspaceInfo,
    async initCurrentWorkspace() {
      const result = await workspaceSettings.initCurrentWorkspace();
      await cleanupDeletedDocumentFiles(result.path).catch(console.error);
      return result;
    },
    cleanupDeletedDocumentFiles,
    removeCoverImage,
    removeDocumentContentFile,
    resetWorkspacePath: workspaceSettings.resetWorkspacePath,
    setCurrentWorkspacePath: workspaceSettings.setCurrentWorkspacePath,
    updateRoot: workspaceSettings.updateRoot,
    withWorkspaceRepositories,
  };
}

export type WorkspaceServiceContext = ReturnType<typeof createWorkspaceServiceContext>;
