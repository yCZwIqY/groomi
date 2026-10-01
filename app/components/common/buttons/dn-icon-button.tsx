import type { ButtonHTMLAttributes } from 'react';
import { tv } from 'tailwind-variants/lite';

type Variant = 'default' | 'dark' | 'ghost';
type Size = 's' | 'm' | 'l';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const styles = tv({
  base: 'flex items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
  variants: {
    variant: {
      default:
        'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:border-primary-200 hover:text-primary-600',
      dark: 'bg-stone-900 text-white  hover:bg-primary-600',
      ghost: 'text-stone-400 hover:bg-stone-200 hover:text-stone-700 active:bg-stone-300',
    },
    size: {
      s: 'h-8 w-8',
      m: 'h-9 w-9',
      l: 'h-11 w-11',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'm',
  },
});

const DnIconButton = ({ variant, size, className, type = 'button', ...rest }: Props) => {
  return (
    <button
      {...rest}
      className={[styles({ variant, size }), className].filter(Boolean).join(' ')}
      type={type}
    />
  );
};

export default DnIconButton;
