import { FaUser } from 'react-icons/fa';
import { AiOutlineDelete } from 'react-icons/ai';
import ConfirmModalWrapper from '~/components/confirm-modal/confirm-modal-wrapper';

interface Props extends GeneratedComment {
  onRemove?: () => void;
}

const CommentItem = ({ expertiseLabel, ageGroup, tone, content, onRemove }: Props) => {
  return (
    <div className={'flex items-start gap-4 border-b border-stone-200 py-5'}>
      <div className={'size-10 shrink-0 rounded-full bg-stone-400 flex items-center justify-center overflow-hidden'}>
        <FaUser size={20} color={'white'} />
      </div>
      <div className={'flex flex-1 flex-col gap-2'}>
        <div className={'typo-b5-b text-stone-900'}>
          {expertiseLabel} | {ageGroup}대 | {tone}
        </div>
        <div className={'whitespace-pre-line typo-b5-r text-stone-700'}>{content}</div>
      </div>
      <ConfirmModalWrapper
        confirmVariant={'red'}
        confirmLabel={'삭제'}
        description={<div className={'py-10 text-center'}>이 댓글을 삭제하시겠습니까?</div>}
        onConfirm={onRemove}
      >
        <span
          className={
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-stone-400 transition-all hover:bg-stone-200 hover:text-stone-700'
          }
        >
          <AiOutlineDelete size={16} />
        </span>
      </ConfirmModalWrapper>
    </div>
  );
};

export default CommentItem;
