import type { HTMLAttributes } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { tv } from 'tailwind-variants/lite';
import DnInput from '../inputs/dn-input';

type SelectOption = {
  description?: string;
  label: string;
  value: string | number;
};

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  disabled?: boolean;
  autocomplete?: boolean;
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
  autocomplete = false,
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
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const classes = styles({ open });
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = autocomplete
    ? options.filter((option) =>
        `${option.label} ${option.value}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : options;
  const listId = `${id}-list`;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, value, open]);

  useEffect(() => {
    if (activeIndex >= 0)
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const handleSelect = (nextValue: string | number) => {
    onChange?.(nextValue);
    setOpen(false);
    setQuery('');
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
      {autocomplete ? (
        <div
          className={`${classes.trigger()} focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 ${disabled ? 'bg-stone-100 text-stone-400' : ''}`}
        >
          <DnInput
            id={id}
            role={'combobox'}
            aria-label={label}
            aria-expanded={open && !disabled}
            aria-controls={listId}
            aria-autocomplete={'list'}
            aria-activedescendant={
              open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
            }
            autoComplete={'off'}
            variant={'text'}
            disabled={disabled}
            value={open ? query : (selectedOption?.label ?? '')}
            placeholder={open ? '모델명 또는 ID 검색' : placeholder}
            className={
              'min-w-0 flex-1 h-full! px-0! py-0! outline-none! [&_input]:bg-transparent [&_input]:text-sm [&_input]:font-medium'
            }
            onFocus={(event) => {
              inputRef.current = event.target;
              setQuery('');
              setOpen(true);
            }}
            onClick={() => {
              if (!open) setQuery('');
              setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onBlur={(event) => {
              if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
                setOpen(false);
                setQuery('');
              }
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((index) => {
                  if (!filteredOptions.length) return -1;
                  return event.key === 'ArrowDown'
                    ? Math.min(index + 1, filteredOptions.length - 1)
                    : index <= 0
                      ? filteredOptions.length - 1
                      : index - 1;
                });
              } else if (event.key === 'Enter' && open && activeIndex >= 0) {
                event.preventDefault();
                const option = filteredOptions[activeIndex];
                if (option) handleSelect(option.value);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                setQuery('');
              }
            }}
          />
          <button
            type={'button'}
            disabled={disabled}
            aria-label={`${label ?? '옵션'} 목록 열기`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (open) {
                setOpen(false);
                setQuery('');
              } else {
                inputRef.current?.focus();
                setQuery('');
                setOpen(true);
              }
            }}
          >
            <FiChevronDown className={classes.icon()} />
          </button>
        </div>
      ) : (
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
      )}

      {open && !disabled && (
        <div
          aria-label={label}
          className={classes.menu()}
          role='listbox'
          tabIndex={-1}
          id={listId}
        >
          {filteredOptions.length === 0 && (
            <div className={classes.empty()}>{query ? '검색 결과가 없습니다.' : emptyLabel}</div>
          )}
          {filteredOptions.map((option, index) => {
            const selected = option.value === value;

            return (
              <button
                aria-selected={selected}
                className={[
                  classes.option(),
                  selected || (autocomplete && activeIndex === index)
                    ? classes.selectedOption()
                    : '',
                ].join(' ')}
                id={`${id}-option-${index}`}
                key={option.value}
                onClick={() => handleSelect(option.value)}
                onMouseDown={autocomplete ? (event) => event.preventDefault() : undefined}
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
