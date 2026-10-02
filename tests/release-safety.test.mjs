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
import ollama from 'ollama';
import { mergeMemoryChanges } from '../dist-electron/services/story-memory/merge-memory-changes.js';
import {
  getDefaultWorkspacePath,
  getWorkspaceDatabaseFilePath,
  LEGACY_DATABASE_NAME,
} from '../dist-electron/common/paths.js';
import { buildAiChapterText, toAiText } from '../dist-electron/services/ai-text.js';
import { createAiCredentials } from '../dist-electron/services/ai-credentials.js';
import {
  generateAiJson,
  listOpenRouterModels,
  requestOpenRouter,
  resolveAiConfiguration,
} from '../dist-electron/services/ai-provider.js';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

test('OpenRouter credentials stay encrypted outside the workspace and survive failed replacement', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'groomi-keys-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const encryptionKey = randomBytes(32);
  let available = true;
  const credentials = createAiCredentials(path.join(root, 'user-data', 'key.enc'), {
    isEncryptionAvailable: () => available,
    encryptString(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    decryptString(value) {
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString(
        'utf8',
      );
    },
  });
  assert.equal(await credentials.hasKey(), false);
  await credentials.saveKey('test-secret-key');
  assert.equal(await credentials.hasKey(), true);
  assert.equal(await credentials.readKey(), 'test-secret-key');
  assert.equal(
    (await fs.readFile(path.join(root, 'user-data', 'key.enc'))).includes('test-secret-key'),
    false,
  );
  available = false;
  await assert.rejects(credentials.saveKey('replacement-key'), /암호화/);
  available = true;
  await assert.rejects(credentials.saveKey('invalid key'), /올바른/);
  assert.equal(await credentials.readKey(), 'test-secret-key');
  await credentials.saveKey('replacement-key');
  assert.equal(await credentials.readKey(), 'replacement-key');
  assert.deepEqual(await fs.readdir(path.join(root, 'user-data')), ['key.enc']);
  await credentials.deleteKey();
  assert.equal(await credentials.hasKey(), false);
});

test('AI provider settings retain separate models across switching and backup restore', async (t) => {
  const { service, workspace, root } = await fixture(t);
  assert.equal((await service.getSettingInfo()).aiProvider, 'ollama');
  await service.updateSelectedLLMModel('local-model');
  await service.updateAiSettings('openrouter', 'test/remote-model');
  const settings = await service.getSettingInfo();
  assert.equal(settings.selectedLLMModel, 'local-model');
  assert.equal(settings.openRouterModel, 'test/remote-model');
  assert.equal(settings.aiProvider, 'openrouter');
  assert.equal('apiKey' in settings, false);
  await service.updateAiSettings('ollama', settings.openRouterModel);
  assert.equal((await service.getSettingInfo()).openRouterModel, 'test/remote-model');
  const restoredService = createWorkspaceService({ getPath: () => root });
  await restoredService.setCurrentWorkspacePath(workspace);
  assert.equal((await restoredService.getSettingInfo()).selectedLLMModel, 'local-model');
  assert.deepEqual(await resolveAiConfiguration(await restoredService.getSettingInfo()), {
    provider: 'ollama',
    model: 'local-model',
  });
  const backup = await service.backupWorkspace(root);
  await service.updateAiSettings('openrouter', 'test/changed-model');
  await service.restoreWorkspaceBackup(backup.path, root);
  const restored = await service.getSettingInfo();
  assert.equal(restored.aiProvider, 'ollama');
  assert.equal(restored.selectedLLMModel, 'local-model');
  assert.equal(restored.openRouterModel, 'test/remote-model');
});

