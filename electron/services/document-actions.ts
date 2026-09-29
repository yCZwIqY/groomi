import path from 'node:path';

import { withTransaction } from '../db/connection.js';
import {
  buildStoredDocumentMeta,
  ensureStore,
  readDocumentContent,
  type WorkspaceStoreDocument,
  writeDocumentContent,
} from './workspace/store.js';
import { buildDocumentNode, buildNodeInfo } from './workspace/nodes.js';
import {
  collectGroupAncestorIds,
  normalizePath,
  now,
  sanitizeNodeName,
} from './workspace/shared.js';
import type { WorkspaceServiceContext } from './workspace-service-context.js';
import type { DocumentUpdatePayload } from './workspace/payloads.js';

export function createDocumentActions(context: WorkspaceServiceContext) {
  async function createDocument(parentPath: string, name?: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const normalizedParentPath = normalizePath(parentPath);
    const documentName = sanitizeNodeName(name || `${Date.now()}`);
    const store = await ensureStore(workspacePath);
    const { nodeByPath } = buildNodeInfo(workspacePath, store);
    const parentNode =
      normalizedParentPath === normalizePath(workspacePath)
        ? null
        : nodeByPath.get(normalizedParentPath);

    if (parentNode && parentNode.type !== 'workspace') {
      throw new Error('문서 아래에는 문서를 생성할 수 없습니다.');
    }

    const document: WorkspaceStoreDocument = {
      id: crypto.randomUUID(),
      type: 'document',
      name: documentName,
      title: documentName,
      subTitle: '',
      parentId: parentNode?.id ?? null,
      createdAt: now(),
      updatedAt: now(),
      draftLength: 0,
      draftCharsWithoutSpaces: 0,
      manuscriptLength: 0,
      manuscriptCharsWithoutSpaces: 0,
      deletedAt: null,
    };

    await writeDocumentContent(workspacePath, document.id, {
      id: document.id,
      title: documentName,
      subTitle: '',
      draft: {
        content: '',
        charsWithSpaces: 0,
        charsWithoutSpaces: 0,
        createdAt: now(),
        updatedAt: now(),
      },
      manuscript: {
        content: '',
        charsWithSpaces: 0,
        charsWithoutSpaces: 0,
        createdAt: now(),
        updatedAt: now(),
      },
    });
    await context.withWorkspaceRepositories(workspacePath, async ({ db, documentInfo, workspaceNodes }) => {
      await withTransaction(db, async () => {
        await workspaceNodes.insertNode(
          store,
          document,
          path.join(normalizedParentPath, `${documentName}.json`),
        );
        await documentInfo.insertDocumentInfo(document);
      });
    });

    return buildDocumentNode(
      document,
      path.join(normalizedParentPath, `${documentName}.json`),
      normalizedParentPath,
    );
  }

  async function getDocument(documentPath: string) {
    const { workspacePath, node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('문서를 찾을 수 없습니다.');
    }

    const content = await readDocumentContent(workspacePath, node.id);
    const document = {
      ...node,
      document: {
        ...node.document,
        title: content.title ?? node.document?.title ?? node.name,
        subTitle: content.subTitle ?? node.document?.subTitle,
        draft: content.draft,
        manuscript: content.manuscript,
        storyMemory: content.storyMemory,
        draftLength: content.draft?.content?.length ?? node.document?.draftLength ?? 0,
        manuscriptLength:
          content.manuscript?.content?.length ?? node.document?.manuscriptLength ?? 0,
        deletedAt: node.document?.deletedAt ?? null,
      },
    };

    if (!document.deletedAt) {
      await context.addRecentVisit(document.path, document);
    }

    return document;
  }

  async function removeDocument(documentPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const { node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('삭제할 문서를 찾을 수 없습니다.');
    }

    const deletedAt = now();
    await context.withWorkspaceRepositories(workspacePath, async ({ db, recentVisits, workspaceNodes }) => {
      await withTransaction(db, async () => {
        await workspaceNodes.markNodesDeleted([node.id], deletedAt, deletedAt);
        await recentVisits.deleteRecentVisitsByIds([node.id]);
      });
    });

    return {
      removed: true,
      path: documentPath,
    };
  }

  async function purgeDocument(documentPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const { node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('영구 삭제할 문서를 찾을 수 없습니다.');
    }

    await context.removeDocumentContentFile(workspacePath, node.id);

    await context.withWorkspaceRepositories(workspacePath, async ({ db, recentVisits, workspaceNodes }) => {
      await withTransaction(db, async () => {
        await recentVisits.deleteRecentVisitsByIds([node.id]);
        await workspaceNodes.deleteNodesByIds([node.id]);
      });
    });

    return {
      removed: true,
      path: documentPath,
    };
  }

  async function restoreDocument(documentPath: string) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const { store, node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('복구할 문서를 찾을 수 없습니다.');
    }

    const { groupsById } = buildNodeInfo(workspacePath, store);
    const restoredAncestorGroupIds = collectGroupAncestorIds(groupsById, node.parentId ?? null);
    const restoredAt = now();

    await context.withWorkspaceRepositories(workspacePath, async ({ workspaceNodes }) => {
      await workspaceNodes.markNodesDeleted([node.id, ...restoredAncestorGroupIds], null, restoredAt);
    });

    return {
      restored: true,
      path: documentPath,
    };
  }

  async function updateDocument(documentPath: string, data: DocumentUpdatePayload) {
    const { workspacePath, store, node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('수정할 문서를 찾을 수 없습니다.');
    }

    const documentData = data.document ?? {};
    const currentContent = await readDocumentContent(workspacePath, node.id);
    const nextContent = {
      ...currentContent,
      id: node.id,
      title: documentData.title ?? currentContent.title ?? node.document?.title ?? node.name,
      subTitle: documentData.subTitle ?? currentContent.subTitle ?? node.document?.subTitle,
      draft: documentData.draft ?? currentContent.draft,
      manuscript: documentData.manuscript ?? currentContent.manuscript,
    };

    const currentDocument = store.documents.find((document: WorkspaceStoreDocument) => document.id === node.id);
    if (!currentDocument) {
      throw new Error('수정할 문서 메타데이터를 찾을 수 없습니다.');
    }

    const updatedAt = now();
    const nextDocument = buildStoredDocumentMeta(
      {
        ...currentDocument,
        name: data.name ?? currentDocument.name,
        updatedAt,
        deletedAt: data.deletedAt ?? currentDocument.deletedAt ?? null,
      },
      nextContent,
    );

    await context.withWorkspaceRepositories(workspacePath, async ({ db, documentInfo, workspaceNodes }) => {
      await withTransaction(db, async () => {
        await workspaceNodes.updateNodeDetails(node.id, {
          name: nextDocument.name,
          path: path.join(node.parentPath, `${nextDocument.name}.json`),
          updatedAt,
        });
        if ('deletedAt' in data) {
          await workspaceNodes.markNodesDeleted([node.id], nextDocument.deletedAt, updatedAt);
        }
        await documentInfo.updateDocumentInfo(nextDocument);
      });
    });
    await writeDocumentContent(workspacePath, node.id, nextContent);

    const nextStore = await ensureStore(workspacePath);
    const updatedNode = context.getUpdatedNodeById(workspacePath, nextStore, node.id);
    return getDocument(updatedNode?.path ?? documentPath);
  }

  return {
    createDocument,
    getDocument,
    purgeDocument,
    removeDocument,
    restoreDocument,
    updateDocument,
  };
}

