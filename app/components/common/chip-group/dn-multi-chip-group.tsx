import DnChip from './dn-chip';
import type { Option } from '~/components';

interface Props<T> {
  label: string;
  description?: string;
  options: Option<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  disabled?: boolean;
}

const DnMultiChipGroup = <T,>({
  label,
  description,
  options,
  value,
  onChange,
  disabled = false,
}: Props<T>) => (
  <fieldset
    disabled={disabled}
    className={'min-w-0'}
  >
    <legend className={'mb-1 text-sm font-semibold text-stone-900'}>{label}</legend>
    {description && <p className={'mb-3 text-xs leading-5 text-stone-500'}>{description}</p>}
    <div className={'flex flex-wrap gap-2'}>
      <DnChip
        type={'button'}
        selected={value.length === options.length}
        onClick={() => onChange(options.map((option) => option.value))}
      >
        전체 선택
      </DnChip>
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <DnChip
            key={String(option.value)}
            type={'button'}
            selected={selected}
            disabled={disabled || (selected && value.length === 1)}
            onClick={() =>
              onChange(
                selected ? value.filter((item) => item !== option.value) : [...value, option.value],
              )
            }
          >
            {option.label}
          </DnChip>
        );
      })}
    </div>
  </fieldset>
);

export default DnMultiChipGroup;
