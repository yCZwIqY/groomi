import type { StoryMemoryCharacter, StoryMemoryPlotHook } from '../workspace/store-types.js';
import { normalizeCharacterName, findCharacterByName } from './character-name.js';

export function mergeMemoryChanges(
  known: { characters: StoryMemoryCharacter[]; plotHooks: StoryMemoryPlotHook[] },
  changes: { characters: StoryMemoryCharacter[]; plotHooks: StoryMemoryPlotHook[] },
) {
  const characters: StoryMemoryCharacter[] = [];
  const plotHooks: StoryMemoryPlotHook[] = [];
  for (const change of changes.characters) {
    const previous =
      known.characters.find((item) => change.id && item.id === change.id) ??
      (change.name ? findCharacterByName(known.characters, change.name) : undefined);
    if (change.id && !previous && !change.name)
      throw new Error('알 수 없는 인물 ID가 생성되었습니다. 다시 생성해주세요.');
    // Model-generated IDs are not identities. Only reuse an ID from group records.
    const character = { ...previous, ...change, id: previous?.id };
    if (
      typeof character.name !== 'string' ||
      !character.name.trim() ||
      typeof character.info !== 'string' ||
      typeof character.summary !== 'string' ||
      !Array.isArray(character.keywords) ||
      character.keywords.some((keyword) => typeof keyword !== 'string')
    ) {
      throw new Error('생성된 인물 정보 형식이 올바르지 않습니다. 다시 생성해주세요.');
    }
    const index = characters.findIndex((item) =>
      character.id && item.id
        ? item.id === character.id
        : normalizeCharacterName(item.name) === normalizeCharacterName(character.name),
    );
    if (index < 0) characters.push(character);
    else characters[index] = character;
  }
  for (const change of changes.plotHooks) {
    const previous =
      known.plotHooks.find((item) => change.id && item.id === change.id) ??
      known.plotHooks.find(
        (item) => item.description === change.description && item.plantedAt === change.plantedAt,
      );
    if (change.id && !previous && !change.description)
      throw new Error('알 수 없는 복선 ID가 생성되었습니다. 다시 생성해주세요.');
    const hook = { ...previous, ...change, id: previous?.id };
    if (
      typeof hook.description !== 'string' ||
      !hook.description.trim() ||
      typeof hook.plantedAt !== 'string' ||
      (hook.status !== undefined && !['resolved', 'unresolved'].includes(hook.status))
    ) {
      throw new Error('생성된 복선 정보 형식이 올바르지 않습니다. 다시 생성해주세요.');
    }
    const index = plotHooks.findIndex((item) =>
      hook.id && item.id
        ? item.id === hook.id
        : item.description === hook.description && item.plantedAt === hook.plantedAt,
    );
    if (index < 0) plotHooks.push(hook);
    else plotHooks[index] = hook;
  }
  return { characters, plotHooks };
}