test('OpenRouter error logs explain provider limits without exposing keys or manuscript text', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: 'Provider returned error',
            metadata: {
              provider_name: 'Test Provider',
              raw: 'temporarily rate-limited upstream fake-secret-key 비공개 원고 본문',
              headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '12345' },
            },
          },
        }),
        { status: 429, headers: { 'retry-after': '60', 'x-request-id': 'test-request' } },
      ),
  );
  await assert.rejects(
    generateAiJson(
      { provider: 'openrouter', model: 'test/model:free', apiKey: 'fake-secret-key' },
      [{ role: 'user', content: '비공개 원고 본문' }],
    ),
    /모델 제공자의 요청이 일시적으로 제한되었습니다/,
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], '[openrouter-error]');
  assert.equal(logs[0][1].httpStatus, 429);
  assert.equal(logs[0][1].provider, 'Test Provider');
  assert.equal(logs[0][1].retryAfter, '60');
  assert.equal(logs[0][1].rateRemaining, '0');
  assert.equal(logs[0][1].rateReset, '12345');
  assert.match(logs[0][1].raw, /temporarily rate-limited upstream/);
  assert.ok(!JSON.stringify(logs).includes('fake-secret-key'));
  assert.ok(!JSON.stringify(logs).includes('비공개 원고 본문'));
});

test('OpenRouter sends JSON requests, normalizes usage, and never retries billable errors', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer fake-key');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'test/model');
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.provider.require_parameters, true);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"events":[]}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    );
  });
  const result = await generateAiJson(
    { provider: 'openrouter', model: 'test/model', apiKey: 'fake-key' },
    [{ role: 'user', content: 'JSON으로 생성' }],
  );
  assert.equal(result.message.content, '{"events":[]}');
  assert.equal(result.prompt_eval_count, 10);
  assert.equal(result.eval_count, 5);
  assert.equal(calls, 1);
  for (const [code, message] of [
    [401, /API 키/],
    [402, /잔액/],
    [429, /한도/],
    [503, /요청에 실패/],
  ]) {
    t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return new Response('', { status: code });
    });
    const before = calls;
    await assert.rejects(
      generateAiJson({ provider: 'openrouter', model: 'test/model', apiKey: 'fake-key' }, []),
      message,
    );
    assert.equal(calls, before + 1);
  }
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ error: { code: 402, message: 'fake-key' } })),
  );
  await assert.rejects(requestOpenRouter('key', 'fake-key'), /잔액/);
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{}' }, finish_reason: 'length' }] }),
      ),
  );
  await assert.rejects(
    generateAiJson({ provider: 'openrouter', model: 'test/model', apiKey: 'fake-key' }, []),
    /길이 제한/,
  );
});

test('OpenRouter model list excludes models without text JSON output', async (t) => {
  const valid = {
    id: 'test/model',
    name: 'Test',
    context_length: 8192,
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    supported_parameters: ['response_format'],
    pricing: { prompt: '0.000001', completion: '0.000002' },
  };
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          data: [
            valid,
            { ...valid, id: 'test/no-json', supported_parameters: [] },
            {
              ...valid,
              id: 'test/image',
              architecture: { input_modalities: ['text'], output_modalities: ['image'] },
            },
          ],
        }),
      ),
  );
  assert.deepEqual(await listOpenRouterModels(), [
    {
      id: 'test/model',
      name: 'Test',
      contextLength: 8192,
      inputPrice: '0.000001',
      outputPrice: '0.000002',
    },
  ]);
});

const text = (content) => ({
  content,
  charsWithSpaces: content.length,
  charsWithoutSpaces: content.replace(/\s/g, '').length,
  createdAt: '2026-09-30',
  updatedAt: '2026-09-30',
});

test('AI input removes editor formatting while preserving prose and deduplicating scripts', () => {
  assert.equal(
    toAiText('<p style="text-align:left">문 &amp; 열쇠</p><p>&lt;비밀&gt; &#xD55C;&#44368;</p>'),
    '문 & 열쇠\n<비밀> 한교',
  );
  assert.equal(
    buildAiChapterText({
      title: '1화',
      draft: { content: '<p>같은 원고</p>' },
      manuscript: { content: '<p style="text-align:left">같은 원고</p>' },
    }),
    '1화\n\n같은 원고',
  );
  assert.ok(
    buildAiChapterText({
      draft: { content: '<p>초안</p>' },
      manuscript: { content: '<p>완성본</p>' },
    }).includes('초안\n\n완성본'),
  );
});

