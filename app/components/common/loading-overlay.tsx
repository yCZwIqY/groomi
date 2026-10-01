import type { ReactNode } from 'react';
import { FaSpinner } from 'react-icons/fa';

interface Props {
  loading: boolean;
  label: string;
  children: ReactNode;
  className?: string;
}

const LoadingOverlay = ({ loading, label, children, className = '' }: Props) => (
  <div
    className={'relative isolate ' + className}
    aria-busy={loading}
  >
    <div inert={loading}>{children}</div>
    {loading && (
      <div
        className={
          'absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/75'
        }
        role={'status'}
        aria-live={'polite'}
      >
        <div
          className={
            'flex flex-col items-center gap-3 rounded-xl border border-primary-100 bg-white px-6 py-5 shadow-sm'
          }
        >
          <FaSpinner
            aria-hidden
            className={'size-6 animate-spin text-primary-500 motion-reduce:animate-none'}
          />
          <span className={'text-sm font-medium text-stone-700'}>{label}</span>
        </div>
      </div>
    )}
  </div>
);

export default LoadingOverlay;
