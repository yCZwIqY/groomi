import { dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

import channels from '../common/channels.cjs';
import { readDirectoryTree, readTextFile } from '../services/file-system.js';
import { requireString, secureHandle } from './ipc-guards.js';

export function registerDirectoryIpcHandlers(
  assertInsideWorkspace: (targetPath: string) => Promise<void>,
) {
  secureHandle(channels.folder.select, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const rootPath = result.filePaths[0];

    return {
      name: path.basename(rootPath),
      path: rootPath,
      type: 'workspace',
      children: await readDirectoryTree(rootPath, {
        maxDepth: 6,
        ignore: ['app.json'],
      }),
    };
  });

  secureHandle(channels.file.read, async (_, filePath) => {
    filePath = requireString(filePath, 'filePath');
    await assertInsideWorkspace(filePath);
    return readTextFile(filePath);
  });

  secureHandle(channels.file.readImage, async (_, filePath) => {
    filePath = requireString(filePath, 'filePath');
    await assertInsideWorkspace(filePath);
    const imageBuffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : 'application/octet-stream';

    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  });
}
