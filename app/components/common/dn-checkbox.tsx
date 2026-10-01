import { useEffect, useRef, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
}

export default function DnCheckbox({ indeterminate = false, className = '', ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      {...props}
      ref={ref}
      type={'checkbox'}
      className={`size-4 shrink-0 cursor-pointer accent-primary-500 focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed ${className}`}
    />
  );
}
