import { useEffect, useMemo, useState } from 'react';
import {
  AiOutlineArrowRight,
  AiOutlineClockCircle,
  AiOutlineFileText,
  AiOutlineFolder,
  AiOutlinePlus,
} from 'react-icons/ai';
import { useNavigate } from 'react-router';
import AddWorkspaceButton from '~/components/add-workspace-modal/add-workspace-button';
import { useWorkspacePath } from '~/hooks';
import { getWorkspaceTree, onWorkspaceTreeChanged } from '~/lib/electron/workspace-api';
import { useSelectedWorkspace } from '~/stores/use-selected-workspace';

const MAX_ITEMS = 6;

function flattenTree(nodes: WorkspaceNode[]): WorkspaceNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children ?? [])]);
}

function toTimestamp(value?: string) {
  return value ? new Date(value).getTime() : 0;
}

function formatRelativeDate(value?: string) {
  if (!value) return '날짜 정보 없음';

  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function getDisplayName(node: WorkspaceNode) {
  return node.type === 'document'
    ? (node.document?.title ?? node.name.replace(/\.json$/, ''))
    : node.name;
}

function WorkspaceCard({
  item,
  onClick,
}: {
  item: WorkspaceNode;
  onClick: (item: WorkspaceNode) => void;
}) {
  const isDocument = item.type === 'document';

  return (
    <button
      type='button'
      onClick={() => onClick(item)}
      className='group flex min-h-36 flex-col rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-primary-200 hover:bg-primary-100/10'
    >
      <div className='flex w-full items-start justify-between gap-4'>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-md ${
            isDocument ? 'bg-neutral-100 text-neutral-500' : 'bg-primary-100 text-primary-500'
          }`}
        >
          {isDocument ? <AiOutlineFileText size={18} /> : <AiOutlineFolder size={18} />}
        </div>
        <AiOutlineArrowRight
          className='text-neutral-300 transition-all group-hover:translate-x-1 group-hover:text-primary-500'
          size={16}
        />
      </div>
      <div className='mt-4 line-clamp-1 text-sm font-bold text-neutral-700'>
        {getDisplayName(item)}
      </div>
      <div className='mt-1 line-clamp-1 text-xs text-neutral-400'>{item.parentPath}</div>
      <div className='mt-auto flex items-center gap-1.5 pt-3 text-xs text-neutral-400'>
        <AiOutlineClockCircle />
        {formatRelativeDate(item.updatedAt)}
      </div>
    </button>
  );
}

const Workroom = () => {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspacePath();
  const setSelectedWorkspace = useSelectedWorkspace((state) => state.setSelectedWorkspace);
  const [tree, setTree] = useState<WorkspaceNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspacePath) {
      setTree([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadTree = async () => {
      const nextTree = await getWorkspaceTree();
      if (isMounted) {
        setTree(nextTree ?? []);
        setLoading(false);
      }
    };

    void loadTree();
    const unsubscribe = onWorkspaceTreeChanged(() => void loadTree());

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [workspacePath]);

  const items = useMemo(() => flattenTree(tree), [tree]);
  const recentItems = useMemo(
    () =>
      [...items]
        .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
        .slice(0, MAX_ITEMS),
    [items],
  );
  const recentWorkspaces = useMemo(
    () =>
      items
        .filter((item) => item.type === 'workspace')
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
        .slice(0, MAX_ITEMS),
    [items],
  );
  const documentCount = items.filter((item) => item.type === 'document').length;
  const workspaceCount = items.length - documentCount;

  const openItem = (item: WorkspaceNode) => {
    setSelectedWorkspace(item);
    navigate('/manuscript');
  };

  return (
    <div className='mx-auto flex w-full max-w-[1440px] flex-col gap-5 p-10'>
      <div className='flex flex-col justify-between gap-4 pb-2 sm:flex-row sm:items-end'>
        <div>
          <h1 className='text-xl font-bold text-neutral-800'>작업실</h1>
          <p className='mt-1 text-sm text-neutral-400'>
            최근 작업을 빠르게 열거나 새로운 작업을 시작합니다.
          </p>
        </div>
        <div>
          <AddWorkspaceButton targetPath={workspacePath}>
            <span className='flex h-9 items-center gap-2 rounded-md bg-primary-500 px-4 text-sm font-bold text-white transition hover:bg-primary-600'>
              <AiOutlinePlus size={17} />새 작업 시작
            </span>
          </AddWorkspaceButton>
        </div>
      </div>

      <section className='grid grid-cols-2 gap-3 lg:max-w-xl'>
        <div className='ui-card px-4 py-3'>
          <div className='text-xs text-neutral-400'>워크스페이스</div>
          <div className='mt-1 text-xl font-bold text-neutral-700'>{workspaceCount}</div>
        </div>
        <div className='ui-card px-4 py-3'>
          <div className='text-xs text-neutral-400'>작성 중인 문서</div>
          <div className='mt-1 text-xl font-bold text-neutral-700'>{documentCount}</div>
        </div>
      </section>

      <HomeSection
        title='최근 작업'
        description='마지막으로 수정한 작업부터 모았습니다.'
        items={recentItems}
        loading={loading}
        emptyMessage='아직 작업한 항목이 없습니다. 첫 문서를 만들어보세요.'
        onClick={openItem}
      />
      <HomeSection
        title='최근 생성한 워크스페이스'
        description='새롭게 만든 공간을 빠르게 확인하세요.'
        items={recentWorkspaces}
        loading={loading}
        emptyMessage='생성된 워크스페이스가 없습니다.'
        onClick={openItem}
      />
    </div>
  );
};

function HomeSection({
  title,
  description,
  items,
  loading,
  emptyMessage,
  onClick,
}: {
  title: string;
  description: string;
  items: WorkspaceNode[];
  loading: boolean;
  emptyMessage: string;
  onClick: (item: WorkspaceNode) => void;
}) {
  return (
    <section className='ui-card w-full'>
      <div className='border-b border-neutral-200 px-4 py-3'>
        <h2 className='text-sm font-bold text-neutral-600'>{title}</h2>
        <p className='mt-1 text-xs text-neutral-400'>{description}</p>
      </div>
      {items.length > 0 ? (
        <div className='grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3'>
          {items.map((item) => (
            <WorkspaceCard
              key={item.id ?? item.path}
              item={item}
              onClick={onClick}
            />
          ))}
        </div>
      ) : (
        <div className='flex min-h-28 items-center justify-center px-6 text-center text-sm text-neutral-400'>
          {loading ? '워크스페이스를 불러오는 중입니다.' : emptyMessage}
        </div>
      )}
    </section>
  );
}

export default Workroom;
