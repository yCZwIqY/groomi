import type { WorkspaceStoreDocument } from '../workspace/store-types.js';

// The workspace currently has no manual chapter order. Use a stable tie-breaker.
export function sortChapters(documents: WorkspaceStoreDocument[], parentId: string | null) {
  return documents
    .filter((chapter) => chapter.parentId === parentId && !chapter.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
