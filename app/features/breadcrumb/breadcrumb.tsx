import { TbChevronRight } from 'react-icons/tb';
import { Fragment } from 'react';
import { Link } from 'react-router';

export type BreadcrumbItem = {
  label: string;
  to?: string;
  onClick?: () => void;
};

interface Props {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb = ({ items, className }: Props) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={'breadcrumb'}
      className={className}
    >
      <ol className={'flex flex-wrap items-center gap-2 text-sm text-stone-500'}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className={'min-w-0'}>
                {item.to && !isLast ? (
                  <Link
                    className={
                      'truncate rounded-full px-2 py-1 transition-colors hover:bg-white/80 hover:text-stone-900'
                    }
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                ) : item.onClick && !isLast ? (
                  <button
                    className={
                      'truncate rounded-full px-2 py-1 transition-colors hover:bg-white/80 hover:text-stone-900'
                    }
                    onClick={item.onClick}
                    type={'button'}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className={isLast ? 'font-semibold text-stone-900' : 'truncate'}>
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li
                  aria-hidden={'true'}
                  className={'text-[11px] text-stone-300'}
                >
                  <TbChevronRight />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
