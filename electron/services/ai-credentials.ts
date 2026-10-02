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
      throw new Error('이 기기에서 API 키 암호화 저장을 사용할 수 없습니다.');
    }
  };
  return {
    async hasKey() {
      try {
        await fs.access(filePath);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw new Error('API 키 저장 상태를 확인하지 못했습니다.');
      }
    },
    async readKey() {
      assertEncryption();
      try {
        return encryption.decryptString(await fs.readFile(filePath));
      } catch {
        throw new Error('OpenRouter API 키를 읽지 못했습니다. 설정에서 다시 등록해주세요.');
      }
    },
    async saveKey(value: string) {
      assertEncryption();
      const key = value.trim();
      if (!key || key.length > 4096 || /\s/.test(key)) {
        throw new Error('올바른 API 키를 입력해주세요.');
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
