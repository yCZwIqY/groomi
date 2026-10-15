import { AppError } from '../../common/app-error.js';
import { withTransaction } from '../../db/connection.js';
import type { CommentExampleInput } from '../../repositories/comment-example-repository.js';
import type { WorkspaceServiceContext } from '../workspace-service-context.js';

type AddCommentExamplePayload = {
  content: string;
  tone?: string | null;
  interest?: string | null;
  ageGroup?: number | null;
  expertiseLevel?: number | null;
  genre?: string | null;
  source?: string | null;
};

export function createCommentExampleActions(context: WorkspaceServiceContext) {
  async function listCommentExamples() {
    const workspacePath = await context.getCurrentWorkspacePath();

    return context.withWorkspaceRepositories(workspacePath, async ({ commentExamples }) => {
      return commentExamples.findAllCommentExamples();
    });
  }

  async function addCommentExample(payload: AddCommentExamplePayload) {
    const workspacePath = await context.getCurrentWorkspacePath();
    const input = normalizeCommentExampleInput(payload);

    return context.withWorkspaceRepositories(workspacePath, async ({ commentExamples }) => {
      return commentExamples.addCommentExample(input);
    });
  }

  async function removeCommentExample(id: string | string[]) {
    const ids = [...new Set(Array.isArray(id) ? id : [id])];
    if (!ids.length || ids.some((value) => typeof value !== 'string' || !value.trim()))
      throw new AppError('COMMENT_EXAMPLE_SELECTION_REQUIRED');
    const workspacePath = await context.getCurrentWorkspacePath();
    await context.withWorkspaceRepositories(workspacePath, async ({ db, commentExamples }) => {
      await withTransaction(db, async () => {
        for (const value of ids) await commentExamples.removeCommentExample(value);
      });
    });

    return { removed: true, id };
  }

  return {
    addCommentExample,
    listCommentExamples,
    removeCommentExample,
  };
}

function normalizeCommentExampleInput(payload: AddCommentExamplePayload): CommentExampleInput {
  if (!payload || typeof payload !== 'object') {
    throw new AppError('COMMENT_EXAMPLE_INVALID');
  }

  if (typeof payload.content !== 'string') {
    throw new AppError('COMMENT_EXAMPLE_TEXT_REQUIRED');
  }
  if (
    payload.interest != null &&
    !['캐릭터', '인물 관계', '전개', '세계관', '문장'].includes(payload.interest)
  ) {
    throw new AppError('COMMENT_EXAMPLE_INTEREST_INVALID');
  }

  return {
    content: payload.content,
    tone: normalizeOptionalString(payload.tone),
    interest: normalizeOptionalString(payload.interest),
    ageGroup: normalizeOptionalNumber(payload.ageGroup, 'ageGroup'),
    gender: null,
    expertiseLevel: normalizeOptionalNumber(payload.expertiseLevel, 'expertiseLevel'),
    genre: normalizeOptionalString(payload.genre),
    source: normalizeOptionalString(payload.source),
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError('INVALID_TEXT_FIELD');
  }

  return value;
}

function normalizeOptionalNumber(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError('INVALID_INPUT', { diagnostic: `${fieldName}는 숫자여야 합니다.` });
  }

  return value;
}
