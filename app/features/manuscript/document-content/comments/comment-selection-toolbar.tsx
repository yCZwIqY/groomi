import DnCheckbox from '~/components/common/dn-checkbox';
import ConfirmModalWrapper from '~/components/confirm-modal/confirm-modal-wrapper';

interface Props {
  count: number;
  selectedCount: number;
  deleting: boolean;
  onSelectAll: (selected: boolean) => void;
  onDelete: (all: boolean) => void;
}

export default function CommentSelectionToolbar({
  count,
  selectedCount,
  deleting,
  onSelectAll,
  onDelete,
}: Props) {
  return (
    <div
      className={
        'mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600'
      }
    >
      <label className={'flex items-center gap-2'}>
        <DnCheckbox
          checked={count > 0 && selectedCount === count}
          indeterminate={selectedCount > 0 && selectedCount < count}
          disabled={deleting}
          onChange={(event) => onSelectAll(event.target.checked)}
        />
        전체 선택{selectedCount > 0 && ` · ${selectedCount}개 선택됨`}
      </label>
      <div className={'flex items-center gap-2'}>
        {[false, true].map((all) => (
          <ConfirmModalWrapper
            key={String(all)}
            disabled={deleting || (!all && selectedCount === 0)}
            triggerLabel={all ? '댓글 전체 삭제' : '선택 댓글 삭제'}
            confirmVariant={'red'}
            confirmLabel={'삭제'}
            description={
              <p className={'py-4 text-center'}>
                {all ? `이 회차의 댓글 ${count}개를 모두` : `선택한 댓글 ${selectedCount}개를`}{' '}
                삭제하시겠습니까?
              </p>
            }
            onConfirm={() => onDelete(all)}
          >
            <span
              className={
                'inline-flex rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-red-600'
              }
            >
              {all ? '전체 삭제' : '선택 삭제'}
            </span>
          </ConfirmModalWrapper>
        ))}
        {deleting && <span role={'status'}>삭제 중…</span>}
      </div>
    </div>
  );
}
