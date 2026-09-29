import type sqlite3 from 'sqlite3';

import { createCommentExampleRepository } from '../repositories/comment-example-repository.js';
import { initializeSchema, withDatabase } from '../db/connection.js';
import { createDocumentCommentRepository } from '../repositories/document-comment-repository.js';
import { createDocumentInfoRepository } from '../repositories/document-info-repository.js';
import { createGroupInfoRepository } from '../repositories/group-info-repository.js';
import { createRecentVisitRepository } from '../repositories/recent-visit-repository.js';
import { createSettingRepository } from '../repositories/setting-repository.js';
import { createWorkspaceNodeRepository } from '../repositories/workspace-node-repository.js';

export type WorkspaceRepositories = {
  commentExamples: ReturnType<typeof createCommentExampleRepository>;
  db: sqlite3.Database;
  documentComments: ReturnType<typeof createDocumentCommentRepository>;
  documentInfo: ReturnType<typeof createDocumentInfoRepository>;
  groupInfo: ReturnType<typeof createGroupInfoRepository>;
  recentVisits: ReturnType<typeof createRecentVisitRepository>;
  settingInfo: ReturnType<typeof createSettingRepository>;
  workspaceNodes: ReturnType<typeof createWorkspaceNodeRepository>;
};

export function withWorkspaceRepositories<Result>(
  workspacePath: string,
  callback: (repositories: WorkspaceRepositories) => Promise<Result>,
) {
  return withDatabase(workspacePath, async (db) => {
    await initializeSchema(db);

    return callback({
      commentExamples: createCommentExampleRepository(db),
      db,
      documentComments: createDocumentCommentRepository(db),
      documentInfo: createDocumentInfoRepository(db),
      groupInfo: createGroupInfoRepository(db),
      recentVisits: createRecentVisitRepository(db),
      settingInfo: createSettingRepository(db),
      workspaceNodes: createWorkspaceNodeRepository(db),
    });
  });
}
