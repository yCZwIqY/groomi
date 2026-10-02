export function formatTokenPrice(price: string | null) {
  if (price === null || !Number.isFinite(Number(price)) || Number(price) < 0) return '가격 미제공';
  return `$${(Number(price) * 1_000_000).toFixed(2)}`;
}

export function describeOpenRouterModel(model: OpenRouterModel) {
  const context = model.contextLength ? `${model.contextLength.toLocaleString()} 토큰` : '미제공';
  return `100만 토큰당 입력 ${formatTokenPrice(model.inputPrice)} · 출력 ${formatTokenPrice(model.outputPrice)} · 컨텍스트 ${context}`;
}

const FREE_MODEL_PRIORITY = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'dots-studio/dots-3-note-preview:free',
  'apodex/apodex-1.1-mini:free',
];

const PAID_MODEL_IDS = {
  performance: ['anthropic/claude-opus-5.5', 'openai/gpt-6.1-sol', 'anthropic/claude-sonnet-5.5'],
  value: ['upstage/solar-mini4', 'upstage/solar-pro4', 'deepseek/deepseek-v4.1-flash'],
};

export function getRecommendedPaidModels(
  models: OpenRouterModel[],
  category: 'performance' | 'value',
) {
  return PAID_MODEL_IDS[category].flatMap((id) => {
    const model = models.find((candidate) => candidate.id === id);
    if (
      !model ||
      model.inputPrice === null ||
      model.outputPrice === null ||
      !Number.isFinite(Number(model.inputPrice)) ||
      !Number.isFinite(Number(model.outputPrice)) ||
      Number(model.inputPrice) < 0 ||
      Number(model.outputPrice) < 0 ||
      !(Number(model.inputPrice) > 0 || Number(model.outputPrice) > 0)
    )
      return [];
    return [model];
  });
}

export function getRecommendedFreeModels(models: OpenRouterModel[]) {
  const priority = (id: string) => {
    const index = FREE_MODEL_PRIORITY.indexOf(id);
    return index === -1 ? FREE_MODEL_PRIORITY.length : index;
  };
  return models
    .filter(
      (model) =>
        model.id.endsWith(':free') &&
        !model.id.startsWith('google/gemma-') &&
        model.inputPrice !== null &&
        model.inputPrice.trim() !== '' &&
        model.outputPrice !== null &&
        model.outputPrice.trim() !== '' &&
        Number(model.inputPrice) === 0 &&
        Number(model.outputPrice) === 0,
    )
    .sort(
      (a, b) =>
        priority(a.id) - priority(b.id) ||
        b.contextLength - a.contextLength ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 3);
}
