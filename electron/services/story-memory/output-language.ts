import { all, run, withDatabase } from '../../db/connection.js';
import { readDocumentContent } from '../workspace/script-files.js';
import {
  inferOutputLanguage,
  type AiOutputLanguage,
  type ResolvedOutputLanguage,
} from '../ai-output-language.js';
import type { WorkspaceStore } from '../workspace/store-types.js';
import { sortChapters } from './chapter-order.js';

export async function resolveGroupOutputLanguage(
  workspacePath: string,
  store: WorkspaceStore,
  parentId: string | null,
  preference: AiOutputLanguage,
  manuscript: string,
): Promise<ResolvedOutputLanguage> {
  const groupId = parentId ?? store.workspace.id;
  return withDatabase(workspacePath, async (db) => {
    await run(
      db,
      "CREATE TABLE IF NOT EXISTS ai_output_languages (groupId TEXT PRIMARY KEY, language TEXT NOT NULL CHECK(language IN ('ko', 'en')))",
    );
    const existing = await all<{ language: ResolvedOutputLanguage }>(
      db,
      'SELECT language FROM ai_output_languages WHERE groupId = ?',
      [groupId],
    );
    if (existing[0]) return existing[0].language;
    // Existing generated prose establishes the language before any new preference is considered.
    let legacyLanguage: ResolvedOutputLanguage | undefined;
    for (const chapter of sortChapters(store.documents, parentId)) {
      const memory = (await readDocumentContent(workspacePath, chapter.id)).storyMemory;
      if (!memory) continue;
      const prose = [
        memory.synopsis,
        ...memory.events.map((event) => event.description),
        ...memory.characters.map((character) => character.summary),
        ...memory.plotHooks.map((hook) => hook.description),
      ]
        .join(' ')
        .trim();
      if (prose) {
        legacyLanguage = inferOutputLanguage(prose);
        break;
      }
    }
    const language =
      legacyLanguage ?? (preference === 'auto' ? inferOutputLanguage(manuscript) : preference);
    await run(db, 'INSERT OR IGNORE INTO ai_output_languages (groupId, language) VALUES (?, ?)', [
      groupId,
      language,
    ]);
    const saved = await all<{ language: ResolvedOutputLanguage }>(
      db,
      'SELECT language FROM ai_output_languages WHERE groupId = ?',
      [groupId],
    );
    return saved[0].language;
  });
}
