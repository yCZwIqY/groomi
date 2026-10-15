export function logCommentValidationFailure(
  content: string,
  metadata: {
    provider: string;
    model: string;
    expectedCount: number;
    inputTokens?: number;
    outputTokens?: number;
    stopReason?: string;
  },
  reason: 'invalid_json' | 'missing_comments_array' | 'too_few_comments' | 'invalid_comment',
  details: { actualCount?: number; itemIndex?: number } = {},
) {
  console.error('[ai-response-validation]', {
    task: 'comments',
    ...metadata,
    // Stop reasons are provider-controlled; never log arbitrary response strings.
    stopReason: ['stop', 'length', 'limit', 'content_filter', 'tool_calls'].includes(
      metadata.stopReason ?? '',
    )
      ? metadata.stopReason
      : 'unknown',
    reason,
    ...details,
    outputCharacters: content.length,
    containsCodeFence: /```/.test(content),
    containsThinkTag: /<think\b/i.test(content),
    startsWith: content.trimStart().startsWith('{')
      ? 'object'
      : content.trimStart().startsWith('[')
        ? 'array'
        : 'other',
  });
}

export function logGenerationMetrics(
  task: 'story-memory' | 'comments',
  model: string,
  startedAt: number,
  input: string,
  response: {
    message: { content: string };
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
    load_duration?: number;
  },
) {
  console.info('[ai-generation]', {
    task,
    model,
    elapsedMs: Math.round(performance.now() - startedAt),
    inputCharacters: input.length,
    outputCharacters: response.message.content.length,
    inputTokens: response.prompt_eval_count,
    outputTokens: response.eval_count,
    modelDurationMs:
      response.total_duration === undefined
        ? undefined
        : Math.round(response.total_duration / 1_000_000),
    modelLoadMs:
      response.load_duration === undefined
        ? undefined
        : Math.round(response.load_duration / 1_000_000),
  });
}
