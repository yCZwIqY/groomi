import fs from 'node:fs/promises';
import path from 'node:path';

export async function atomicWrite(filePath: string, content: string | Buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    const file = await fs.open(temporaryPath, 'wx');
    try {
      await file.writeFile(content);
      await file.sync();
    } finally {
      await file.close();
    }
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}
