import type { HTMLAttributes } from 'react';
import type { Option } from '~/components';
import DnChip from './dn-chip';

interface DnChipGroupProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

const DnChipGroup = <T,>({
  options,
  value,
  onChange,
  disabled = false,
  className,
  ...rest
}: DnChipGroupProps<T>) => {
  const columnCount = Math.max(options.length, 1);

  return (
    <div
      {...rest}
      className={['grid gap-2', disabled ? 'opacity-50' : '', className].filter(Boolean).join(' ')}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        ...rest.style,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <DnChip
            key={String(option.value)}
            type='button'
            disabled={disabled}
            selected={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </DnChip>
        );
      })}
    </div>
  );
};

export default DnChipGroup;
