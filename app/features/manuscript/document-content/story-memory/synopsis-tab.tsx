import { StoryMemoryHeading } from '~/features/manuscript/story-memory/story-memory-heading';
import { reviewCardClass, reviewFieldClass } from './review-tab-styles';
interface Props {
  synopsis: string;
  onChange: (value: string) => void;
}

const SynopsisTab = ({ synopsis, onChange }: Props) => (
  <div className={'flex flex-col gap-4'}>
    <StoryMemoryHeading title={'현재까지 줄거리'} />
    <div className={reviewCardClass}>
      <p className={'text-xs leading-5 text-stone-500'}>
        지금까지의 이야기 흐름을 확인하고 수정해주세요.
      </p>
      <textarea
        aria-label={'현재까지 줄거리'}
        className={reviewFieldClass + ' min-h-70 w-full resize-y'}
        onChange={(event) => onChange(event.target.value)}
        placeholder={'현재까지의 줄거리를 입력해주세요.'}
        value={synopsis}
      />
    </div>
  </div>
);

export default SynopsisTab;
