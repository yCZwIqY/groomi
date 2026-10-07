import ModalFrame from '~/components/common/modal/modal-frame';
import { useEffect } from 'react';
import { useModal } from '~/hooks/use-modal';
import DnButton from '~/components/common/buttons/dn-button';
import { REVIEW_CRITERIA } from './review-criteria';
type Props = {
  review: ManuscriptReview | null;
  loading: boolean;
  onRegenerate: () => void;
  documentTitle: string;
};
export default function ManuscriptReviewModal({
  review,
  loading,
  onRegenerate,
  documentTitle,
}: Props) {
  const { portal, setIsOpen } = useModal({
    content: (
      <ModalFrame
        title='원고 리뷰'
        label='원고 리뷰'
        description={<>{documentTitle} · 결과는 저장되지 않습니다.</>}
        onClose={() => setIsOpen(false)}
        footer={
          <>
            <DnButton
              variant='outlined'
              onClick={() => setIsOpen(false)}
            >
              닫기
            </DnButton>
            <DnButton
              loading={loading}
              disabled={loading}
              onClick={onRegenerate}
            >
              다시 생성
            </DnButton>
          </>
        }
      >
        <div className='space-y-3'>
          {review &&
            REVIEW_CRITERIA.map(({ key, label }) => (
              <div
                key={key}
                className='rounded-lg border border-stone-200 p-4'
              >
                <div className='flex items-center justify-between gap-3'>
                  <h3 className='font-medium'>{label}</h3>
                  <span className='text-primary-600'>{review.criteria[key].score}/10</span>
                </div>
                <p className='mt-2 whitespace-pre-wrap text-sm text-stone-600'>
                  {review.criteria[key].comment}
                </p>
              </div>
            ))}
          {review && (
            <div className='rounded-lg bg-primary-50 p-4'>
              <h3 className='font-medium'>총평</h3>
              <p className='mt-2 whitespace-pre-wrap text-sm'>{review.overallComment}</p>
            </div>
          )}
        </div>
      </ModalFrame>
    ),
  });
  useEffect(() => {
    if (review) setIsOpen(true);
  }, [review, setIsOpen]);
  return portal;
}
