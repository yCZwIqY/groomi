import crypto from 'node:crypto';
import type sqlite3 from 'sqlite3';

import { all, run } from '../db/connection.js';

export type DocumentCommentRow = {
  id: string;
  documentId: string;
  content: string;
  tone: string | null;
  ageGroup: number | null;
  expertiseLevel: number | null;
  expertiseLabel: string | null;
  usedContext: number;
  createdAt: string;
};

export type DocumentCommentInput = {
  content: string;
  tone?: string | null;
  ageGroup?: number | null;
  expertiseLevel?: number | null;
  expertiseLabel?: string | null;
  usedContext?: boolean;
};

export function createDocumentCommentRepository(db: sqlite3.Database) {
  return {
    findByDocumentId(documentId: string) {
      return all<DocumentCommentRow>(
        db,
        `
          SELECT *
          FROM document_comments
          WHERE documentId = ?
          ORDER BY createdAt DESC, rowid DESC
        `,
        [documentId],
      );
    },

    async insertComments(documentId: string, inputs: DocumentCommentInput[]) {
      const createdAt = new Date().toISOString();
      const rows: DocumentCommentRow[] = inputs.map((input) => ({
        id: crypto.randomUUID(),
        documentId,
        content: input.content,
        tone: input.tone ?? null,
        ageGroup: input.ageGroup ?? null,
        expertiseLevel: input.expertiseLevel ?? null,
        expertiseLabel: input.expertiseLabel ?? null,
        usedContext: input.usedContext ? 1 : 0,
        createdAt,
      }));

      for (const row of rows) {
        await run(
          db,
          `
            INSERT INTO document_comments (
              id, documentId, content, tone, ageGroup, expertiseLevel, expertiseLabel, usedContext, createdAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            row.id,
            row.documentId,
            row.content,
            row.tone,
            row.ageGroup,
            row.expertiseLevel,
            row.expertiseLabel,
            row.usedContext,
            row.createdAt,
          ],
        );
      }

      return rows;
    },

    removeComment(id: string) {
      return run(db, 'DELETE FROM document_comments WHERE id = ?', [id]);
    },

    removeCommentsByDocumentId(documentId: string) {
      return run(db, 'DELETE FROM document_comments WHERE documentId = ?', [documentId]);
    },
  };
}
