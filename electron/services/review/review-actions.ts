import { buildAiChapterText, toAiText } from '../ai-text.js';
import { generateAiJson, resolveAiConfiguration } from '../ai-provider.js';
import { serializeWorkspaceOperation } from '../workspace-operation.js';
import { readDocumentContent } from '../workspace/store.js';
import { getNovelType } from '../story-memory/story-memory-actions.js';
import { getGroupMemory } from '../story-memory/group-memory.js';
import { validateSchema } from '../json-schema.js';
import { manuscriptReviewSchema } from './review-schema.js';
import { buildManuscriptReviewPrompt } from './review-prompt.js';
import type { WorkspaceServiceContext } from '../workspace-service-context.js';
import type { ManuscriptReview } from '../workspace/store-types.js';

export function parseManuscriptReview(content: string): ManuscriptReview {
  const cleaned = content
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  let parsed: ManuscriptReview;
  try {
    parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
  } catch {
    throw new Error('원고 리뷰를 JSON으로 해석하지 못했습니다.');
  }
  validateSchema(parsed, manuscriptReviewSchema);
  return parsed;
}
export function createReviewActions(context: WorkspaceServiceContext) {
  async function generateManuscriptReview(documentPath: string): Promise<ManuscriptReview> {
    const { model, systemPrompt, userPrompt } = await serializeWorkspaceOperation(async () => {
      const { workspacePath, store, node } = await context.getStoreNodeByPath(documentPath);
      if (!node || node.type !== 'document')
        throw new Error('원고 리뷰를 생성할 문서를 찾을 수 없습니다.');
      const setting = await context.withWorkspaceRepositories(
        workspacePath,
        async ({ settingInfo }) => settingInfo.findSettingInfo(),
      );
      const content = await readDocumentContent(workspacePath, node.id);
      if (!toAiText(content.manuscript?.content))
        throw new Error(
          '원고 리뷰를 생성할 원고 본문이 없습니다. 원고를 작성한 뒤 다시 시도해주세요. 초고는 원고 리뷰 생성에 사용되지 않습니다.',
        );
      const knownMemory =
        getNovelType(store, node.parentId ?? null) === 'short'
          ? null
          : await getGroupMemory(workspacePath, store, node.parentId ?? null, node.id, {
              includeCurrentChapter: false,
              readOnly: true,
            });
      return {
        model: await resolveAiConfiguration(setting),
        ...buildManuscriptReviewPrompt({
          chapterTitle: content.title ?? node.name,
          currentText: buildAiChapterText(content, node.name),
          knownMemory,
        }),
      };
    });
    const messages: { role: 'system' | 'user'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await generateAiJson(model, messages, {
        schema: manuscriptReviewSchema,
        schemaName: 'manuscript_review',
        temperature: 0.2,
        numCtx: 32768,
      });
      try {
        return parseManuscriptReview(response.message.content);
      } catch (error) {
        if (attempt === 1) throw error;
        messages.push({
          role: 'user',
          content: `응답 검증 실패: ${error instanceof Error ? error.message : '잘못된 형식'}. 위 입력으로 올바른 JSON을 다시 반환해주세요.`,
        });
      }
    }
    throw new Error('원고 리뷰 생성에 실패했습니다.');
  }
  return { generateManuscriptReview };
}
