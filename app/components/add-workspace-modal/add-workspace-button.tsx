import ModalFrame from '~/components/common/modal/modal-frame';
import { useWorkspacePath } from '~/hooks';
import { useModal } from '~/hooks/use-modal';
import DnInput from '~/components/common/inputs/dn-input';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSelectedWorkspace } from '~/stores/use-selected-workspace';
import DnButton from '~/components/common/buttons/dn-button';
import { DnChipGroup } from '~/components/common/chip-group';
import { showToast } from '~/lib/toast-manager';
import { createDocument } from '~/lib/electron/document-api';
import { getWorkspaceInfo } from '~/lib/electron/workspace-api';
import { AiOutlineArrowLeft, AiOutlineFolderOpen } from 'react-icons/ai';
import { CiFileOn } from 'react-icons/ci';

type NodeType = 'workspace' | 'document';

const NOVEL_TYPE_OPTIONS: { label: string; value: NovelType }[] = [
  { label: '장편', value: 'long' },
  { label: '단편', value: 'short' },
];

interface Props {
  targetPath?: string;
  children?: ReactNode;
  onCreated?: () => void;
}
const AddWorkspaceButton = ({ targetPath, children, onCreated }: Props) => {
  const navigate = useNavigate();
  const setSelectedWorkspace = useSelectedWorkspace((state) => state.setSelectedWorkspace);
  const { workspacePath, createNewWorkspace } = useWorkspacePath();
  const creationInProgress = useRef(false);
  const [creating, setCreating] = useState(false);
  const [parentGroup, setParentGroup] = useState(targetPath || workspacePath);
  const [nodeType, setNodeType] = useState<NodeType | null>(null);
  const [novelType, setNovelType] = useState<NovelType>('long');
  const [name, setName] = useState<string>('');

  const resetForm = () => {
    setNodeType(null);
    setNovelType('long');
    setName('');
  };

  useEffect(() => {
    setParentGroup(targetPath || workspacePath);
    return () => {
      resetForm();
    };
  }, [targetPath, workspacePath]);

  useEffect(() => {
    return () => {
      resetForm();
    };
  }, []);

  const { portal, setIsOpen } = useModal(
    {
      content: (
        <ModalFrame
          title={
            nodeType ? (
              <button
                type={'button'}
                onClick={() => setNodeType(null)}
                className={'flex items-center gap-1 text-sm text-stone-500'}
              >
                <AiOutlineArrowLeft /> 뒤로
              </button>
            ) : (
              '새 문서 혹은 그룹 추가'
            )
          }
          label='새 문서 혹은 그룹 추가'
          size='small'
          onClose={() => setIsOpen(false)}
          footer={
            nodeType && (
              <>
                <DnButton
                  variant='outlined'
                  onClick={() => setIsOpen(false)}
                >
                  닫기
                </DnButton>
                <DnButton
                  loading={creating}
                  onClick={() => void handleCreate()}
                >
                  생성
                </DnButton>
              </>
            )
          }
        >
          {!nodeType && (
            <>
              <div className={'text-stone-500 text-xs pb-4'}>무엇을 추가할까요?</div>
              <div className={'grid grid-cols-2 gap-3'}>
                <DnButton
                  onClick={() => setNodeType('workspace')}
                  className={
                    'flex h-auto! flex-col gap-3 rounded-2xl! border border-stone-300 bg-white px-4 py-5 text-stone-800 shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
                  }
                  variant={'outlined'}
                >
                  <AiOutlineFolderOpen size={30} />
                  그룹
                </DnButton>
                <DnButton
                  onClick={() => setNodeType('document')}
                  className={
                    'flex h-auto! flex-col gap-3 rounded-2xl! border border-stone-300 bg-white px-4 py-5 text-stone-800 shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
                  }
                  variant={'outlined'}
                >
                  <CiFileOn size={30} />
                  회차
                </DnButton>
              </div>
            </>
          )}

          {nodeType && (
            <>
              <div className={'text-stone-500 text-xs'}>
                하위에 생성: <br />
                <div className={'truncate'}> {parentGroup}</div>
              </div>

              {nodeType === 'workspace' && (
                <div className={'pt-4'}>
                  <div className={'mb-2 typo-b5-b text-stone-900'}>그룹 유형</div>
                  <DnChipGroup
                    onChange={setNovelType}
                    options={NOVEL_TYPE_OPTIONS}
                    value={novelType}
                  />
                  <p className={'mt-2 typo-b6-r text-stone-400'}>
                    단편은 화차별로 줄거리를 이어가지 않고, 각 회차의 사건·인물·복선을 독립적으로
                    관리합니다.
                  </p>
                </div>
              )}

              <div className={'pt-4'}>
                <DnInput
                  className={'w-full border-stone-300 bg-white'}
                  id={'group-name'}
                  placeholder={'이름을 입력해주세요.'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </>
          )}
        </ModalFrame>
      ),
    },
    [parentGroup, nodeType, novelType, name, creating],
  );

  const handleCreate = async () => {
    if (creationInProgress.current || !nodeType) return;
    if (!name) {
      showToast('이름을 입력해주세요.', 'danger');
      return;
    }

    creationInProgress.current = true;
    setCreating(true);
    try {
      let createdNode: WorkspaceNode;
      if (nodeType === 'workspace') {
        const created = await createNewWorkspace(parentGroup, name, novelType);
        createdNode = await getWorkspaceInfo(created.path);
      } else {
        createdNode = await createDocument(parentGroup, name);
      }

      onCreated?.();
      setIsOpen(false);
      resetForm();
      const selected = await setSelectedWorkspace(createdNode);
      if (selected) navigate('/manuscript');
    } catch (error) {
      showToast((error as Error).message, 'danger');
    } finally {
      creationInProgress.current = false;
      setCreating(false);
    }
  };

  return (
    <>
      <button
        className={'cursor-pointer'}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
      >
        {children ?? (
          <span
            className={
              'flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-600'
            }
          >
            <AiOutlineFolderOpen size={16} />
          </span>
        )}
      </button>
      {portal}
    </>
  );
};

export default AddWorkspaceButton;
