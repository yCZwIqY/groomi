import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  WorkspaceStoreDocument,
  WorkspaceStoreGroup,
  WorkspaceStoreRecentVisit,
} from './store-types.js';

export function now() {
  return new Date().toISOString();
}

export function nextDeletionTime(nodes: { deletedAt?: string | null }[]) {
  // Distinguish deletion batches even within the same millisecond or after a
  // clock change, so restoring a group cannot revive an older trash item.
  const previous = nodes.reduce(
    (latest, node) => Math.max(latest, node.deletedAt ? Date.parse(node.deletedAt) || 0 : 0),
    0,
  );
  return new Date(Math.max(Date.now(), previous + 1)).toISOString();
}

export function normalizePath(targetPath: string) {
  return path.resolve(targetPath);
}

export function toFileSystemPath(targetPath: string) {
  if (typeof targetPath === 'string' && targetPath.startsWith('file://')) {
    return fileURLToPath(targetPath);
  }

  return targetPath;
}

export function mergeRecentVisits(
  recentVisits: WorkspaceStoreRecentVisit[] = [],
  visit: WorkspaceStoreRecentVisit,
  max = 10,
) {
  return [
    visit,
    ...recentVisits.filter((item) => item?.id !== visit.id && item?.path !== visit.path),
  ].slice(0, max);
}

export function sanitizeNodeName(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('이름이 비어 있습니다.');
  }

  if (/[\\/:*?"<>|]/.test(trimmedName)) {
    throw new Error('이름에 사용할 수 없는 문자가 포함되어 있습니다.');
  }

  return trimmedName;
}

export function collectGroupDescendantIds(groups: WorkspaceStoreGroup[], targetId: string) {
  const descendants = new Set([targetId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const group of groups) {
      if (group.parentId && descendants.has(group.parentId) && !descendants.has(group.id)) {
        descendants.add(group.id);
        changed = true;
      }
    }
  }

  return descendants;
}

export function collectGroupAncestorIds(
  groupsById: Map<string, WorkspaceStoreGroup>,
  targetParentId: string | null,
) {
  const ancestors = new Set<string>();
  let cursorId = targetParentId;

  while (cursorId) {
    const parent = groupsById.get(cursorId);
    if (!parent || ancestors.has(parent.id)) {
      break;
    }

    ancestors.add(parent.id);
    cursorId = parent.parentId ?? null;
  }

  return ancestors;
}

export function collectDocumentIdsByGroupIds(
  documents: WorkspaceStoreDocument[],
  groupIds: Set<string>,
) {
  const documentIds = new Set<string>();

  for (const document of documents) {
    if (groupIds.has(document.parentId ?? '')) {
      documentIds.add(document.id);
    }
  }

  return documentIds;
}
