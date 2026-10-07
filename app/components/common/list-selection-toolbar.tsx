import DnCheckbox from './dn-checkbox';
import DnButton from './buttons/dn-button';
import ConfirmModalWrapper from '~/components/confirm-modal/confirm-modal-wrapper';
type Props = {
  label: string;
  count: number;
  pageCount: number;
  pageSelectedCount: number;
  selectedCount: number;
  busy: boolean;
  onSelectPage: (selected: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  permanent?: boolean;
};
export default function ListSelectionToolbar({
  label,
  count,
  pageCount,
  pageSelectedCount,
  selectedCount,
  busy,
  onSelectPage,
  onSelectAll,
  onClear,
  onDelete,
  onRestore,
  permanent,
}: Props) {
  if (!count) return null;
  return (
    <div className='mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-stone-100 p-3 text-xs text-stone-600'>
      <label className='flex items-center gap-2'>
        <DnCheckbox
          aria-label={label + ' 현재 페이지 선택'}
          checked={pageCount > 0 && pageSelectedCount === pageCount}
          indeterminate={pageSelectedCount > 0 && pageSelectedCount < pageCount}
          disabled={busy}
          onChange={(event) => onSelectPage(event.target.checked)}
        />
        현재 페이지 선택<span>{selectedCount}개 선택됨</span>
      </label>
      <div className='flex flex-wrap items-center gap-2'>
        {onRestore && (
          <ConfirmModalWrapper
            triggerLabel={label + ' 선택 복원'}
            disabled={busy || selectedCount === 0}
            confirmLabel='복원'
            onConfirm={onRestore}
            description={
              <div className='space-y-3'>
                <p>
                  선택한 {label} {selectedCount}개를 복원하시겠습니까?
                </p>
                <p>
                  그룹은 함께 삭제된 하위 항목도 복원합니다. 이전에 별도로 삭제한 항목은 선택한
                  경우에만 복원합니다.
                </p>
              </div>
            }
          >
            <span className='inline-flex rounded-lg border border-primary-200 bg-white px-3 py-2 font-medium text-primary-600'>
              선택 복원
            </span>
          </ConfirmModalWrapper>
        )}
        <ConfirmModalWrapper
          triggerLabel={label + ' 선택 삭제'}
          disabled={busy || selectedCount === 0}
          confirmLabel={permanent ? '영구 삭제' : '삭제'}
          confirmVariant='red'
          onConfirm={onDelete}
          description={
            <div className='space-y-3'>
              <p>
                선택한 {label} {selectedCount}개를 {permanent ? '영구 ' : ''}삭제하시겠습니까?
              </p>
              {permanent && (
                <p className='text-red-600'>
                  그룹을 삭제하면 하위 항목도 함께 삭제되며 복원할 수 없습니다.
                </p>
              )}
            </div>
          }
        >
          <span className='inline-flex rounded-lg border border-red-200 bg-white px-3 py-2 font-medium text-red-600'>
            {busy ? '처리 중…' : permanent ? '선택 영구 삭제' : '선택 삭제'}
          </span>
        </ConfirmModalWrapper>
      </div>
    </div>
  );
}
