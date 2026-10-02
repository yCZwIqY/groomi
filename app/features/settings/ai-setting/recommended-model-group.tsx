import DnButton from '~/components/common/buttons/dn-button';
import { describeOpenRouterModel } from '~/lib/ai-model-options';

export type RecommendedModelGroupProps = {
  title: string;
  description: string;
  models: OpenRouterModel[];
  selectedModel: string | null;
  disabled: boolean;
  onSelect: (model: string) => void;
};

export default function RecommendedModelGroup({
  title,
  description,
  models,
  selectedModel,
  disabled,
  onSelect,
}: RecommendedModelGroupProps) {
  return (
    <div className={'space-y-2'}>
      <h4 className={'text-sm font-semibold text-stone-900'}>{title}</h4>
      <p className={'text-xs text-stone-500'}>{description}</p>
      <div className={'flex gap-2'}>
        {models.length === 0 ? (
          <p className={'rounded-lg bg-stone-50 p-3 text-xs text-stone-500'}>
            추천할 모델이 없습니다. 모델 목록을 새로고침해주세요.
          </p>
        ) : (
          models.map((model) => (
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
                  {describeOpenRouterModel(model)}
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