test('first generation ignores invented IDs and matches existing names without duplicates', async (t) => {
  const { service, node } = await fixture(t);
  await service.updateSelectedLLMModel('test-model');
  const draft = {
    synopsis: '첫 줄거리',
    events: [],
    characters: [{ id: 'character-1', name: '태윤', info: '학생', keywords: [], summary: '발견' }],
    plotHooks: [
      { id: 'hook-1', description: '문 비밀', plantedAt: '첫 회차', status: 'unresolved' },
    ],
  };
  t.mock.method(ollama, 'chat', async () => ({ message: { content: JSON.stringify(draft) } }));
  const result = await service.generateStoryMemory(node.path);
  assert.notEqual(result.characters[0].id, 'character-1');
  assert.notEqual(result.plotHooks[0].id, 'hook-1');
  const merged = mergeMemoryChanges(result, result, draft);
  assert.equal(merged.characters.length, 1);
  assert.equal(merged.plotHooks.length, 1);
  assert.equal(merged.characters[0].id, result.characters[0].id);
  assert.equal(merged.plotHooks[0].id, result.plotHooks[0].id);
});

test('group characters and hooks preserve chapter history and exclude future information', async (t) => {
  const { service, workspace, node } = await fixture(t);
  const empty = { synopsis: '', events: [], characters: [], plotHooks: [] };
  const first = await service.saveStoryMemory(node.path, {
    ...empty,
    characters: [{ name: '태윤', info: '평범한 학생', keywords: [], summary: '문을 발견했다' }],
    plotHooks: [{ description: '문 뒤의 비밀', plantedAt: '첫 회차', status: 'unresolved' }],
  });
  const second = await service.createDocument(workspace, '2화');
  const third = await service.createDocument(workspace, '3화');
  await service.saveStoryMemory(third.path, {
    ...empty,
    characters: [
      { ...first.characters[0], info: '미래에 밝혀진 왕의 정체', summary: '왕으로 즉위했다' },
    ],
    plotHooks: [
      { ...first.plotHooks[0], status: 'resolved' },
      { description: '미래의 새 비밀', plantedAt: '3화', status: 'unresolved' },
    ],
  });
  const past = (await service.getDocument(second.path)).document.storyMemory;
  assert.equal(past.characters[0].info, '평범한 학생');
  assert.equal(past.plotHooks.length, 1);
  assert.equal(past.plotHooks[0].status, 'unresolved');
  const latest = await service.getLatestStoryMemory(workspace);
  assert.equal(latest.characters.length, 1);
  assert.equal(latest.characters[0].introducedAt, node.id);
  assert.equal(latest.plotHooks[0].resolvedAt, third.id);
  assert.equal(latest.plotHooks[0].plantedChapterId, node.id);
  await service.updateSelectedLLMModel('test-model');
  let prompt = '';
  t.mock.method(ollama, 'chat', async (payload) => {
    prompt = payload.messages.map((message) => message.content).join('\n');
    return {
      message: { content: JSON.stringify({ comments: [{ content: 'test', tone: 'test' }] }) },
    };
  });
  await service.generateComments({
    documentPath: second.path,
    startAge: 20,
    endAge: 20,
    expertise: 40,
    count: 1,
  });
  assert.ok(prompt.includes('문 뒤의 비밀'));
  assert.ok(!prompt.includes('미래의 새 비밀'));
  assert.ok(!prompt.includes('미래에 밝혀진 왕의 정체'));
  await service.generateComments({
    documentPath: third.path,
    startAge: 20,
    endAge: 20,
    expertise: 40,
    count: 1,
  });
  assert.ok(prompt.includes('미래에 밝혀진 왕의 정체'));
  assert.ok(!prompt.includes('문 뒤의 비밀'));
});

