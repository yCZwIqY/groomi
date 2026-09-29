import path from 'node:path';

import { getWorkspaceScriptDataFilePath } from '../../common/paths.js';
import type {
  StoredDocumentContent,
  StoredDocumentMetaInput,
  WorkspaceStore,
  WorkspaceStoreDocument,
  WorkspaceStoreGroup,
  WorkspaceStoreRecentVisit,
  WorkspaceStoreRoot,
} from './store-types.js';
import { now } from './shared.js';

export function createEmptyStore(workspacePath: string): WorkspaceStore {
  const timestamp = now();

  return {
    version: 3,
    workspace: {
      id: crypto.randomUUID(),
      name: path.basename(workspacePath),
      description: '',
      coverPath: '',
      novelType: 'long',
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
    groups: [],
    documents: [],
    recentVisits: [],
    settingInfo: {
      selectedEmbeddingModel: null,
      selectedLLMModel: null,
    },
  };
}

export function parseRecentVisit(payload: string): WorkspaceStoreRecentVisit {
  return JSON.parse(payload) as WorkspaceStoreRecentVisit;
}

export function buildStoredDocumentMeta(
  document: StoredDocumentMetaInput,
  content: StoredDocumentContent = {},
): WorkspaceStoreDocument {
  return {
    ...document,
    type: 'document',
    parentId: document.parentId ?? null,
    title: content.title ?? document.title ?? document.name,
    subTitle: content.subTitle ?? document.subTitle,
    draftPath: getWorkspaceScriptDataFilePath('', document.id).replace(/^[/\\]/, ''),
    manuscriptPath: getWorkspaceScriptDataFilePath('', document.id).replace(/^[/\\]/, ''),
    draftLength: content.draft?.charsWithSpaces ?? content.draft?.content?.length ?? document.draftLength ?? 0,
    draftCharsWithoutSpaces:
      content.draft?.charsWithoutSpaces ?? document.draftCharsWithoutSpaces ?? 0,
    manuscriptLength:
      content.manuscript?.charsWithSpaces ??
      content.manuscript?.content?.length ??
      document.manuscriptLength ??
      0,
    manuscriptCharsWithoutSpaces:
      content.manuscript?.charsWithoutSpaces ?? document.manuscriptCharsWithoutSpaces ?? 0,
    createdAt: document.createdAt ?? now(),
    updatedAt: document.updatedAt ?? now(),
    deletedAt: document.deletedAt ?? null,
  };
}

export function getNodePath(
  workspacePath: string,
  store: WorkspaceStore,
  node: WorkspaceStoreGroup | WorkspaceStoreDocument | null | undefined,
) {
  if (!node) {
    return workspacePath;
  }

  if (node.id === store.workspace.id) {
    return workspacePath;
  }

  const groupsById = new Map<string, WorkspaceStoreGroup>(
    store.groups.map((group) => [group.id, group]),
  );
  const segments = [node.name];
  let cursor = node;

  while (cursor.parentId) {
    const parent = groupsById.get(cursor.parentId);
    if (!parent) {
      break;
    }

    segments.unshift(parent.name);
    cursor = parent;
  }

  return path.join(workspacePath, ...segments);
}

export function toRootWorkspaceNode(
  workspace: WorkspaceStoreRoot,
): WorkspaceStoreRoot & { type: 'workspace'; parentId: null } {
  return {
    ...workspace,
    type: 'workspace',
    parentId: null,
  };
}
