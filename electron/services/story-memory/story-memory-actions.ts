import { buildAiChapterText } from '../ai-text.js';
import { mergeMemoryChanges } from './merge-memory-changes.js';
import { logGenerationMetrics } from '../ai-generation-metrics.js';
import { getGroupMemory } from './group-memory.js';
import { updateDocumentContentWithMetadata } from '../workspace/script-files.js';
import { run } from '../../db/connection.js';
import { serializeWorkspaceOperation } from '../workspace-operation.js';
import { generateAiJson, resolveAiConfiguration } from '../ai-provider.js';

import { ensureStore, readDocumentContent } from '../workspace/store.js';
import { normalizePath, now } from '../workspace/shared.js';
import type {
  NovelType,
  StoryMemory,
  StoryMemoryCharacter,
  StoryMemoryEvent,
  StoryMemoryPlotHook,
  WorkspaceStore,
  WorkspaceStoreDocument,
} from '../workspace/store-types.js';
import type { WorkspaceServiceContext } from '../workspace-service-context.js';

export type StoryMemoryDraft = {
  synopsis: string;
  events: StoryMemoryEvent[];
  characters: StoryMemoryCharacter[];
  plotHooks: StoryMemoryPlotHook[];
};

export function sortChaptersByCreatedAt(
  documents: WorkspaceStoreDocument[],
  parentId: string | null,
) {
  return documents
    .filter((document) => document.parentId === parentId && !document.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

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
      existingRevision,
      knownMemory,
      systemPrompt,
      userPrompt,
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
      const currentText = buildAiChapterText(currentContent, node.name);

      let previousMemory: StoryMemory | null = null;

      if (!standalone) {
        const chapters = sortChaptersByCreatedAt(store.documents, node.parentId ?? null);
        const previous = chapters[chapters.findIndex((chapter) => chapter.id === node.id) - 1];
        previousMemory = previous
          ? ((await readDocumentContent(workspacePath, previous.id)).storyMemory ?? null)
          : null;
      }
      const knownMemory = await getGroupMemory(
        workspacePath,
        store,
        node.parentId ?? null,
        node.id,
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

      const { systemPrompt, userPrompt } = buildStoryMemoryPrompt({
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
        existingRevision: {
          characters: currentContent.storyMemory?.characters ?? [],
          plotHooks: currentContent.storyMemory?.plotHooks ?? [],
        },
        knownMemory,
        systemPrompt,
        userPrompt,
      };
    });

    const startedAt = performance.now();
    const response = await generateAiJson(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    logGenerationMetrics(
      'story-memory',
      `${model.provider}:${model.model}`,
      startedAt,
      systemPrompt + userPrompt,
      response,
    );
    const changes = parseStoryMemoryDraft(response.message.content);
    const draft = { ...changes, ...mergeMemoryChanges(existingRevision, knownMemory, changes) };

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
    const storyMemory: StoryMemory = {
      synopsis: draft.synopsis ?? '',
      events: Array.isArray(draft.events) ? draft.events : [],
      characters: (Array.isArray(draft.characters) ? draft.characters : []).map((character) => ({
        ...character,
        id:
          character.id ??
          groupMemory.characters.find((item) => item.name === character.name)?.id ??
          crypto.randomUUID(),
      })),
      plotHooks: (Array.isArray(draft.plotHooks) ? draft.plotHooks : []).map((hook) => ({
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
    return { ...storyMemory, ...projected };
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

    const chapters = sortChaptersByCreatedAt(store.documents, parentId);
    const lastChapter = chapters.at(-1);
    if (!lastChapter) return null;
    const content = await readDocumentContent(workspacePath, lastChapter.id);
    const groupMemory = await getGroupMemory(workspacePath, store, parentId, lastChapter.id);
    if (!content.storyMemory && !groupMemory.characters.length && !groupMemory.plotHooks.length)
      return null;
    return { synopsis: '', events: [], generatedAt: '', ...content.storyMemory, ...groupMemory };
  }

  return {
    generateStoryMemory,
    saveStoryMemory,
    getLatestStoryMemory,
  };
}

function buildStoryMemoryPrompt({
  chapterTitle,
  currentText,
  previousMemory,
  standalone,
}: {
  chapterTitle: string;
  currentText: string;
  previousMemory: StoryMemory | null;
  standalone: boolean;
}) {
  const previousSynopsis = previousMemory?.synopsis || '없음 (첫 화)';
  const previousEvents = previousMemory?.events?.length
    ? previousMemory.events
        .map((event, index) => `${index + 1}. [${event.importance}] ${event.description}`)
        .join('\n')
    : '없음';
  const previousCharacters = previousMemory?.characters?.length
    ? previousMemory.characters
        .map(
          (character) =>
            `- [id:${character.id ?? ''}] ${character.name} (${character.keywords.join(', ') || '키워드 없음'})\n  정보: ${character.info}`,
        )
        .join('\n')
    : '없음';
  const previousPlotHooks = previousMemory?.plotHooks?.length
    ? previousMemory.plotHooks
        .map(
          (hook) =>
            `- [id:${hook.id ?? ''}] [${hook.status === 'resolved' ? 'resolved' : 'unresolved'}] (${hook.plantedAt}) ${hook.description}`,
        )
        .join('\n')
    : '없음';

  const systemPrompt = standalone
    ? `
너는 웹소설 작가를 돕는 스토리 정리 보조 시스템이다.
이 회차는 다른 화와 줄거리가 이어지지 않는 독립된 단편이다. 다른 화의 내용은 참고하지 말고, 오직 이번 화 내용만으로 정리한다.

절대 규칙:
- 출력은 반드시 JSON 객체 하나만 반환한다.
- 마크다운, 설명, 코드블록, JSON 밖의 텍스트를 절대 포함하지 않는다.
- synopsis 필드는 항상 빈 문자열("")로 반환한다.
- events는 이번 화 안에서 발생한 주요 사건을 중요도와 함께 정리한다. importance는 반드시 "상", "중", "하" 중 하나다.
- characters는 이번 화에 등장한 인물을 정리한다. 각 인물의 summary는 이번 화 안에서의 행동을 5줄 이내로 요약한다.
- plotHooks는 이번 화의 복선을 해결 여부와 관계없이 보존한다. status는 "resolved" 또는 "unresolved"로 반환하고 plantedAt은 이번 화 제목을 적는다.
`
    : `
너는 웹소설 작가를 돕는 스토리 정리 보조 시스템이다.
이전 화까지 누적된 줄거리, 주요 사건, 등장인물, 떡밥(해결 상태 포함) 정보를 참고해서 이번 화 내용을 반영한 최신 상태로 갱신한다.

절대 규칙:
- 출력은 반드시 JSON 객체 하나만 반환한다.
- 마크다운, 설명, 코드블록, JSON 밖의 텍스트를 절대 포함하지 않는다.
- synopsis는 이번 화까지의 전체 줄거리를 자연스러운 문단으로 작성한다.
- events는 이번 화까지 발생한 주요 사건을 중요도와 함께 정리한다. importance는 반드시 "상", "중", "하" 중 하나다.
- characters에는 새 인물과 이번 화에서 정보·관계·행동이 변경된 인물만 반환한다. 변화가 없으면 생략한다. 기존 목록은 앱이 보존한다.
- 기존 인물과 떡밥의 id는 반드시 그대로 반환한다. 새로운 항목은 id를 생략한다.
- 이번 화에 새로 등장한 인물은 characters에 추가한다.
- 기존 인물의 info, keywords, summary 중 이번 화 내용으로 바뀌거나 추가된 부분이 있으면 그 인물의 항목만 갱신한다. 변화가 없는 인물은 출력하지 않는다. 기존 인물은 id와 변경된 필드만 반환해도 된다.
- summary는 스토리 진행에 따른 행동을 5줄 이내로 요약한다.
- plotHooks에는 새 떡밥과 이번 화에서 변경·해결된 떡밥만 반환한다. 변경이 없으면 생략한다. 기존 목록은 앱이 보존한다.
- 기존 떡밥을 해결하면 { "id": "기존 ID", "status": "resolved" }만 반환한다. 이미 해결된 떡밥은 출력하지 않는다.
- 인물·떡밥 변화가 없으면 characters와 plotHooks는 빈 배열로 반환한다.
- plotHooks의 plantedAt에는 그 복선이 처음 등장한 화의 제목을 적는다 (이전 화의 plantedAt은 그대로 유지, 새 항목만 이번 화 제목을 사용).
- 이전 화 정보와 이번 화 내용이 모순되면 이번 화 내용을 우선한다.
- 죽었거나 퇴장한 인물은 summary에 그 사실을 반드시 반영한다.
`;

  const userPrompt = `
${
  standalone
    ? ''
    : `이전 화까지의 줄거리:
${previousSynopsis}

이전 화까지의 주요 사건:
${previousEvents}

이 회차까지 등록된 등장인물 (변경된 항목만 출력):
${previousCharacters}

이 회차까지 등록된 떡밥 (새 항목·해결 등 변경만 출력):
${previousPlotHooks}

`
}이번 화 제목:
${chapterTitle}

이번 화 내용:
${currentText}

반환 형식 예시:
{
  "synopsis": "${standalone ? '' : '이번 화까지의 전체 줄거리'}",
  "events": [
    { "description": "사건 설명", "importance": "상" }
  ],
  "characters": [
    {
      "name": "이름",
      "info": "인물에 대한 기본 정보",
      "keywords": ["키워드1", "키워드2"],
      "summary": "스토리에 따른 행동 요약 (최대 5줄)"
    }
  ],
  "plotHooks": [
    { "description": "아직 해결되지 않은 복선 설명", "plantedAt": "떡밥이 처음 등장한 화 제목", "status": "unresolved" }
  ]
}
`;

  return { systemPrompt, userPrompt };
}

function parseStoryMemoryDraft(content: string): StoryMemoryDraft {
  let parsed: Partial<StoryMemoryDraft>;

  try {
    parsed = JSON.parse(content) as Partial<StoryMemoryDraft>;
  } catch {
    throw new Error('회차 정보를 JSON으로 해석하지 못했습니다. 다시 생성해주세요.');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !Array.isArray(parsed.characters) ||
    !Array.isArray(parsed.plotHooks) ||
    !Array.isArray(parsed.events)
  ) {
    throw new Error('생성된 회차 정보 형식이 올바르지 않습니다. 다시 생성해주세요.');
  }

  return {
    synopsis: typeof parsed.synopsis === 'string' ? parsed.synopsis : '',
    events: Array.isArray(parsed.events) ? parsed.events : [],
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    plotHooks: Array.isArray(parsed.plotHooks) ? parsed.plotHooks : [],
  };
}
