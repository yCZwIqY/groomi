import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

const DnChip = ({ selected = false, className = '', ...props }: Props) => (
  <button
    type={'button'}
    aria-pressed={selected}
    {...props}
    className={
      'min-h-9 rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:cursor-not-allowed ' +
      (selected
        ? 'border-primary-500 bg-primary-500 text-white enabled:hover:border-primary-600 enabled:hover:bg-primary-600 '
        : 'border-stone-200 bg-white text-stone-600 enabled:hover:border-primary-300 enabled:hover:bg-primary-50 ') +
      className
    }
  />
);

export default DnChip;
