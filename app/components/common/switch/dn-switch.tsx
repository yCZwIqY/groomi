import type { Option } from '~/components';
import { useMemo } from 'react';

interface Props<T> {
  options: Option<T>[];
  value: T;
  setValue: (value: T) => void;
}
const DnSwitch = <T,>({ options, value, setValue }: Props<T>) => {
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );

  return (
    <div className={'flex flex-col'}>
      <div
        className={'grid h-10'}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map(({ label, value }, index) => (
          <button
            type='button'
            key={String(value)}
            className={`${index === selectedIndex ? 'font-bold text-primary-500' : ''}`}
            onClick={() => setValue(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className={'h-px border-b border-primary-500 transition-all'}
        style={{
          width: `${100 / options.length}%`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
    </div>
  );
};

export default DnSwitch;
