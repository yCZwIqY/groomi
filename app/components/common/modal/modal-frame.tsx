import type { ReactNode } from 'react';
import { AiOutlineClose } from 'react-icons/ai';
type Props = {
  title: ReactNode;
  label: string;
  description?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  size?: 'small' | 'large';
};
export default function ModalFrame({
  title,
  label,
  description,
  toolbar,
  footer,
  children,
  onClose,
  size = 'large',
}: Props) {
  return (
    <div
      className={`ui-modal flex max-h-[80dvh] flex-col overflow-hidden p-0! ${size === 'small' ? 'w-80' : 'w-160'}`}
      role='dialog'
      aria-modal='true'
      aria-label={label}
    >
      <div className='shrink-0 border-b border-stone-200 px-6 py-5'>
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0 flex-1'>
            <h2 className='typo-b2-b text-stone-900'>{title}</h2>
            {description && (
              <div className='mt-2 text-xs leading-5 text-stone-500'>{description}</div>
            )}
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label={label + ' 닫기'}
            className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-200 focus-visible:outline-primary-500'
          >
            <AiOutlineClose size={18} />
          </button>
        </div>
        {toolbar && <div className='pt-4'>{toolbar}</div>}
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto px-6 py-5'>{children}</div>
      {footer && (
        <div className='grid shrink-0 grid-cols-2 gap-3 border-t border-stone-200 bg-white/60 px-6 py-4'>
          {footer}
        </div>
      )}
    </div>
  );
}
