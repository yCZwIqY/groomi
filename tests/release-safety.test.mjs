import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createWorkspaceService } from '../dist-electron/services/workspace-service.js';
import {
  readDocumentContent,
  writeDocumentContent,
  updateDocumentContentWithMetadata,
} from '../dist-electron/services/workspace/script-files.js';
import { readStore } from '../dist-electron/services/workspace/store.js';
import { all, run, withDatabase } from '../dist-electron/db/connection.js';
import { nextDeletionTime } from '../dist-electron/services/workspace/shared.js';
import { createDocumentCommentRepository } from '../dist-electron/repositories/document-comment-repository.js';

const text = (content) => ({
  content,
  charsWithSpaces: content.length,
  charsWithoutSpaces: content.replace(/\s/g, '').length,
  createdAt: '2026-09-30',
  updatedAt: '2026-09-30',
});
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'groomi-safety-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, '작업 폴더');
  const service = createWorkspaceService({ getPath: () => path.join(root, 'app-data') });
  await service.setCurrentWorkspacePath(workspace);
  const node = await service.createDocument(workspace, '첫 회차');
  await service.updateDocument(node.path, { document: { draft: text('첫 저장 원고') } });
  const file = path.join(workspace, 'scripts', `${node.id}.json`);
  return { root, workspace, service, node, file };
}

test('corrupt or missing manuscripts fail visibly and cannot be overwritten silently', async (t) => {
  const { service, node, file, workspace } = await fixture(t);
  await fs.writeFile(file, '{broken');
  await assert.rejects(service.getDocument(node.path), /원고 파일을 읽을 수 없습니다/);
  await assert.rejects(
    service.updateDocument(node.path, { document: { draft: text('overwrite') } }),
  );
  assert.equal(await fs.readFile(file, 'utf8'), '{broken');
  await assert.rejects(writeDocumentContent(workspace, node.id, { draft: text('overwrite') }));
  await fs.unlink(file);
  await assert.rejects(service.getDocument(node.path));
});

test('previous-save recovery preserves the damaged file', async (t) => {
  const { service, node, file } = await fixture(t);
  await service.updateDocument(node.path, { document: { draft: text('두 번째 저장') } });
  await fs.writeFile(file, '{broken');
  const restored = await service.recoverDocument(node.path);
  assert.equal(restored.document.draft.content, '첫 저장 원고');
  const retained = (await fs.readdir(path.dirname(file))).find((name) =>
    name.includes('.recovered-'),
  );
  assert.equal(await fs.readFile(path.join(path.dirname(file), retained), 'utf8'), '{broken');
});

test('metadata failure rolls back both DB and manuscript file', async (t) => {
  const { workspace, node, file } = await fixture(t);
  const original = JSON.parse(await fs.readFile(file, 'utf8'));
  await assert.rejects(
    updateDocumentContentWithMetadata(
      workspace,
      node.id,
      { ...original, draft: text('not committed') },
      async (db) => {
        await run(db, 'UPDATE document_info SET title = ? WHERE nodeId = ?', ['changed', node.id]);
        throw new Error('injected DB failure');
      },
    ),
    /injected DB failure/,
  );
  assert.equal((await readDocumentContent(workspace, node.id)).draft.content, '첫 저장 원고');
  const titles = await withDatabase(workspace, (db) =>
    all(db, 'SELECT title FROM document_info WHERE nodeId = ?', [node.id]),
  );
  assert.equal(titles[0].title, '첫 회차');
});

for (const committed of [false, true]) {
  test(`interrupted save selects the ${committed ? 'committed' : 'previous'} complete version`, async (t) => {
    const { workspace, node, file } = await fixture(t);
    const previous = await fs.readFile(file, 'utf8');
    const next = JSON.stringify({ ...JSON.parse(previous), draft: text('crash version') });
    const token = crypto.randomUUID();
    await fs.writeFile(`${file}.pending`, JSON.stringify({ token, previous, next }));
    await fs.writeFile(file, committed ? '{partial' : next);
    if (committed)
      await withDatabase(workspace, (db) =>
        run(
          db,
          'INSERT INTO document_file_commits (documentId, token) VALUES (?, ?) ON CONFLICT(documentId) DO UPDATE SET token = excluded.token',
          [node.id, token],
        ),
      );
    assert.equal(
      (await readDocumentContent(workspace, node.id)).draft.content,
      committed ? 'crash version' : '첫 저장 원고',
    );
    await assert.rejects(fs.access(`${file}.pending`));
  });
}

