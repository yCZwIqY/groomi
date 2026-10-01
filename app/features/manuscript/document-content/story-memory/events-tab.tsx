import { StoryMemoryHeading } from '~/features/manuscript/story-memory/story-memory-heading';
import { StoryMemoryActionButton } from '~/features/manuscript/story-memory/story-memory-action-button';
import { StoryMemoryState } from '~/features/manuscript/story-memory/story-memory-state';
import { reviewCardClass, reviewFieldClass } from './review-tab-styles';
import { AiOutlineDelete, AiOutlinePlus } from 'react-icons/ai';
import { DnSelect } from '~/components/common/selector';

const IMPORTANCE_OPTIONS = [
  { label: '상', value: '상' },
  { label: '중', value: '중' },
  { label: '하', value: '하' },
];

interface Props {
  events: StoryMemoryEvent[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, key: 'description' | 'importance', value: string) => void;
}

const EventsTab = ({ events, onAdd, onRemove, onChange }: Props) => (
  <div className={'flex flex-col gap-4'}>
    <div className={'flex items-start justify-between gap-4'}>
      <StoryMemoryHeading title={'주요 사건'} />
      <StoryMemoryActionButton
        onClick={onAdd}
        type={'button'}
      >
        <AiOutlinePlus /> 사건 추가
      </StoryMemoryActionButton>
    </div>
    {events.length === 0 && <StoryMemoryState>등록된 사건이 없습니다.</StoryMemoryState>}
    {events.map((event, index) => (
      <div
        className={reviewCardClass}
        key={index}
      >
        <div className={'w-28 shrink-0 text-sm'}>
          <div className={'mb-1.5 text-xs font-medium text-stone-600'}>중요도</div>
          <DnSelect
            onChange={(value) => onChange(index, 'importance', String(value))}
            options={IMPORTANCE_OPTIONS}
            value={event.importance}
          />
        </div>
        <textarea
          rows={3}
          aria-label={'사건 ' + (index + 1) + ' 내용'}
          placeholder={'주요 사건의 내용을 입력해주세요.'}
          className={reviewFieldClass + ' w-full resize-y'}
          onChange={(changeEvent) => onChange(index, 'description', changeEvent.target.value)}
          value={event.description}
        />
        <StoryMemoryActionButton
          tone={'delete'}
          onClick={() => onRemove(index)}
          type={'button'}
          className={'self-end'}
          aria-label={'항목 ' + (index + 1) + ' 삭제'}
        >
          <AiOutlineDelete /> 삭제
        </StoryMemoryActionButton>
      </div>
    ))}
  </div>
);

export default EventsTab;
