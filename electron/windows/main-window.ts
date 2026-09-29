import { fileURLToPath } from 'url';
import path from 'path';

import { app, BrowserWindow, nativeImage, shell } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:3000';
const PRODUCTION_RENDERER_URL = 'app://groomi/';
const RETRY_DELAY_MS = 1000;
const PRELOAD_PATH = path.resolve(__dirname, '../preload.cjs');

function getWindowIcon() {
  const iconPath = path.resolve(app.getAppPath(), 'assets/app-logo.png');
  return nativeImage.createFromPath(iconPath);
}

function loadRenderer(mainWindow: BrowserWindow) {
  const rendererUrl = app.isPackaged ? PRODUCTION_RENDERER_URL : DEV_SERVER_URL;

  mainWindow.loadURL(rendererUrl).catch(() => {
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        loadRenderer(mainWindow);
      }
    }, RETRY_DELAY_MS);
  });
}

export function createMainWindow() {
  const mainWindow = new BrowserWindow({
    title: '그루미',
    width: 1200,
    height: 700,
    show: false,
    icon: getWindowIcon(),
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        loadRenderer(mainWindow);
      }
    }, RETRY_DELAY_MS);
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (navigationUrl !== currentUrl) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  loadRenderer(mainWindow);

  return mainWindow;
}
