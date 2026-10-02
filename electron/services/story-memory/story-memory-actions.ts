import { buildAiChapterText, toAiText } from '../ai-text.js';
import { mergeMemoryChanges } from './merge-memory-changes.js';
import { logGenerationMetrics } from '../ai-generation-metrics.js';
import { getGroupMemory } from './group-memory.js';
import { updateDocumentContentWithMetadata } from '../workspace/script-files.js';
import { run } from '../../db/connection.js';
import { serializeWorkspaceOperation } from '../workspace-operation.js';
import { generateAiJson, resolveAiConfiguration } from '../ai-provider.js';
import { sortChapters } from './chapter-order.js';
import { buildStoryMemoryPrompt } from './story-memory-prompt.js';
import { storyMemorySchema, validateSchema } from './story-memory-schema.js';
import {
  memoryContextFingerprint,
  manuscriptFingerprint,
  isMemoryStale,
} from './memory-context.js';
import { findCharacterByName } from './character-name.js';

import { ensureStore, readDocumentContent } from '../workspace/store.js';
import { normalizePath, now } from '../workspace/shared.js';
import type {
  NovelType,
  StoryMemory,
  StoryMemoryEvent,
  WorkspaceStore,
} from '../workspace/store-types.js';
import type { WorkspaceServiceContext } from '../workspace-service-context.js';

export type StoryMemoryDraft = Omit<StoryMemory, 'generatedAt'>;

export function getNovelType(store: WorkspaceStore, parentId: string | null): NovelType {
  if (!parentId) {
    return store.workspace.novelType ?? 'long';
  }

  const group = store.groups.find((candidate) => candidate.id === parentId);
  return group?.novelType ?? 'long';
}