test('AI deltas merge partial updates and keep omitted group records and regenerated chapter changes', async (t) => {
  const { service, workspace, node } = await fixture(t);
  const first = await service.saveStoryMemory(node.path, {
    synopsis: '첫 줄거리',
    events: [],
    characters: [
      { name: '태윤', info: '학생', keywords: ['신중함'], summary: '문을 발견' },
      { name: '동생', info: '동생 정보', keywords: [], summary: '대기' },
    ],
    plotHooks: [
      { description: '문 비밀', plantedAt: '첫 회차', status: 'unresolved' },
      { description: '열쇠 비밀', plantedAt: '첫 회차', status: 'unresolved' },
    ],
  });
  const next = await service.createDocument(workspace, '2화');
  await service.updateSelectedLLMModel('test-model');
  let delta = {
    synopsis: '두 번째 줄거리',
    events: [],
    characters: [{ id: first.characters[0].id, info: '왕의 정체' }],
    plotHooks: [{ id: first.plotHooks[0].id, status: 'resolved' }],
  };
  t.mock.method(ollama, 'chat', async (payload) => {
    assert.ok(payload.messages[0].content.includes('변경된 인물만 반환'));
    return { message: { content: JSON.stringify(delta) } };
  });
  const generated = await service.generateStoryMemory(next.path);
  assert.equal(generated.characters.length, 2);
  assert.equal(generated.characters[0].info, '왕의 정체');
  assert.deepEqual(generated.characters[0].keywords, ['신중함']);
  assert.equal(generated.plotHooks.length, 2);
  assert.equal(generated.plotHooks[0].resolvedAt, next.id);
  const rows = await withDatabase(workspace, (db) =>
    all(db, 'SELECT payload FROM group_memory_revisions WHERE chapterId = ?', [next.id]),
  );
  assert.equal(JSON.parse(rows[0].payload).characters.length, 1);
  assert.equal(JSON.parse(rows[0].payload).plotHooks.length, 1);
  delta = { synopsis: '재생성 줄거리', events: [], characters: [], plotHooks: [] };
  const regenerated = await service.generateStoryMemory(next.path);
  assert.equal(regenerated.characters[0].info, '왕의 정체');
  assert.equal(regenerated.plotHooks[0].status, 'resolved');
  const last = await service.createDocument(workspace, '정보 없는 마지막 회차');
  const group = await service.getLatestStoryMemory(workspace);
  assert.equal(group.generatedAt, '');
  assert.equal(group.characters.length, 2);
  assert.equal(group.plotHooks.length, 2);
  delta = {
    synopsis: '실패',
    events: [],
    characters: [{ id: 'unknown', info: '위조' }],
    plotHooks: [],
  };
  await assert.rejects(service.generateStoryMemory(last.path), /알 수 없는 인물 ID/);
  assert.equal((await readDocumentContent(workspace, last.id)).storyMemory, undefined);
});

test('batch comment deletion is atomic and restricted to the selected chapter', async (t) => {
  const { service, workspace, node } = await fixture(t);
  const other = await service.createDocument(workspace, '다른 회차');
  const [rows, otherRows] = await withDatabase(workspace, async (db) => {
    const repo = createDocumentCommentRepository(db);
    return [
      await repo.insertComments(
        node.id,
        Array.from({ length: 501 }, (_, index) => ({ content: `댓글 ${index}` })),
      ),
      await repo.insertComments(other.id, [{ content: '다른 회차 댓글' }]),
    ];
  });
  await withDatabase(workspace, (db) =>
    run(
      db,
      `CREATE TRIGGER fail_comment_delete BEFORE DELETE ON document_comments WHEN OLD.id = '${rows[500].id}' BEGIN SELECT RAISE(ABORT, 'delete failed'); END`,
    ),
  );
  await assert.rejects(
    service.removeGeneratedComment(
      node.path,
      rows.map((row) => row.id),
    ),
    /delete failed/,
  );
  assert.equal((await service.listGeneratedComments(node.path)).length, 501);
  await withDatabase(workspace, (db) => run(db, 'DROP TRIGGER fail_comment_delete'));
  await service.removeGeneratedComment(node.path, [rows[0].id, otherRows[0].id]);
  assert.equal((await service.listGeneratedComments(node.path)).length, 500);
  assert.equal((await service.listGeneratedComments(other.path)).length, 1);
  await service.removeGeneratedComment(
    node.path,
    rows.slice(1).map((row) => row.id),
  );
  assert.equal((await service.listGeneratedComments(node.path)).length, 0);
  await assert.rejects(service.removeGeneratedComment(other.path, []), /선택해주세요/);
});

