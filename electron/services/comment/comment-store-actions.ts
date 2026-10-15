import { AppError } from '../../common/app-error.js';
import { run, withTransaction } from '../../db/connection.js';
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
      throw new AppError('COMMENT_READ_DOCUMENT_NOT_FOUND');
    }

    return context.withWorkspaceRepositories(workspacePath, async ({ documentComments }) => {
      const rows = await documentComments.findByDocumentId(node.id);
      return rows.map(toGeneratedComment);
    });
  }

  async function removeGeneratedComment(documentPath: string, commentId: string | string[]) {
    const { workspacePath, node } = await context.getStoreNodeByPath(documentPath);

    if (!node || node.type !== 'document') {
      throw new AppError('COMMENT_DELETE_DOCUMENT_NOT_FOUND');
    }

    const ids = [...new Set(Array.isArray(commentId) ? commentId : [commentId])];
    if (ids.length === 0 || ids.some((id) => typeof id !== 'string' || !id.trim())) {
      throw new AppError('COMMENT_SELECTION_REQUIRED');
    }
    await context.withWorkspaceRepositories(workspacePath, async ({ db }) => {
      await withTransaction(db, async () => {
        for (let offset = 0; offset < ids.length; offset += 500) {
          const batch = ids.slice(offset, offset + 500);
          await run(
            db,
            `DELETE FROM document_comments WHERE documentId = ? AND id IN (${batch.map(() => '?').join(',')})`,
            [node.id, ...batch],
          );
        }
      });
    });

    return { removed: true, id: commentId };
  }

  return {
    listGeneratedComments,
    removeGeneratedComment,
  };
}
