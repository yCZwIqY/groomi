import { formatDate } from '../../../../utils/date-utils';
import { useSelectedWorkspace } from '~/stores/use-selected-workspace';
import { AiOutlineFile, AiOutlineFolder } from 'react-icons/ai';
import { showToast } from '~/lib/toast-manager';
import ConfirmModalWrapper from '~/components/confirm-modal/confirm-modal-wrapper';
import { removeDocument } from '~/lib/electron/document-api';
import { removeWorkspace as removeWorkspaceItem } from '~/lib/electron/workspace-api';

interface Props {
  tree: WorkspaceNode[];
}
const WorkspaceList = ({ tree }: Props) => {
  const setSelectedWorkspace = useSelectedWorkspace((state) => state.setSelectedWorkspace);

  const handleRemoveNode = async (item: WorkspaceNode) => {
    try {
      if (item.type === 'document') {
        await removeDocument(item.path);
        return;
      }

      await removeWorkspaceItem(item.path);
    } catch (error) {
      showToast((error as Error).message, 'danger');
    }
  };

  return (
    <section
      className={
        'relative isolate max-h-[420px] w-full overflow-auto rounded-xl border border-stone-200 bg-white'
      }
    >
      <table className={'w-full min-w-[760px]'}>
        <colgroup>
          <col className={'w-[52px]'} />
          <col className={'w-[30%]'} />
          <col className={'w-[20%]'} />
          <col className={'w-[10%]'} />
          <col className={'w-[10%]'} />
          <col className={'w-[10%]'} />
          <col className={'w-[52px]'} />
        </colgroup>
        <thead className={'sticky top-0 z-10 border-b border-stone-200 bg-stone-100'}>
          <tr className={'h-11 text-xs font-medium text-stone-600'}>
            <th>No.</th>
            <th>제목</th>
            <th>경로</th>

            <th>초안 글자수</th>
            <th>원고 글자수</th>
            <th>수정일</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          {!tree ||
            (tree.length <= 0 && (
              <tr>
                <td
                  colSpan={7}
                  className={'px-4 py-8 text-center text-sm text-stone-500'}
                >
                  하위 항목이 존재하지 않습니다.
                </td>
              </tr>
            ))}
          {tree.map((item, index) => (
            <tr
              key={item.id ?? item.path}
              className={'border-b border-stone-100 last:border-b-0 hover:bg-primary-50/50'}
            >
              <td className={'p-2 text-center text-xs text-stone-500'}>
                {(index + 1).toLocaleString()}{' '}
              </td>
              <td>
                <button
                  type={'button'}
                  className={
                    'flex w-full items-center gap-2 px-2 py-4 text-left text-sm font-medium text-stone-800 hover:text-primary-600 focus-visible:outline-primary-500'
                  }
                  onClick={() => setSelectedWorkspace(item)}
                >
                  {item.type === 'document' ? (
                    <AiOutlineFile color={'var(--color-gray-400)'} />
                  ) : (
                    <AiOutlineFolder color={'var(--color-primary-500)'} />
                  )}
                  {item.name.split('.')[0]}
                </button>
              </td>
              <td className={'max-w-48 px-2 text-xs text-stone-500'}>
                <span
                  className={'block truncate'}
                  title={item.path.split('.')[0]}
                >
                  {item.path.split('.')[0]}
                </span>
              </td>
              <td className={'text-center text-sm'}>
                {item.type === 'document' ? item.document?.draftLength?.toLocaleString() : '-'}
              </td>
              <td className={'text-center text-sm'}>
                {item.type === 'document' ? item.document?.manuscriptLength?.toLocaleString() : '-'}
              </td>
              <td className={'text-center text-sm'}>
                {formatDate(new Date(item.updatedAt ?? ''), 'YYYY-MM-DD HH:mm:SS')}
              </td>
              <td>
                <div className={'flex justify-center'}>
                  <ConfirmModalWrapper
                    confirmVariant={'red'}
                    description={
                      <div className={'py-10 text-center'}>
                        <span className={'font-bold text-primary-500'}>
                          {item.name.split('.')[0]}
                        </span>{' '}
                        {item.type === 'document' ? '문서를' : '워크스페이스를'} <br />
                        삭제하시겠습니까?
                        <br />
                        {item.type === 'workspace' && '하위 항목들도 함께 삭제됩니다'}
                        <br />
                        <br />
                        삭제된 항목은
                        <strong> Settings &gt; 휴지통</strong>
                        에서
                        <br /> 복원 할 수 있습니다.
                      </div>
                    }
                    onConfirm={() => void handleRemoveNode(item)}
                    confirmLabel={'삭제'}
                  >
                    <button
                      type={'button'}
                      className={
                        'rounded-lg px-2 py-1.5 text-xs text-stone-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-primary-500'
                      }
                    >
                      삭제
                    </button>
                  </ConfirmModalWrapper>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export default WorkspaceList;
