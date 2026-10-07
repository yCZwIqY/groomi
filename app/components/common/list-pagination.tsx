import DnButton from './buttons/dn-button';
type Props = {
  page: number;
  pageCount: number;
  count: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  label: string;
};
export default function ListPagination({
  page,
  pageCount,
  count,
  onChange,
  disabled,
  label,
}: Props) {
  if (!count) return null;
  const pages = Array.from(
    { length: Math.min(5, pageCount) },
    (_, index) => Math.max(1, Math.min(page - 2, pageCount - 4)) + index,
  );
  return (
    <nav
      aria-label={label + ' 페이지'}
      className='mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500'
    >
      <span>
        총 {count}개 · {page}/{pageCount}페이지
      </span>
      <div className='flex items-center gap-1'>
        <DnButton
          size='s'
          variant='outlined'
          disabled={disabled || page === 1}
          onClick={() => onChange(page - 1)}
        >
          이전
        </DnButton>
        {pages.map((number) => (
          <DnButton
            key={number}
            size='s'
            variant={number === page ? 'primary' : 'text'}
            aria-current={number === page ? 'page' : undefined}
            disabled={disabled}
            onClick={() => onChange(number)}
          >
            {number}
          </DnButton>
        ))}
        <DnButton
          size='s'
          variant='outlined'
          disabled={disabled || page === pageCount}
          onClick={() => onChange(page + 1)}
        >
          다음
        </DnButton>
      </div>
    </nav>
  );
}
