import type { ButtonHTMLAttributes } from 'react';

export const PillActionButton = ({
  tone = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'delete' }) => (
  <button
    type={'button'}
    {...props}
    className={
      'flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ' +
      (tone === 'delete'
        ? 'text-stone-500 hover:bg-red-50 hover:text-red-600 '
        : 'border border-primary-200 bg-white text-primary-600 hover:bg-primary-50 ') +
      className
    }
  />
);
