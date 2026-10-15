import { AppError } from '../common/app-error.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function createAiCredentials(
  filePath: string,
  encryption: {
    isEncryptionAvailable: () => boolean;
    encryptString: (value: string) => Buffer;
    decryptString: (value: Buffer) => string;
  },
) {
  const assertEncryption = () => {
    if (!encryption.isEncryptionAvailable()) {
      throw new AppError('KEY_ENCRYPTION_UNAVAILABLE');
    }
  };
  return {
    async hasKey() {
      try {
        await fs.access(filePath);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw new AppError('KEY_STATUS_FAILED');
      }
    },
    async readKey() {
      assertEncryption();
      try {
        return encryption.decryptString(await fs.readFile(filePath));
      } catch {
        throw new AppError('KEY_READ_FAILED');
      }
    },
    async saveKey(value: string) {
      assertEncryption();
      const key = value.trim();
      if (!key || key.length > 4096 || /\s/.test(key)) {
        throw new AppError('KEY_INVALID');
      }
      const encrypted = encryption.encryptString(key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaryPath, encrypted, { mode: 0o600, flag: 'wx' });
        await fs.rename(temporaryPath, filePath);
      } finally {
        await fs.rm(temporaryPath, { force: true });
      }
    },
    async deleteKey() {
      await fs.rm(filePath, { force: true });
    },
  };
}

export async function getAiCredentials() {
  const { app, safeStorage } = await import('electron');
  return createAiCredentials(path.join(app.getPath('userData'), 'openrouter-key.enc'), {
    isEncryptionAvailable: () =>
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
    encryptString: (value) => safeStorage.encryptString(value),
    decryptString: (value) => safeStorage.decryptString(value),
  });
}
