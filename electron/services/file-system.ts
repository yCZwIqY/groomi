import fs from 'node:fs/promises';
import path from 'node:path';
import { LEGACY_DATABASE_NAME } from '../common/paths.js';

const DEFAULT_IGNORE_FILES = ['groomi.sqlite', LEGACY_DATABASE_NAME, 'scripts', 'images'];

export type DirectoryTreeNode = {
  name: string;
  path: string;
  type: 'workspace' | 'document';
  children?: DirectoryTreeNode[];
};

type ReadDirectoryTreeOptions = {
  maxDepth?: number;
  currentDepth?: number;
  ignore?: string[];
};

export async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, {
    recursive: true,
  });
}

export async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(filePath: string) {
  return fs.readFile(filePath, 'utf8');
}

export async function readDirectoryTree(
  dirPath: string,
  options: ReadDirectoryTreeOptions = {},
): Promise<DirectoryTreeNode[]> {
  const maxDepth = options.maxDepth ?? 5;
  const currentDepth = options.currentDepth ?? 0;
  const ignore = [...DEFAULT_IGNORE_FILES, ...(options.ignore ?? [])];

  if (currentDepth >= maxDepth) {
    return [];
  }

  const entries = await fs.readdir(dirPath, {
    withFileTypes: true,
  });

  const nodes: DirectoryTreeNode[] = [];

  for (const entry of entries) {
    if (ignore.includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'workspace',
        children: await readDirectoryTree(fullPath, {
          maxDepth,
          currentDepth: currentDepth + 1,
          ignore,
        }),
      });
      continue;
    }

    if (entry.isFile()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'document',
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'workspace' ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

export async function copyFileToDirectory(sourcePath: string, targetDir: string) {
  await fs.mkdir(targetDir, { recursive: true });

  const fileName = path.basename(sourcePath);
  const targetPath = path.join(targetDir, `${crypto.randomUUID()}_${fileName}`);

  await fs.copyFile(sourcePath, targetPath);

  return targetPath;
}

export async function deleteFile(targetPath: string) {
  await fs.rm(targetPath, { recursive: true });
}
