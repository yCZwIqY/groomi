import { AppError } from '../../common/app-error.js';
import { resolveGroupOutputLanguage } from '../story-memory/output-language.js';
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
    throw new AppError('REVIEW_JSON_INVALID');
  }
  validateSchema(parsed, manuscriptReviewSchema);
  return parsed;
}
export function createReviewActions(context: WorkspaceServiceContext) {
  async function generateManuscriptReview(documentPath: string): Promise<ManuscriptReview> {
    const { model, systemPrompt, userPrompt } = await serializeWorkspaceOperation(async () => {
      const { workspacePath, store, node } = await context.getStoreNodeByPath(documentPath);
      if (!node || node.type !== 'document') throw new AppError('REVIEW_DOCUMENT_NOT_FOUND');
      const setting = await context.withWorkspaceRepositories(
        workspacePath,
        async ({ settingInfo }) => settingInfo.findSettingInfo(),
      );
      const content = await readDocumentContent(workspacePath, node.id);
      if (!toAiText(content.manuscript?.content)) throw new AppError('REVIEW_MANUSCRIPT_REQUIRED');
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
          outputLanguage: await resolveGroupOutputLanguage(
            workspacePath,
            store,
            node.parentId ?? null,
            setting.aiOutputLanguage ?? 'auto',
            toAiText(content.manuscript?.content),
          ),
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
          content: `Response validation failed: ${error instanceof Error ? error.message : 'Invalid format'}. Return valid JSON for the same input, preserving the specified output language.`,
        });
      }
    }
    throw new AppError('REVIEW_GENERATION_FAILED');
  }
  return { generateManuscriptReview };
}
