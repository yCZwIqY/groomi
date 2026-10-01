import { uiFieldClass } from '~/components/common/ui-styles';
import { useEffect, useState } from 'react';
import { FaCamera } from 'react-icons/fa';
import { AiOutlineCalendar, AiOutlineClockCircle } from 'react-icons/ai';
import { readImage, removeFile, saveImage, showInFolder } from '~/lib/electron/file-api';
import { updateWorkspaceInfo } from '~/lib/electron/workspace-api';
import DnButton from '~/components/common/buttons/dn-button';
import DnInput from '~/components/common/inputs/dn-input';
import { formatDate } from '../../../../utils/date-utils';

interface Props {
  workspaceData?: WorkspaceNode | null;
  onUpdated?: (workspaceData: WorkspaceNode) => void;
}
const WorkspaceSummary = ({ workspaceData, onUpdated }: Props) => {
  const [coverSrc, setCoverSrc] = useState('');
  const [coverPath, setCoverPath] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    let isMounted = true;

    if (workspaceData) {
      setDescription(workspaceData.workspace?.description ?? '');
      setName(workspaceData?.name ?? '');
    }
    if (!workspaceData?.workspace?.coverPath) {
      setCoverSrc('');
      return () => {
        isMounted = false;
        setName('');
        setDescription('');
        setCoverPath('');
        setCoverSrc('');
      };
    }

    void readImage(workspaceData.workspace.coverPath).then((src) => {
      if (isMounted) {
        setCoverSrc(src);
        setCoverPath(workspaceData.workspace?.coverPath ?? '');
      }
    });

    return () => {
      isMounted = false;
      setName('');
      setDescription('');
      setCoverPath('');
      setCoverSrc('');
    };
  }, [workspaceData]);

  const handleSaveCoverImage = async (files: FileList | null) => {
    if (!files || !files.length || !workspaceData?.path) {
      return;
    }
    const file = files[0];
    const newCoverPath = await saveImage(workspaceData.path, file);
    const prevCoverPath = workspaceData.workspace?.coverPath;
    if (prevCoverPath) {
      await removeFile(prevCoverPath);
    }
    const updatedWorkspace = await updateWorkspaceInfo(workspaceData?.path, {
      workspace: {
        coverPath: newCoverPath,
      },
    });
    onUpdated?.(updatedWorkspace);
  };

  const handleUpdateWorkspaceData = async (data: WorkspaceUpdatePayload) => {
    if (!workspaceData?.path) {
      return;
    }
    const updatedWorkspace = await updateWorkspaceInfo(workspaceData?.path, {
      ...data,
    });
    if (updatedWorkspace) onUpdated?.(updatedWorkspace);
  };

  return (
    <section className={'ui-card p-5 w-full flex gap-4'}>
      <div className={'w-[180px] h-[220px] shrink-0'}>
        {coverSrc ? (
          <div
            className={
              'group relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg bg-stone-200'
            }
          >
            <img
              className={'h-full w-full object-cover'}
              src={coverSrc}
              alt={`${workspaceData?.name ?? '워크스페이스'}의 커버 이미지`}
              width={200}
              height={300}
            />
            <div
              className={
                'absolute inset-0 flex flex-col gap-2 px-2 items-center justify-center bg-stone-950/0 text-white opacity-0 transition-all group-hover:bg-stone-950/45 group-hover:opacity-100'
              }
            >
              <DnButton
                className={'w-full'}
                variant={'secondary'}
              >
                <label htmlFor={'image-uploader'}>커버 이미지 교체</label>
              </DnButton>

              <DnButton
                className={'w-full bg-white'}
                variant={'outlined'}
                onClick={() => {
                  void showInFolder(coverPath);
                }}
              >
                파일 위치 열기
              </DnButton>
            </div>
          </div>
        ) : (
          <label
            htmlFor={'image-uploader'}
            className={
              'group relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg bg-stone-200'
            }
          >
            <FaCamera color={'#737373'} />
            <div className={'text-neutral-500'}>커버 이미지 교체</div>
          </label>
        )}
        <input
          id={'image-uploader'}
          className={'sr-only'}
          multiple={false}
          type={'file'}
          accept={'image/*'}
          onChange={(e) => {
            void handleSaveCoverImage(e.target.files);
          }}
        />
      </div>
      <div className={'flex flex-col flex-1'}>
        <h3 className={'text-2xl font-bold text-neutral-700'}>
          <DnInput
            variant={'text'}
            value={name}
            className={'font-bold'}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (!name) return;
              void handleUpdateWorkspaceData({ name });
            }}
          />
        </h3>
        <div className={'flex flex-wrap gap-5 text-sm text-neutral-400'}>
          <div className={'flex items-center gap-1'}>
            <AiOutlineCalendar />
            {formatDate(new Date(workspaceData?.createdAt ?? ''), 'YYYY-MM-DD HH:mm:SS')}
          </div>
          <div className={'flex items-center gap-1'}>
            <AiOutlineClockCircle />
            {formatDate(new Date(workspaceData?.updatedAt ?? ''), 'YYYY-MM-DD HH:mm:SS')}
          </div>
        </div>
        <div className={'mt-2 flex-1'}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() =>
              handleUpdateWorkspaceData({
                workspace: {
                  description,
                },
              })
            }
            className={`w-full h-full flex flex-1 resize-none ${uiFieldClass}`}
          />
        </div>
      </div>
    </section>
  );
};

export default WorkspaceSummary;
