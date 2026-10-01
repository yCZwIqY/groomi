import type { HTMLAttributes } from 'react';

const tagColors = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  neutral: 'border-stone-200 bg-stone-100 text-stone-600',
  primary: 'border-primary-200 bg-primary-50 text-primary-700',
};

export const StoryMemoryTag = ({
  tone = 'neutral',
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tagColors }) => (
  <span
    {...props}
    className={
      'inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ' +
      tagColors[tone] +
      ' ' +
      className
    }
  />
);
