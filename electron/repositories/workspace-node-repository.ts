import type sqlite3 from 'sqlite3';

import { all, createPlaceholders, run } from '../db/connection.js';
import type {
  StoredNodeType,
  WorkspaceStore,
  WorkspaceStoreDocument,
  WorkspaceStoreGroup,
  WorkspaceStoreRoot
} from '../services/workspace/store-types.js';

export type WorkspaceNodeRow = {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  type: StoredNodeType;
  deleted: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WritableWorkspaceNode =
  | (WorkspaceStoreRoot & { type: 'workspace'; parentId: null })
  | WorkspaceStoreGroup
  | WorkspaceStoreDocument;

function toDbParentId(store: WorkspaceStore, parentId: string | null) {
  return parentId ?? store.workspace.id;
}

export function createWorkspaceNodeRepository(db: sqlite3.Database) {
  return {
    findAllNodes() {
      return all<WorkspaceNodeRow>(db, 'SELECT * FROM workspace_nodes ORDER BY createdAt ASC');
    },

    findRecentCreatedNodes(count: number = 5) {
      return all<WorkspaceNodeRow>(db, `SELECT * FROM workspace_nodes ORDER BY createdAt ASC LIMIT ${count}`);
    },

    findRecentUpdatedNodes(count: number = 5) {
      return all<WorkspaceNodeRow>(db, `SELECT * FROM workspace_nodes ORDER BY updatedAt ASC LIMIT ${count}`);
    },

    deleteAllNodes() {
      return run(db, 'DELETE FROM workspace_nodes');
    },

    insertNode(store: WorkspaceStore, node: WritableWorkspaceNode, nodePath: string) {
      return run(
        db,
        `
          INSERT INTO workspace_nodes (
            id, parentId, name, path, type, deleted, createdAt, updatedAt, deletedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          node.id,
          node.id === store.workspace.id ? null : toDbParentId(store, node.parentId),
          node.name,
          nodePath,
          node.type,
          node.deletedAt ? 1 : 0,
          node.createdAt,
          node.updatedAt,
          node.deletedAt ?? null,
        ],
      );
    },

    updateNodeDetails(
      id: string,
      data: Partial<Pick<WorkspaceNodeRow, 'name' | 'path' | 'updatedAt'>>,
    ) {
      return run(
        db,
        `
          UPDATE workspace_nodes
          SET
            name = COALESCE(?, name),
            path = COALESCE(?, path),
            updatedAt = COALESCE(?, updatedAt)
          WHERE id = ?
        `,
        [data.name ?? null, data.path ?? null, data.updatedAt ?? null, id],
      );
    },

    markNodesDeleted(ids: string[], deletedAt: string | null, updatedAt: string) {
      if (ids.length === 0) {
        return Promise.resolve();
      }

      return run(
        db,
        `
          UPDATE workspace_nodes
          SET deletedAt = ?, deleted = ?, updatedAt = ?
          WHERE id IN (${createPlaceholders(ids)})
        `,
        [deletedAt, deletedAt ? 1 : 0, updatedAt, ...ids],
      );
    },

    deleteNodesByIds(ids: string[]) {
      if (ids.length === 0) {
        return Promise.resolve();
      }

      return run(
        db,
        `DELETE FROM workspace_nodes WHERE id IN (${createPlaceholders(ids)})`,
        ids,
      );
    },
  };
}
