import type { FontWeight, Rounded, Size } from '~/components';
import { tv } from 'tailwind-variants/lite';
import { TextInput, type TextInputProps } from 'jy-headless';

interface Props extends Omit<TextInputProps, 'size'> {
  variant?: 'outlined' | 'underlined' | 'text';
  size?: Size;
  fontWeight?: FontWeight;
  rounded?: Rounded;
}

const styles = tv({
  base: [
    'outline-2 outline-transparent outline-offset-1 transition-colors px-3 py-2',
    '[&_input]:outline-none [&_input]:w-full [&_input]:h-full',
  ],
  variants: {
    variant: {
      outlined:
        'bg-white border border-stone-200 text-stone-800 focus-within:border-primary-500 focus-within:outline-primary-100',
      underlined:
        'bg-none border-b border-stone-200 text-stone-800 rounded-none! outline-0 focus-within:border-primary-500 ',
      text: 'bg-none focus-within:outline-primary-500',
    },
    size: {
      s: 'min-w-4 h-8 text-xs',
      m: 'min-w-6 h-9 text-sm',
      l: 'min-w-8 h-11 text-sm',
    },
    rounded: {
      s: 'rounded-sm',
      m: 'rounded-lg',
      l: 'rounded-xl',
    },
    fontWeight: {
      light: 'font-light!',
      regular: 'font-regular!',
      bold: 'font-bold!',
      black: 'font-black!',
    },
  },
});

const DnInput = ({
  variant = 'outlined',
  size = 'm',
  fontWeight = 'regular',
  rounded = 'm',
  className,
  ...rest
}: Props) => {
  return (
    <div className={[styles({ variant, size, fontWeight, rounded }), className].join(' ')}>
      <TextInput
        {...rest}
        className={className}
      />
    </div>
  );
};

export default DnInput;
