import { createHash } from 'node:crypto';
import { sortChapters } from './chapter-order.js';
import { readDocumentContent } from '../workspace/script-files.js';
import type { WorkspaceStore, StoredDocumentContent } from '../workspace/store-types.js';

export function manuscriptFingerprint(content: string | undefined) {
  return createHash('sha256')
    .update(content ?? '')
    .digest('hex');
}

export async function isMemoryStale(
  workspacePath: string,
  store: WorkspaceStore,
  parentId: string | null,
  chapterId: string,
  content: StoredDocumentContent,
) {
  const memory = content.storyMemory;
  if (!memory) return false;
  if (
    memory.sourceManuscriptHash !== undefined &&
    memory.sourceManuscriptHash !== manuscriptFingerprint(content.manuscript?.content)
  )
    return true;
  if (memory.contextFingerprint !== undefined)
    return (
      memory.contextFingerprint !==
      (await memoryContextFingerprint(workspacePath, store, parentId, chapterId))
    );
  // Legacy memories have no fingerprints. Detect changes made after their generation.
  const short = parentId
    ? store.groups.find((group) => group.id === parentId)?.novelType === 'short'
    : store.workspace.novelType === 'short';
  if (content.manuscript?.updatedAt && content.manuscript.updatedAt > memory.generatedAt)
    return true;
  if (!short) {
    const chapters = sortChapters(store.documents, parentId);
    for (const chapter of chapters.slice(
      0,
      chapters.findIndex((item) => item.id === chapterId),
    )) {
      const previous = await readDocumentContent(workspacePath, chapter.id);
      if (
        (previous.storyMemory?.generatedAt ?? '') > memory.generatedAt ||
        (previous.manuscript?.updatedAt ?? '') > memory.generatedAt
      )
        return true;
    }
  }
  return false;
}

export async function memoryContextFingerprint(
  workspacePath: string,
  store: WorkspaceStore,
  parentId: string | null,
  chapterId: string,
) {
  const short = parentId
    ? store.groups.find((group) => group.id === parentId)?.novelType === 'short'
    : store.workspace.novelType === 'short';
  const chapters = sortChapters(store.documents, parentId);
  const previous = short
    ? []
    : chapters.slice(
        0,
        chapters.findIndex((item) => item.id === chapterId),
      );
  const context = [];
  for (const chapter of previous) {
    const content = await readDocumentContent(workspacePath, chapter.id);
    context.push([chapter.id, content.manuscript?.content, content.storyMemory]);
  }
  return createHash('sha256').update(JSON.stringify(context)).digest('hex');
}
