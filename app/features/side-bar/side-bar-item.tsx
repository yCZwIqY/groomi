import { useEffect, useState } from 'react';
import { AiOutlineFile, AiOutlineFolder, AiOutlineFolderOpen, AiOutlinePlus } from 'react-icons/ai';
import { useSelectedWorkspace } from '~/stores/use-selected-workspace';
import { useNavigate } from 'react-router';
import AddWorkspaceButton from '~/components/add-workspace-modal/add-workspace-button';
import { BiUpArrow } from 'react-icons/bi';
import DnIconButton from '~/components/common/buttons/dn-icon-button';

type Props = WorkspaceNode & {};

const SideBarItem = (fileTreeNode: Props) => {
  const { name, path, id, type, children, ...workspaceData } = fileTreeNode;
  const navigate = useNavigate();
  const selectedWorkspaceId = useSelectedWorkspace((state) => state.selectedWorkspaceId);
  const setSelectedWorkspace = useSelectedWorkspace((state) => state.setSelectedWorkspace);
  const [open, setOpen] = useState(false);
  const isSelected = selectedWorkspaceId ? selectedWorkspaceId === id : false;
  const hasChildren = type === 'workspace' && (children?.length ?? 0) > 0;
  const hasSelectedDescendant =
    type === 'workspace' && Boolean(children?.some((child) => child.id === selectedWorkspaceId));

  useEffect(() => {
    if (hasSelectedDescendant) {
      setOpen(true);
    }
  }, [hasSelectedDescendant]);

  return (
    <div className={'min-w-fit'}>
      <div
        onClick={async () => {
          if (hasChildren) {
            setOpen((prev) => !prev);
          }
          const selected = await setSelectedWorkspace({
            id,
            ...workspaceData,
            name,
            path,
            type,
            children,
          });
          if (selected) navigate('manuscript');
        }}
        className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition-all duration-300 ${isSelected ? 'border-primary-200 bg-primary-50 text-primary-700 ' : 'border-transparent text-stone-600 hover:border-stone-200 hover:bg-white/75 hover:text-stone-900'}`}
      >
        <div
          className={`text-[16px] transition-transform duration-300 ${isSelected ? 'scale-110 text-primary-500' : 'group-hover:scale-105'}`}
        >
          {type === 'document' ? (
            <AiOutlineFile />
          ) : open ? (
            <AiOutlineFolderOpen />
          ) : (
            <AiOutlineFolder />
          )}
        </div>
        <div
          className={`flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden transition-all duration-300 max-w-[220px] opacity-100`}
        >
          <div className={'truncate font-medium'}>{name.split('.')[0]}</div>
          {hasChildren && (
            <div
              className={`text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            >
              <BiUpArrow />
            </div>
          )}
        </div>
        {type === 'workspace' && (
          <AddWorkspaceButton targetPath={path}>
            <DnIconButton
              className={'rounded-full'}
              size={'s'}
              variant={'ghost'}
            >
              <AiOutlinePlus />
            </DnIconButton>
          </AddWorkspaceButton>
        )}
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${open ? 'mt-1.5 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}
      >
        <div className={'overflow-auto'}>
          <div className={'ml-4 border-l border-stone-200/80 pl-3'}>
            {children?.map((item: WorkspaceNode) => (
              <SideBarItem
                {...item}
                key={item.id ?? item.path}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideBarItem;
