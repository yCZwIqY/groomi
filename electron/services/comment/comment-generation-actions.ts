import ollama from 'ollama';
import { readDocumentContent } from '../workspace/store.js';
import { getNovelType, sortChaptersByCreatedAt } from '../story-memory/story-memory-actions.js';
import { getDefaultCommentStyleExamples } from './default-comment-style-examples.js';
import { toGeneratedComment } from './comment-store-actions.js';
import type { WorkspaceServiceContext } from '../workspace-service-context.js';
import type { StoryMemoryCharacter, StoryMemoryEvent } from '../workspace/store-types.js';

type GenerateCommentsPayload = {
  documentPath: string;
  startAge: number;
  endAge: number;
  expertise: number;
  count: number;
};

type RawGeneratedComment = {
  ageGroup: number;
  expertiseLevel: number;
  expertiseLabel: string;
  tone: string;
  usedContext: boolean;
  content: string;
};

type GenerateCommentsResult = {
  comments?: RawGeneratedComment[];
};

const MAX_SAVED_STYLE_EXAMPLES = 12;

const EXPERTISE_LEVELS = [0, 20, 40, 60, 80, 100] as const;
const EXPERTISE_LABELS: Record<number, string> = {
  0: '입문 독자',
  20: '가볍게 즐기는 독자',
  40: '자주 읽는 독자',
  60: '꼼꼼히 읽는 독자',
  80: '창작 경험 보유',
  100: '편집자/비평가',
};

