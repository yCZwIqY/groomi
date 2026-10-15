import { beginAiUsageRequest, recordAiUsageResponse } from './ai-task-usage.js';
import { AppError, type ErrorCode } from '../common/app-error.js';
import ollama from 'ollama';
import { getAiCredentials } from './ai-credentials.js';
import { getOpenRouterUsageStore, type AiUsageRecord } from './openrouter-usage.js';

export type AiProvider = 'ollama' | 'openrouter';
export type AiConfiguration = {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  recordUsage?: (record: AiUsageRecord) => Promise<void>;
};
export type OpenRouterModel = {
  id: string;
  name: string;
  contextLength: number;
  inputPrice: string | null;
  outputPrice: string | null;
};

export async function resolveAiConfiguration(setting: {
  aiProvider?: AiProvider;
  selectedLLMModel: string | null;
  openRouterModel?: string | null;
}): Promise<AiConfiguration> {
  const provider = setting.aiProvider ?? 'ollama';
  const model = provider === 'openrouter' ? setting.openRouterModel : setting.selectedLLMModel;
  if (!model) throw new AppError('AI_MODEL_REQUIRED');
  const apiKey = provider === 'openrouter' ? await (await getAiCredentials()).readKey() : undefined;
  return {
    provider,
    model,
    ...(apiKey
      ? {
          apiKey,
          recordUsage: async (record: AiUsageRecord) =>
            (await getOpenRouterUsageStore()).record(apiKey, record),
        }
      : {}),
  };
}

function requestError(status: number, result?: { error?: { metadata?: { raw?: unknown } } }) {
  const raw = result?.error?.metadata?.raw;
  if (status === 429 && typeof raw === 'string' && /temporarily rate-limited upstream/i.test(raw)) {
    return new AppError('AI_UPSTREAM_RATE_LIMITED');
  }
  const codes: Record<number, ErrorCode> = {
    400: 'OPENROUTER_BAD_REQUEST',
    401: 'OPENROUTER_UNAUTHORIZED',
    402: 'OPENROUTER_CREDITS_REQUIRED',
    403: 'OPENROUTER_FORBIDDEN',
    429: 'OPENROUTER_RATE_LIMITED',
  };
  return new AppError(codes[status] ?? 'OPENROUTER_FAILED');
}

function logOpenRouterError(
  endpoint: string,
  response: Response,
  result: any,
  apiKey?: string,
  body?: unknown,
) {
  const request = body as { model?: string; messages?: { content: string }[] } | undefined;
  const privateValues = [
    apiKey,
    ...(request?.messages ?? []).flatMap((message) => [
      message.content,
      JSON.stringify(message.content).slice(1, -1),
      ...message.content.split('\n').filter((line) => line.trim()),
    ]),
  ].filter((value): value is string => Boolean(value));
  const sanitize = (value: unknown) => {
    if (typeof value !== 'string') return undefined;
    let text = value;
    for (const privateValue of privateValues) text = text.split(privateValue).join('[REDACTED]');
    return text.replace(/sk-or-[a-zA-Z0-9_-]+/g, '[REDACTED]').slice(0, 4000);
  };
  const error = result?.error;
  const headers = error?.metadata?.headers;
  console.error('[openrouter-error]', {
    endpoint,
    model: request?.model,
    httpStatus: response.status,
    code: typeof error?.code === 'number' ? error.code : sanitize(error?.code),
    message: sanitize(error?.message),
    provider: sanitize(error?.metadata?.provider_name),
    raw: sanitize(error?.metadata?.raw),
    requestId: sanitize(response.headers.get('x-request-id') ?? undefined),
    retryAfter: sanitize(response.headers.get('retry-after') ?? undefined),
    rateLimit: sanitize(
      response.headers.get('x-ratelimit-limit') ?? headers?.['X-RateLimit-Limit'],
    ),
    rateRemaining: sanitize(
      response.headers.get('x-ratelimit-remaining') ?? headers?.['X-RateLimit-Remaining'],
    ),
    rateReset: sanitize(
      response.headers.get('x-ratelimit-reset') ?? headers?.['X-RateLimit-Reset'],
    ),
  });
}

