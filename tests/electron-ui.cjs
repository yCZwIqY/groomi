const { app, BrowserWindow, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

const projectRoot = path.resolve(__dirname, '..');
const appRoot = process.env.GROOMI_APP_ROOT || projectRoot;
const load = (file) => import(pathToFileURL(path.join(appRoot, 'dist-electron', file)).href);
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);
let root;
let window;
const errors = [];

async function until(check, description) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out: ${description}`);
}

async function click(label) {
  const result = await window.webContents.executeJavaScript(`(() => {
    const target = [...document.querySelectorAll('button, a, div.truncate')].find((element) => element.textContent.trim() === ${JSON.stringify(label)} || (element.getAttribute('role') === 'option' && element.firstElementChild?.textContent.trim() === ${JSON.stringify(label)}));
    if (!target) return { missing: ${JSON.stringify(label)}, body: document.body.textContent };
    target.click();
    return { clicked: true };
  })()`);
  assert.ok(result.clicked, `Missing control ${label}: ${result.body}`);
}

async function edit(content) {
  await window.webContents.executeJavaScript(`(() => {
    const editor = document.querySelector('[contenteditable="true"]');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  })()`);
  window.webContents.insertText(content);
  await until(
    () =>
      window.webContents.executeJavaScript(
        `document.querySelector('[contenteditable="true"]')?.textContent === ${JSON.stringify(content)}`,
      ),
    'editor input',
  );
}

app
  .whenReady()
  .then(async () => {
    root = process.env.GROOMI_TEST_DIR || (await fs.mkdtemp(path.join(os.tmpdir(), 'groomi-ui-')));
    app.setPath('userData', path.join(root, 'app-data'));
    // The harness lives in tests/, while product assets live at the repository root.
    app.getAppPath = () => appRoot;
    const { createWorkspaceService } = await load('services/workspace-service.js');
    const service = createWorkspaceService(app);
    const workspace = path.join(root, 'workspace');
    await service.setCurrentWorkspacePath(workspace);
    await service.updateSelectedLLMModel('test-local-model');
    const first = await service.createDocument(workspace, '첫 회차');
    const second = await service.createDocument(workspace, '두 번째 회차');
    const seededText = (content) => ({
      content,
      charsWithSpaces: content.length,
      charsWithoutSpaces: content.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await service.updateDocument(first.path, {
      document: {
        draft: seededText('<p>기존에 저장된 초안</p>'),
        manuscript: seededText('<p>기존에 저장된 원고</p>'),
      },
    });
    const { withDatabase } = await load('db/connection.js');
    const { createDocumentCommentRepository } = await load(
      'repositories/document-comment-repository.js',
    );
    await withDatabase(workspace, (db) =>
      createDocumentCommentRepository(db).insertComments(first.id, [
        { content: '선택 삭제 댓글' },
        { content: '유지할 댓글' },
        { content: '전체 삭제 댓글' },
      ]),
    );
    const { registerIpcHandlers } = await load('ipc/index.js');
    registerIpcHandlers(app);
    const { ipcMain } = require('electron');
    const { secureHandle } = await load('ipc/ipc-guards.js');
    ipcMain.removeHandler('ollama:is-running');
    secureHandle('ollama:is-running', async () => true);
    let completedUpdates = 0;
    ipcMain.removeHandler('document:update');
    secureHandle('document:update', async (_event, documentPath, payload) => {
      try {
        return await service.updateDocument(documentPath, payload);
      } finally {
        completedUpdates++;
      }
    });
    const { registerRendererProtocol } = await load('renderer-protocol.js');
    registerRendererProtocol();
    window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        preload: path.join(appRoot, 'dist-electron', 'preload.cjs'),
        contextIsolation: true,
        sandbox: true,
      },
    });
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error' || event.level === 3) errors.push(event.message);
    });
    await window.loadURL('app://groomi/');
    await until(
      () => window.webContents.executeJavaScript(`document.body.textContent.includes('첫 회차')`),
      'workspace hydration',
    );
    await click('첫 회차');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelectorAll('[contenteditable="true"]').length === 2`,
        ),
      'editors',
    );
    await until(
      () =>
        window.webContents.executeJavaScript(`(() => {
        const editors = document.querySelectorAll('[contenteditable="true"]');
        return editors[0]?.textContent === '기존에 저장된 초안' && editors[1]?.textContent === '기존에 저장된 원고';
      })()`),
      'saved draft and manuscript hydration',
    );

    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelectorAll('input[aria-label^="댓글 선택:"]').length === 3`,
        ),
      'comment selection loaded',
    );
    await window.webContents.executeJavaScript(
      `document.querySelector('input[aria-label^="댓글 선택:"]').click()`,
    );
    await until(
      () =>
        window.webContents.executeJavaScript(`document.body.textContent.includes('1개 선택됨')`),
      'comment selected',
    );
    await click('선택 삭제');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.body.textContent.includes('선택한 댓글 1개를')`,
        ),
      'selected deletion confirmation',
    );
    await window.webContents.executeJavaScript(
      `([...document.querySelectorAll('.modal-overlay--open button')].find((button) => button.textContent.trim() === '삭제')).click()`,
    );
    await until(
      async () => (await service.listGeneratedComments(first.path)).length === 2,
      'selected comments deleted',
    );
    await click('전체 삭제');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.body.textContent.includes('댓글 2개를 모두')`,
        ),
      'all deletion confirmation',
    );
    await window.webContents.executeJavaScript(
      `([...document.querySelectorAll('.modal-overlay--open button')].find((button) => button.textContent.trim() === '삭제')).click()`,
    );
    await until(
      async () => (await service.listGeneratedComments(first.path)).length === 0,
      'all comments deleted',
    );
    console.log('PASS: checkbox selection and confirmed batch comment deletion');
    ipcMain.removeHandler('comment:generateComments');
    secureHandle('comment:generateComments', async () => {
      throw new Error('테스트 생성 실패 사유');
    });
    await click('댓글 생성');
    await until(
      () => window.webContents.executeJavaScript(`document.body.textContent.includes('실패 1건')`),
      'failed background task badge',
    );
    await window.webContents.executeJavaScript(
      `([...document.querySelectorAll('button')].find((button) => button.textContent.includes('백그라운드 작업'))).click()`,
    );
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.body.textContent.includes('테스트 생성 실패 사유')`,
        ),
      'background failure reason retained',
    );
    console.log('PASS: background failure reason is retained in task history');
    const failureText = await window.webContents.executeJavaScript('document.body.textContent');
    assert.ok(failureText.includes('Error: 테스트 생성 실패 사유'));
    assert.ok(!failureText.includes("Error invoking remote method 'comment:generateComments'"));
    ipcMain.removeHandler('ollama:is-running');
    secureHandle('ollama:is-running', async () => false);
    await service.updateSelectedLLMModel(null);
    await window.webContents.executeJavaScript(
      `([...document.querySelectorAll('button')].find((button) => button.textContent.includes('백그라운드 작업'))).click()`,
    );
    await edit('이동 직전 입력');
    await click('두 번째 회차');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('input')?.value === '두 번째 회차'`,
        ),
      'chapter switch',
    );
    assert.ok(
      (await service.getDocument(first.path)).document.draft.content.includes('이동 직전 입력'),
    );
    console.log('PASS: immediate chapter switch flushes the manuscript');

    await edit('설정 이동 직전 입력');
    await window.webContents.executeJavaScript(
      `document.querySelector('a[href="/setting"]').click()`,
    );
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.body.textContent.includes('원고 백업·복원')`,
        ),
      'settings navigation',
    );
    assert.ok(
      (await service.getDocument(second.path)).document.draft.content.includes(
        '설정 이동 직전 입력',
      ),
    );
    console.log('PASS: route navigation flushes the manuscript');

    // Exercise the real credential IPC and both remote generation services without paid requests.
    let remoteRequests = 0;
    let responseMode = 'story-memory';
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/models'))
        return new Response(
          JSON.stringify({
            data: [
              ...[
                'anthropic/claude-opus-5.5',
                'openai/gpt-6.1-sol',
                'anthropic/claude-sonnet-5.5',
                'upstage/solar-mini4',
                'upstage/solar-pro4',
                'deepseek/deepseek-v4.1-flash',
              ].map((id) => ({
                id,
                name: id,
                context_length: 32768,
                architecture: { input_modalities: ['text'], output_modalities: ['text'] },
                supported_parameters: ['response_format'],
                pricing: { prompt: '0.000001', completion: '0.000002' },
              })),
              {
                id: 'test/remote-model',
                name: 'Test Remote Model',
                context_length: 32768,
                architecture: { input_modalities: ['text'], output_modalities: ['text'] },
                supported_parameters: ['response_format'],
                pricing: { prompt: '0.000001', completion: '0.000002' },
              },
              {
                id: 'test/free-model:free',
                name: 'Test Free Model',
                context_length: 65536,
                architecture: { input_modalities: ['text'], output_modalities: ['text'] },
                supported_parameters: ['response_format'],
                pricing: { prompt: '0', completion: '0' },
              },
            ],
          }),
        );
      assert.equal(options.headers.Authorization, 'Bearer test-openrouter-ui-key');
      if (url.endsWith('/key')) return new Response(JSON.stringify({ data: {} }));
      assert.ok(url.endsWith('/chat/completions'));
      remoteRequests++;
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'test/remote-model');
      assert.ok(
        body.messages.some((message) => message.content.includes('OpenRouter 생성 직전 입력')),
      );
      assert.ok(
        (await service.getDocument(first.path)).document.draft.content.includes(
          'OpenRouter 생성 직전 입력',
        ),
      );
      const payload =
        responseMode === 'story-memory'
          ? { synopsis: '원격 생성 줄거리', events: [], characters: [], plotHooks: [] }
          : {
              comments: Array.from({ length: 5 }, (_, index) => ({
                content: `원격 댓글 ${index + 1}`,
              })),
            };
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }],
        }),
      );
    };
    await window.webContents.executeJavaScript(`(() => {
      const section = [...document.querySelectorAll('section')].find((element) => element.querySelector('h3')?.textContent === 'AI 모델 설정');
      section.querySelector('button[aria-expanded]').click();
      const label = [...section.querySelectorAll('label')].find((element) => element.textContent === 'AI 제공자');
      document.getElementById(label.htmlFor).click();
    })()`);
    await click('OpenRouter · 온라인');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `Boolean(document.querySelector('#openrouter-api-key:not(:disabled)'))`,
        ),
      'OpenRouter setting controls',
    );
    await window.webContents.executeJavaScript(
      `document.querySelector('#openrouter-api-key').focus()`,
    );
    window.webContents.insertText('test-openrouter-ui-key');
    await click('키 저장');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('#openrouter-api-key').value === '' && [...document.querySelectorAll('button')].some((button) => button.textContent === '연결 확인' && !button.disabled)`,
        ),
      'encrypted key saved and input cleared',
    );
    const publicSettings = await window.webContents.executeJavaScript(
      'window.electronAPI.getSettingInfo()',
    );
    assert.equal(publicSettings.hasOpenRouterKey, true);
    assert.equal(JSON.stringify(publicSettings).includes('test-openrouter-ui-key'), false);
    await click('연결 확인');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.body.textContent.includes('연결 확인 완료')`,
        ),
      'OpenRouter key checked',
    );
    assert.deepEqual(
      await window.webContents.executeJavaScript(
        `['추천 모델 (유료 · 성능)', '추천 모델 (유료 · 가성비)'].map((title) => [...document.querySelectorAll('h4')].find((heading) => heading.textContent === title)?.parentElement.querySelectorAll('button[aria-label]').length)`,
      ),
      [3, 3],
    );
    await window.webContents.executeJavaScript(
      `document.querySelector('button[aria-label="upstage/solar-mini4 선택"]').click()`,
    );
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('button[aria-label="upstage/solar-mini4 선택"]')?.textContent.trim() === '선택됨' && !document.querySelector('input[role="combobox"]').disabled`,
        ),
      'paid recommendation selected',
    );
    assert.equal((await service.getSettingInfo()).openRouterModel, 'upstage/solar-mini4');
    assert.equal(remoteRequests, 0);
    console.log(
      'PASS: both paid recommendation groups show three models and selection persists without generation',
    );
    await window.webContents.executeJavaScript(
      `document.querySelector('button[aria-label="Test Free Model 선택"]').click()`,
    );
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('button[aria-label="Test Free Model 선택"]')?.textContent.trim() === '선택됨' && ![...document.querySelectorAll('button[aria-haspopup="listbox"]')].some((button) => button.disabled)`,
        ),
      'free recommendation selected',
    );
    assert.equal((await service.getSettingInfo()).openRouterModel, 'test/free-model:free');
    console.log('PASS: free recommendation selects and persists the model');
    await window.webContents.executeJavaScript(`(() => {
      const section = [...document.querySelectorAll('section')].find((element) => element.querySelector('h3')?.textContent === 'AI 모델 설정');
      const label = [...section.querySelectorAll('label')].find((element) => element.textContent === 'LLM 모델');
      const input = document.getElementById(label.htmlFor);
      input.focus();
      input.click();
    })()`);
    window.webContents.insertText('test/remote');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelectorAll('[role="listbox"][aria-label="LLM 모델"] [role="option"]').length === 1 && document.querySelector('[role="option"]')?.textContent.includes('Test Remote Model')`,
        ),
      'model ID autocomplete filtering',
    );
    assert.equal((await service.getSettingInfo()).openRouterModel, 'test/free-model:free');
    assert.equal(
      await window.webContents.executeJavaScript(
        `document.querySelectorAll('input[type="search"]').length`,
      ),
      0,
    );
    await click('Test Remote Model');
    await until(
      async () => (await service.getSettingInfo()).openRouterModel === 'test/remote-model',
      'OpenRouter model saved',
    );
    const encrypted = await fs.readFile(path.join(root, 'app-data', 'openrouter-key.enc'));
    assert.equal(encrypted.includes('test-openrouter-ui-key'), false);
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('input[role="combobox"]')?.value === 'Test Remote Model' && !document.querySelector('input[role="combobox"]').disabled && document.body.textContent.includes('100만 토큰당 입력 $1.00')`,
        ),
      'selected model and pricing rendered',
    );
    if (process.env.GROOMI_UI_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.GROOMI_UI_SCREENSHOT_DIR, { recursive: true });
      await fs.writeFile(
        path.join(process.env.GROOMI_UI_SCREENSHOT_DIR, 'openrouter-settings.png'),
        (await window.webContents.capturePage()).toPNG(),
      );
    }
    const backup = await service.backupWorkspace(root);
    await assert.rejects(fs.access(path.join(backup.path, 'openrouter-key.enc')));
    console.log(
      'PASS: OpenRouter selection, encrypted key IPC, connection check and model selection',
    );
    await click('첫 회차');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === '회차 정보 생성' && !button.disabled)`,
        ),
      'remote generation ready with Ollama stopped',
    );
    await click('저장');
    await until(
      () => window.webContents.executeJavaScript(`document.body.textContent.includes('저장완료')`),
      'save without generation',
    );
    assert.equal(remoteRequests, 0);
    await edit('OpenRouter 생성 직전 입력');
    await click('회차 정보 생성');
    await until(
      async () =>
        (await service.getDocument(first.path)).document.storyMemory?.synopsis ===
        '원격 생성 줄거리',
      'remote story memory persisted',
    );
    assert.equal(remoteRequests, 1);
    await until(
      () =>
        window.webContents.executeJavaScript(
          `[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === '댓글 생성' && !button.disabled)`,
        ),
      'background generation complete',
    );
    ipcMain.removeHandler('comment:generateComments');
    secureHandle('comment:generateComments', (_event, params) => service.generateComments(params));
    responseMode = 'comments';
    await click('5개');
    await click('댓글 생성');
    await until(
      async () => (await service.listGeneratedComments(first.path)).length === 5,
      'remote comments persisted',
    );
    assert.equal(remoteRequests, 2);
    console.log(
      'PASS: separate save and remote generation with auto-save; comments work without Ollama',
    );
    await window.webContents.executeJavaScript(
      `document.querySelector('a[href="/setting"]').click()`,
    );
    await until(
      () =>
        window.webContents.executeJavaScript(
          `Boolean(document.querySelector('#openrouter-api-key'))`,
        ),
      'return to AI settings',
    );
    await window.webContents.executeJavaScript(`(() => {
      const section = [...document.querySelectorAll('section')].find((element) => element.querySelector('h3')?.textContent === 'AI 모델 설정');
      section.querySelector('button[aria-expanded]').click();
    })()`);
    await click('키 삭제');
    await until(
      () => window.webContents.executeJavaScript(`document.body.textContent.includes('키 미등록')`),
      'key removed',
    );
    await assert.rejects(fs.access(path.join(root, 'app-data', 'openrouter-key.enc')));
    await service.updateAiSettings('ollama', 'test/remote-model');
    console.log('PASS: OpenRouter key deletion');

    await window.webContents.executeJavaScript(`(() => {
      const section = [...document.querySelectorAll('section')].find((element) => element.querySelector('h3')?.textContent.includes('댓글 스타일 예시'));
      section.querySelector('button[aria-expanded]').click();
    })()`);
    await click('일반');
    await click('문장');
    await click('질문');
    await window.webContents.executeJavaScript(`(() => {
      const section = [...document.querySelectorAll('section')].find((element) => element.querySelector('h3')?.textContent.includes('댓글 스타일 예시'));
      section.querySelector('summary').click();
      section.querySelector('textarea').focus();
    })()`);
    await click('30대');
    window.webContents.insertText('설정에서 저장한 문장 질문 예시');
    await window.webContents.executeJavaScript(`(() => {
      const section = [...document.querySelectorAll('section')].find((element) => element.querySelector('h3')?.textContent.includes('댓글 스타일 예시'));
      section.querySelector('button[aria-expanded]').click();
    })()`);
    assert.ok(
      await window.webContents.executeJavaScript(`(() => {
      const toggle = document.querySelector('button[aria-controls][aria-expanded="false"]');
      return toggle && document.getElementById(toggle.getAttribute('aria-controls')).hidden;
    })()`),
    );
    await window.webContents.executeJavaScript(`(() => {
      const section = [...document.querySelectorAll('section')].find((element) => element.querySelector('h3')?.textContent.includes('댓글 스타일 예시'));
      section.querySelector('button[aria-expanded]').click();
    })()`);
    assert.equal(
      await window.webContents.executeJavaScript(`document.querySelector('textarea').value`),
      '설정에서 저장한 문장 질문 예시',
    );
    await click('예시 저장');
    await until(
      async () =>
        (await service.listCommentExamples()).some(
          (example) => example.content === '설정에서 저장한 문장 질문 예시',
        ),
      'style example saved',
    );
    const styleExample = (await service.listCommentExamples()).find(
      (example) => example.content === '설정에서 저장한 문장 질문 예시',
    );
    assert.equal(styleExample.expertiseLevel, 40);
    assert.equal(styleExample.interest, '문장');
    assert.equal(styleExample.tone, '의문');
    assert.equal(styleExample.ageGroup, 30);
    console.log('PASS: style example chips save reading experience, interest, reaction and age');

    await click('첫 회차');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelectorAll('[contenteditable="true"]').length === 2`,
        ),
      'editor return',
    );
    await edit('저장 실패 후 남아야 할 입력');
    const file = path.join(workspace, 'scripts', `${first.id}.json`);
    const original = await fs.readFile(file, 'utf8');
    await fs.rename(file, `${file}.original`);
    await fs.mkdir(file);
    await click('두 번째 회차');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('.typo-b6-r')?.textContent.startsWith('저장 실패')`,
        ),
      'save error',
    );
    assert.equal(
      await window.webContents.executeJavaScript(`document.querySelector('input')?.value`),
      '첫 회차',
    );
    assert.equal(
      await window.webContents.executeJavaScript(
        `document.querySelector('[contenteditable="true"]').textContent`,
      ),
      '저장 실패 후 남아야 할 입력',
    );
    const beforeRouteFailure = completedUpdates;
    await window.webContents.executeJavaScript(
      `document.querySelector('a[href="/setting"]').click()`,
    );
    await until(() => completedUpdates > beforeRouteFailure, 'route save failure');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('.typo-b6-r')?.textContent.startsWith('저장 실패')`,
        ),
      'blocked route',
    );
    assert.equal(await window.webContents.executeJavaScript('location.pathname'), '/manuscript');
    await fs.rmdir(file);
    await fs.writeFile(file, original);
    console.log('PASS: failed save blocks chapter switching and retains editor text');

    await click('저장');
    await until(
      async () =>
        (await service.getDocument(first.path)).document.draft.content.includes(
          '저장 실패 후 남아야 할 입력',
        ),
      'manual retry',
    );
    await until(
      () => window.webContents.executeJavaScript(`document.body.textContent.includes('저장완료')`),
      'save toast',
    );
    assert.ok(
      !(await window.webContents.executeJavaScript(`document.body.textContent`)).includes(
        '정보 생성에 실패',
      ),
    );
    console.log('PASS: retry and saving without an AI model');

    ipcMain.removeHandler('document:update');
    let requestStarted = false;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    secureHandle('document:update', async (_event, documentPath, payload) => {
      if (!requestStarted) {
        requestStarted = true;
        await gate;
      }
      return service.updateDocument(documentPath, payload);
    });
    await edit('저장 시작 내용');
    await click('저장');
    await until(() => requestStarted, 'in-flight save');
    await edit('저장 도중 추가한 내용');
    release();
    await until(
      async () =>
        (await service.getDocument(first.path)).document.draft.content.includes(
          '저장 도중 추가한 내용',
        ),
      'follow-up save',
    );
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('.typo-b6-r')?.textContent === '자동 저장됨'`,
        ),
      'save completion',
    );
    console.log('PASS: edits during an in-flight save are persisted');

    await edit('회차 정보 저장 후에도 유지할 원고');
    await click('사건·인물·떡밥 보기');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `Boolean(document.querySelector('.modal-overlay--open textarea'))`,
        ),
      'story memory modal',
    );
    await window.webContents.executeJavaScript(`(() => {
      const modal = document.querySelector('.modal-overlay--open');
      [...modal.querySelectorAll('button')].find((button) => button.textContent.trim() === '저장').click();
    })()`);
    await until(
      () => window.webContents.executeJavaScript(`!document.querySelector('.modal-overlay--open')`),
      'story memory saved',
    );
    assert.equal(
      await window.webContents.executeJavaScript(
        `document.querySelector('[contenteditable="true"]').textContent`,
      ),
      '회차 정보 저장 후에도 유지할 원고',
    );
    await click('두 번째 회차');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('input')?.value === '두 번째 회차'`,
        ),
      'switch after memory save',
    );
    assert.ok(
      (await service.getDocument(first.path)).document.draft.content.includes(
        '회차 정보 저장 후에도 유지할 원고',
      ),
    );
    await click('첫 회차');
    await until(
      () =>
        window.webContents.executeJavaScript(
          `document.querySelector('[contenteditable="true"]')?.textContent === '회차 정보 저장 후에도 유지할 원고'`,
        ),
      'reopen after memory save',
    );
    console.log('PASS: story memory save preserves manuscript edits through chapter switching');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const reopened = await service.getDocument(first.path);
    assert.ok(reopened.document.draft.content.includes('회차 정보 저장 후에도 유지할 원고'));
    assert.ok(reopened.document.manuscript.content.includes('기존에 저장된 원고'));
    console.log('PASS: hydration does not autosave empty draft or manuscript');

    await edit('종료 직전 입력');
    window.close();
    await until(() => window.isDestroyed(), 'window close after flush');
    assert.ok(
      (await service.getDocument(first.path)).document.draft.content.includes('종료 직전 입력'),
    );
    console.log('PASS: window close waits for saving');
    assert.deepEqual(
      errors.filter((message) => !message.includes('Electron Security Warning')),
      [],
    );
    console.log('PASS: no renderer errors');
  })
  .then(async () => {
    app.emit('before-quit', { preventDefault() {} });
    await (
      await load('services/workspace-operation.js')
    ).serializeWorkspaceOperation(async () => {});
    app.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    console.error('Renderer errors:', errors);
    if (window && !window.isDestroyed()) {
      const screenshot = await window.webContents.capturePage();
      await fs.writeFile(path.join(projectRoot, 'release-ui-failure.png'), screenshot.toPNG());
      window.destroy();
    }
    app.emit('before-quit', { preventDefault() {} });
    await (
      await load('services/workspace-operation.js')
    ).serializeWorkspaceOperation(async () => {});
    app.exit(1);
  });

app.on('window-all-closed', () => {});