test('file replacement failure leaves the original intact and rolls DB back', async (t) => {
  const { workspace, node, file } = await fixture(t);
  const before = JSON.parse(await fs.readFile(file, 'utf8'));
  const moved = `${file}.original`;
  await assert.rejects(
    updateDocumentContentWithMetadata(
      workspace,
      node.id,
      { ...before, draft: text('new') },
      async (db) => {
        await run(db, 'UPDATE document_info SET title = ? WHERE nodeId = ?', ['failed', node.id]);
        await fs.rename(file, moved);
        await fs.mkdir(file);
      },
    ),
  );
  assert.equal(JSON.parse(await fs.readFile(moved, 'utf8')).draft.content, '첫 저장 원고');
  await fs.rmdir(file);
  assert.equal((await readDocumentContent(workspace, node.id)).draft.content, '첫 저장 원고');
});

test('group restore keeps individually trashed chapters and subgroups in trash', async (t) => {
  const { service, workspace } = await fixture(t);
  const group = await service.createWorkspace(path.join(workspace, '장편'));
  const child = await service.createWorkspace(path.join(group.path, '개별 삭제 그룹'));
  const oldTrash = await service.createDocument(child.path, '개별 삭제 회차');
  const active = await service.createDocument(group.path, '함께 복원 회차');
  await service.removeWorkspace(child.path);
  await service.removeWorkspace(group.path);
  await service.restoreWorkspace(group.path);
  const trash = await service.getTrashItems();
  assert.ok(trash.some((item) => item.id === oldTrash.id));
  assert.ok(trash.some((item) => item.id === child.id));
  assert.ok(!trash.some((item) => item.id === active.id));
});

test('deletion batches remain distinct after a clock change', () => {
  const earlier = new Date(Date.now() + 10000).toISOString();
  assert.ok(Date.parse(nextDeletionTime([{ deletedAt: earlier }])) > Date.parse(earlier));
});

test('failed permanent deletion retains original files and recoverable DB entry', async (t) => {
  const { workspace, service, node, file } = await fixture(t);
  await assert.rejects(service.purgeDocument(node.path), /휴지통/);
  await service.removeDocument(node.path);
  await withDatabase(workspace, (db) =>
    run(
      db,
      "CREATE TRIGGER refuse_delete BEFORE DELETE ON workspace_nodes BEGIN SELECT RAISE(ABORT, 'injected deletion failure'); END",
    ),
  );
  await assert.rejects(service.purgeDocument(node.path), /injected deletion failure/);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).draft.content, '첫 저장 원고');
  assert.ok((await service.getTrashItems()).some((item) => item.id === node.id));
  await withDatabase(workspace, (db) => run(db, 'DROP TRIGGER refuse_delete'));
  await service.purgeDocument(node.path);
  assert.ok(
    !(await fs.readdir(path.dirname(file))).some((name) => name.startsWith(`${node.id}.json`)),
  );
});

test('permanent deletion retries interrupted file cleanup on the next initialization', async (t) => {
  const { workspace, service, node, file } = await fixture(t);
  await service.removeDocument(node.path);
  await fs.unlink(`${file}.bak`);
  await fs.mkdir(`${file}.bak`);
  await assert.rejects(service.purgeDocument(node.path), /다시 실행하면 재시도/);
  const pending = await withDatabase(workspace, (db) =>
    all(db, 'SELECT documentId FROM pending_document_deletions'),
  );
  assert.deepEqual(pending, [{ documentId: node.id }]);
  await fs.rmdir(`${file}.bak`);
  await service.initCurrentWorkspace();
  assert.deepEqual(
    await withDatabase(workspace, (db) =>
      all(db, 'SELECT documentId FROM pending_document_deletions'),
    ),
    [],
  );
});

