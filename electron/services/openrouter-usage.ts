import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { atomicWrite } from './atomic-file.js';

export type LocalAiUsage = {
  startedAt: string | null;
  requests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  missingTokenResponses: number;
};
export type AiUsageRecord = { failed: boolean; inputTokens?: number; outputTokens?: number };
const emptyUsage = (): LocalAiUsage => ({
  startedAt: null,
  requests: 0,
  failedRequests: 0,
  inputTokens: 0,
  outputTokens: 0,
  missingTokenResponses: 0,
});
const keyId = (key: string) => createHash('sha256').update(key).digest('hex');
const tokenCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function createOpenRouterUsageStore(filePath: string) {
  let queue: Promise<unknown> = Promise.resolve();
  async function readRecords(): Promise<Record<string, LocalAiUsage>> {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (
        !parsed ||
        parsed.version !== 1 ||
        !parsed.records ||
        typeof parsed.records !== 'object' ||
        Array.isArray(parsed.records)
      )
        throw new Error('invalid usage file');
      for (const [id, usage] of Object.entries(parsed.records)) {
        const value = usage as LocalAiUsage;
        if (
          !/^[a-f0-9]{64}$/.test(id) ||
          !value ||
          (value.startedAt !== null && typeof value.startedAt !== 'string') ||
          ![
            'requests',
            'failedRequests',
            'inputTokens',
            'outputTokens',
            'missingTokenResponses',
          ].every((field) => tokenCount(value[field as keyof LocalAiUsage]))
        )
          throw new Error('invalid usage record');
      }
      return parsed.records;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw new Error('Groomi 사용량 기록을 읽지 못했습니다. 기존 기록은 보존했습니다.');
    }
  }
  return {
    async read(key: string) {
      await queue.catch(() => {});
      return (await readRecords())[keyId(key)] ?? emptyUsage();
    },
    async record(key: string, record: AiUsageRecord) {
      const operation = queue
        .catch(() => {})
        .then(async () => {
          const records = await readRecords();
          const id = keyId(key);
          const previous = records[id] ?? emptyUsage();
          records[id] = {
            startedAt: previous.startedAt ?? new Date().toISOString(),
            requests: previous.requests + 1,
            failedRequests: previous.failedRequests + Number(record.failed),
            inputTokens:
              previous.inputTokens + (tokenCount(record.inputTokens) ? record.inputTokens : 0),
            outputTokens:
              previous.outputTokens + (tokenCount(record.outputTokens) ? record.outputTokens : 0),
            missingTokenResponses:
              previous.missingTokenResponses +
              Number(
                !record.failed &&
                  (!tokenCount(record.inputTokens) || !tokenCount(record.outputTokens)),
              ),
          };
          await atomicWrite(filePath, JSON.stringify({ version: 1, records }));
        });
      queue = operation;
      await operation;
    },
  };
}

let store: ReturnType<typeof createOpenRouterUsageStore> | undefined;
export async function getOpenRouterUsageStore() {
  if (!store) {
    const { app } = await import('electron');
    store = createOpenRouterUsageStore(path.join(app.getPath('userData'), 'openrouter-usage.json'));
  }
  return store;
}
