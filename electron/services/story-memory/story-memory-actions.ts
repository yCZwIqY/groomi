import { serializeWorkspaceOperation } from '../workspace-operation.js';
import ollama from 'ollama';

import { ensureStore, readDocumentContent, writeDocumentContent } from '../workspace/store.js';
import { normalizePath, now } from '../workspace/shared.js';
import type {
  NovelType,
  StoredDocumentContent,
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

function buildChapterText(content: StoredDocumentContent, fallbackTitle: string) {
  return [
    content.title ?? fallbackTitle,
    content.subTitle,
    content.draft?.content,
    content.manuscript?.content,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function createStoryMemoryActions(context: WorkspaceServiceContext) {
  async function generateStoryMemory(documentPath: string): Promise<StoryMemoryDraft> {
    const {
      workspacePath,
      documentId,
      model,
      standalone,
      previousPlotHooks,
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

      if (!setting.selectedLLMModel) {
        throw new Error('LLM 모델이 선택되지 않았습니다.');
      }

      const novelType = getNovelType(store, node.parentId ?? null);
      const standalone = novelType === 'short';

      const currentContent = await readDocumentContent(workspacePath, node.id);
      const currentText = buildChapterText(currentContent, node.name);

      let previousMemory: StoryMemory | null = null;

      if (!standalone) {
        const chapters = sortChaptersByCreatedAt(store.documents, node.parentId ?? null);
        const currentIndex = chapters.findIndex((chapter) => chapter.id === node.id);
        const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;

        previousMemory = previousChapter
          ? ((await readDocumentContent(workspacePath, previousChapter.id)).storyMemory ?? null)
          : null;
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
        model: setting.selectedLLMModel,
        standalone,
        previousPlotHooks: previousMemory?.plotHooks ?? [],
        systemPrompt,
        userPrompt,
      };
    });

    const response = await ollama.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      format: 'json',
    });

    const draft = parseStoryMemoryDraft(response.message.content);
    // Keep history even when the model omits an existing hook from its response.
    for (const previousHook of previousPlotHooks) {
      const generatedHook = draft.plotHooks.find(
        (hook) =>
          hook.plantedAt === previousHook.plantedAt &&
          hook.description === previousHook.description,
      );
      if (!generatedHook) {
        draft.plotHooks.push(previousHook);
      } else if (previousHook.status === 'resolved') {
        generatedHook.status = 'resolved';
      }
    }

    if (standalone) {
      draft.synopsis = '';
    }

    await serializeWorkspaceOperation(async () => {
      const store = await ensureStore(workspacePath);
      const currentNode = context.getUpdatedNodeById(workspacePath, store, documentId);
      if (!currentNode || currentNode.deletedAt) {
        throw new Error('회차 정보를 저장할 문서를 찾을 수 없습니다.');
      }
      await saveStoryMemory(currentNode.path, draft);
    });
    return draft;
  }

  async function saveStoryMemory(
    documentPath: string,
    draft: StoryMemoryDraft,
  ): Promise<StoryMemory> {
    const { workspacePath, node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('회차 정보를 저장할 문서를 찾을 수 없습니다.');
    }

    const currentContent = await readDocumentContent(workspacePath, node.id);
    const storyMemory: StoryMemory = {
      synopsis: draft.synopsis ?? '',
      events: Array.isArray(draft.events) ? draft.events : [],
      characters: Array.isArray(draft.characters) ? draft.characters : [],
      plotHooks: Array.isArray(draft.plotHooks) ? draft.plotHooks : [],
      generatedAt: now(),
    };

    await writeDocumentContent(workspacePath, node.id, {
      ...currentContent,
      storyMemory,
    });

    return storyMemory;
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
    return content.storyMemory ?? null;
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
            `- ${character.name} (${character.keywords.join(', ') || '키워드 없음'})\n  정보: ${character.info}\n  행동 요약: ${character.summary}`,
        )
        .join('\n')
    : '없음';
  const previousPlotHooks = previousMemory?.plotHooks?.length
    ? previousMemory.plotHooks
        .map(
          (hook) =>
            `- [${hook.status === 'resolved' ? 'resolved' : 'unresolved'}] (${hook.plantedAt}) ${hook.description}`,
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
- characters는 이전 화까지의 등장인물 목록을 기본으로 그대로 유지한다. 이번 화에 등장하지 않는다는 이유만으로 목록에서 임의로 삭제하지 않는다.
- 이번 화에 새로 등장한 인물은 characters에 추가한다.
- 기존 인물의 info, keywords, summary 중 이번 화 내용으로 바뀌거나 추가된 부분이 있으면 그 인물의 항목만 갱신한다. 변화가 없는 인물은 이전 내용을 그대로 유지한다.
- summary는 스토리 진행에 따른 행동을 5줄 이내로 요약한다.
- plotHooks는 복선·약속·암시를 모두 보존한다. 해결된 항목은 삭제하지 말고 status를 "resolved"로, 미해결 항목은 "unresolved"로 반환한다. 이전 항목과 해결 상태를 유지하고 새 항목을 추가한다.
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

이전 화까지의 등장인물 정리:
${previousCharacters}

이전 화까지의 떡밥(해결 상태 포함):
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
    throw new Error(`회차 정보를 JSON으로 해석하지 못했습니다: ${content}`);
  }

  return {
    synopsis: typeof parsed.synopsis === 'string' ? parsed.synopsis : '',
    events: Array.isArray(parsed.events) ? parsed.events : [],
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    plotHooks: Array.isArray(parsed.plotHooks) ? parsed.plotHooks : [],
  };
}
