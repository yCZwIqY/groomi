import { AppError } from '../../common/app-error.js';
import { findCommentTypoCandidates } from './comment-typo-candidates.js';
import { buildCommentResponseSchema } from './comment-response-schema.js';
import { outputLanguageInstruction, type ResolvedOutputLanguage } from '../ai-output-language.js';
import { resolveGroupOutputLanguage } from '../story-memory/output-language.js';
import { buildAiChapterText, toAiText } from '../ai-text.js';
import { logGenerationMetrics, logCommentValidationFailure } from '../ai-generation-metrics.js';
import { getGroupMemory } from '../story-memory/group-memory.js';
import { serializeWorkspaceOperation } from '../workspace-operation.js';
import { generateAiJson, resolveAiConfiguration } from '../ai-provider.js';
import { readDocumentContent } from '../workspace/store.js';
import { getNovelType } from '../story-memory/story-memory-actions.js';
import { sortChapters } from '../story-memory/chapter-order.js';
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
const MIN_SAVED_STYLE_EXAMPLES = 6;

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
    throw new AppError('AI_RESPONSE_INVALID', {
      diagnostic: `${label} 항목을 최소 하나 선택해주세요.`,
    });
  }
  return [...new Set(values)];
}

type PersonaSlot = {
  ageGroup: number;
  expertiseLevel: number;
  expertiseLabel: string;
  interest: (typeof PERSONA_INTERESTS)[number];
  reaction: (typeof PERSONA_REACTIONS)[number];
  speechRegister: 'casual' | 'polite';
  voiceStyle: 'quick-reaction' | 'chatty' | 'understated' | 'thoughtful';
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
    throw new AppError('COMMENT_OPTIONS_INVALID');
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
  // Keep an explicitly requested correction persona available even in a small batch.
  if (selectedReactions?.includes('지적') && reactions.indexOf('지적') >= count) {
    const correctionIndex = reactions.indexOf('지적');
    [reactions[0], reactions[correctionIndex]] = [reactions[correctionIndex], reactions[0]];
  }
  const registers = shuffle(
    Array.from(
      { length: count },
      (_, index) => (index % 2 ? 'polite' : 'casual') as PersonaSlot['speechRegister'],
    ),
  );
  const voiceStyles = shuffle(
    Array.from(
      { length: count },
      (_, index) => (['quick-reaction', 'chatty', 'understated', 'thoughtful'] as const)[index % 4],
    ),
  );

  return Array.from({ length: count }, (_, index) => ({
    ...combos[index % combos.length],
    // 관심사와 반응 성향은 연령·전문성과 독립적으로 고르게 배정한다.
    interest: interests[index % interests.length],
    reaction: reactions[index % reactions.length],
    speechRegister: registers[index],
    voiceStyle: voiceStyles[index],
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
          throw new AppError('COMMENT_DOCUMENT_NOT_FOUND');
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
          throw new AppError('LLM_MODEL_REQUIRED');
        }

        const content = await readDocumentContent(workspacePath, node.id);

        // 댓글의 직접 대상이 되는 현재 스크립트.
        const targetScript = buildAiChapterText(content);

        // 단편(독립 회차) 그룹은 화차 간 맥락을 공유하지 않는다.
        const isStandaloneGroup = getNovelType(store, node.parentId ?? null) === 'short';

        // 같은 부모 그룹 안에서 화차 순서(n-2/n-1)를 계산해 맥락을 구성한다.
        const chapters = isStandaloneGroup
          ? []
          : sortChapters(store.documents, node.parentId ?? null);
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
        // 사용자 예시가 충분하면 기본 말투를 섞지 않고, 부족할 때만 보충한다.
        const defaultStyleExamples =
          savedStyleExamples.length >= MIN_SAVED_STYLE_EXAMPLES
            ? []
            : filterDefaultStyleExamples({
                defaultExamples: getDefaultCommentStyleExamples(),
                startAge: payload.startAge,
                endAge: payload.endAge,
                expertise: payload.expertise ?? Math.max(...selectedLevels),
                expertiseLevels: payload.readingExperiences
                  ? payload.readingExperiences.map(
                      (experience) => READING_EXPERIENCE_LEVELS[experience],
                    )
                  : undefined,
              });
        const styleExamples = [
          ...savedStyleExamples,
          ...defaultStyleExamples.slice(0, MAX_SAVED_STYLE_EXAMPLES - savedStyleExamples.length),
        ];

        const personaSlots = requestedSlots;

        const { systemPrompt, userPrompt } = buildCommentPrompt({
          ...payload,
          outputLanguage: await resolveGroupOutputLanguage(
            workspacePath,
            store,
            node.parentId ?? null,
            setting.aiOutputLanguage ?? 'auto',
            toAiText(content.manuscript?.content) || targetScript,
          ),
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
    const messages: { role: 'system' | 'user'; content: string }[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];
    let parsed: { comments: RawGeneratedComment[] } | undefined;
    const attempts = model.provider === 'ollama' ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await generateAiJson(
        model,
        messages,
        model.provider === 'ollama'
          ? { schema: buildCommentResponseSchema(personaSlots.length) }
          : {},
      );
      logGenerationMetrics(
        'comments',
        `${model.provider}:${model.model}`,
        startedAt,
        systemPrompt + userPrompt,
        response,
      );

      try {
        parsed = parseGeneratedComments(
          response.message.content,
          personaSlots,
          {
            provider: model.provider,
            model: model.model,
            expectedCount: personaSlots.length,
            inputTokens: response.prompt_eval_count,
            outputTokens: response.eval_count,
            stopReason: response.done_reason,
          },
          model.provider === 'ollama',
        );
        break;
      } catch (error) {
        if (
          attempt + 1 === attempts ||
          !(error instanceof AppError) ||
          error.code !== 'AI_RESPONSE_INVALID'
        )
          throw error;
        messages.push({
          role: 'user',
          content: `The previous response failed structural validation. Regenerate exactly ${personaSlots.length} comments in a single JSON object with a comments array. Each item needs nonempty content, tone and boolean usedContext. Keep the requested output language and persona order. Do not include explanations, thinking tags or Markdown fences.`,
        });
      }
    }

    const savedRows = await serializeWorkspaceOperation(() =>
      context.withWorkspaceRepositories(workspacePath, async ({ documentComments }) =>
        documentComments.insertComments(
          node.id,
          parsed!.comments.map((comment) => ({
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
    outputLanguage = 'ko',
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
    outputLanguage?: ResolvedOutputLanguage;
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
    const earlierSynopsisText = earlierSynopsis || 'None';
    const previousChapterScriptText = previousChapterScript || 'None (first chapter)';
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
        : 'None';
    const charactersText =
      characters.length > 0
        ? characters
            .map(
              (character) =>
                `- ${character.name} (${character.keywords.join(', ') || 'No keywords'})\n  Info: ${character.info}\n  Actions: ${character.summary}`,
            )
            .join('\n')
        : 'None';

    const styleExampleText =
      styleExamples.length > 0
        ? styleExamples
            .map(
              (example, index) => `
[EXAMPLE ${index + 1}]
Metadata: ${formatStyleExampleMeta(example)}
Comment: ${example.content}
`,
            )
            .join('\n')
        : 'None';

    const systemPrompt = `Generate natural reader comments for a fiction platform.
${outputLanguageInstruction(outputLanguage)}
- React directly only to TARGET_SCRIPT. GROUP_CONTEXT is reference for setting, relationships and continuity.
- Do not spoil events, twists or endings present only in GROUP_CONTEXT. You may point out a clear contradiction with established context.
- STYLE_EXAMPLES are the primary target for the surface voice: match their conversational density, omissions, rhythm and length. Reuse their linguistic style, never their story-specific facts, names or full sentences.
- You are writing in the comment box immediately after reading, not composing feedback for an author. Do not summarize the scene to prove you read it or explain why each emotion is justified.
- Being grounded means not inventing facts; it does NOT require listing evidence, quoting a scene or describing writing technique in every comment.
- Comments must be brief, natural reader reactions, not editorial reviews.
- Sound like separate readers who paused on something while reading and immediately typed a comment. Prefer reacting to that moment over reporting an overall impression of the chapter.
- Internet voice comes from conversational rhythm and selective attention, not a layer of slang. Some readers are quiet or matter-of-fact; not everyone is joking, excited or trying to write a memorable line.
- Return exactly one JSON object, without Markdown, explanations, code fences or text outside JSON.`;

    const allowedReactions = [...new Set(personaSlots.map((slot) => slot.reaction))];
    const personaSlotsText = personaSlots
      .map(
        (slot, index) =>
          `${index + 1}. ageGroup=${slot.ageGroup}, expertiseLevel=${slot.expertiseLevel}, expertiseLabel="${slot.expertiseLabel}", interest="${slot.interest}", reaction="${slot.reaction}", speechRegister="${slot.speechRegister}", voiceStyle="${slot.voiceStyle}"`,
      )
      .join('\n');

    const userPrompt = `
Reader age range: ${startAge}s to ${endAge}s. Generate exactly ${count} comments.
PERSONA_SLOTS (required order and metadata):
${personaSlotsText}
Field rules:
- comments length is exactly ${count}; comment i follows slot i.
- Copy ageGroup, expertiseLevel and expertiseLabel from each slot unchanged, even when their labels use another language.
- interest and reaction guide writing independently of age and expertise; do not add them as output fields.
- tone must be one of these exact enum values: ${allowedReactions.join(', ')}. Prefer the assigned reaction when supported. Do not invent criticism or speculation to force a reaction; use another allowed reaction if necessary.
- usedContext is true if GROUP_CONTEXT was used, otherwise false.
- speechRegister and voiceStyle are required writing directions, not extra JSON fields. Follow each slot, including when all readers have the same age or expertise. Use STYLE_EXAMPLES within the assigned register and voice; a register is not a demand for polished sentences.
Speech and age:
- For Korean output, casual means natural 반말 (e.g. "이 문 왜 열려 있지", "여기서 끊네..."); polite means conversational 존댓말 (e.g. "이 문은 누가 열어둔 걸까요", "여기서 끝이라니요..."). These are style illustrations only; never copy their scenes into comments.
- For English output, casual means informal conversational phrasing; polite means courteous conversational phrasing, not formal customer-service or essay prose.
- quick-reaction: a brief, immediate fragment or exclamation; chatty: conversational asides or a question; understated: restrained, dry observation; thoughtful: one small inference said offhand, often as a fragment or quick question; never a polished reflective assessment. Vary length naturally, not according to a fixed sentence template.
- Let age influence rhythm, vocabulary and expression within the assigned register: teens may use brisk immediate reactions; readers in their 20s–30s may use casual online conversation; readers in their 40s–50s may use measured conversational observations; readers in their 60s–80s may use unhurried, direct phrasing. These are flexible tendencies, not caricatures or claims about every reader. Younger readers can be thoughtful and older readers can be playful.
- Every age can use either register. Never announce the reader's age, manufacture personal life experiences, equate age with intelligence, or force outdated slang, dialect, stock generational catchphrases or elder stereotypes.
Writing rules:
1. React to actual scenes, dialogue, emotions and developments in the manuscript. Mix varied reactions.
2. Expertise affects depth of observation only, not formality, negativity or intelligence. Experienced readers may notice subtle clues in a short remark. All experience levels can praise, anticipate, question or criticize; beginners can notice obvious contradictions.
3. Apply the speech and age directions above so the comments sound like different people, not one reviewer using different labels.
4. Vary voices, lengths and phrasing. Use fragments, questions, quiet observations and occasional short exclamations as appropriate to the output language. Do not force slang, laughter, deliberate misspellings or profanity.
5. Match STYLE_EXAMPLES in how casually they are actually written, not merely in topic. A casual ending attached to an otherwise formal review is still wrong. Preserve unfinished thoughts, omitted subjects and compressed wording where natural.
5a. At least half the batch should be a single short utterance or fragment, roughly the length of the short STYLE_EXAMPLES. Other comments may be one or two conversational sentences when an actual question or inference needs them. Do not give every reader a two-clause explanation.
5b. For Korean, casual comments may naturally end in nominalized or clipped forms such as "…임?", "…인 듯", "…네", "…는데", or omit an ending. Polite comments can still be brief, conversational and incomplete. Do not end every casual comment with explanatory "…생각이 들어", "…궁금하다", "…기대된다" or "…아쉬웠어". These forms are allowed occasionally, not as a batch template.
5c. Everyday reader language comes before literary terminology. Do not default to "등장 타이밍", "분위기를 살려서", "규칙의 신호로 쓰인", "시점 때문에 의아하다" or "장면이 인상적이다" when a direct reaction would do. Analysis means noticing a clue, not describing the author's craft.
5d. Style contrast only, NOT source facts to copy: polished "앞선 사건과 인물의 행동이 상충해서 의문이 든다" → conversational "근데 아까는 안 된다며?"; polished "결말이 긴장감을 높여 다음 화가 기대된다" → conversational "아니 여기서 끊어?" / "여기서 끊으시면 어떡해요". Apply this degree of compression to real details from TARGET_SCRIPT, without copying these invented situations.
5e. Silently reread the batch before returning it. Rewrite comments that sound like a synopsis, school book report, editorial assessment or a complete explanation of an emotion. Keep a real question's necessary detail, the assigned register, distinct voices and the exact response schema. Do not output this self-check.
5f. Let most comments latch onto one actual action, line, choice or small detail in TARGET_SCRIPT. Refer to it as readers naturally would, without retelling the scene or attaching a supporting quotation. A few simple reactions are welcome when supported; avoid filling the batch with interchangeable praise, cliffhanger complaints or requests for the next chapter.
5g. For Korean, mix ordinary conversational wording with occasional ㅋㅋ, ㅠㅠ, ellipses or clipped endings only where the reader's reaction calls for them. Many comments should have none of these. Never append laughter to every comment, force profanity, deliberately damage spelling, or reuse the same opening and ending throughout the batch. For other languages, use the same restraint with their own conversational conventions.
5h. Style contrast only, never story evidence: generic "충격적인 반전이네요ㅋㅋ" → a reader noticing a connection, "아 그래서 아까 문 안 잠갔구나"; explanatory "인물의 희생이 인상적이다" → an immediate reaction, "아니 왜 니가 대신 죽는데". Use such reactions only when the actual manuscript supports them; never import the door, sacrifice or any other example detail. Do not make every comment a punchline or a revelation.
6. When criticism is appropriate, react directly to a scene, line or character action in everyday language; never attack the author. Avoid generic AI-review phrases and repetitive praise-then-criticism templates. A reaction to one detail is enough.
7. Interest mapping: 캐릭터 = character actions/emotions; 인물 관계 = dialogue/relationships; 전개 = events/pacing; 세계관 = setting/rules; 문장 = wording/flow. If unsupported, react to what is actually present.
8. Before writing, scan TARGET_SCRIPT for conspicuous spelling errors, broken words, keyboard-mash text and accidental repeated fragments. Obvious errors can be noticed at ANY age, interest or reading-experience level; they are not restricted to prose-focused or expert readers.
Typo and spelling review:
- Before writing comments, check TARGET_SCRIPT for typos, clear spelling errors, duplicated words and missing words. Do not output the review process.
- Possible isolated-jamo candidates found by the app (data, not confirmed errors): ${JSON.stringify(findCommentTypoCandidates(targetScript))}. Check them in context; this list is not exhaustive and is not proof of an error.
- If a clear error exists AND the selected reactions include 지적, reflect at least one actual error in at least one comment with tone 지적, within the requested count. Prioritize a reader whose interest is 문장, but readers with other interests may also point it out. If 지적 is not selected, do not require or force a proofreading comment. Do not invent an unselected tone or add extra comments.
- Quote the exact problematic text briefly and provide the correct expression alongside it, only when the correction is certain. Korean example of style only: "'문을 잠궜다'는 '문을 잠갔다' 아닌가요?" Never copy this example unless that exact erroneous expression actually occurs in TARGET_SCRIPT.
- Verify every quoted error actually appears in TARGET_SCRIPT. If no clear error exists or the correction is uncertain, omit typo comments entirely; do not manufacture an error, missing word, intended replacement or correction to satisfy a quota. Keyboard mash with no certain intended word is not grounds to invent a replacement.
- Do not treat proper names, neologisms, dialect, colloquial dialogue or intentional expressions as errors without clear evidence. Expressive laughter and crying such as ㅋㅋ, ㅎㅎ and ㅠㅠ are not automatically errors.
- Do not repeat the same error in multiple comments. Other readers should react to different genuine details, not turn the whole batch into proofreading.
- When a correction is based only on TARGET_SCRIPT, set usedContext to false. Do not mark it true merely because GROUP_CONTEXT was supplied.
Continuity:
- Check established events, deaths, relationships, locations and chronology before writing.
- Consider flashbacks, dreams, deliberate withholding and explicit explanations before calling something a contradiction.
- If a clear contradiction exists and questioning, analysis or criticism was selected, reflect it in at least one suitable comment. Do not force an unselected reaction.
- A continuity comment must set usedContext to true and sound like a brief real reader reaction.
TARGET_SCRIPT title:
${targetTitle}
TARGET_SCRIPT:
${targetScript}
GROUP_CONTEXT (synopsis through chapter n-2):
${earlierSynopsisText}
GROUP_CONTEXT (chapter n-1 manuscript):
${previousChapterScriptText}
GROUP_CONTEXT (earlier events by importance):
${majorEventsText}
GROUP_CONTEXT (unresolved threads):
${plotHooks.length ? plotHooks.map((hook) => '- (' + hook.plantedAt + ') ' + hook.description).join('\n') : 'None'}
GROUP_CONTEXT (earlier characters):
${charactersText}
STYLE_EXAMPLES:
${styleExampleText}
Return {"comments":[{"ageGroup":20,"expertiseLevel":20,"expertiseLabel":"copy slot label","tone":"copy allowed enum","usedContext":false,"content":"reader reaction in the specified output language"}]}
`;

    return { systemPrompt, userPrompt };
  }

  function parseGeneratedComments(
    content: string,
    personaSlots: PersonaSlot[],
    metadata: Parameters<typeof logCommentValidationFailure>[1],
    normalizeWrapper = false,
  ): { comments: RawGeneratedComment[] } {
    let parsed: GenerateCommentsResult;

    try {
      const cleaned = normalizeWrapper
        ? content
            .trim()
            .replace(/^<think\b[^>]*>[\s\S]*?<\/think>\s*/i, '')
            .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1')
            .trim()
        : content;
      parsed = JSON.parse(cleaned) as GenerateCommentsResult;
    } catch {
      logCommentValidationFailure(content, metadata, 'invalid_json');
      throw new AppError('AI_RESPONSE_INVALID', {
        diagnostic: '댓글 생성 결과를 JSON으로 해석하지 못했습니다.',
      });
    }

    if (!parsed || !Array.isArray(parsed.comments)) {
      logCommentValidationFailure(content, metadata, 'missing_comments_array');
      throw new AppError('AI_RESPONSE_INVALID', {
        diagnostic: '댓글 생성 결과에 comments 배열이 없습니다.',
      });
    }

    if (parsed.comments.length < personaSlots.length) {
      logCommentValidationFailure(content, metadata, 'too_few_comments', {
        actualCount: parsed.comments.length,
      });
      throw new AppError('AI_RESPONSE_INVALID', {
        diagnostic: `댓글 생성 결과 개수(${parsed.comments.length})가 요청한 개수(${personaSlots.length})와 다릅니다.`,
      });
    }

    // ageGroup/expertiseLevel/expertiseLabel은 모델이 실수로 바꿔도 미리 정해둔 분포가 깨지지 않도록 서버에서 강제로 덮어쓴다.
    const allowedReactions = new Set<string>(personaSlots.map((slot) => slot.reaction));
    const comments = parsed.comments.slice(0, personaSlots.length).map((comment, index) => {
      const persona = personaSlots[index];
      if (!persona || !comment || typeof comment.content !== 'string' || !comment.content.trim()) {
        logCommentValidationFailure(content, metadata, 'invalid_comment', {
          actualCount: parsed.comments!.length,
          itemIndex: index + 1,
        });
        throw new AppError('AI_RESPONSE_INVALID', {
          diagnostic: `댓글 생성 결과의 ${index + 1}번째 항목이 올바르지 않습니다. 다시 생성해주세요.`,
        });
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