test('legacy workspace database migrates to Groomi without losing manuscripts or its original database', async (t) => {
  const { service, workspace, node, file } = await fixture(t);
  const current = getWorkspaceDatabaseFilePath(workspace);
  const legacy = path.join(workspace, LEGACY_DATABASE_NAME);
  const manuscript = await fs.readFile(file, 'utf8');
  await fs.rename(current, legacy);
  const originalDatabase = await fs.readFile(legacy);
  await service.initCurrentWorkspace();
  assert.equal((await service.getDocument(node.path)).id, node.id);
  assert.equal((await service.getDocument(node.path)).document.draft.content, '첫 저장 원고');
  assert.equal(await fs.readFile(file, 'utf8'), manuscript);
  assert.deepEqual(await fs.readFile(legacy), originalDatabase);
  await fs.access(current);
  assert.equal(path.basename(current), 'groomi.sqlite');
  assert.equal(path.basename(getDefaultWorkspacePath()), 'groomi');
  await service.updateDocument(node.path, { document: { draft: text('새 이름으로 저장') } });
  assert.equal((await service.getDocument(node.path)).document.draft.content, '새 이름으로 저장');
  assert.deepEqual(await fs.readFile(legacy), originalDatabase);
});

test('group memory transaction failure preserves manuscript and chapter history', async (t) => {
  const { service, workspace, node, file } = await fixture(t);
  const before = await fs.readFile(file, 'utf8');
  await withDatabase(workspace, (db) =>
    run(
      db,
      `CREATE TRIGGER fail_group_memory BEFORE INSERT ON group_memory_revisions BEGIN SELECT RAISE(ABORT, 'group save failed'); END`,
    ),
  );
  await assert.rejects(
    service.saveStoryMemory(node.path, {
      synopsis: 'failed',
      events: [],
      characters: [],
      plotHooks: [],
    }),
    /group save failed/,
  );
  assert.equal(await fs.readFile(file, 'utf8'), before);
  const rows = await withDatabase(workspace, (db) =>
    all(db, 'SELECT * FROM group_memory_revisions'),
  );
  assert.equal(rows.length, 0);
});

test('resolved hooks persist, remain editable, and are excluded from comment context', async (t) => {
  const { service, workspace, node } = await fixture(t);
  const hooks = [
    { description: 'resolved-secret', plantedAt: 'first', status: 'resolved' },
    { description: 'open-secret', plantedAt: 'first', status: 'unresolved' },
    { description: 'legacy-secret', plantedAt: 'first' },
  ];
  const memory = { synopsis: '', events: [], characters: [], plotHooks: hooks };
  await service.saveStoryMemory(node.path, memory);
  assert.deepEqual(
    (await service.getDocument(node.path)).document.storyMemory.plotHooks.map(
      ({ description, plantedAt, status }) => ({
        description,
        plantedAt,
        ...(status ? { status } : {}),
      }),
    ),
    hooks,
  );
  hooks[0].description = 'edited-resolved-secret';
  await service.saveStoryMemory(node.path, memory);
  assert.deepEqual(
    (await service.getLatestStoryMemory(workspace)).plotHooks.map(
      ({ description, plantedAt, status }) => ({
        description,
        plantedAt,
        ...(status ? { status } : {}),
      }),
    ),
    hooks,
  );

  const next = await service.createDocument(workspace, 'second');
  await service.updateSelectedLLMModel('test-model');
  const prompts = [];
  t.mock.method(ollama, 'chat', async (payload) => {
    prompts.push(payload.messages.map((message) => message.content).join('\n'));
    return {
      message: { content: JSON.stringify({ comments: [{ content: 'test', tone: 'test' }] }) },
    };
  });
  await service.generateComments({
    documentPath: next.path,
    startAge: 20,
    endAge: 20,
    expertise: 20,
    count: 1,
  });
  assert.ok(prompts[0].includes('open-secret'));
  assert.ok(prompts[0].includes('legacy-secret'));
  assert.ok(!prompts[0].includes('edited-resolved-secret'));

  ollama.chat.mock.mockImplementation(async (payload) => {
    prompts.push(payload.messages.map((message) => message.content).join('\n'));
    return { message: { content: JSON.stringify({ ...memory, plotHooks: [] }) } };
  });
  const generated = await service.generateStoryMemory(next.path);
  assert.ok(prompts[1].includes('edited-resolved-secret'));
  assert.deepEqual(
    generated.plotHooks.map(({ description, plantedAt, status }) => ({
      description,
      plantedAt,
      ...(status ? { status } : {}),
    })),
    hooks,
  );
  assert.deepEqual(
    (await service.getDocument(next.path)).document.storyMemory.plotHooks,
    generated.plotHooks,
  );
  await service.createDocument(workspace, '정보 없는 최신 회차');
  assert.equal((await service.getLatestStoryMemory(workspace)).plotHooks.length, hooks.length);
});

