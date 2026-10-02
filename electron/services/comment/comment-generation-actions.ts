import { buildAiChapterText } from '../ai-text.js';
import { logGenerationMetrics } from '../ai-generation-metrics.js';
import { getGroupMemory } from '../story-memory/group-memory.js';
import { serializeWorkspaceOperation } from '../workspace-operation.js';
import { generateAiJson, resolveAiConfiguration } from '../ai-provider.js';
import { readDocumentContent } from '../workspace/store.js';
import { getNovelType, sortChaptersByCreatedAt } from '../story-memory/story-memory-actions.js';
import { getDefaultCommentStyleExamples } from './default-comment-style-examples.js';
import { toGeneratedComment } from './comment-store-actions.js';
import type { WorkspaceServiceContext } from '../workspace-service-context.js';
import type {
  StoryMemoryCharacter,
  StoryMemoryEvent,
  StoryMemoryPlotHook,
} from '../workspace/store-types.js';

type GenerateCommentsPayload = {
  documentPath: string;
  startAge: number;
  endAge: number;
  expertise?: number;
  readingExperiences?: Array<'입문' | '일반' | '숙련' | '창작 경험'>;
  interests?: Array<'캐릭터' | '인물 관계' | '전개' | '세계관' | '문장'>;
  reactions?: Array<'몰입' | '기대' | '의문' | '추측' | '분석' | '아쉬움' | '지적'>;
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

const PERSONA_INTERESTS = ['캐릭터', '인물 관계', '전개', '세계관', '문장'] as const;
const PERSONA_REACTIONS = [
  '몰입',
  '의문',
  '추측',
  '아쉬움',
  '기대',
  '캐릭터 반응',
  '분석',
  '지적',
] as const;
const READING_EXPERIENCE_LEVELS = { 입문: 0, 일반: 40, 숙련: 60, '창작 경험': 80 } as const;

function selectedOptions<T extends string>(
  values: T[] | undefined,
  allowed: readonly T[],
  label: string,
): T[] {
  if (values === undefined) return [...allowed];
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => !allowed.includes(value))
  ) {
    throw new Error(`${label} 항목을 최소 하나 선택해주세요.`);
  }
  return [...new Set(values)];
}

type PersonaSlot = {
  ageGroup: number;
  expertiseLevel: number;
  expertiseLabel: string;
  interest: (typeof PERSONA_INTERESTS)[number];
  reaction: (typeof PERSONA_REACTIONS)[number];
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
  expertise = 0,
  readingExperiences,
  interests: selectedInterests,
  reactions: selectedReactions,
  count,
}: GenerateCommentsPayload): PersonaSlot[] {
  if (
    !Number.isInteger(startAge) ||
    !Number.isInteger(endAge) ||
    startAge < 10 ||
    endAge > 80 ||
    startAge > endAge ||
    startAge % 10 !== 0 ||
    endAge % 10 !== 0 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100 ||
    (!readingExperiences &&
      !EXPERTISE_LEVELS.includes(expertise as (typeof EXPERTISE_LEVELS)[number]))
  ) {
    throw new Error(
      '댓글 생성 조건이 올바르지 않습니다. 연령대, 독서 경험과 댓글 개수를 확인해주세요.',
    );
  }
  const ageSteps: number[] = [];
  for (let age = startAge; age <= endAge; age += 10) {
    ageSteps.push(age);
  }

  const expertiseSteps = readingExperiences
    ? selectedOptions(
        readingExperiences,
        Object.keys(READING_EXPERIENCE_LEVELS) as Array<keyof typeof READING_EXPERIENCE_LEVELS>,
        '독서 경험',
      ).map((experience) => READING_EXPERIENCE_LEVELS[experience])
    : EXPERTISE_LEVELS.filter((level) => level <= expertise);

  const combos = shuffle(
    ageSteps.flatMap((ageGroup) =>
      expertiseSteps.map((expertiseLevel) => ({
        ageGroup,
        expertiseLevel,
        expertiseLabel: readingExperiences
          ? readingExperiences.find(
              (experience) => READING_EXPERIENCE_LEVELS[experience] === expertiseLevel,
            )!
          : EXPERTISE_LABELS[expertiseLevel],
      })),
    ),
  );

  const interests = shuffle(selectedOptions(selectedInterests, PERSONA_INTERESTS, '관심사'));
  const reactions = shuffle(selectedOptions(selectedReactions, PERSONA_REACTIONS, '반응 성향'));

  return Array.from({ length: count }, (_, index) => ({
    ...combos[index % combos.length],
    // 관심사와 반응 성향은 연령·전문성과 독립적으로 고르게 배정한다.
    interest: interests[index % interests.length],
    reaction: reactions[index % reactions.length],
  }));
}

