import path from 'node:path';

import { ensureStore } from './workspace/store.js';
import { buildNodeInfo, buildRootWorkspaceNode, buildTrashNodes, buildTreeNodes } from './workspace/nodes.js';
import {
  collectDocumentIdsByGroupIds,
  collectGroupAncestorIds,
  collectGroupDescendantIds,
  normalizePath,
  now,
  sanitizeNodeName,
} from './workspace/shared.js';
import { withTransaction } from '../db/connection.js';
import type { WorkspaceServiceContext } from './workspace-service-context.js';
import type { NovelType, WorkspaceStoreDocument, WorkspaceStoreGroup } from './workspace/store-types.js';
import type { WorkspaceUpdatePayload } from './workspace/payloads.js';

export function createWorkspaceActions(context: WorkspaceServiceContext) {
  async function createWorkspace(targetPath: string, novelType: NovelType = 'long') {
    const workspacePath = await context.getCurrentWorkspacePath();
    const normalizedTargetPath = normalizePath(targetPath);
    const parentPath = path.dirname(normalizedTargetPath);
    const safeName = sanitizeNodeName(path.basename(normalizedTargetPath));

    await context.assertInsideWorkspace(normalizedTargetPath);

    const store = await ensureStore(workspacePath);
    const { nodeByPath } = buildNodeInfo(workspacePath, store);

    if (nodeByPath.has(normalizedTargetPath)) {
      throw new Error('같은 레벨에선 중복되는 이름을 사용할 수 없습니다.');
    }

    const parentNode =
      normalizePath(parentPath) === normalizePath(workspacePath)
        ? null
        : nodeByPath.get(normalizePath(parentPath));

    if (parentNode && parentNode.type !== 'workspace') {
      throw new Error('문서 아래에는 그룹을 생성할 수 없습니다.');
    }

    const newGroup: WorkspaceStoreGroup = {
      id: crypto.randomUUID(),
      type: 'workspace',
      name: safeName,
      parentId: parentNode?.id ?? null,
      description: '',
      coverPath: '',
      novelType,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };

    await context.withWorkspaceRepositories(workspacePath, async ({ db, groupInfo, workspaceNodes }) => {
      await withTransaction(db, async () => {
        await workspaceNodes.insertNode(store, newGroup, path.join(parentPath, safeName));
        await groupInfo.insertGroupInfo(newGroup);
      });
    });

    return {
      id: newGroup.id,
      name: safeName,
      path: path.join(parentPath, safeName),
    };
  }

  async function renameWorkspace(oldWorkspacePath: string, newName: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const safeNewName = sanitizeNodeName(newName);
    const { node } = await context.getStoreNodeByPath(oldWorkspacePath);

    if (!node || node.type !== 'workspace') {
      throw new Error('수정할 그룹을 찾을 수 없습니다.');
    }

    await context.withWorkspaceRepositories(workspacePath, async ({ workspaceNodes }) => {
      await workspaceNodes.updateNodeDetails(node.id, {
        name: safeNewName,
        path: path.join(node.parentPath, safeNewName),
        updatedAt: now(),
      });
    });

    return {
      oldPath: oldWorkspacePath,
      newPath: path.join(node.parentPath, safeNewName),
    };
  }

  async function removeWorkspace(targetPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const { store, node } = await context.getStoreNodeByPath(targetPath);

    if (!node || node.type !== 'workspace') {
      throw new Error('삭제할 그룹을 찾을 수 없습니다.');
    }

    const removedGroupIds = collectGroupDescendantIds(store.groups, node.id);
    const deletedAt = now();
    const removedDocumentIds = collectDocumentIdsByGroupIds(store.documents, removedGroupIds);
    const removedNodeIds = new Set([...removedGroupIds, ...removedDocumentIds]);

    await context.withWorkspaceRepositories(workspacePath, async ({ db, recentVisits, workspaceNodes }) => {
      await withTransaction(db, async () => {
        await workspaceNodes.markNodesDeleted([...removedNodeIds], deletedAt, deletedAt);
        await recentVisits.deleteRecentVisitsByIds([...removedNodeIds]);
      });
    });

    return {
      removed: true,
      path: targetPath,
    };
  }

  async function purgeWorkspace(targetPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const { store, node } = await context.getStoreNodeByPath(targetPath);

    if (!node || node.type !== 'workspace') {
      throw new Error('영구 삭제할 그룹을 찾을 수 없습니다.');
    }

    const removedGroupIds = collectGroupDescendantIds(store.groups, node.id);
    const removedGroups = store.groups.filter((group: WorkspaceStoreGroup) => removedGroupIds.has(group.id));
    const removedDocuments = store.documents.filter((document: WorkspaceStoreDocument) =>
      removedGroupIds.has(document.parentId ?? ''),
    );
    const removedDocumentIds = new Set(removedDocuments.map((document: WorkspaceStoreDocument) => document.id));
    const removedNodeIds = new Set([...removedGroupIds, ...removedDocumentIds]);

    for (const group of removedGroups) {
      await context.removeCoverImage(group.coverPath);
    }

    for (const document of removedDocuments) {
      await context.removeDocumentContentFile(workspacePath, document.id);
    }

    await context.withWorkspaceRepositories(workspacePath, async ({ db, recentVisits, workspaceNodes }) => {
      await withTransaction(db, async () => {
        await recentVisits.deleteRecentVisitsByIds([...removedNodeIds]);
        await workspaceNodes.deleteNodesByIds([...removedNodeIds]);
      });
    });

    return {
      removed: true,
      path: targetPath,
    };
  }

  async function restoreWorkspace(targetPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const { store, node } = await context.getStoreNodeByPath(targetPath);

    if (!node || node.type !== 'workspace') {
      throw new Error('복구할 워크스페이스를 찾을 수 없습니다.');
    }

    const { groupsById } = buildNodeInfo(workspacePath, store);
    const restoredSubtreeGroupIds = collectGroupDescendantIds(store.groups, node.id);
    const restoredAncestorGroupIds = collectGroupAncestorIds(groupsById, node.parentId ?? null);
    const restoredTargetGroupIds = new Set([
      ...restoredSubtreeGroupIds,
      ...restoredAncestorGroupIds,
    ]);
    const restoredDocumentIds = collectDocumentIdsByGroupIds(
      store.documents,
      restoredSubtreeGroupIds,
    );
    const restoredAt = now();

    await context.withWorkspaceRepositories(workspacePath, async ({ workspaceNodes }) => {
      await workspaceNodes.markNodesDeleted(
        [...restoredTargetGroupIds, ...restoredDocumentIds],
        null,
        restoredAt,
      );
    });

    return {
      restored: true,
      path: targetPath,
    };
  }

  async function getWorkflowInfo(workflowPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const normalizedWorkflowPath = normalizePath(workflowPath);
    const store = await ensureStore(workspacePath);

    const workflowData =
      normalizedWorkflowPath === normalizePath(workspacePath)
        ? buildRootWorkspaceNode(workspacePath, store)
        : (buildNodeInfo(workspacePath, store).nodeByPath.get(normalizedWorkflowPath) ?? null);

    if (!workflowData) {
      throw new Error('워크스페이스를 찾을 수 없습니다.');
    }

    if (!workflowData.deletedAt) {
      await context.addRecentVisit(workflowData.path, workflowData);
    }

    return workflowData;
  }

  async function updateWorkspaceInfo(workflowPath: string, data: WorkspaceUpdatePayload) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const normalizedWorkflowPath = normalizePath(workflowPath);
    const store = await ensureStore(workspacePath);
    const workspaceData = data.workspace ?? {};

    if (normalizedWorkflowPath === normalizePath(workspacePath)) {
      const updatedAt = now();
      const nextWorkspace = {
        ...store.workspace,
        name: data.name ?? store.workspace.name,
        description: workspaceData.description ?? store.workspace.description ?? '',
        coverPath: workspaceData.coverPath ?? store.workspace.coverPath ?? '',
        deletedAt: data.deletedAt ?? store.workspace.deletedAt ?? null,
        updatedAt,
      };

      await context.withWorkspaceRepositories(workspacePath, async ({ db, groupInfo, workspaceNodes }) => {
        await withTransaction(db, async () => {
          await workspaceNodes.updateNodeDetails(store.workspace.id, {
            name: nextWorkspace.name,
            path: workspacePath,
            updatedAt,
          });
          if ('deletedAt' in data) {
            await workspaceNodes.markNodesDeleted([store.workspace.id], nextWorkspace.deletedAt, updatedAt);
          }
          await groupInfo.updateGroupInfo(store.workspace.id, {
            description: nextWorkspace.description,
            coverPath: nextWorkspace.coverPath,
          });
        });
      });

      return buildRootWorkspaceNode(workspacePath, {
        ...store,
        workspace: nextWorkspace,
      });
    }

    const { nodeByPath } = buildNodeInfo(workspacePath, store);
    const targetNode = nodeByPath.get(normalizedWorkflowPath);

    if (!targetNode || targetNode.type !== 'workspace') {
      throw new Error('수정할 워크스페이스를 찾을 수 없습니다.');
    }

    const currentGroup = store.groups.find((group) => group.id === targetNode.id);
    if (!currentGroup) {
      throw new Error('수정할 워크스페이스 메타데이터를 찾을 수 없습니다.');
    }

    const updatedAt = now();
    const nextGroup = {
      ...currentGroup,
      name: data.name ?? currentGroup.name,
      description: workspaceData.description ?? currentGroup.description ?? '',
      coverPath: workspaceData.coverPath ?? currentGroup.coverPath ?? '',
      deletedAt: data.deletedAt ?? currentGroup.deletedAt ?? null,
      updatedAt,
    };

    await context.withWorkspaceRepositories(workspacePath, async ({ db, groupInfo, workspaceNodes }) => {
      await withTransaction(db, async () => {
        await workspaceNodes.updateNodeDetails(nextGroup.id, {
          name: nextGroup.name,
          path: path.join(targetNode.parentPath, nextGroup.name),
          updatedAt,
        });
        if ('deletedAt' in data) {
          await workspaceNodes.markNodesDeleted([nextGroup.id], nextGroup.deletedAt, updatedAt);
        }
        await groupInfo.updateGroupInfo(nextGroup.id, {
          description: nextGroup.description,
          coverPath: nextGroup.coverPath,
        });
      });
    });

    const nextStore = await ensureStore(workspacePath);
    return context.getUpdatedNodeById(workspacePath, nextStore, targetNode.id);
  }

  async function getWorkspaceTree(targetPath?: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const store = await ensureStore(workspacePath);
    const tree = buildTreeNodes(workspacePath, store);

    if (!targetPath) {
      return tree;
    }

    const normalizedTargetPath = normalizePath(targetPath);
    if (normalizedTargetPath === normalizePath(workspacePath)) {
      return [
        {
          ...buildRootWorkspaceNode(workspacePath, store),
          children: tree,
        },
      ];
    }

    const stack = [...tree];

    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) {
        continue;
      }

      if (normalizePath(node.path) === normalizedTargetPath) {
        return [node];
      }

      if (node.children) {
        stack.push(...node.children);
      }
    }

    return [];
  }

  async function getTrashItems() {
    const workspacePath = await context.getCurrentWorkspacePath();
    const store = await ensureStore(workspacePath);

    return buildTrashNodes(workspacePath, store);
  }

  return {
    createWorkspace,
    getTrashItems,
    getWorkflowInfo,
    getWorkspaceTree,
    purgeWorkspace,
    removeWorkspace,
    renameWorkspace,
    restoreWorkspace,
    updateWorkflowInfo: updateWorkspaceInfo,
    updateWorkspaceInfo,
  };
}

