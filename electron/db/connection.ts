import sqlite3 from 'sqlite3';

import { getWorkspaceDatabaseFilePath } from '../common/paths.js';
import { WORKSPACE_SCHEMA_STATEMENTS, WORKSPACE_SCHEMA_VERSION } from './schema.js';

const sqlite = sqlite3.verbose();

export type SqliteParameter = string | number | null;

export function createPlaceholders(values: readonly unknown[]) {
  return values.map(() => '?').join(', ');
}

export function openDatabase(workspacePath: string) {
  return new sqlite.Database(getWorkspaceDatabaseFilePath(workspacePath));
}

export function run(db: sqlite3.Database, sql: string, params: SqliteParameter[] = []) {
  return new Promise<void>((resolve, reject) => {
    db.run(sql, params, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function all<Row>(
  db: sqlite3.Database,
  sql: string,
  params: SqliteParameter[] = [],
): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows: Row[]) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

export function close(db: sqlite3.Database) {
  return new Promise<void>((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function withDatabase<Result>(
  workspacePath: string,
  callback: (db: sqlite3.Database) => Promise<Result>,
) {
  const db = openDatabase(workspacePath);

  try {
    return await callback(db);
  } finally {
    await close(db);
  }
}

export async function initializeSchema(db: sqlite3.Database) {
  const versions = await all<{ user_version: number }>(db, 'PRAGMA user_version');
  if ((versions[0]?.user_version ?? 0) > WORKSPACE_SCHEMA_VERSION) {
    throw new Error(
      '이 작업 폴더는 더 최신 버전의 그루미에서 저장했습니다. 앱을 업데이트해주세요.',
    );
  }
  for (const statement of WORKSPACE_SCHEMA_STATEMENTS) {
    await run(db, statement);
  }

  await withTransaction(db, async () => {
    const exampleColumns = await all<{ name: string }>(db, 'PRAGMA table_info(comment_examples)');
    if (!exampleColumns.some((column) => column.name === 'interest')) {
      await run(db, 'ALTER TABLE comment_examples ADD COLUMN interest TEXT');
    }
    if ((versions[0]?.user_version ?? 0) < 3) {
      // The old settings selector stored the index (0–7) instead of the decade (10–80).
      await run(
        db,
        'UPDATE comment_examples SET ageGroup = (ageGroup + 1) * 10 WHERE ageGroup BETWEEN 0 AND 7',
      );
    }
    await run(db, `PRAGMA user_version = ${WORKSPACE_SCHEMA_VERSION}`);
  });
}

export async function withTransaction<Result>(
  db: sqlite3.Database,
  callback: () => Promise<Result>,
) {
  await run(db, 'BEGIN IMMEDIATE TRANSACTION');

  try {
    const result = await callback();
    await run(db, 'COMMIT');
    return result;
  } catch (error) {
    await run(db, 'ROLLBACK');
    throw error;
  }
}
