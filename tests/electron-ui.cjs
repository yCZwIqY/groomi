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
    const target = [...document.querySelectorAll('button, a, div.truncate')].find((element) => element.textContent.trim() === ${JSON.stringify(label)});
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
    const first = await service.createDocument(workspace, '첫 회차');
    const second = await service.createDocument(workspace, '두 번째 회차');
    const { registerIpcHandlers } = await load('ipc/index.js');
    registerIpcHandlers(app);
    const { ipcMain } = require('electron');
    const { secureHandle } = await load('ipc/ipc-guards.js');
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
