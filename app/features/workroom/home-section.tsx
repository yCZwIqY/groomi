import WorkspaceCard from './workspace-card';
export default function HomeSection({
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
