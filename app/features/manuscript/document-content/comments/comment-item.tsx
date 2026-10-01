import { FaUser } from 'react-icons/fa';
import { AiOutlineDelete } from 'react-icons/ai';
import ConfirmModalWrapper from '~/components/confirm-modal/confirm-modal-wrapper';
import { StoryMemoryCard } from '~/features/manuscript/story-memory/story-memory-card';
import { StoryMemoryTag } from '~/features/manuscript/story-memory/story-memory-tag';

interface Props extends GeneratedComment {
  onRemove?: () => void;
}

const CommentItem = ({ expertiseLabel, ageGroup, tone, content, onRemove }: Props) => {
  return (
    <StoryMemoryCard
      as={'article'}
      className={'flex shrink-0 items-start gap-3'}
    >
      <div className={'flex min-w-0 flex-1 flex-col gap-2.5'}>
        <div className={'flex items-center flex-wrap gap-1.5'}>
          <StoryMemoryTag
            tone={'primary'}
            aria-label={'독서 경험: ' + expertiseLabel}
          >
            {expertiseLabel}
          </StoryMemoryTag>
          <StoryMemoryTag aria-label={'연령대: ' + ageGroup + '대'}>{ageGroup}대</StoryMemoryTag>
          <StoryMemoryTag aria-label={'반응 성향: ' + tone}>
            {tone === '의문' ? '질문' : tone === '지적' ? '비판' : tone}
          </StoryMemoryTag>
        </div>
        <p className={'whitespace-pre-wrap break-words text-sm leading-6 text-stone-700'}>
          {content}
        </p>
      </div>
      {onRemove && (
        <ConfirmModalWrapper
          triggerLabel={'댓글 삭제'}
          confirmVariant={'red'}
          confirmLabel={'삭제'}
          description={<div className={'py-10 text-center'}>이 댓글을 삭제하시겠습니까?</div>}
          onConfirm={onRemove}
        >
          <span
            className={
              'flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-primary-500'
            }
          >
            <AiOutlineDelete size={16} />
          </span>
        </ConfirmModalWrapper>
      )}
    </StoryMemoryCard>
  );
};

export default CommentItem;