export function createStoryMemoryActions(context: WorkspaceServiceContext) {
  async function generateStoryMemory(documentPath: string): Promise<StoryMemoryDraft> {
    const {
      workspacePath,
      documentId,
      model,
      standalone,
      knownMemory,
      systemPrompt,
      userPrompt,
      aliases,
      chapterTitle,
      contextFingerprint,
      sourceManuscriptHash,
    } = await serializeWorkspaceOperation(async () => {
      const { workspacePath, store, node } = await context.getStoreNodeByPath(documentPath);

      if (!node || node.type !== 'document') {
        throw new Error('회차 정보를 생성할 문서를 찾을 수 없습니다.');
      }

      const setting = await context.withWorkspaceRepositories(
        workspacePath,
        async ({ settingInfo }) => settingInfo.findSettingInfo(),
      );

      if (
        !(setting.aiProvider === 'openrouter' ? setting.openRouterModel : setting.selectedLLMModel)
      ) {
        throw new Error('LLM 모델이 선택되지 않았습니다.');
      }

      const novelType = getNovelType(store, node.parentId ?? null);
      const standalone = novelType === 'short';

      const currentContent = await readDocumentContent(workspacePath, node.id);
      if (!toAiText(currentContent.manuscript?.content)) {
        throw new Error(
          '회차 정보를 생성할 원고 본문이 없습니다. 원고를 작성한 뒤 다시 시도해주세요. 초고는 회차 정보 생성에 사용되지 않습니다.',
        );
      }
      const currentText = buildAiChapterText(
        {
          title: currentContent.title,
          subTitle: currentContent.subTitle,
          manuscript: currentContent.manuscript,
        },
        node.name,
      );

      let previousMemory: StoryMemory | null = null;

      if (!standalone) {
        const chapters = sortChapters(store.documents, node.parentId ?? null);
        const previous = chapters.slice(
          0,
          chapters.findIndex((chapter) => chapter.id === node.id),
        );
        const events: StoryMemoryEvent[] = [];
        for (const chapter of previous) {
          const memory = (await readDocumentContent(workspacePath, chapter.id)).storyMemory;
          if (!memory) continue;
          previousMemory = memory;
          // Legacy events are cumulative snapshots; replace rather than append them.
          if (memory.eventsMode !== 'chapter') events.length = 0;
          events.push(...memory.events);
        }
        if (previous.length && !previousMemory) {
          throw new Error('이전 회차의 정보가 없습니다. 앞 회차 정보를 먼저 생성해주세요.');
        }
        if (previousMemory)
          previousMemory = {
            ...previousMemory,
            events: [
              ...new Map(
                events
                  .filter((event) => event.importance !== '하')
                  .map((event) => [event.description, event]),
              ).values(),
            ].slice(-40),
          };
      }
      const knownMemory = await getGroupMemory(
        workspacePath,
        store,
        node.parentId ?? null,
        node.id,
        { includeCurrentChapter: false },
      );
      if (!standalone) {
        previousMemory = {
          synopsis: '',
          events: [],
          generatedAt: '',
          ...previousMemory,
          ...knownMemory,
        };
      }

      const { systemPrompt, userPrompt, aliases } = buildStoryMemoryPrompt({
        chapterTitle: currentContent.title ?? node.name,
        currentText,
        previousMemory,
        standalone,
      });

      return {
        workspacePath,
        documentId: node.id,
        model: await resolveAiConfiguration(setting),
        standalone,
        knownMemory,
        systemPrompt,
        userPrompt,
        aliases,
        chapterTitle: currentContent.title ?? node.name,
        contextFingerprint: await memoryContextFingerprint(
          workspacePath,
          store,
          node.parentId ?? null,
          node.id,
        ),
        sourceManuscriptHash: manuscriptFingerprint(currentContent.manuscript!.content),
      };
    });

    const startedAt = performance.now();
    const messages: { role: 'system' | 'user'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    let changes: StoryMemoryDraft | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await generateAiJson(model, messages, {
        schema: storyMemorySchema,
        schemaName: 'story_memory',
        temperature: 0.2,
        numCtx: 32768,
      });
      logGenerationMetrics(
        'story-memory',
        `${model.provider}:${model.model}`,
        startedAt,
        systemPrompt + userPrompt,
        response,
      );
      try {
        changes = parseStoryMemoryDraft(response.message.content, aliases, chapterTitle);
        // Validate partial updates before retrying; no state is saved on failure.
        changes = {
          ...changes,
          ...mergeMemoryChanges(knownMemory, changes),
        };
        break;
      } catch (error) {
        if (attempt === 1) throw error;
        messages.push({
          role: 'user',
          content: `응답 검증 실패: ${error instanceof Error ? error.message : '잘못된 형식'}. 위 입력으로 올바른 JSON을 다시 반환해주세요.`,
        });
      }
    }
    // Regeneration replaces this chapter's revision. Prior chapters only resolve partial updates.
    const draft = {
      ...changes!,
      eventsMode: 'chapter' as const,
      contextFingerprint,
      sourceManuscriptHash,
    };

    if (standalone) {
      draft.synopsis = '';
    }

    const saved = await serializeWorkspaceOperation(async () => {
      const store = await ensureStore(workspacePath);
      const currentNode = context.getUpdatedNodeById(workspacePath, store, documentId);
      if (!currentNode || currentNode.deletedAt) {
        throw new Error('회차 정보를 저장할 문서를 찾을 수 없습니다.');
      }
      return saveStoryMemory(currentNode.path, draft);
    });
    return saved;
  }

  async function saveStoryMemory(
    documentPath: string,
    draft: StoryMemoryDraft,
  ): Promise<StoryMemory> {
    const { workspacePath, store, node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('회차 정보를 저장할 문서를 찾을 수 없습니다.');
    }

    const currentContent = await readDocumentContent(workspacePath, node.id);
    const groupMemory = await getGroupMemory(workspacePath, store, node.parentId ?? null, node.id);
    validateSchema(
      { synopsis: draft.synopsis, events: draft.events, characters: [], plotHooks: [] },
      storyMemorySchema,
    );
    for (const character of draft.characters) {
      if (character.id && !groupMemory.characters.some((item) => item.id === character.id))
        throw new Error('알 수 없는 인물 ID입니다.');
      if (character.status && !['active', 'dead', 'left', 'unknown'].includes(character.status))
        throw new Error('인물 상태가 올바르지 않습니다.');
    }
    for (const hook of draft.plotHooks) {
      if (hook.id && !groupMemory.plotHooks.some((item) => item.id === hook.id))
        throw new Error('알 수 없는 떡밥 ID입니다.');
    }
    const records = mergeMemoryChanges(groupMemory, draft);
    const storyMemory: StoryMemory = {
      eventsMode: draft.eventsMode ?? currentContent.storyMemory?.eventsMode,
      contextFingerprint:
        draft.contextFingerprint ?? currentContent.storyMemory?.contextFingerprint,
      sourceManuscriptHash:
        draft.sourceManuscriptHash ?? currentContent.storyMemory?.sourceManuscriptHash,
      synopsis: draft.synopsis ?? '',
      events: Array.isArray(draft.events) ? draft.events : [],
      characters: records.characters.map((character) => ({
        ...character,
        id:
          character.id ??
          findCharacterByName(groupMemory.characters, character.name)?.id ??
          crypto.randomUUID(),
      })),
      plotHooks: records.plotHooks.map((hook) => ({
        ...hook,
        id:
          hook.id ??
          groupMemory.plotHooks.find(
            (item) => item.description === hook.description && item.plantedAt === hook.plantedAt,
          )?.id ??
          crypto.randomUUID(),
      })),
      generatedAt: now(),
    };

    await updateDocumentContentWithMetadata(
      workspacePath,
      node.id,
      {
        ...currentContent,
        storyMemory,
      },
      async (db) => {
        await run(
          db,
          'INSERT INTO group_memory_revisions (groupId, chapterId, payload) VALUES (?, ?, ?) ON CONFLICT(chapterId) DO UPDATE SET groupId = excluded.groupId, payload = excluded.payload',
          [
            node.parentId ?? store.workspace.id,
            node.id,
            JSON.stringify({
              characters: storyMemory.characters,
              plotHooks: storyMemory.plotHooks,
            }),
          ],
        );
      },
    );
    const projected = await getGroupMemory(workspacePath, store, node.parentId ?? null, node.id);
    return {
      ...storyMemory,
      ...projected,
      stale: await isMemoryStale(workspacePath, store, node.parentId ?? null, node.id, {
        ...currentContent,
        storyMemory,
      }),
    };
  }

  async function getLatestStoryMemory(groupPath: string): Promise<StoryMemory | null> {
    const workspacePath = await context.getCurrentWorkspacePath();
    const store = await ensureStore(workspacePath);
    const isRoot = normalizePath(groupPath) === normalizePath(workspacePath);

    let parentId: string | null;

    if (isRoot) {
      parentId = null;
    } else {
      const { node } = await context.getStoreNodeByPath(groupPath);

      if (!node || node.type !== 'workspace') {
        throw new Error('그룹을 찾을 수 없습니다.');
      }

      parentId = node.id;
    }

    const chapters = sortChapters(store.documents, parentId);
    const lastChapter = chapters.at(-1);
    if (!lastChapter) return null;
    const content = await readDocumentContent(workspacePath, lastChapter.id);
    const groupMemory = await getGroupMemory(workspacePath, store, parentId, lastChapter.id);
    if (!content.storyMemory && !groupMemory.characters.length && !groupMemory.plotHooks.length)
      return null;
    return {
      synopsis: '',
      events: [],
      generatedAt: '',
      ...content.storyMemory,
      ...groupMemory,
      stale: await isMemoryStale(workspacePath, store, parentId, lastChapter.id, content),
    };
  }

  return {
    generateStoryMemory,
    saveStoryMemory,
    getLatestStoryMemory,
  };
}

