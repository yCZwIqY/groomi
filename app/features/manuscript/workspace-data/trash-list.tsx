import DnCheckbox from '~/components/common/dn-checkbox';
import ListPagination from '~/components/common/list-pagination';
import ListSelectionToolbar from '~/components/common/list-selection-toolbar';
import { usePaginatedSelection } from '~/hooks/use-paginated-selection';
import SettingsSection from '~/components/common/settings-section';
import { formatDate } from '../../../../utils/date-utils';
import { AiOutlineFile, AiOutlineFolder } from 'react-icons/ai';
import ConfirmModalWrapper from '~/components/confirm-modal/confirm-modal-wrapper';

interface Props {
  items: WorkspaceNode[];
  onRestore: (item: WorkspaceNode) => void;
  onDelete: (item: WorkspaceNode) => void;
  onDeleteSelected: (items: WorkspaceNode[]) => void;
  onRestoreSelected: (items: WorkspaceNode[]) => void;
  busy: boolean;
}

const getTrashId = (item: WorkspaceNode) => item.id ?? item.path;

const TrashList = ({
  items,
  onRestore,
  onDelete,
  onDeleteSelected,
  onRestoreSelected,
  busy,
}: Props) => {
  const selection = usePaginatedSelection(items, getTrashId);
  return (
    <SettingsSection
      collapsible
      title={'휴지통'}
      description={'삭제한 항목을 복원하거나 영구 삭제합니다.'}
      count={items.length}
    >
      <ListSelectionToolbar
        label='휴지통 항목'
        count={items.length}
        pageCount={selection.visibleItems.length}
        pageSelectedCount={selection.visibleSelectedCount}
        selectedCount={selection.selectedCount}
        busy={busy}
        onSelectPage={selection.selectPage}
        onSelectAll={selection.selectAll}
        onClear={selection.clearSelection}
        onDelete={() => onDeleteSelected(selection.selectedItems)}
        onRestore={() => onRestoreSelected(selection.selectedItems)}
        permanent
      />
      <div className={'divide-y divide-neutral-100'}>
        {items.length === 0 ? (
          <div className={'px-4 py-6 text-sm text-neutral-400'}>휴지통이 비어 있습니다.</div>
        ) : (
          selection.visibleItems.map((item) => (
            <div
              className={
                'grid grid-cols-[20px_20px_minmax(0,1fr)] sm:grid-cols-[20px_20px_minmax(0,1fr)_150px_120px] items-center gap-3 px-4 py-3'
              }
              key={item.id ?? item.path}
            >
              <DnCheckbox
                aria-label={'휴지통 항목 선택: ' + (item.document?.title || item.name)}
                checked={selection.selectedIds.has(getTrashId(item))}
                disabled={busy}
                onChange={(event) => selection.select(getTrashId(item), event.target.checked)}
              />
              <div>
                {item.type === 'document' ? (
                  <AiOutlineFile color={'var(--color-gray-400)'} />
                ) : (
                  <AiOutlineFolder color={'var(--color-primary-500)'} />
                )}
              </div>
              <div className={'min-w-0'}>
                <div className={'truncate text-sm font-medium text-neutral-700'}>
                  {item.document?.title || item.name.split('.')[0]}
                </div>
                <div className={'truncate text-xs text-neutral-400'}>{item.path.split('.')[0]}</div>
              </div>
              <div
                className={'col-start-3 text-xs text-neutral-400 sm:col-start-auto sm:text-right'}
              >
                {formatDate(new Date(item.deletedAt ?? ''), 'YYYY-MM-DD HH:mm:SS')}
              </div>
              <div
                className={'col-start-3 flex items-center gap-2 sm:col-start-auto sm:justify-end'}
              >
                <ConfirmModalWrapper
                  disabled={busy}
                  description={
                    <div className={'py-10 text-center'}>
                      <span className={'font-bold text-primary-500'}>
                        {item.document?.title || item.name.split('.')[0]}
                      </span>{' '}
                      {item.type === 'document' ? '문서를' : '워크스페이스를'}
                      <br />
                      복원하시겠습니까?
                    </div>
                  }
                  onConfirm={() => onRestore(item)}
                >
                  <span className={'text-xs hover:underline block'}>복원</span>
                </ConfirmModalWrapper>
                <div className={'border-r w-px h-4 border-neutral-500'} />
                <ConfirmModalWrapper
                  disabled={busy}
                  confirmLabel={'영구 삭제'}
                  confirmVariant={'red'}
                  description={
                    <div className={'py-10 text-center'}>
                      <span className={'font-bold text-primary-500'}>
                        {item.document?.title || item.name.split('.')[0]}
                      </span>{' '}
                      {item.type === 'document' ? '문서를' : '워크스페이스를'}
                      <br />
                      <strong className={'font-bold'}>영구 삭제</strong> 하시겠습니까?
                      <div className={'pt-2 font-bold text-red-600'}>
                        영구 삭제된 항목은 복원할 수 없습니다.
                      </div>
                    </div>
                  }
                  onConfirm={() => onDelete(item)}
                >
                  <span className={'text-xs text-red-600 hover:underline block'}>영구 삭제</span>
                </ConfirmModalWrapper>
              </div>
            </div>
          ))
        )}
      </div>
      <ListPagination
        label='휴지통'
        count={items.length}
        page={selection.page}
        pageCount={selection.pageCount}
        onChange={selection.setPage}
        disabled={busy}
      />
    </SettingsSection>
  );
};

export default TrashList;