type PersonaSlot = {
  ageGroup: number;
  expertiseLevel: number;
  expertiseLabel: string;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// 요청된 개수만큼 (연령대 x 전문성) 조합을 최대한 고르게 순회시켜, 특정 조합에만 쏠리지 않게 한다.
function buildPersonaSlots({
  startAge,
  endAge,
  expertise,
  count,
}: {
  startAge: number;
  endAge: number;
  expertise: number;
  count: number;
}): PersonaSlot[] {
  const ageSteps: number[] = [];
  for (let age = startAge; age <= endAge; age += 10) {
    ageSteps.push(age);
  }

  const expertiseSteps = EXPERTISE_LEVELS.filter((level) => level <= expertise);

  const combos = shuffle(
    ageSteps.flatMap((ageGroup) =>
      expertiseSteps.map((expertiseLevel) => ({
        ageGroup,
        expertiseLevel,
        expertiseLabel: EXPERTISE_LABELS[expertiseLevel],
      })),
    ),
  );

  return Array.from({ length: count }, (_, index) => combos[index % combos.length]);
}

export function createCommentGenerationActions(context: WorkspaceServiceContext) {
  async function generateComments(payload: GenerateCommentsPayload) {
    const { workspacePath, store, node } = await context.getStoreNodeByPath(payload.documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('댓글을 생성할 문서를 찾을 수 없습니다.');
    }

    const setting = await context.withWorkspaceRepositories(
      workspacePath,
      async ({ settingInfo }) => settingInfo.findSettingInfo(),
    );

    if (!setting.selectedLLMModel) {
      throw new Error('LLM 모델이 선택되지 않았습니다.');
    }

    const content = await readDocumentContent(workspacePath, node.id);

    // 댓글의 직접 대상이 되는 현재 스크립트.
    const targetScript = [
      content.title,
      content.subTitle,
      content.draft?.content,
      content.manuscript?.content,
    ]
      .filter(Boolean)
      .join('\n\n');

    // 단편(독립 회차) 그룹은 화차 간 맥락을 공유하지 않는다.
    const isStandaloneGroup = getNovelType(store, node.parentId ?? null) === 'short';

    // 같은 부모 그룹 안에서 화차 순서(n-2/n-1)를 계산해 맥락을 구성한다.
    const chapters = isStandaloneGroup
      ? []
      : sortChaptersByCreatedAt(store.documents, node.parentId ?? null);
    const currentIndex = chapters.findIndex((chapter) => chapter.id === node.id);
    const earlierSynopsisChapter = currentIndex - 2 >= 0 ? chapters[currentIndex - 2] : null;
    const previousChapter = currentIndex - 1 >= 0 ? chapters[currentIndex - 1] : null;

    const earlierSynopsis = earlierSynopsisChapter
      ? ((await readDocumentContent(workspacePath, earlierSynopsisChapter.id)).storyMemory
          ?.synopsis ?? '')
      : '';

    const previousChapterContent = previousChapter
      ? await readDocumentContent(workspacePath, previousChapter.id)
      : null;
    const previousChapterScript = previousChapterContent
      ? [
          previousChapterContent.title,
          previousChapterContent.subTitle,
          previousChapterContent.draft?.content,
          previousChapterContent.manuscript?.content,
        ]
          .filter(Boolean)
          .join('\n\n')
      : '';
    const majorEvents = previousChapterContent?.storyMemory?.events ?? [];
    const characters = previousChapterContent?.storyMemory?.characters ?? [];

    const savedStyleExamples = await context.withWorkspaceRepositories(
      workspacePath,
      async ({ commentExamples }) =>
        commentExamples.findStyleExamples({
          startAge: payload.startAge,
          endAge: payload.endAge,
          expertise: payload.expertise,
          limit: MAX_SAVED_STYLE_EXAMPLES,
        }),
    );
    const styleExamples = [
      ...filterDefaultStyleExamples({
        defaultExamples: getDefaultCommentStyleExamples(),
        startAge: payload.startAge,
        endAge: payload.endAge,
        expertise: payload.expertise,
      }),
      ...savedStyleExamples,
    ];

    const personaSlots = buildPersonaSlots(payload);

    const { systemPrompt, userPrompt } = buildCommentPrompt({
      ...payload,
      targetTitle: content.title ?? node.name,
      targetScript,
      earlierSynopsis,
      previousChapterScript,
      majorEvents,
      characters,
      styleExamples,
      personaSlots,
    });

    const response = await ollama.chat({
      model: setting.selectedLLMModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      format: 'json',
    });

    const parsed = parseGeneratedComments(response.message.content, personaSlots);

    const savedRows = await context.withWorkspaceRepositories(
      workspacePath,
      async ({ documentComments }) =>
        documentComments.insertComments(
          node.id,
          parsed.comments.map((comment) => ({
            content: comment.content,
            tone: comment.tone,
            ageGroup: comment.ageGroup,
            expertiseLevel: comment.expertiseLevel,
            expertiseLabel: comment.expertiseLabel,
            usedContext: comment.usedContext,
          })),
        ),
    );

    return savedRows.map(toGeneratedComment);
  }

  function buildCommentPrompt({
    startAge,
    endAge,
    count,
    targetTitle,
    targetScript,
    earlierSynopsis,
    previousChapterScript,
    majorEvents,
    characters,
    styleExamples,
    personaSlots,
  }: {
    startAge: number;
    endAge: number;
    count: number;
    targetTitle: string;
    targetScript: string;
    earlierSynopsis: string;
    previousChapterScript: string;
    majorEvents: StoryMemoryEvent[];
    characters: StoryMemoryCharacter[];
    styleExamples: Array<{
      content: string;
      tone?: string | null;
      ageGroup?: number | null;
      expertiseLevel?: number | null;
    }>;
    personaSlots: PersonaSlot[];
  }): { systemPrompt: string; userPrompt: string } {
    const earlierSynopsisText = earlierSynopsis || '없음';
    const previousChapterScriptText = previousChapterScript || '없음 (첫 화)';
    const majorEventsText =
      majorEvents.length > 0
        ? (['상', '중', '하'] as const)
            .map((importance) => {
              const events = majorEvents.filter((event) => event.importance === importance);
              if (events.length === 0) {
                return null;
              }

              return `[${importance}]\n${events.map((event) => `- ${event.description}`).join('\n')}`;
            })
            .filter(Boolean)
            .join('\n')
        : '없음';
    const charactersText =
      characters.length > 0
        ? characters
            .map(
              (character) =>
                `- ${character.name} (${character.keywords.join(', ') || '키워드 없음'})\n  정보: ${character.info}\n  행동 요약: ${character.summary}`,
            )
            .join('\n')
        : '없음';

    const styleExampleText =
      styleExamples.length > 0
        ? styleExamples
            .map(
              (example, index) => `
[EXAMPLE ${index + 1}]
조건: ${formatStyleExampleMeta(example)}
댓글: ${example.content}
`,
            )
            .join('\n')
        : '없음';

    const systemPrompt = `
너는 웹소설 플랫폼의 실제 독자 댓글을 생성하는 시스템이다.

절대 규칙:
- 댓글의 직접 대상은 TARGET_SCRIPT뿐이다.
- GROUP_CONTEXT는 세계관, 인물 관계, 앞뒤 흐름을 이해하기 위한 참고 자료로만 사용한다.
- GROUP_CONTEXT에만 있고 TARGET_SCRIPT에 없는 사건, 설정, 반전, 결말은 일반 감상 댓글에서 직접 언급하지 않는다.
- 단, TARGET_SCRIPT가 GROUP_CONTEXT의 확정된 사건과 모순될 때는 전문성 높은 댓글에서 그 모순을 지적할 수 있다.
- STYLE_EXAMPLES는 댓글의 문체, 길이, 감정 표현, 말줄임 방식을 참고하기 위한 자료다.
- STYLE_EXAMPLES의 내용을 그대로 복사하거나 비슷한 문장으로 바꿔 쓰지 않는다.
- 댓글은 짧고 자연스러운 실제 독자 반응이어야 한다.
- 출력은 반드시 JSON 객체 하나만 반환한다.
- 마크다운, 설명, 코드블록, JSON 밖의 텍스트를 절대 포함하지 않는다.
`;

    const personaSlotsText = personaSlots
      .map(
        (slot, index) =>
          `${index + 1}. ageGroup=${slot.ageGroup}, expertiseLevel=${slot.expertiseLevel}, expertiseLabel="${slot.expertiseLabel}"`,
      )
      .join('\n');

    const userPrompt = `
독자 조건:
- 연령대: ${startAge}대 ~ ${endAge}대
- 생성할 댓글 수: ${count}개

PERSONA_SLOTS (댓글마다 반드시 지켜야 하는 순서와 조건):
${personaSlotsText}

필드 규칙:
- comments 배열의 길이는 정확히 ${count}개이며, i번째 댓글은 PERSONA_SLOTS의 i번째 조건을 그대로 사용한다.
- ageGroup, expertiseLevel, expertiseLabel은 PERSONA_SLOTS에 주어진 값을 절대 바꾸지 않고 그대로 채운다. 이 값들은 이미 연령대/전문성 조합이 골고루 섞이도록 미리 정해둔 것이다.
- tone은 "몰입", "의문", "추측", "아쉬움", "기대", "캐릭터 반응", "분석", "지적" 중 하나만 사용하며, 같은 tone이 전체 댓글의 절반을 넘지 않도록 분산시킨다.
- usedContext는 GROUP_CONTEXT를 댓글 작성에 참고했으면 true, 아니면 false다.
- TARGET_SCRIPT에 대한 맞춤법 검사를 수행하고, 틀린 부분이 있을 경우 댓글 중 하나를 맞춤법 지적 댓글로 변경한다.

댓글 작성 규칙:
1. 현재 스크립트 안에 드러난 장면, 대사, 감정, 전개에 반응한다.
2. 다양한 반응을 섞는다.
3. expertiseLevel이 낮을수록 짧고 감정적이며 구어체에 가깝게 쓴다.
4. expertiseLevel이 높을수록 구체적인 장면 판단, 구성 비판, 오타, 문체, 문장 흐름을 지적한다.
5. ageGroup이 어릴수록 단순하고 직관적인 표현을 쓴다.
6. 모든 댓글이 같은 말투가 되지 않게 한다.
7. STYLE_EXAMPLES가 있으면 문체 밀도, 길이, 구어체 정도를 적극적으로 참고한다.
8. GROUP_CONTEXT와 TARGET_SCRIPT가 모순될 때는 전문성이 높은 댓글에서만 자연스럽게 지적한다.
9. 비판 댓글은 허용하지만 작가 개인 공격보다 장면, 전개, 대사, 캐릭터 행동, 문장 완성도에 대한 반응으로 쓴다.

연속성 검토 규칙:
- 댓글을 만들기 전에 GROUP_CONTEXT에서 확정된 사건, 캐릭터 생사, 관계 변화, 장소, 시간 순서를 먼저 확인한다.
- TARGET_SCRIPT에서 같은 캐릭터나 설정이 다르게 등장하면 연속성 오류 후보로 판단한다.
- 예: 이전 문서에서 죽은 캐릭터가 TARGET_SCRIPT에서 설명 없이 멀쩡히 활동하면 모순으로 지적한다.
- 모순이 발견되면 expertiseLevel 60 이상 댓글 중 최소 1개는 그 모순을 지적한다.
- 모순 지적 댓글의 usedContext는 true로 설정한다.
- 모순 지적은 실제 독자 댓글처럼 짧게 쓴다. 예: "근데 얘 2화에서 죽지 않았나? 왜 갑자기 멀쩡함?"

TARGET_SCRIPT 제목:
${targetTitle}

TARGET_SCRIPT:
${targetScript}

GROUP_CONTEXT (n-2화까지 줄거리):
${earlierSynopsisText}

GROUP_CONTEXT (n-1화 원문):
${previousChapterScriptText}

GROUP_CONTEXT (n-1화까지 주요 사건, 중요도별):
${majorEventsText}

GROUP_CONTEXT (n-1화까지 등장인물 정리):
${charactersText}

STYLE_EXAMPLES:
${styleExampleText}

반환 형식 예시:
{
  "comments": [
    {
      "ageGroup": 20,
      "expertiseLevel": 20,
      "expertiseLabel": "가볍게 즐기는 독자",
      "tone": "몰입",
      "usedContext": false,
      "content": "댓글 내용"
    }
  ]
}
`;

    return { systemPrompt, userPrompt };
  }

  function parseGeneratedComments(
    content: string,
    personaSlots: PersonaSlot[],
  ): { comments: RawGeneratedComment[] } {
    let parsed: GenerateCommentsResult;

    try {
      parsed = JSON.parse(content) as GenerateCommentsResult;
    } catch {
      throw new Error(`댓글 생성 결과를 JSON으로 해석하지 못했습니다: ${content}`);
    }

    if (!Array.isArray(parsed.comments)) {
      throw new Error(`댓글 생성 결과에 comments 배열이 없습니다: ${content}`);
    }

    if (parsed.comments.length !== personaSlots.length) {
      throw new Error(
        `댓글 생성 결과 개수(${parsed.comments.length})가 요청한 개수(${personaSlots.length})와 다릅니다.`,
      );
    }

    // ageGroup/expertiseLevel/expertiseLabel은 모델이 실수로 바꿔도 미리 정해둔 분포가 깨지지 않도록 서버에서 강제로 덮어쓴다.
    const comments = parsed.comments.map((comment, index) => ({
      ...comment,
      ageGroup: personaSlots[index].ageGroup,
      expertiseLevel: personaSlots[index].expertiseLevel,
      expertiseLabel: personaSlots[index].expertiseLabel,
    }));

    return { comments };
  }

  return {
    generateComments,
  };
}

function formatStyleExampleMeta(example: {
  tone?: string | null;
  ageGroup?: number | null;
  expertiseLevel?: number | null;
}) {
  const meta = [
    example.ageGroup !== null && example.ageGroup !== undefined
      ? `${example.ageGroup}대`
      : null,
    example.expertiseLevel !== null && example.expertiseLevel !== undefined
      ? `전문성 ${example.expertiseLevel}`
      : null,
    example.tone,
  ].filter(Boolean);

  return meta.length > 0 ? meta.join(', ') : '미지정';
}

function filterDefaultStyleExamples({
  defaultExamples,
  startAge,
  endAge,
  expertise,
}: {
  defaultExamples: Array<{
    content: string;
    tone?: string | null;
    ageGroup?: number | null;
    expertiseLevel?: number | null;
  }>;
  startAge: number;
  endAge: number;
  expertise: number;
}) {
  return defaultExamples.filter((example) => {
    const matchesAge =
      example.ageGroup === null ||
      example.ageGroup === undefined ||
      (example.ageGroup >= startAge && example.ageGroup <= endAge);
    const matchesExpertise =
      example.expertiseLevel === null ||
      example.expertiseLevel === undefined ||
      example.expertiseLevel <= expertise;

    return matchesAge && matchesExpertise;
  });
}
