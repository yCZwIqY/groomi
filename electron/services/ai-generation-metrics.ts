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
