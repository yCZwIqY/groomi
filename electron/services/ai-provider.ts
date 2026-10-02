import ollama from 'ollama';
import { getAiCredentials } from './ai-credentials.js';

export type AiProvider = 'ollama' | 'openrouter';
export type AiConfiguration = { provider: AiProvider; model: string; apiKey?: string };
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
  if (!model) throw new Error('설정에서 AI 모델을 선택해주세요.');
  return {
    provider,
    model,
    ...(provider === 'openrouter' ? { apiKey: await (await getAiCredentials()).readKey() } : {}),
  };
}

function requestError(status: number, result?: { error?: { metadata?: { raw?: unknown } } }) {
  const raw = result?.error?.metadata?.raw;
  if (status === 429 && typeof raw === 'string' && /temporarily rate-limited upstream/i.test(raw)) {
    return new Error(
      '모델 제공자의 요청이 일시적으로 제한되었습니다. 잠시 후 재시도하거나 다른 모델을 선택해주세요.',
    );
  }
  const messages: Record<number, string> = {
    400: '모델 또는 요청 설정이 올바르지 않습니다. 다른 모델을 선택해주세요.',
    401: 'OpenRouter API 키가 유효하지 않습니다. 다시 등록해주세요.',
    402: 'OpenRouter 잔액이 부족합니다. 계정의 크레딧을 확인해주세요.',
    403: 'OpenRouter에서 이 요청을 허용하지 않았습니다. 계정 설정을 확인해주세요.',
    429: 'OpenRouter 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.',
  };
  return new Error(
    messages[status] ?? 'OpenRouter 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
  );
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
      throw new Error('OpenRouter 응답 시간이 초과됐습니다. 다시 시도해주세요.');
    }
    if (error instanceof TypeError)
      throw new Error('OpenRouter에 연결하지 못했습니다. 네트워크를 확인해주세요.');
    throw error;
  }
}

export async function listOpenRouterModels(): Promise<OpenRouterModel[]> {
  const result = await requestOpenRouter('models');
  if (!Array.isArray(result.data)) throw new Error('모델 목록 형식이 올바르지 않습니다.');
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
) {
  if (configuration.provider === 'ollama') {
    return ollama.chat({ model: configuration.model, messages, format: 'json' });
  }
  if (!configuration.apiKey) throw new Error('OpenRouter API 키를 등록해주세요.');
  const result = await requestOpenRouter('chat/completions', configuration.apiKey, {
    model: configuration.model,
    messages,
    stream: false,
    response_format: { type: 'json_object' },
    provider: { require_parameters: true },
  });
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim())
    throw new Error('AI가 빈 응답을 반환했습니다. 다시 시도해주세요.');
  if (result.choices[0].finish_reason === 'length')
    throw new Error('AI 응답이 길이 제한으로 중단됐습니다. 다른 모델을 선택해주세요.');
  return {
    message: { content },
    prompt_eval_count: result.usage?.prompt_tokens,
    eval_count: result.usage?.completion_tokens,
  };
}
