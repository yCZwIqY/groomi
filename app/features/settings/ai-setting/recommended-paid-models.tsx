import { getRecommendedPaidModels } from '~/lib/ai-model-options';
import RecommendedModelGroup from './recommended-model-group';
import type { RecommendedModelGroupProps } from './recommended-model-group';

type Props = Omit<RecommendedModelGroupProps, 'title' | 'description'>;

export default function RecommendedPaidModels({ models, ...props }: Props) {
  return (
    <div className={'space-y-4'}>
      <RecommendedModelGroup
        {...props}
        models={getRecommendedPaidModels(models, 'performance')}
        title={'추천 모델 (유료 · 성능)'}
        description={
          '요약과 복잡한 문맥 분석에 비교해볼 모델입니다. 실제 원고로 품질을 비교해주세요.'
        }
      />
      <RecommendedModelGroup
        {...props}
        models={getRecommendedPaidModels(models, 'value')}
        title={'추천 모델 (유료 · 가성비)'}
        description={
          '낮은 토큰 비용을 우선한 모델입니다. 가격은 현재 모델 목록 기준이며 요청 조건에 따라 달라질 수 있습니다.'
        }
      />
    </div>
  );
}
