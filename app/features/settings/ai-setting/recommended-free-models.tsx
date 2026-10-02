import DnButton from '~/components/common/buttons/dn-button';
import { getRecommendedFreeModels } from '~/lib/ai-model-options';

type Props = {
  models: OpenRouterModel[];
  selectedModel: string | null;
  disabled: boolean;
  onSelect: (model: string) => void;
};

export default function RecommendedFreeModels({
  models,
  selectedModel,
  disabled,
  onSelect,
}: Props) {
  const recommended = getRecommendedFreeModels(models);
  return (
    <div className={'space-y-2'}>
      <h4 className={'text-sm font-semibold text-stone-900'}>추천 모델 (무료)</h4>
      <p className={'text-xs text-stone-500'}>
        현재 무료이며 JSON 응답을 지원하는 모델입니다. 무료 모델은 요청 제한이 있고 제공 여부가
        변경될 수 있습니다.
      </p>
      <div className={'flex gap-2'}>
        {recommended.length === 0 ? (
          <p className={'rounded-lg bg-stone-50 p-3 text-xs text-stone-500'}>
            추천할 무료 모델이 없습니다. 모델 목록을 새로고침해주세요.
          </p>
        ) : (
          recommended.map((model) => (
            <div
              key={model.id}
              className={
                'flex flex-col items-center justify-between gap-3 rounded-lg border border-stone-200 p-3'
              }
            >
              <div className={'min-w-0'}>
                <div
                  className={'truncate text-sm font-medium text-stone-800'}
                  title={model.name}
                >
                  {model.name}
                </div>
                <div className={'mt-1 text-xs text-stone-500'}>
                  무료 · JSON 응답 지원 · 컨텍스트 {model.contextLength.toLocaleString()} 토큰
                </div>
              </div>
              <DnButton
                variant={'outlined'}
                size={'s'}
                className={'w-full'}
                disabled={disabled || selectedModel === model.id}
                aria-label={`${model.name} 선택`}
                onClick={() => onSelect(model.id)}
              >
                {selectedModel === model.id ? '선택됨' : '선택'}
              </DnButton>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
