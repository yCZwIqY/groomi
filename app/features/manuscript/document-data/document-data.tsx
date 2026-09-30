import { useEffect, useState } from 'react';
import { getDocument, recoverDocument } from '~/lib/electron-api';
import { useSelectedWorkspace } from '~/stores/use-selected-workspace';
import DocumentInfo from '~/features/manuscript/document-data/document-info';
import { WorkspaceBreadcrumb } from '~/features';
import { DocumentContent } from '~/features/manuscript/document-content';
import DnButton from '~/components/common/buttons/dn-button';

export const DocumentData = () => {
  const selectedWorkspace = useSelectedWorkspace((state) => state.selectedWorkspace);
  const setSelectedWorkspace = useSelectedWorkspace((state) => state.setSelectedWorkspace);
  const [documentData, setDocumentData] = useState<WorkspaceNode | null>(null);
  const [loadError, setLoadError] = useState('');
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!selectedWorkspace?.path || selectedWorkspace.type !== 'document') {
      setDocumentData(null);
      return;
    }

    let isMounted = true;
    setDocumentData(null);
    setLoadError('');

    void getDocument(selectedWorkspace.path)
      .then((data) => {
        if (isMounted) {
          setDocumentData(data);
        }
      })
      .catch((error: unknown) => {
        if (isMounted)
          setLoadError(error instanceof Error ? error.message : '원고를 열지 못했습니다.');
      });

    return () => {
      isMounted = false;
    };
  }, [selectedWorkspace?.id, selectedWorkspace?.path, selectedWorkspace?.type]);

  return (
    <div className={'flex flex-1 flex-col gap-4 p-8 w-full'}>
      <WorkspaceBreadcrumb />
      {loadError && (
        <div
          role='alert'
          className='rounded-lg border border-red-200 bg-white p-6'
        >
          <p className='mb-4 text-sm text-red-600'>{loadError}</p>
          <p className='mb-4 text-sm text-neutral-500'>
            현재 원고 파일은 보존됩니다. 이전 저장본이 없으면 설정에서 작업 폴더 백업을
            복원해주세요.
          </p>
          <DnButton
            disabled={recovering}
            onClick={async () => {
              if (!selectedWorkspace?.path) return;
              setRecovering(true);
              try {
                const data = await recoverDocument(selectedWorkspace.path);
                if (
                  useSelectedWorkspace.getState().selectedWorkspace?.path === selectedWorkspace.path
                ) {
                  setDocumentData(data);
                  setLoadError('');
                }
              } catch (error) {
                setLoadError(
                  error instanceof Error ? error.message : '이전 저장본을 복구하지 못했습니다.',
                );
              } finally {
                setRecovering(false);
              }
            }}
          >
            이전 저장본 복구
          </DnButton>
        </div>
      )}
      {documentData && (
        <div>
          <DocumentInfo
            workspaceData={documentData}
            onUpdated={(nextDocumentData) => {
              setDocumentData(nextDocumentData);
              setSelectedWorkspace(nextDocumentData);
            }}
          />
          <DocumentContent
            workspaceData={documentData}
            onUpdated={(nextDocumentData) => {
              setDocumentData(nextDocumentData);
              setSelectedWorkspace(nextDocumentData);
            }}
          />
        </div>
      )}
    </div>
  );
};
