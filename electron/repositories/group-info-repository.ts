import type sqlite3 from 'sqlite3';

import { all, run } from '../db/connection.js';
import type {
  NovelType,
  WorkspaceStoreGroup,
  WorkspaceStoreRoot,
} from '../services/workspace/store-types.js';

export type GroupInfoRow = {
  nodeId: string;
  description: string | null;
  coverPath: string | null;
  novelType: string | null;
};

type TableInfoRow = {
  name: string;
};

export function createGroupInfoRepository(db: sqlite3.Database) {
  async function ensureGroupInfoColumns() {
    const columns = await all<TableInfoRow>(db, 'PRAGMA table_info(group_info)');
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('novelType')) {
      await run(db, 'ALTER TABLE group_info ADD COLUMN novelType TEXT');
    }
  }

  return {
    async findAllGroupInfo() {
      await ensureGroupInfoColumns();

      return all<GroupInfoRow>(db, 'SELECT * FROM group_info');
    },

    deleteAllGroupInfo() {
      return run(db, 'DELETE FROM group_info');
    },

    async insertGroupInfo(group: WorkspaceStoreGroup | WorkspaceStoreRoot) {
      await ensureGroupInfoColumns();

      return run(
        db,
        'INSERT INTO group_info (nodeId, description, coverPath, novelType) VALUES (?, ?, ?, ?)',
        [group.id, group.description ?? '', group.coverPath ?? '', group.novelType ?? 'long'],
      );
    },

    async updateGroupInfo(
      nodeId: string,
      data: Partial<Pick<WorkspaceStoreGroup, 'description' | 'coverPath'> & { novelType: NovelType }>,
    ) {
      await ensureGroupInfoColumns();

      return run(
        db,
        `
          UPDATE group_info
          SET
            description = COALESCE(?, description),
            coverPath = COALESCE(?, coverPath),
            novelType = COALESCE(?, novelType)
          WHERE nodeId = ?
        `,
        [data.description ?? null, data.coverPath ?? null, data.novelType ?? null, nodeId],
      );
    },
  };
}
