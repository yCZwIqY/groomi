import type { HTMLAttributes } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { tv } from 'tailwind-variants/lite';

type SelectOption = {
  description?: string;
  label: string;
  value: string | number;
};

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  disabled?: boolean;
  emptyLabel?: string;
  hint?: string;
  label?: string;
  onChange?: (value: string | number) => void;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
}

const styles = tv({
  slots: {
    root: 'relative',
    label: 'mb-2 block text-sm font-semibold text-stone-900',
    trigger:
      'flex h-9 w-full items-center justify-between gap-3 rounded-lg border border-stone-300 bg-white px-3 text-left outline-none transition hover:border-stone-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400',
    triggerText: 'min-w-0 flex-1 truncate text-sm font-medium text-stone-900',
    placeholder: 'min-w-0 flex-1 truncate text-sm text-stone-400',
    icon: 'shrink-0 text-lg text-stone-400 transition',
    menu: 'absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-stone-200 bg-white p-1 shadow-lg outline-none',
    option:
      'w-full rounded px-3 py-2 text-left transition hover:bg-stone-100 focus:bg-stone-100 focus:outline-none',
    optionLabel: 'block truncate text-sm font-medium text-stone-900',
    optionDescription: 'mt-0.5 block truncate text-xs text-stone-500',
    selectedOption: 'bg-primary-50 hover:bg-primary-50',
    selectedLabel: 'text-primary-700',
    empty: 'px-3 py-2 text-sm text-stone-400',
    hint: 'mt-1.5 text-xs text-stone-500',
  },
  variants: {
    open: {
      true: {
        icon: 'rotate-180 text-primary-500',
      },
    },
  },
});

const DnSelect = ({
  className,
  disabled,
  emptyLabel = '선택 가능한 항목 없음',
  hint,
  label,
  onChange,
  options,
  placeholder = '선택해주세요',
  value,
  ...rest
}: Props) => {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const classes = styles({ open });
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const handleSelect = (nextValue: string | number) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div
      {...rest}
      className={[classes.root(), className].filter(Boolean).join(' ')}
      ref={rootRef}
    >
      {label && (
        <label
          className={classes.label()}
          htmlFor={id}
        >
          {label}
        </label>
      )}
      <button
        aria-expanded={open}
        aria-haspopup='listbox'
        className={classes.trigger()}
        disabled={disabled}
        id={id}
        onClick={() => setOpen((current) => !current)}
        type='button'
      >
        <span className={selectedOption ? classes.triggerText() : classes.placeholder()}>
          {selectedOption?.label ?? placeholder}
        </span>
        <FiChevronDown className={classes.icon()} />
      </button>

      {open && !disabled && (
        <div
          aria-label={label}
          className={classes.menu()}
          role='listbox'
          tabIndex={-1}
        >
          {options.length === 0 && <div className={classes.empty()}>{emptyLabel}</div>}
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                aria-selected={selected}
                className={[classes.option(), selected ? classes.selectedOption() : ''].join(' ')}
                key={option.value}
                onClick={() => handleSelect(option.value)}
                role='option'
                type='button'
              >
                <span
                  className={[classes.optionLabel(), selected ? classes.selectedLabel() : ''].join(
                    ' ',
                  )}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span className={classes.optionDescription()}>{option.description}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {hint && <div className={classes.hint()}>{hint}</div>}
    </div>
  );
};

export default DnSelect;
