import { AsyncLocalStorage } from 'node:async_hooks';

export type AiTaskUsage = {
  provider: 'openrouter';
  inputTokens: number | null;
  outputTokens: number | null;
  requestCount: number;
  complete: boolean;
  costUsd: number | null;
  costComplete: boolean;
};

const tasks = new AsyncLocalStorage<{
  requests: number;
  inputs: number[];
  outputs: number[];
  costs: number[];
}>();

export function beginAiUsageRequest() {
  const task = tasks.getStore();
  if (task) task.requests++;
}

export function recordAiUsageResponse(input: unknown, output: unknown, cost: unknown) {
  const task = tasks.getStore();
  if (!task) return;
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) task.costs.push(cost);
  if (typeof input === 'number' && Number.isSafeInteger(input) && input >= 0)
    task.inputs.push(input);
  if (typeof output === 'number' && Number.isSafeInteger(output) && output >= 0)
    task.outputs.push(output);
}

export async function withAiTaskUsage<T>(
  action: () => Promise<T>,
): Promise<{ result: T; usage?: AiTaskUsage }> {
  const task = {
    requests: 0,
    inputs: [] as number[],
    outputs: [] as number[],
    costs: [] as number[],
  };
  return tasks.run(task, async () => {
    const result = await action();
    if (!task.requests) return { result };
    return {
      result,
      usage: {
        provider: 'openrouter',
        costUsd: task.costs.length ? task.costs.reduce((a, b) => a + b, 0) : null,
        costComplete: task.costs.length === task.requests,
        inputTokens: task.inputs.length ? task.inputs.reduce((a, b) => a + b, 0) : null,
        outputTokens: task.outputs.length ? task.outputs.reduce((a, b) => a + b, 0) : null,
        requestCount: task.requests,
        complete: task.inputs.length === task.requests && task.outputs.length === task.requests,
      },
    };
  });
}