test('generated memory persists without overwriting manuscript edits and stays within its group', async (t) => {
  const { service, workspace } = await fixture(t);
  const group = await service.createWorkspace(path.join(workspace, '그룹'), 'long');
  const other = await service.createWorkspace(path.join(workspace, '다른 그룹'), 'long');
  const chapter = await service.createDocument(group.path, '첫 회차');
  const generated = {
    synopsis: '최신 줄거리',
    events: [{ description: '주요 사건', importance: '상' }],
    characters: [],
    plotHooks: [],
  };
  await service.updateSelectedLLMModel('test-model');
  t.mock.method(ollama, 'chat', async () => {
    await service.updateDocument(chapter.path, {
      document: { manuscript: text('생성 중 추가한 원고') },
    });
    return { message: { content: JSON.stringify(generated) } };
  });
  await service.generateStoryMemory(chapter.path);
  assert.equal(
    (await service.getDocument(chapter.path)).document.manuscript.content,
    '생성 중 추가한 원고',
  );
  const lastChapter = await service.createDocument(group.path, '마지막 회차');
  assert.equal(await service.getLatestStoryMemory(group.path), null);
  await service.saveStoryMemory(lastChapter.path, { ...generated, synopsis: '마지막 회차 줄거리' });
  await service.saveStoryMemory(chapter.path, { ...generated, synopsis: '나중에 수정한 첫 회차' });
  assert.equal((await service.getLatestStoryMemory(group.path)).synopsis, '마지막 회차 줄거리');
  assert.equal(await service.getLatestStoryMemory(other.path), null);
  await service.removeDocument(chapter.path);
  assert.equal((await service.getLatestStoryMemory(group.path)).synopsis, '마지막 회차 줄거리');
  await service.removeDocument(lastChapter.path);
  assert.equal(await service.getLatestStoryMemory(group.path), null);
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

test('comment personas balance interests and reactions independently of expertise', async (t) => {
  const { service, node } = await fixture(t);
  await service.updateSelectedLLMModel('test-model');
  const requests = [];
  t.mock.method(ollama, 'chat', async ({ messages }) => {
    const prompt = messages.find((message) => message.role === 'user').content;
    const slots = [
      ...prompt.matchAll(
        /\d+\. ageGroup=(\d+), expertiseLevel=(\d+), expertiseLabel="([^"]+)", interest="([^"]+)", reaction="([^"]+)"/g,
      ),
    ];
    requests.push({ prompt, slots });
    return {
      message: {
        content: JSON.stringify({
          comments: slots.map(() => ({ content: '장면에 대한 반응', tone: '몰입' })),
        }),
      },
    };
  });
  const comments = await service.generateComments({
    documentPath: node.path,
    startAge: 20,
    endAge: 20,
    expertise: 0,
    count: 40,
  });
  const slots = requests[0].slots;
  assert.equal(slots.length, 40);
  assert.ok(slots.every((slot) => slot[1] === '20' && slot[2] === '0'));
  const interests = new Map();
  const reactions = new Map();
  for (const slot of slots) {
    interests.set(slot[4], (interests.get(slot[4]) ?? 0) + 1);
    reactions.set(slot[5], (reactions.get(slot[5]) ?? 0) + 1);
  }
  assert.equal(interests.size, 5);
  assert.ok([...interests.values()].every((count) => count === 8));
  assert.equal(reactions.size, 8);
  assert.ok([...reactions.values()].every((count) => count === 5));
  assert.ok(comments.every((comment) => comment.expertiseLevel === 0));
  assert.ok(requests[0].prompt.includes('높은 전문성을 비판이나 부정적 반응과 동일시하지 않는다'));
  assert.ok(!requests[0].prompt.includes('ageGroup이 어릴수록 단순'));

  await service.generateComments({
    documentPath: node.path,
    startAge: 20,
    endAge: 30,
    expertise: 20,
    count: 12,
  });
  const combinations = new Map();
  for (const slot of requests[1].slots) {
    const key = slot[1] + ':' + slot[2];
    combinations.set(key, (combinations.get(key) ?? 0) + 1);
    assert.ok(Number(slot[2]) <= 20);
  }
  assert.equal(combinations.size, 4);
  assert.ok([...combinations.values()].every((count) => count === 3));
});

