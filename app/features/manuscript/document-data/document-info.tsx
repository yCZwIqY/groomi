import { useEffect, useState } from 'react';
import { AiOutlineCalendar, AiOutlineClockCircle } from 'react-icons/ai';
import DnInput from '~/components/common/inputs/dn-input';
import { updateDocument } from '~/lib/electron/document-api';
import { formatDate } from '../../../../utils/date-utils';
import { flushPendingDocument } from '~/lib/pending-document';
import { showToast } from '~/lib/toast-manager';

interface Props {
  workspaceData: WorkspaceNode;
  onUpdated?: (workspaceData: WorkspaceNode) => void;
}
const DocumentInfo = ({ workspaceData, onUpdated }: Props) => {
  const [title, setTitle] = useState<string>('');
  const [subTitle, setSubTitle] = useState<string>('');

  useEffect(() => {
    if (workspaceData) {
      setTitle(workspaceData.document?.title ?? workspaceData.name ?? '');
      setSubTitle(workspaceData?.document?.subTitle ?? '');
    }

    return () => {
      setTitle('');
      setSubTitle('');
    };
  }, [workspaceData.path, workspaceData.document?.title, workspaceData.document?.subTitle]);

  const handleUpdateDocumentData = async (data: DocumentUpdatePayload) => {
    if (!workspaceData?.path) {
      return;
    }
    try {
      await flushPendingDocument();
      const updatedWorkspace = await updateDocument(workspaceData.path, data);
      if (updatedWorkspace) onUpdated?.(updatedWorkspace);
    } catch {
      showToast('제목 저장에 실패했습니다. 입력 내용은 유지됩니다.', 'danger');
    }
  };

  return (
    <section className={'ui-card p-5 w-full flex gap-4'}>
      <div className={'flex flex-col flex-1'}>
        <div className={'flex flex-col gap-2'}>
          <h3 className={'text-2xl font-bold text-neutral-700'}>
            <DnInput
              variant={'text'}
              value={title}
              className={'font-bold'}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (!title) {
                  setTitle(workspaceData.document?.title ?? workspaceData.name ?? '');
                  return;
                }

                void handleUpdateDocumentData({
                  name: title,
                  document: {
                    title,
                  },
                });
              }}
            />
          </h3>
          <DnInput
            variant={'text'}
            value={subTitle}
            className={'text-neutral-500'}
            onChange={(e) => setSubTitle(e.target.value)}
            onBlur={() => {
              void handleUpdateDocumentData({
                document: {
                  title,
                  subTitle,
                },
              });
            }}
            placeholder={'서브제목을 입력하세요.'}
          />
        </div>
        <div className={'flex flex-wrap gap-5 text-sm text-neutral-400 pt-2'}>
          <div className={'flex items-center gap-1'}>
            <AiOutlineCalendar />
            {formatDate(new Date(workspaceData?.createdAt ?? ''), 'YYYY-MM-DD HH:mm:SS')}
          </div>
          <div className={'flex items-center gap-1'}>
            <AiOutlineClockCircle />
            {formatDate(new Date(workspaceData?.updatedAt ?? ''), 'YYYY-MM-DD HH:mm:SS')}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DocumentInfo;
