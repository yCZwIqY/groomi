import { all, run, withDatabase, withTransaction } from '../../db/connection.js';
import { readDocumentContent } from '../workspace/script-files.js';
import { sortChapters } from './chapter-order.js';
import { normalizeCharacterName } from './character-name.js';
import type {
  StoryMemoryCharacter,
  StoryMemoryPlotHook,
  WorkspaceStore,
} from '../workspace/store-types.js';

export type GroupMemoryRevision = {
  characters: StoryMemoryCharacter[];
  plotHooks: StoryMemoryPlotHook[];
};

export async function getGroupMemory(
  workspacePath: string,
  store: WorkspaceStore,
  parentId: string | null,
  chapterId: string,
  options: { includeCurrentChapter?: boolean } = {},
): Promise<GroupMemoryRevision> {
  const novelType = parentId
    ? store.groups.find((group) => group.id === parentId)?.novelType
    : store.workspace.novelType;
  const chapters = sortChapters(store.documents, parentId).filter(
    (chapter) => novelType !== 'short' || chapter.id === chapterId,
  );
  const currentIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
  const visibleChapters = chapters.slice(
    0,
    currentIndex + (options.includeCurrentChapter === false ? 0 : 1),
  );
  const groupId = parentId ?? store.workspace.id;
  const revisions = await withDatabase(workspacePath, async (db) => {
    const rows = await all<{ chapterId: string; payload: string }>(
      db,
      'SELECT chapterId, payload FROM group_memory_revisions WHERE groupId = ?',
      [groupId],
    );
    const records = new Map(
      rows.map((row) => [row.chapterId, JSON.parse(row.payload) as GroupMemoryRevision]),
    );
    // Import legacy chapter snapshots without changing manuscript files.
    const imported: { chapterId: string; revision: GroupMemoryRevision }[] = [];
    for (const chapter of visibleChapters) {
      if (records.has(chapter.id)) continue;
      const memory = (await readDocumentContent(workspacePath, chapter.id)).storyMemory;
      if (!memory) continue;
      const revision = { characters: memory.characters ?? [], plotHooks: memory.plotHooks ?? [] };
      imported.push({ chapterId: chapter.id, revision });
      records.set(chapter.id, revision);
    }
    await withTransaction(db, async () => {
      for (const { chapterId, revision } of imported) {
        await run(
          db,
          'INSERT OR IGNORE INTO group_memory_revisions (groupId, chapterId, payload) VALUES (?, ?, ?)',
          [groupId, chapterId, JSON.stringify(revision)],
        );
      }
    });
    return records;
  });
  const characters = new Map<string, StoryMemoryCharacter>();
  const plotHooks = new Map<string, StoryMemoryPlotHook>();
  for (const chapter of visibleChapters) {
    const revision = revisions.get(chapter.id);
    for (const character of revision?.characters ?? []) {
      const previous = [...characters.values()].find(
        (item) =>
          (character.id && item.id === character.id) ||
          normalizeCharacterName(item.name) === normalizeCharacterName(character.name),
      );
      const id = previous?.id ?? character.id ?? `character:${chapter.id}:${character.name}`;
      characters.set(id, {
        ...character,
        id,
        introducedAt: previous?.introducedAt ?? chapter.id,
        introducedAtTitle: previous?.introducedAtTitle ?? chapter.title,
        recordedAt: chapter.id,
      });
    }
    for (const hook of revision?.plotHooks ?? []) {
      const previous = [...plotHooks.values()].find(
        (item) =>
          (hook.id && item.id === hook.id) ||
          (item.description === hook.description && item.plantedAt === hook.plantedAt),
      );
      const id =
        previous?.id ?? hook.id ?? `hook:${chapter.id}:${hook.plantedAt}:${hook.description}`;
      plotHooks.set(id, {
        ...hook,
        id,
        plantedChapterId: previous?.plantedChapterId ?? chapter.id,
        plantedAt: previous?.plantedAt ?? hook.plantedAt ?? chapter.title,
        resolvedAt:
          hook.status === 'resolved'
            ? previous?.status === 'resolved'
              ? previous.resolvedAt
              : chapter.id
            : undefined,
        resolvedAtTitle:
          hook.status === 'resolved'
            ? previous?.status === 'resolved'
              ? previous.resolvedAtTitle
              : chapter.title
            : undefined,
      });
    }
  }
  return { characters: [...characters.values()], plotHooks: [...plotHooks.values()] };
}
