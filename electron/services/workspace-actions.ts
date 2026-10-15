import { AppError } from '../common/app-error.js';
import path from 'node:path';

import { ensureStore } from './workspace/store.js';
import {
  buildNodeInfo,
  buildRootWorkspaceNode,
  buildTrashNodes,
  buildTreeNodes,
} from './workspace/nodes.js';
import {
  collectDocumentIdsByGroupIds,
  collectGroupAncestorIds,
  collectGroupDescendantIds,
  normalizePath,
  now,
  nextDeletionTime,
  sanitizeNodeName,
} from './workspace/shared.js';
import { run, withTransaction } from '../db/connection.js';
import type { WorkspaceServiceContext } from './workspace-service-context.js';
import type {
  NovelType,
  WorkspaceStoreDocument,
  WorkspaceStoreGroup,
} from './workspace/store-types.js';
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
      throw new AppError('NAME_DUPLICATE');
    }

    const parentNode =
      normalizePath(parentPath) === normalizePath(workspacePath)
        ? null
        : nodeByPath.get(normalizePath(parentPath));

    if (parentNode && parentNode.type !== 'workspace') {
      throw new AppError('GROUP_UNDER_DOCUMENT_NOT_ALLOWED');
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

    await context.withWorkspaceRepositories(
      workspacePath,
      async ({ db, groupInfo, workspaceNodes }) => {
        await withTransaction(db, async () => {
          await workspaceNodes.insertNode(store, newGroup, path.join(parentPath, safeName));
          await groupInfo.insertGroupInfo(newGroup);
        });
      },
    );

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
      throw new AppError('GROUP_UPDATE_NOT_FOUND');
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
      throw new AppError('GROUP_DELETE_NOT_FOUND');
    }

    const removedGroupIds = collectGroupDescendantIds(store.groups, node.id);
    const deletedAt = nextDeletionTime([...store.groups, ...store.documents]);
    const removedDocumentIds = collectDocumentIdsByGroupIds(store.documents, removedGroupIds);
    const removedNodeIds = new Set([...removedGroupIds, ...removedDocumentIds]);

    await context.withWorkspaceRepositories(
      workspacePath,
      async ({ db, recentVisits, workspaceNodes }) => {
        await withTransaction(db, async () => {
          await workspaceNodes.markNodesDeleted(
            [...removedNodeIds].filter(
              (id) =>
                !store.groups.find((group) => group.id === id)?.deletedAt &&
                !store.documents.find((document) => document.id === id)?.deletedAt,
            ),
            deletedAt,
            deletedAt,
          );
          await recentVisits.deleteRecentVisitsByIds([...removedNodeIds]);
        });
      },
    );

    return {
      removed: true,
      path: targetPath,
    };
  }

  async function purgeWorkspace(targetPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const { store, node } = await context.getStoreNodeByPath(targetPath);

    if (!node || node.type !== 'workspace') {
      throw new AppError('GROUP_PURGE_NOT_FOUND');
    }
    if (!node.deletedAt) throw new AppError('GROUP_NOT_IN_TRASH');

    const removedGroupIds = collectGroupDescendantIds(store.groups, node.id);
    const removedGroups = store.groups.filter((group: WorkspaceStoreGroup) =>
      removedGroupIds.has(group.id),
    );
    const removedDocuments = store.documents.filter((document: WorkspaceStoreDocument) =>
      removedGroupIds.has(document.parentId ?? ''),
    );
    const removedDocumentIds = new Set(
      removedDocuments.map((document: WorkspaceStoreDocument) => document.id),
    );
    const removedNodeIds = new Set([...removedGroupIds, ...removedDocumentIds]);

    await context.withWorkspaceRepositories(
      workspacePath,
      async ({ db, recentVisits, workspaceNodes }) => {
        await withTransaction(db, async () => {
          await recentVisits.deleteRecentVisitsByIds([...removedNodeIds]);
          await workspaceNodes.deleteNodesByIds([...removedNodeIds]);
          for (const id of removedDocumentIds) {
            await run(
              db,
              'INSERT OR IGNORE INTO pending_document_deletions (documentId) VALUES (?)',
              [id],
            );
          }
        });
      },
    );
    for (const group of removedGroups) {
      await context.removeCoverImage(group.coverPath).catch(console.error);
    }
    await context.cleanupDeletedDocumentFiles(workspacePath);

    return {
      removed: true,
      path: targetPath,
    };
  }

  async function restoreWorkspace(targetPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const { store, node } = await context.getStoreNodeByPath(targetPath);

    if (!node || node.type !== 'workspace') {
      throw new AppError('WORKSPACE_RECOVERY_NOT_FOUND');
    }

    const { groupsById } = buildNodeInfo(workspacePath, store);
    const restoredSubtreeGroupIds = collectGroupDescendantIds(store.groups, node.id);
    const restoredAncestorGroupIds = collectGroupAncestorIds(groupsById, node.parentId ?? null);
    const restoredTargetGroupIds = new Set([
      ...restoredSubtreeGroupIds,
      ...restoredAncestorGroupIds,
    ]);
    const restoredDocumentIds = collectDocumentIdsByGroupIds(
      store.documents.filter((document) => document.deletedAt === node.deletedAt),
      restoredSubtreeGroupIds,
    );
    const restoredAt = now();

    await context.withWorkspaceRepositories(workspacePath, async ({ workspaceNodes }) => {
      await workspaceNodes.markNodesDeleted(
        [
          ...[...restoredTargetGroupIds].filter(
            (id) =>
              restoredAncestorGroupIds.has(id) || groupsById.get(id)?.deletedAt === node.deletedAt,
          ),
          ...restoredDocumentIds,
        ],
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
      throw new AppError('WORKSPACE_NOT_FOUND');
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

      await context.withWorkspaceRepositories(
        workspacePath,
        async ({ db, groupInfo, workspaceNodes }) => {
          await withTransaction(db, async () => {
            await workspaceNodes.updateNodeDetails(store.workspace.id, {
              name: nextWorkspace.name,
              path: workspacePath,
              updatedAt,
            });
            if ('deletedAt' in data) {
              await workspaceNodes.markNodesDeleted(
                [store.workspace.id],
                nextWorkspace.deletedAt,
                updatedAt,
              );
            }
            await groupInfo.updateGroupInfo(store.workspace.id, {
              description: nextWorkspace.description,
              coverPath: nextWorkspace.coverPath,
            });
          });
        },
      );

      return buildRootWorkspaceNode(workspacePath, {
        ...store,
        workspace: nextWorkspace,
      });
    }

    const { nodeByPath } = buildNodeInfo(workspacePath, store);
    const targetNode = nodeByPath.get(normalizedWorkflowPath);

    if (!targetNode || targetNode.type !== 'workspace') {
      throw new AppError('WORKSPACE_UPDATE_NOT_FOUND');
    }

    const currentGroup = store.groups.find((group) => group.id === targetNode.id);
    if (!currentGroup) {
      throw new AppError('WORKSPACE_METADATA_NOT_FOUND');
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

    await context.withWorkspaceRepositories(
      workspacePath,
      async ({ db, groupInfo, workspaceNodes }) => {
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
      },
    );

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
