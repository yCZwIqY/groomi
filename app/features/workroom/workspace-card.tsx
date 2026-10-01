import {
  AiOutlineArrowRight,
  AiOutlineClockCircle,
  AiOutlineFileText,
  AiOutlineFolder,
} from 'react-icons/ai';
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

export default function WorkspaceCard({
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