export function createCommentGenerationActions(context: WorkspaceServiceContext) {
  async function generateComments(payload: GenerateCommentsPayload) {
    const requestedSlots = buildPersonaSlots(payload);
    const selectedLevels = [...new Set(requestedSlots.map((slot) => slot.expertiseLevel))];
    const { workspacePath, node, model, personaSlots, systemPrompt, userPrompt } =
      await serializeWorkspaceOperation(async () => {
        const { workspacePath, store, node } = await context.getStoreNodeByPath(
          payload.documentPath,
        );

        if (!node || node.type !== 'document') {
          throw new Error('댓글을 생성할 문서를 찾을 수 없습니다.');
        }

        const setting = await context.withWorkspaceRepositories(
          workspacePath,
          async ({ settingInfo }) => settingInfo.findSettingInfo(),
        );

        if (
          !(setting.aiProvider === 'openrouter'
            ? setting.openRouterModel
            : setting.selectedLLMModel)
        ) {
          throw new Error('LLM 모델이 선택되지 않았습니다.');
        }

        const content = await readDocumentContent(workspacePath, node.id);

        // 댓글의 직접 대상이 되는 현재 스크립트.
        const targetScript = buildAiChapterText(content);

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
          ? buildAiChapterText(previousChapterContent)
          : '';
        const majorEvents = previousChapterContent?.storyMemory?.events ?? [];
        const groupMemory = await getGroupMemory(
          workspacePath,
          store,
          node.parentId ?? null,
          node.id,
        );
        const characters = isStandaloneGroup
          ? (content.storyMemory?.characters ?? [])
          : groupMemory.characters;
        const plotHooks = (
          isStandaloneGroup ? (content.storyMemory?.plotHooks ?? []) : groupMemory.plotHooks
        ).filter((hook) => hook.status !== 'resolved');

        const savedStyleExamples = await context.withWorkspaceRepositories(
          workspacePath,
          async ({ commentExamples }) =>
            commentExamples.findStyleExamples({
              startAge: payload.startAge,
              endAge: payload.endAge,
              expertise: payload.expertise ?? Math.max(...selectedLevels),
              expertiseLevels: payload.readingExperiences
                ? payload.readingExperiences.map(
                    (experience) => READING_EXPERIENCE_LEVELS[experience],
                  )
                : undefined,
              limit: MAX_SAVED_STYLE_EXAMPLES,
              interests: payload.interests,
              reactions: payload.reactions,
            }),
        );
        const styleExamples = [
          ...filterDefaultStyleExamples({
            defaultExamples: getDefaultCommentStyleExamples(),
            startAge: payload.startAge,
            endAge: payload.endAge,
            expertise: payload.expertise ?? Math.max(...selectedLevels),
            expertiseLevels: payload.readingExperiences
              ? payload.readingExperiences.map(
                  (experience) => READING_EXPERIENCE_LEVELS[experience],
                )
              : undefined,
          }),
          ...savedStyleExamples,
        ];

        const personaSlots = requestedSlots;

        const { systemPrompt, userPrompt } = buildCommentPrompt({
          ...payload,
          targetTitle: content.title ?? node.name,
          targetScript,
          earlierSynopsis,
          previousChapterScript,
          majorEvents,
          characters,
          plotHooks,
          styleExamples,
          personaSlots,
        });

        return {
          workspacePath,
          node,
          model: await resolveAiConfiguration(setting),
          personaSlots,
          systemPrompt,
          userPrompt,
        };
      });

    const startedAt = performance.now();
    const response = await generateAiJson(model, [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ]);
    logGenerationMetrics(
      'comments',
      `${model.provider}:${model.model}`,
      startedAt,
      systemPrompt + userPrompt,
      response,
    );

    const parsed = parseGeneratedComments(response.message.content, personaSlots);

    const savedRows = await serializeWorkspaceOperation(() =>
      context.withWorkspaceRepositories(workspacePath, async ({ documentComments }) =>
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
    plotHooks,
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
    plotHooks: StoryMemoryPlotHook[];
    styleExamples: Array<{
      content: string;
      interest?: string | null;
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
- 단, TARGET_SCRIPT가 GROUP_CONTEXT의 확정된 사건과 모순될 때는 그 모순을 지적할 수 있다. 전문성은 설명의 깊이에만 반영한다.
- STYLE_EXAMPLES는 댓글의 문체, 길이, 감정 표현, 말줄임 방식을 참고하기 위한 자료다.
- STYLE_EXAMPLES의 내용을 그대로 복사하거나 비슷한 문장으로 바꿔 쓰지 않는다.
- 댓글은 짧고 자연스러운 실제 독자 반응이어야 한다.
- 출력은 반드시 JSON 객체 하나만 반환한다.
- 마크다운, 설명, 코드블록, JSON 밖의 텍스트를 절대 포함하지 않는다.
`;

    const allowedReactions = [...new Set(personaSlots.map((slot) => slot.reaction))];
    const personaSlotsText = personaSlots
      .map(
        (slot, index) =>
          `${index + 1}. ageGroup=${slot.ageGroup}, expertiseLevel=${slot.expertiseLevel}, expertiseLabel="${slot.expertiseLabel}", interest="${slot.interest}", reaction="${slot.reaction}"`,
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
- interest는 해당 독자가 주로 관심을 갖는 대상이고, reaction은 기본 반응 성향이다. 전문성이나 연령과 독립적으로 적용한다. 두 값은 댓글 작성 지침이며 반환 필드를 추가하지 않는다.
- tone은 선택된 반응 성향(${allowedReactions.join(', ')}) 중 하나만 사용한다. 원고에 근거가 있으면 배정된 reaction을 우선하되, 근거 없는 추측이나 비판을 만들어 성향을 억지로 맞추지 않는다. 배정된 성향이 어울리지 않으면 다른 선택된 성향으로 자연스럽게 반응한다.
- usedContext는 GROUP_CONTEXT를 댓글 작성에 참고했으면 true, 아니면 false다.
- 맞춤법 지적은 명백한 오류가 있고 문장에 관심을 가진 독자의 반응에 어울릴 때만 포함한다. 구어체 대사나 의도된 표현을 오류로 단정하지 않는다.

댓글 작성 규칙:
1. 현재 스크립트 안에 드러난 장면, 대사, 감정, 전개에 반응한다.
2. 다양한 반응을 섞는다.
3. expertiseLevel은 관찰과 해석의 깊이만 결정한다. 낮은 전문성은 눈에 보이는 장면에 반응하고, 높은 전문성은 구체적인 근거로 구성, 인물 행동, 문장이나 복선을 더 깊게 해석할 수 있다.
4. 높은 전문성을 비판이나 부정적 반응과 동일시하지 않는다. 모든 전문성에서 몰입, 칭찬, 기대, 질문, 추측, 아쉬움이 가능하며 반응 성향은 reaction을 참고한다. 낮은 전문성도 명백한 모순을 알아차릴 수 있다.
5. ageGroup은 표현과 말투에 약하게만 반영한다. 나이를 이해력, 지적 수준, 문장 복잡도와 연결하지 않고 특정 연령에 줄임말이나 유행어를 강제하지 않는다.
6. 모든 댓글이 같은 말투가 되지 않게 한다.
7. STYLE_EXAMPLES가 있으면 문체 밀도, 길이, 구어체 정도를 적극적으로 참고한다.
8. GROUP_CONTEXT와 TARGET_SCRIPT가 명백히 모순될 때는 자연스럽게 질문하거나 지적할 수 있다. 전문성이 높을수록 근거와 흐름을 더 깊게 살펴본다.
9. 비판 댓글은 허용하지만 작가 개인 공격보다 장면, 전개, 대사, 캐릭터 행동, 문장 완성도에 대한 반응으로 쓴다.
10. 보고서나 합평문처럼 완결된 문장만 쓰지 말고, 실제 댓글처럼 생략·반말·존댓말·줄임말·ㅋㅋ·ㅠㅠ를 페르소나에 맞게 섞는다.
11. 모든 댓글에 유행어, 초성, ㅋㅋ, ㅠㅠ를 억지로 붙이지 않는다. 한 사람이 쓴 것처럼 같은 어미와 감탄사를 반복하지 않는다.
12. "흥미롭네요", "기대됩니다", "인상적입니다", "아쉬운 것 같습니다"처럼 AI 리뷰로 보이는 상투적인 총평은 피하고, 가능하면 장면 속 구체적인 대사·행동·소품을 집어 반응한다.
13. interest에 따라 캐릭터는 행동·감정, 인물 관계는 대화·관계 변화, 전개는 사건·속도, 세계관은 설정·규칙, 문장은 표현·문장 흐름에 주목한다. 원고에 해당 관심사의 근거가 없으면 실제로 드러난 장면에 반응한다.

연속성 검토 규칙:
- 댓글을 만들기 전에 GROUP_CONTEXT에서 확정된 사건, 캐릭터 생사, 관계 변화, 장소, 시간 순서를 먼저 확인한다.
- TARGET_SCRIPT에서 같은 캐릭터나 설정이 다르게 등장하면 연속성 오류 후보로 판단한다.
- 예: 이전 문서에서 죽은 캐릭터가 TARGET_SCRIPT에서 설명 없이 멀쩡히 활동하면 모순으로 지적한다.
- 명백한 모순이 발견되고 질문·분석·지적 성향이 선택되어 있으면 해당 독자를 우선해 최소 1개 댓글에 반영한다. 선택되지 않은 반응 성향은 강제하지 않는다. 회상, 꿈, 의도적인 정보 은폐나 원고에 제시된 설명을 먼저 확인하고 모순을 단정하지 않는다.
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

GROUP_CONTEXT (미해결 떡밥):
${plotHooks.length ? plotHooks.map((hook) => `- (${hook.plantedAt}) ${hook.description}`).join('\n') : '없음'}

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

    if (!parsed || !Array.isArray(parsed.comments)) {
      throw new Error(`댓글 생성 결과에 comments 배열이 없습니다: ${content}`);
    }

    if (parsed.comments.length < personaSlots.length) {
      throw new Error(
        `댓글 생성 결과 개수(${parsed.comments.length})가 요청한 개수(${personaSlots.length})와 다릅니다.`,
      );
    }

    // ageGroup/expertiseLevel/expertiseLabel은 모델이 실수로 바꿔도 미리 정해둔 분포가 깨지지 않도록 서버에서 강제로 덮어쓴다.
    const allowedReactions = new Set<string>(personaSlots.map((slot) => slot.reaction));
    const comments = parsed.comments.slice(0, personaSlots.length).map((comment, index) => {
      const persona = personaSlots[index];
      if (!persona || !comment || typeof comment.content !== 'string' || !comment.content.trim()) {
        throw new Error(
          `댓글 생성 결과의 ${index + 1}번째 항목이 올바르지 않습니다. 다시 생성해주세요.`,
        );
      }
      return {
        ...comment,
        ageGroup: persona.ageGroup,
        expertiseLevel: persona.expertiseLevel,
        expertiseLabel: persona.expertiseLabel,
        tone: allowedReactions.has(comment.tone) ? comment.tone : persona.reaction,
      };
    });

    return { comments };
  }

  return {
    generateComments,
  };
}

function formatStyleExampleMeta(example: {
  interest?: string | null;
  tone?: string | null;
  ageGroup?: number | null;
  expertiseLevel?: number | null;
}) {
  const meta = [
    example.interest ? `관심사 ${example.interest}` : null,
    example.ageGroup !== null && example.ageGroup !== undefined ? `${example.ageGroup}대` : null,
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
  expertiseLevels,
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
  expertiseLevels?: number[];
}) {
  return defaultExamples.filter((example) => {
    const matchesAge =
      example.ageGroup === null ||
      example.ageGroup === undefined ||
      (example.ageGroup >= startAge && example.ageGroup <= endAge);
    const matchesExpertise =
      example.expertiseLevel === null ||
      example.expertiseLevel === undefined ||
      (expertiseLevels
        ? expertiseLevels.includes(
            example.expertiseLevel === 20
              ? 40
              : example.expertiseLevel === 100
                ? 80
                : example.expertiseLevel,
          )
        : example.expertiseLevel <= expertise);

    return matchesAge && matchesExpertise;
  });
}
