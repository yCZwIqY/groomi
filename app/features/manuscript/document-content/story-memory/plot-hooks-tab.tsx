import { StoryMemoryHeading } from '~/features/manuscript/story-memory/story-memory-heading';
import { StoryMemoryActionButton } from '~/features/manuscript/story-memory/story-memory-action-button';
import { StoryMemoryState } from '~/features/manuscript/story-memory/story-memory-state';
import { reviewCardClass, reviewFieldClass } from './review-tab-styles';
import { AiOutlineDelete, AiOutlinePlus } from 'react-icons/ai';
import DnInput from '~/components/common/inputs/dn-input';
import { DnSelect } from '~/components/common/selector';

interface Props {
  plotHooks: StoryMemoryPlotHook[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, key: 'description' | 'plantedAt' | 'status', value: string) => void;
}

const PlotHooksTab = ({ plotHooks, onAdd, onRemove, onChange }: Props) => (
  <div className={'flex flex-col gap-4'}>
    <div className={'flex items-start justify-between gap-4'}>
      <div>
        <StoryMemoryHeading title={'떡밥'} />
        <div className={'mt-1 text-xs leading-5 text-stone-500'}>
          해결된 항목도 조회·수정할 수 있습니다. 댓글 생성에는 미해결 항목만 참고합니다.
        </div>
      </div>
      <StoryMemoryActionButton
        onClick={onAdd}
        type={'button'}
      >
        <AiOutlinePlus /> 떡밥 추가
      </StoryMemoryActionButton>
    </div>
    {plotHooks.length === 0 && <StoryMemoryState>등록된 떡밥이 없습니다.</StoryMemoryState>}
    {plotHooks.map((hook, index) => (
      <div
        className={reviewCardClass}
        key={index}
      >
        <div className={'flex items-center gap-2'}>
          <span className={'shrink-0 text-xs font-medium text-stone-600'}>등장 회차</span>
          <DnInput
            size={'s'}
            className={'min-w-0 flex-1 border-stone-200! text-sm!'}
            onChange={(event) => onChange(index, 'plantedAt', event.target.value)}
            placeholder={'등장 화'}
            value={hook.plantedAt}
          />
        </div>
        <textarea
          rows={3}
          aria-label={'떡밥 ' + (index + 1) + ' 내용'}
          placeholder={'복선, 약속, 암시 등의 내용을 입력해주세요.'}
          className={reviewFieldClass + ' w-full resize-y'}
          onChange={(changeEvent) => onChange(index, 'description', changeEvent.target.value)}
          value={hook.description}
        />
        <div className={'w-24 shrink-0'}>
          <div className={'mb-1.5 text-xs font-medium text-stone-600'}>해결 상태</div>
          <DnSelect
            onChange={(value) => onChange(index, 'status', String(value))}
            options={[
              { label: '미해결', value: 'unresolved' },
              { label: '해결', value: 'resolved' },
            ]}
            value={hook.status ?? 'unresolved'}
          />
        </div>
        <StoryMemoryActionButton
          tone={'delete'}
          onClick={() => onRemove(index)}
          type={'button'}
          className={'self-end'}
          aria-label={'항목 ' + (index + 1) + ' 삭제'}
        >
          삭제
          <AiOutlineDelete />
        </StoryMemoryActionButton>
      </div>
    ))}
  </div>
);

export default PlotHooksTab;
