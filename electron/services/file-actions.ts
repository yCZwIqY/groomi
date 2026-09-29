import fs from 'node:fs/promises';
import path from 'node:path';

import { getWorkspaceImagesDirectoryPath } from '../common/paths.js';
import { deleteFile, ensureDirectory } from './file-system.js';
import { ensureStore } from './workspace/store.js';
import { normalizePath, toFileSystemPath } from './workspace/shared.js';
import type { WorkspaceServiceContext } from './workspace-service-context.js';

export function createFileActions(context: WorkspaceServiceContext) {
  async function removeFile(targetPath: string) {
    const rootWorkspacePath = await context.getCurrentWorkspacePath();
    const imagesDirectoryPath = getWorkspaceImagesDirectoryPath(normalizePath(rootWorkspacePath));
    const filePath = normalizePath(toFileSystemPath(targetPath));
    const relativePath = path.relative(imagesDirectoryPath, filePath);

    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('이미지 폴더 밖의 파일은 삭제할 수 없습니다.');
    }

    return deleteFile(filePath);
  }

  async function saveImage(workflowPath: string, fileName: string, buffer: number[]) {
    const rootWorkspacePath = await context.getCurrentWorkspacePath();
    const normalizedWorkflowPath = normalizePath(workflowPath);
    await context.assertInsideWorkspace(normalizedWorkflowPath);
    await ensureStore(rootWorkspacePath);

    const imagesDirectoryPath = getWorkspaceImagesDirectoryPath(normalizePath(rootWorkspacePath));
    await ensureDirectory(imagesDirectoryPath);

    const safeFileName = path.basename(fileName);
    const allowedExtensions = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);
    if (!allowedExtensions.has(path.extname(safeFileName).toLowerCase())) {
      throw new Error('지원하지 않는 이미지 형식입니다.');
    }

    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error('이미지는 10MB 이하여야 합니다.');
    }

    const targetPath = path.join(imagesDirectoryPath, `${crypto.randomUUID()}-${safeFileName}`);

    await fs.writeFile(targetPath, Buffer.from(buffer));

    return targetPath;
  }

  return {
    removeFile,
    saveImage,
    toFileSystemPath,
  };
}
