import { useId, useState, type ReactNode } from 'react';
import { FiChevronDown } from 'react-icons/fi';

interface Props {
  title: string;
  description?: string;
  count?: number;
  collapsible?: boolean;
  children: ReactNode;
}

export default function SettingsSection({
  title,
  description,
  count,
  collapsible,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(!collapsible);
  const contentId = useId();

  return (
    <section className={'ui-card min-w-0 w-full overflow-hidden'}>
      <header className={'flex items-start justify-between gap-4 p-5'}>
        <div className={'min-w-0'}>
          <div className={'flex items-center gap-2'}>
            <h3 className={'text-sm font-semibold text-stone-900'}>{title}</h3>
            {count !== undefined && (
              <span className={'rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600'}>
                {count}
              </span>
            )}
          </div>
          {description && <p className={'mt-1 text-sm leading-6 text-stone-500'}>{description}</p>}
        </div>
        {collapsible && (
          <button
            type={'button'}
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded((value) => !value)}
            className={
              'flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-primary-500'
            }
          >
            {expanded ? '접기' : '펼치기'}
            <FiChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </header>
      <div
        id={contentId}
        hidden={!expanded}
        className={'border-t border-stone-200 p-5 text-sm text-stone-700'}
      >
        {children}
      </div>
    </section>
  );
}
