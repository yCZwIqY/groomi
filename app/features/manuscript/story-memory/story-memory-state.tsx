import type { ReactNode } from 'react';

export const StoryMemoryState = ({
  loading = false,
  children,
}: {
  loading?: boolean;
  children: ReactNode;
}) => (
  <div
    role={loading ? 'status' : undefined}
    className={
      'rounded-xl border bg-white/60 px-4 py-8 text-center text-sm text-stone-500 ' +
      (loading ? 'border-stone-200' : 'border-dashed border-stone-300')
    }
  >
    {children}
  </div>
);
