import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import electron from 'electron';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'groomi-ui-'));
const packaged = process.argv.includes('--packaged');
const screenshotDirectory =
  process.env.GROOMI_UI_SCREENSHOT_DIR ||
  (process.argv.includes('--screenshots') ? path.resolve('release/ui-screenshots') : undefined);
let code = 1;
try {
  code = await new Promise((resolve, reject) => {
    const child = spawn(electron, ['tests/electron-ui.cjs'], {
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...process.env,
        GROOMI_TEST_DIR: root,
        ...(screenshotDirectory ? { GROOMI_UI_SCREENSHOT_DIR: screenshotDirectory } : {}),
        GROOMI_APP_ROOT: packaged
          ? path.resolve('release/win-unpacked/resources/app.asar')
          : process.cwd(),
      },
    });
    child.on('error', reject);
    child.on('exit', (result) => resolve(result ?? 1));
  });
} finally {
  // Chromium releases its profile files only after the Electron process exits.
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
process.exitCode = code;