export async function requestOpenRouter(
  endpoint: 'models' | 'key' | 'chat/completions',
  apiKey?: string,
  body?: unknown,
): Promise<any> {
  try {
    const response = await fetch(`https://openrouter.ai/api/v1/${endpoint}`, {
      method: body ? 'POST' : 'GET',
      redirect: 'error',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json',
        'X-Title': 'Groomi',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(body ? 180_000 : 20_000),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      logOpenRouterError(endpoint, response, result, apiKey, body);
      throw requestError(response.status, result);
    }
    const result = await response.json();
    if (result.error) {
      logOpenRouterError(endpoint, response, result, apiKey, body);
      throw requestError(Number(result.error.code), result);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new AppError('OPENROUTER_TIMEOUT');
    }
    if (error instanceof TypeError) throw new AppError('OPENROUTER_CONNECTION_FAILED');
    throw error;
  }
}

export async function listOpenRouterModels(): Promise<OpenRouterModel[]> {
  const result = await requestOpenRouter('models');
  if (!Array.isArray(result.data)) throw new AppError('AI_MODEL_LIST_INVALID');
  return result.data
    .filter(
      (model: any) =>
        typeof model.id === 'string' &&
        typeof model.name === 'string' &&
        model.architecture?.input_modalities?.includes('text') &&
        model.architecture?.output_modalities?.includes('text') &&
        model.supported_parameters?.includes('response_format'),
    )
    .map((model: any) => ({
      id: model.id,
      name: model.name,
      contextLength: Number.isFinite(model.context_length) ? model.context_length : 0,
      inputPrice: typeof model.pricing?.prompt === 'string' ? model.pricing.prompt : null,
      outputPrice: typeof model.pricing?.completion === 'string' ? model.pricing.completion : null,
    }))
    .sort((a: OpenRouterModel, b: OpenRouterModel) => a.name.localeCompare(b.name));
}

export async function generateAiJson(
  configuration: AiConfiguration,
  messages: { role: 'system' | 'user'; content: string }[],
  options: { schema?: object; schemaName?: string; temperature?: number; numCtx?: number } = {},
) {
  const estimatedTokens = Math.ceil(
    messages.reduce((total, message) => total + message.content.length, 0) / 1.5,
  );
  if (options.numCtx && estimatedTokens + 4096 > options.numCtx) {
    console.warn('[ai-context-limit]', {
      model: configuration.model,
      estimatedTokens,
      numCtx: options.numCtx,
    });
  }
  if (configuration.provider === 'ollama') {
    try {
      return await ollama.chat({
        model: configuration.model,
        messages,
        format: options.schema ?? 'json',
        options: { temperature: options.temperature, num_ctx: options.numCtx },
      });
    } catch (error) {
      throw new AppError('OLLAMA_CONNECTION_FAILED', { cause: error });
    }
  }
  if (!configuration.apiKey) throw new AppError('OPENROUTER_KEY_REQUIRED');
  beginAiUsageRequest();
  let result: any;
  const recordUsage = async (record: AiUsageRecord) => {
    try {
      await configuration.recordUsage?.(record);
    } catch {
      console.warn('[openrouter-usage] 사용량 기록 저장에 실패했습니다.');
    }
  };
  try {
    result = await requestOpenRouter('chat/completions', configuration.apiKey, {
      model: configuration.model,
      messages,
      stream: false,
      response_format: options.schema
        ? {
            type: 'json_schema',
            json_schema: { name: options.schemaName ?? 'response', schema: options.schema },
          }
        : { type: 'json_object' },
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      provider: { require_parameters: true },
    });
  } catch (error) {
    await recordUsage({ failed: true });
    throw error;
  }
  recordAiUsageResponse(
    result.usage?.prompt_tokens,
    result.usage?.completion_tokens,
    result.usage?.cost,
  );
  await recordUsage({
    failed: false,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
  });
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AppError('AI_EMPTY_RESPONSE');
  if (result.choices[0].finish_reason === 'length') throw new AppError('AI_RESPONSE_TRUNCATED');
  return {
    message: { content },
    done_reason: result.choices[0].finish_reason as string,
    prompt_eval_count: result.usage?.prompt_tokens,
    eval_count: result.usage?.completion_tokens,
  };
}