export function parseStoryMemoryDraft(
  content: string,
  aliases: { characters: Map<string, string>; plotHooks: Map<string, string> },
  chapterTitle: string,
): StoryMemoryDraft {
  const cleaned = content
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  let parsed: StoryMemoryDraft;
  try {
    parsed = JSON.parse(cleaned.slice(first, last + 1));
  } catch {
    throw new Error('회차 정보를 JSON으로 해석하지 못했습니다.');
  }
  validateSchema(parsed, storyMemorySchema);
  for (const character of parsed.characters) {
    if (character.id) {
      const id = aliases.characters.get(character.id);
      if (!id) throw new Error('알 수 없는 인물 ID가 생성되었습니다.');
      character.id = id;
    } else if (
      !character.name ||
      typeof character.info !== 'string' ||
      typeof character.summary !== 'string' ||
      !Array.isArray(character.keywords)
    ) {
      throw new Error('신규 인물은 name, info, keywords, summary가 필요합니다.');
    }
    if (!character.id) character.status ??= 'unknown';
  }
  for (const hook of parsed.plotHooks) {
    if (hook.id) {
      const id = aliases.plotHooks.get(hook.id);
      if (!id) throw new Error('알 수 없는 떡밥 ID가 생성되었습니다.');
      hook.id = id;
    } else {
      if (!hook.description) throw new Error('신규 떡밥은 description이 필요합니다.');
      hook.plantedAt = chapterTitle;
      hook.status ??= 'unresolved';
    }
  }
  return parsed;
}
