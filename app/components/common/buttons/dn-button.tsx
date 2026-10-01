import type { ButtonHTMLAttributes } from 'react';
import type { FontWeight, Rounded, Size, Variants } from '~/components';
import { tv } from 'tailwind-variants/lite';
import { FaSpinner } from 'react-icons/fa';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: Variants | 'red' | 'red-outline' | 'disabled';
  size?: Size;
  fontWeight?: FontWeight;
  rounded?: Rounded;
  loading?: boolean;
}

const styles = tv({
  base: 'outline-2 outline-transparent outline-offset-1 transition-colors focus-visible:outline-primary-500 flex items-center justify-center gap-2 disabled:cursor-not-allowed',
  variants: {
    variant: {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 ',
      secondary: 'bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-700',
      outlined:
        'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 active:bg-stone-100',
      text: 'text-stone-600 hover:bg-stone-100 active:bg-stone-200',
      red: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:outline-red-500 outline-1',
      'red-outline':
        'border border-red-600 text-red-600 hover:bg-red-50 active:bg-red-100 focus:outline-red-500 outline-1',
      disabled: 'bg-stone-100 text-stone-400 border border-stone-200 focus:outline-none',
    },
    size: {
      s: 'h-8 text-xs px-3',
      m: 'h-9 text-sm px-4',
      l: 'h-11 text-sm px-5',
    },
    rounded: {
      s: 'rounded-md!',
      m: 'rounded-lg!',
      l: 'rounded-xl!',
    },
    fontWeight: {
      light: 'font-light!',
      regular: 'font-regular!',
      bold: 'font-bold!',
      black: 'font-black!',
    },
  },
});

const DnButton = ({
  variant = 'primary',
  size = 'm',
  fontWeight = 'bold',
  rounded = 'm',
  disabled,
  className,
  loading = false,
  children,
  ...rest
}: Props) => {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${styles({ variant: disabled ? 'disabled' : variant, size, fontWeight, rounded })} ${className}`}
    >
      {loading ? (
        <div>
          <FaSpinner
            fontSize={'100%'}
            className={'animate-spin'}
          />
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default DnButton;
