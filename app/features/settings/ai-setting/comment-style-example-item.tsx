import ConfirmModalWrapper from '~/components/confirm-modal/confirm-modal-wrapper';
import { StoryMemoryCard } from '~/features/manuscript/story-memory/story-memory-card';
import { StoryMemoryTag } from '~/features/manuscript/story-memory/story-memory-tag';

interface Props {
  example: CommentExample;
  removing: boolean;
  onRemove: () => void;
}

const experienceLabels: Record<number, string> = {
  0: '입문',
  20: '일반',
  40: '일반',
  60: '숙련',
  80: '창작 경험',
  100: '창작 경험',
};

const CommentStyleExampleItem = ({ example, removing, onRemove }: Props) => (
  <StoryMemoryCard
    as={'article'}
    className={'flex shrink-0 flex-col gap-3'}
  >
    <div className={'flex items-start justify-between gap-3'}>
      <div className={'flex flex-wrap gap-1.5'}>
        <StoryMemoryTag tone={'primary'}>
          {example.expertiseLevel === null
            ? '독서 경험 미지정'
            : (experienceLabels[example.expertiseLevel] ?? '독서 경험 미지정')}
        </StoryMemoryTag>
        <StoryMemoryTag>{example.interest ?? '관심사 미지정'}</StoryMemoryTag>
        <StoryMemoryTag>
          {example.tone === '의문'
            ? '질문'
            : example.tone === '지적'
              ? '비판'
              : (example.tone ?? '반응 미지정')}
        </StoryMemoryTag>
        <StoryMemoryTag>
          {example.ageGroup != null && example.ageGroup >= 10
            ? example.ageGroup + '대'
            : '연령 미지정'}
        </StoryMemoryTag>
      </div>
      <ConfirmModalWrapper
        triggerLabel={'댓글 스타일 예시 삭제'}
        confirmVariant={'red'}
        confirmLabel={'삭제'}
        description={
          <p className={'py-6 text-center text-sm'}>이 댓글 스타일 예시를 삭제하시겠습니까?</p>
        }
        onConfirm={() => {
          if (!removing) onRemove();
        }}
      >
        <span
          className={
            'whitespace-nowrap rounded-lg px-2 py-1.5 text-xs text-stone-500 hover:bg-red-50 hover:text-red-600'
          }
        >
          {removing ? '삭제 중…' : '삭제'}
        </span>
      </ConfirmModalWrapper>
    </div>
    <p className={'whitespace-pre-wrap break-words text-sm leading-6 text-stone-700'}>
      {example.content}
    </p>
  </StoryMemoryCard>
);

export default CommentStyleExampleItem;
