import { Link } from 'react-router';
import AddWorkspaceButton from '~/components/add-workspace-modal/add-workspace-button';
import { useWorkspacePath } from '~/hooks';
import { useEffect, useState } from 'react';
import { getWorkspaceTree, onWorkspaceTreeChanged } from '~/lib/electron/workspace-api';
import SideBarItem from '~/features/side-bar/side-bar-item';
import { AiOutlineLeft, AiOutlineMenu, AiOutlinePlus, AiOutlineSetting } from 'react-icons/ai';
import DnIconButton from '~/components/common/buttons/dn-icon-button';
import logo from '~/assets/logo.png';

const SideBar = () => {
  const { workspacePath } = useWorkspacePath();
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceNode[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!workspacePath) {
      setWorkspaceTree([]);
      return;
    }

    let isMounted = true;

    const loadWorkspaceTree = async () => {
      const tree = await getWorkspaceTree();

      if (isMounted) {
        setWorkspaceTree(tree ?? []);
      }
    };

    void loadWorkspaceTree();

    const unsubscribe = onWorkspaceTreeChanged(() => {
      void loadWorkspaceTree();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [workspacePath]);

  return (
    <aside
      className={`p-3 bg-white h-dvh ${collapsed ? 'w-16 items-center' : 'w-[250px] '} transition-all flex flex-col justify-center`}
    >
      <div className={'flex flex-1 flex-col items-center overflow-hidden'}>
        <div className={`flex w-full justify-between items-center my-2`}>
          {!collapsed && (
            <div
              className={`min-w-0 min-h-0 overflow-hidden transition-opacity break-keep whitespace-nowrap`}
            >
              <img
                src={logo}
                alt={'그루미'}
                width={140}
                height={47}
                className='h-auto w-[140px] object-contain'
              />
            </div>
          )}
          <div className={`shrink-0 flex-1 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
            <DnIconButton
              aria-label={collapsed ? '사이드바 열기' : '사이드바 닫기'}
              onClick={() => setCollapsed((prev) => !prev)}
              size={'s'}
            >
              {collapsed ? <AiOutlineMenu size={18} /> : <AiOutlineLeft size={18} />}
            </DnIconButton>
          </div>
        </div>
        <Link
          className={`my-2 flex items-center rounded-2xl border border-transparent bg-white/55 text-stone-600 shadow-[inset_0_0_0_1px_rgba(231,229,228,0.85)] transition-all hover:border-primary-100 hover:bg-white hover:text-stone-900 p-3 gap-4 ${collapsed || 'w-full'}`}
          to={'/'}
        >
          <div
            className={`h-2.5 w-2.5 rounded-full bg-primary-500 shadow-[0_0_0_6px_rgba(37,99,235,0.12)]`}
          />
          {!collapsed && (
            <span
              className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300`}
            >
              홈으로 이동
            </span>
          )}
        </Link>
        <div className={'flex min-h-0 flex-1 flex-col overflow-visible w-full my-2'}>
          <div className={`flex items-center justify-between cursor-default`}>
            {!collapsed && (
              <div
                className={`flex-1 overflow-hidden whitespace-nowrap text-xs font-bold uppercase tracking-[0.18em] text-stone-500`}
              >
                Workspace
              </div>
            )}
            <div className={`flex flex-1 ${collapsed ? 'justify-center' : 'justify-end'}`}>
              <AddWorkspaceButton targetPath={workspacePath}>
                <DnIconButton
                  variant={'dark'}
                  size={'s'}
                >
                  <AiOutlinePlus size={16} />
                </DnIconButton>
              </AddWorkspaceButton>
            </div>
          </div>

          <div className={'my-2 flex-1 overflow-auto sidebar-scroll '}>
            {!collapsed && (
              <div className={'flex flex-col gap-1.5'}>
                {workspaceTree.map((workspace) => (
                  <SideBarItem
                    {...workspace}
                    key={workspace.id ?? workspace.path}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={'mt-3'}>
        <Link
          to={'/setting'}
          className={`flex items-center gap-2 hover:bg-stone-100 rounded-full ${collapsed ? 'p-1' : 'px-3 py-2'}`}
        >
          <AiOutlineSetting size={24} />
          {!collapsed && 'Settings'}
        </Link>
      </div>
    </aside>
  );
};

export default SideBar;
