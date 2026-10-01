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

  async function removeCommentExample(id: string) {
    const workspacePath = await context.getCurrentWorkspacePath();

    await context.withWorkspaceRepositories(workspacePath, async ({ commentExamples }) => {
      await commentExamples.removeCommentExample(id);
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
    throw new Error('댓글 예시 payload가 올바르지 않습니다.');
  }

  if (typeof payload.content !== 'string') {
    throw new Error('댓글 예시 content는 문자열이어야 합니다.');
  }
  if (
    payload.interest != null &&
    !['캐릭터', '인물 관계', '전개', '세계관', '문장'].includes(payload.interest)
  ) {
    throw new Error('댓글 예시 관심사가 올바르지 않습니다.');
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
    throw new Error('문자열 필드가 올바르지 않습니다.');
  }

  return value;
}

function normalizeOptionalNumber(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName}는 숫자여야 합니다.`);
  }

  return value;
}
