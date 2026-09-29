import type { DocumentCommentRow } from '../../repositories/document-comment-repository.js';
import type { WorkspaceServiceContext } from '../workspace-service-context.js';

export type GeneratedComment = {
  id: string;
  content: string;
  tone: string;
  ageGroup: number;
  expertiseLevel: number;
  expertiseLabel: string;
  usedContext: boolean;
  createdAt: string;
};

export function toGeneratedComment(row: DocumentCommentRow): GeneratedComment {
  return {
    id: row.id,
    content: row.content,
    tone: row.tone ?? '',
    ageGroup: row.ageGroup ?? 0,
    expertiseLevel: row.expertiseLevel ?? 0,
    expertiseLabel: row.expertiseLabel ?? '',
    usedContext: Boolean(row.usedContext),
    createdAt: row.createdAt,
  };
}

export function createCommentStoreActions(context: WorkspaceServiceContext) {
  async function listGeneratedComments(documentPath: string) {
    const { workspacePath, node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('댓글을 조회할 문서를 찾을 수 없습니다.');
    }

    return context.withWorkspaceRepositories(workspacePath, async ({ documentComments }) => {
      const rows = await documentComments.findByDocumentId(node.id);
      return rows.map(toGeneratedComment);
    });
  }

  async function removeGeneratedComment(documentPath: string, commentId: string) {
    const { workspacePath, node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new Error('댓글을 삭제할 문서를 찾을 수 없습니다.');
    }

    await context.withWorkspaceRepositories(workspacePath, async ({ documentComments }) => {
      await documentComments.removeComment(commentId);
    });

    return { removed: true, id: commentId };
  }

  return {
    listGeneratedComments,
    removeGeneratedComment,
  };
}