test('excess generated comments are trimmed while missing comments still fail', async (t) => {
  const { service, node } = await fixture(t);
  await service.updateSelectedLLMModel('test-model');
  const generated = Array.from({ length: 10 }, (_, index) => ({
    content: `comment-${index + 1}`,
    tone: '몰입',
  }));
  t.mock.method(ollama, 'chat', async () => ({
    message: { content: JSON.stringify({ comments: [...generated, null] }) },
  }));
  const payload = {
    documentPath: node.path,
    startAge: 20,
    endAge: 20,
    expertise: 0,
    count: 10,
  };
  const comments = await service.generateComments(payload);
  assert.equal(comments.length, 10);
  assert.deepEqual(
    comments.map((comment) => comment.content),
    generated.map((comment) => comment.content),
  );

  ollama.chat.mock.mockImplementation(async () => ({
    message: { content: JSON.stringify({ comments: generated.slice(0, 9) }) },
  }));
  await assert.rejects(service.generateComments(payload), /댓글 생성 결과 개수\(9\)/);
});

test('selected persona chips limit slots, style examples and saved metadata', async (t) => {
  const { service, node } = await fixture(t);
  await service.updateSelectedLLMModel('test-model');
  await service.addCommentExample({ content: 'selected-style-example', expertiseLevel: 60 });
  await service.addCommentExample({ content: 'unselected-style-example', expertiseLevel: 40 });
  let prompt = '';
  t.mock.method(ollama, 'chat', async ({ messages }) => {
    prompt = messages.find((message) => message.role === 'user').content;
    return {
      message: {
        content: JSON.stringify({
          comments: Array.from({ length: 10 }, () => ({
            content: '반응',
            tone: '지적',
            expertiseLevel: 100,
          })),
        }),
      },
    };
  });
  const payload = {
    documentPath: node.path,
    startAge: 20,
    endAge: 20,
    count: 10,
    readingExperiences: ['입문', '숙련'],
    expertise: 80,
    interests: ['문장'],
    reactions: ['몰입'],
  };
  const comments = await service.generateComments(payload);
  const slots = [
    ...prompt.matchAll(
      /\d+\. ageGroup=(\d+), expertiseLevel=(\d+), expertiseLabel="([^"]+)", interest="([^"]+)", reaction="([^"]+)"/g,
    ),
  ];
  assert.equal(slots.length, 10);
  assert.equal(slots.filter((slot) => slot[2] === '0').length, 5);
  assert.equal(slots.filter((slot) => slot[2] === '60').length, 5);
  assert.ok(slots.every((slot) => slot[4] === '문장' && slot[5] === '몰입'));
  assert.ok(prompt.includes('selected-style-example'));
  assert.ok(!prompt.includes('unselected-style-example'));
  assert.ok(
    comments.every(
      (comment) => [0, 60].includes(comment.expertiseLevel) && comment.tone === '몰입',
    ),
  );
  for (const field of ['readingExperiences', 'interests', 'reactions']) {
    await assert.rejects(service.generateComments({ ...payload, [field]: [] }), /최소 하나/);
    await assert.rejects(
      service.generateComments({ ...payload, [field]: ['invalid'] }),
      /최소 하나/,
    );
  }
  await assert.rejects(
    service.generateComments({ ...payload, startAge: 40, endAge: 20 }),
    /조건이 올바르지/,
  );
  await assert.rejects(service.generateComments({ ...payload, count: 0 }), /조건이 올바르지/);
  ollama.chat.mock.mockImplementation(async () => ({
    message: { content: JSON.stringify({ comments: [null] }) },
  }));
  await assert.rejects(service.generateComments({ ...payload, count: 1 }), /1번째 항목이 올바르지/);
});

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
  assert.equal(versions[0].user_version, 4);
});

test('newer workspace format is rejected without downgrading its schema', async (t) => {
  const { service, workspace } = await fixture(t);
  await withDatabase(workspace, (db) => run(db, 'PRAGMA user_version = 99'));
  await assert.rejects(service.initCurrentWorkspace(), /최신 버전/);
  const versions = await withDatabase(workspace, (db) => all(db, 'PRAGMA user_version'));
  assert.equal(versions[0].user_version, 99);
});