test('backup restores manuscripts, trash, comments, settings and images into a new folder', async (t) => {
  const { root, workspace, service, node, file } = await fixture(t);
  const extra = await service.createDocument(workspace, '휴지통 회차');
  await service.removeDocument(extra.path);
  await service.updateSelectedLLMModel('offline-model');
  await service.addCommentExample({ content: '댓글 예시' });
  await withDatabase(workspace, (db) =>
    createDocumentCommentRepository(db).insertComments(node.id, [{ content: '생성된 댓글' }]),
  );
  await fs.mkdir(path.join(workspace, 'images'));
  await fs.writeFile(path.join(workspace, 'images', 'cover.png'), Buffer.from([1, 2, 3]));
  await service.updateWorkspaceInfo(workspace, {
    workspace: { coverPath: path.join(workspace, 'images', 'cover.png') },
  });
  const backup = await service.backupWorkspace(root);
  await service.updateDocument(node.path, { document: { draft: text('백업 후 수정') } });
  const restored = await service.restoreWorkspaceBackup(backup.path, root);
  assert.notEqual(restored.path, workspace);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).draft.content, '백업 후 수정');
  const store = await readStore(restored.path);
  assert.equal((await readDocumentContent(restored.path, node.id)).draft.content, '첫 저장 원고');
  assert.ok((await service.getTrashItems()).some((item) => item.id === extra.id));
  assert.equal((await service.getSettingInfo()).selectedLLMModel, 'offline-model');
  assert.equal((await service.listCommentExamples())[0].content, '댓글 예시');
  assert.equal(
    (await service.listGeneratedComments(path.join(restored.path, '첫 회차.json')))[0].content,
    '생성된 댓글',
  );
  assert.equal(store.workspace.coverPath, path.join(restored.path, 'images', 'cover.png'));
  assert.deepEqual(await fs.readFile(store.workspace.coverPath), Buffer.from([1, 2, 3]));
});

test('invalid restore and nested backup leave the active workspace unchanged', async (t) => {
  const { root, workspace, service, node } = await fixture(t);
  await assert.rejects(service.backupWorkspace(workspace), /作|작업 폴더 밖/);
  const backup = await service.backupWorkspace(root);
  await fs.writeFile(path.join(backup.path, 'scripts', `${node.id}.json`), '{broken');
  await assert.rejects(service.restoreWorkspaceBackup(backup.path, root));
  assert.equal(await service.getCurrentWorkspacePath(), workspace);
});

test('concurrent content and story-memory updates do not overwrite each other', async (t) => {
  const { service, node } = await fixture(t);
  await Promise.all([
    service.updateDocument(node.path, { document: { draft: text('동시 저장 원고') } }),
    service.saveStoryMemory(node.path, {
      synopsis: '줄거리',
      events: [],
      characters: [],
      plotHooks: [],
    }),
  ]);
  const saved = await service.getDocument(node.path);
  assert.equal(saved.document.draft.content, '동시 저장 원고');
  assert.equal(saved.document.storyMemory.synopsis, '줄거리');
});

test('version 1 workspace upgrades without losing existing manuscripts or settings', async (t) => {
  const { service, workspace, node } = await fixture(t);
  await service.updateSelectedLLMModel('previous-version-model');
  await withDatabase(workspace, async (db) => {
    await run(db, 'DROP TABLE document_file_commits');
    await run(db, 'PRAGMA user_version = 1');
  });
  await service.initCurrentWorkspace();
  assert.equal((await service.getDocument(node.path)).document.draft.content, '첫 저장 원고');
  assert.equal((await service.getSettingInfo()).selectedLLMModel, 'previous-version-model');
  await service.updateDocument(node.path, { document: { draft: text('업데이트 후 저장') } });
  assert.equal((await service.getDocument(node.path)).document.draft.content, '업데이트 후 저장');
  const versions = await withDatabase(workspace, (db) => all(db, 'PRAGMA user_version'));
  assert.equal(versions[0].user_version, 2);
});

test('newer workspace format is rejected without downgrading its schema', async (t) => {
  const { service, workspace } = await fixture(t);
  await withDatabase(workspace, (db) => run(db, 'PRAGMA user_version = 99'));
  await assert.rejects(service.initCurrentWorkspace(), /최신 버전/);
  const versions = await withDatabase(workspace, (db) => all(db, 'PRAGMA user_version'));
  assert.equal(versions[0].user_version, 99);
});
