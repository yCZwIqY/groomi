import path from 'node:path';

import { getWorkspaceDatabaseFilePath } from '../../common/paths.js';
import {
  initializeSchema,
  withDatabase,
  withTransaction,
  migrateWorkspaceDatabase,
} from '../../db/connection.js';
import { createDocumentInfoRepository } from '../../repositories/document-info-repository.js';
import { createGroupInfoRepository } from '../../repositories/group-info-repository.js';
import { createRecentVisitRepository } from '../../repositories/recent-visit-repository.js';
import { createSettingRepository } from '../../repositories/setting-repository.js';
import { createWorkspaceNodeRepository } from '../../repositories/workspace-node-repository.js';
import { ensureDirectory, pathExists } from '../file-system.js';
import {
  buildStoredDocumentMeta,
  createEmptyStore,
  getNodePath,
  parseRecentVisit,
  toRootWorkspaceNode,
} from './store-mappers.js';
import {
  ensureScriptsDirectory,
  readDocumentContent,
  writeDocumentContent,
} from './script-files.js';
import type {
  NovelType,
  WorkspaceStore,
  WorkspaceStoreDocument,
  WorkspaceStoreGroup,
} from './store-types.js';
import { normalizePath, now } from './shared.js';

export {
  buildStoredDocumentMeta,
  createEmptyStore,
  ensureScriptsDirectory,
  readDocumentContent,
  writeDocumentContent,
};
export type {
  StoredDocumentContent,
  StoredScriptContent,
  WorkspaceStore,
  WorkspaceStoreDocument,
  WorkspaceStoreGroup,
  WorkspaceStoreRecentVisit,
  WorkspaceStoreRoot,
} from './store-types.js';

export async function readStore(workspacePath: string): Promise<WorkspaceStore | null> {
  return withDatabase(workspacePath, async (db) => {
    await initializeSchema(db);

    const workspaceNodes = createWorkspaceNodeRepository(db);
    const groupInfo = createGroupInfoRepository(db);
    const documentInfo = createDocumentInfoRepository(db);
    const recentVisits = createRecentVisitRepository(db);
    const settingRepo = createSettingRepository(db);

    const nodeRows = await workspaceNodes.findAllNodes();
    const groupRows = await groupInfo.findAllGroupInfo();
    const documentRows = await documentInfo.findAllDocumentInfo();
    const recentVisitRows = await recentVisits.findAllRecentVisits();
    const settingInfo = await settingRepo.findSettingInfo();

    const groupInfoById = new Map(groupRows.map((row) => [row.nodeId, row]));
    const documentInfoById = new Map(documentRows.map((row) => [row.nodeId, row]));
    const rootRow = nodeRows.find((row) => row.parentId === null && row.type === 'workspace');

    if (!rootRow) {
      return null;
    }

    return {
      version: 4,
      workspace: {
        id: rootRow.id,
        name: rootRow.name,
        description: groupInfoById.get(rootRow.id)?.description ?? '',
        coverPath: groupInfoById.get(rootRow.id)?.coverPath ?? '',
        novelType: (groupInfoById.get(rootRow.id)?.novelType as NovelType | undefined) ?? 'long',
        createdAt: rootRow.createdAt,
        updatedAt: rootRow.updatedAt,
        deletedAt: rootRow.deletedAt,
      },
      groups: nodeRows
        .filter((row) => row.type === 'workspace' && row.id !== rootRow.id)
        .map(
          (row): WorkspaceStoreGroup => ({
            id: row.id,
            type: 'workspace',
            parentId: row.parentId === rootRow.id ? null : row.parentId,
            name: row.name,
            description: groupInfoById.get(row.id)?.description ?? '',
            coverPath: groupInfoById.get(row.id)?.coverPath ?? '',
            novelType: (groupInfoById.get(row.id)?.novelType as NovelType | undefined) ?? 'long',
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
          }),
        ),
      documents: nodeRows
        .filter((row) => row.type === 'document')
        .map((row): WorkspaceStoreDocument => {
          const info = documentInfoById.get(row.id);

          return {
            id: row.id,
            type: 'document',
            parentId: row.parentId === rootRow.id ? null : row.parentId,
            name: row.name,
            title: info?.title ?? row.name,
            subTitle: info?.subTitle ?? '',
            draftPath: info?.draftPath ?? undefined,
            manuscriptPath: info?.manuscriptPath ?? undefined,
            draftLength: info?.draftCharsWithSpaces ?? 0,
            draftCharsWithoutSpaces: info?.draftCharsWithoutSpaces ?? 0,
            manuscriptLength: info?.manuscriptCharsWithSpaces ?? 0,
            manuscriptCharsWithoutSpaces: info?.manuscriptCharsWithoutSpaces ?? 0,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
          };
        }),
      recentVisits: recentVisitRows.map((row) => parseRecentVisit(row.payload)),
      settingInfo,
    };
  });
}

export async function writeStore(
  workspacePath: string,
  store: WorkspaceStore,
): Promise<WorkspaceStore> {
  const normalizedWorkspacePath = normalizePath(workspacePath);
  const nextStore: WorkspaceStore = {
    ...store,
    version: 4,
    workspace: {
      ...store.workspace,
      updatedAt: now(),
    },
  };

  await ensureDirectory(normalizedWorkspacePath);

  await migrateWorkspaceDatabase(normalizedWorkspacePath);
  await ensureScriptsDirectory(normalizedWorkspacePath);

  await withDatabase(normalizedWorkspacePath, async (db) => {
    await initializeSchema(db);

    const workspaceNodes = createWorkspaceNodeRepository(db);
    const groupInfo = createGroupInfoRepository(db);
    const documentInfo = createDocumentInfoRepository(db);
    const recentVisits = createRecentVisitRepository(db);

    await withTransaction(db, async () => {
      await recentVisits.deleteAllRecentVisits();
      await documentInfo.deleteAllDocumentInfo();
      await groupInfo.deleteAllGroupInfo();
      await workspaceNodes.deleteAllNodes();

      const root = toRootWorkspaceNode(nextStore.workspace);
      await workspaceNodes.insertNode(nextStore, root, normalizedWorkspacePath);
      await groupInfo.insertGroupInfo(root);

      for (const group of nextStore.groups) {
        await workspaceNodes.insertNode(
          nextStore,
          group,
          getNodePath(normalizedWorkspacePath, nextStore, group),
        );
        await groupInfo.insertGroupInfo(group);
      }

      for (const document of nextStore.documents) {
        const parentPath = document.parentId
          ? getNodePath(
              normalizedWorkspacePath,
              nextStore,
              nextStore.groups.find((group) => group.id === document.parentId),
            )
          : normalizedWorkspacePath;
        const documentPath = path.join(parentPath, `${document.name}.json`);

        await workspaceNodes.insertNode(nextStore, document, documentPath);
        await documentInfo.insertDocumentInfo(document);
      }

      await recentVisits.insertRecentVisits(nextStore.recentVisits ?? []);
    });
  });

  return nextStore;
}

export async function ensureStore(workspacePath: string): Promise<WorkspaceStore> {
  const normalizedWorkspacePath = normalizePath(workspacePath);
  const databaseFilePath = getWorkspaceDatabaseFilePath(normalizedWorkspacePath);

  await ensureDirectory(normalizedWorkspacePath);
  await migrateWorkspaceDatabase(normalizedWorkspacePath);

  if (await pathExists(databaseFilePath)) {
    const store = await readStore(normalizedWorkspacePath);

    if (store) {
      return store;
    }
  }

  return writeStore(normalizedWorkspacePath, createEmptyStore(normalizedWorkspacePath));
}