test('style examples upgrade legacy ages and preserve old reading experience metadata', async (t) => {
  const { service, workspace, node } = await fixture(t);
  const old = await service.addCommentExample({
    content: 'legacy-example',
    ageGroup: 2,
    expertiseLevel: 20,
    tone: '의문',
  });
  await withDatabase(workspace, async (db) => {
    await run(db, 'ALTER TABLE comment_examples DROP COLUMN interest');
    await run(db, 'PRAGMA user_version = 2');
  });
  await service.initCurrentWorkspace();
  const upgraded = (await service.listCommentExamples()).find((example) => example.id === old.id);
  assert.equal(upgraded.ageGroup, 30);
  assert.equal(upgraded.expertiseLevel, 20);
  assert.equal(upgraded.interest, null);
  const saved = await service.addCommentExample({
    content: 'matching-interest-example',
    ageGroup: 30,
    expertiseLevel: 40,
    interest: '문장',
    tone: '의문',
  });
  assert.equal(saved.interest, '문장');
  await service.addCommentExample({
    content: 'wrong-interest-example',
    interest: '세계관',
    expertiseLevel: 40,
  });
  await service.addCommentExample({
    content: 'wrong-reaction-example',
    interest: '문장',
    expertiseLevel: 40,
    tone: '지적',
  });
  await service.updateSelectedLLMModel('test-model');
  let prompt;
  t.mock.method(ollama, 'chat', async ({ messages }) => {
    prompt = messages.find((message) => message.role === 'user').content;
    return {
      message: {
        content: JSON.stringify({ comments: [{ content: '문장에 대한 질문', tone: '의문' }] }),
      },
    };
  });
  await service.generateComments({
    documentPath: node.path,
    startAge: 30,
    endAge: 30,
    count: 1,
    readingExperiences: ['일반'],
    interests: ['문장'],
    reactions: ['의문'],
  });
  assert.ok(prompt.includes('legacy-example'));
  assert.ok(prompt.includes('matching-interest-example'));
  assert.ok(prompt.includes('관심사 문장'));
  assert.ok(!prompt.includes('wrong-interest-example'));
  assert.ok(!prompt.includes('wrong-reaction-example'));
  assert.equal((await service.getDocument(node.path)).document.draft.content, '첫 저장 원고');
  await assert.rejects(
    service.addCommentExample({ content: 'invalid', interest: 'invalid' }),
    /관심사/,
  );
});

test('backup reminder persists per workspace and only advances after successful backup', async (t) => {
  const { service, workspace, root } = await fixture(t);
  const { isBackupOverdue, BACKUP_REMINDER_INTERVAL_MS } =
    await import('../dist-electron/repositories/backup-status-repository.js');
  assert.equal((await service.getWorkspaceBackupStatus()).lastBackupAt, null);
  const before = await service.getWorkspaceBackupStatus();
  assert.equal(before.overdue, true);
  const backup = await service.backupWorkspace(root);
  const status = await service.getWorkspaceBackupStatus();
  assert.equal(status.workspacePath, workspace);
  assert.equal(status.overdue, false);
  assert.equal(
    status.lastBackupAt,
    JSON.parse(await fs.readFile(path.join(backup.path, 'groomi-backup.json'), 'utf8')).createdAt,
  );
  assert.equal(
    isBackupOverdue(
      status.lastBackupAt,
      Date.parse(status.lastBackupAt) + BACKUP_REMINDER_INTERVAL_MS - 1,
    ),
    false,
  );
  assert.equal(
    isBackupOverdue(
      status.lastBackupAt,
      Date.parse(status.lastBackupAt) + BACKUP_REMINDER_INTERVAL_MS,
    ),
    true,
  );
  await assert.rejects(service.backupWorkspace(path.join(root, 'missing-parent')));
  assert.deepEqual(await service.getWorkspaceBackupStatus(), status);
  const reloaded = createWorkspaceService({ getPath: () => path.join(root, 'app') });
  await reloaded.setCurrentWorkspacePath(workspace);
  assert.equal((await reloaded.getWorkspaceBackupStatus()).lastBackupAt, status.lastBackupAt);
  const other = path.join(root, 'another-workspace');
  await service.setCurrentWorkspacePath(other);
  assert.equal((await service.getWorkspaceBackupStatus()).lastBackupAt, null);
});
