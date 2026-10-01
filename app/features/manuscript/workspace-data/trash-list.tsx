import SettingsSection from '~/components/common/settings-section';
import { formatDate } from '../../../../utils/date-utils';
import { AiOutlineFile, AiOutlineFolder } from 'react-icons/ai';
import ConfirmModalWrapper from '~/components/confirm-modal/confirm-modal-wrapper';

interface Props {
  items: WorkspaceNode[];
  onRestore: (item: WorkspaceNode) => void;
  onDelete: (item: WorkspaceNode) => void;
}

const TrashList = ({ items, onRestore, onDelete }: Props) => {
  return (
    <SettingsSection
      collapsible
      title={'휴지통'}
      description={'삭제한 항목을 복원하거나 영구 삭제합니다.'}
      count={items.length}
    >
      <div className={'divide-y divide-neutral-100'}>
        {items.length === 0 ? (
          <div className={'px-4 py-6 text-sm text-neutral-400'}>휴지통이 비어 있습니다.</div>
        ) : (
          items.map((item) => (
            <div
              className={'grid grid-cols-[28px_1fr_180px_120px] items-center gap-3 px-4 py-3'}
              key={item.id ?? item.path}
            >
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
              <div className={'text-right text-xs text-neutral-400'}>
                {formatDate(new Date(item.deletedAt ?? ''), 'YYYY-MM-DD HH:mm:SS')}
              </div>
              <div className={'flex justify-end items-center gap-2'}>
                <ConfirmModalWrapper
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
                  <button
                    className={'text-xs hover:underline block'}
                    type={'button'}
                  >
                    복원
                  </button>
                </ConfirmModalWrapper>
                <div className={'border-r w-px h-4 border-neutral-500'} />
                <ConfirmModalWrapper
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
                  <button
                    className={'text-xs text-red-600 hover:underline block'}
                    type={'button'}
                  >
                    영구 삭제
                  </button>
                </ConfirmModalWrapper>
              </div>
            </div>
          ))
        )}
      </div>
    </SettingsSection>
  );
};

export default TrashList;
