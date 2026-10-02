import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuALargeSmall, LuX } from 'react-icons/lu';

const symbolGroups = [
  {
    label: '문장부호',
    values: ['…', '……', '—', '──', '·', '「」', '『』', '“”', '‘’', '〈〉', '《》', '【】'],
  },
  {
    label: '장면 전환 · 특수기호',
    values: ['***', '* * *', '※', '★', '☆', '♡', '♥', '♪', '→', '✓'],
  },
];

const EditorSymbols = ({ editor }: { editor: Editor | null }) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const popupId = useId();
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!trigger.current || !popup.current) return;
      const margin = 8;
      const gap = 8;
      const anchor = trigger.current.getBoundingClientRect();
      const width = popup.current.getBoundingClientRect().width;
      const height = popup.current.scrollHeight;
      const viewportHeight = window.innerHeight;
      const below = Math.max(0, viewportHeight - margin - anchor.bottom - gap);
      const above = Math.max(0, anchor.top - gap - margin);
      const placeBelow = below >= Math.min(height, above);
      const maxHeight = Math.max(
        1,
        Math.min(viewportHeight - margin * 2, placeBelow ? below : above),
      );
      const top = placeBelow ? anchor.bottom + gap : anchor.top - gap - Math.min(height, maxHeight);
      setPosition({
        left: Math.max(margin, Math.min(anchor.right - width, window.innerWidth - width - margin)),
        top: Math.max(margin, Math.min(top, viewportHeight - maxHeight - margin)),
        maxHeight,
      });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    if (popup.current) observer.observe(popup.current);
    if (trigger.current) observer.observe(trigger.current);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className='relative'
    >
      <button
        ref={trigger}
        type='button'
        title='문장부호 · 특수기호'
        aria-label='문장부호 · 특수기호'
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        disabled={!editor?.isEditable}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen(!open)}
        className='flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-primary-500 disabled:opacity-30'
      >
        <LuALargeSmall
          size={17}
          aria-hidden='true'
        />{' '}
        기호
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={popupId}
            role='group'
            aria-label='문장부호와 특수기호 삽입'
            style={position}
            className='fixed z-[100] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white p-3 shadow-xl'
          >
            <div className='mb-3 flex items-center justify-between text-xs text-stone-500'>
              <span>커서 위치에 삽입</span>
              <button
                type='button'
                aria-label='기호 메뉴 닫기'
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
                className='rounded p-1 hover:bg-stone-100'
              >
                <LuX size={15} />
              </button>
            </div>
            {symbolGroups.map((group) => (
              <div
                key={group.label}
                className='mb-3 last:mb-0'
              >
                <p className='mb-1.5 text-xs font-medium text-stone-400'>{group.label}</p>
                <div className='flex flex-wrap gap-1'>
                  {group.values.map((value) => (
                    <button
                      key={value}
                      type='button'
                      aria-label={`${value} 삽입`}
                      title={`${value} 삽입`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        editor
                          ?.chain()
                          .focus()
                          .command(({ tr }) => {
                            closeHistory(tr);
                            return true;
                          })
                          .insertContent({ type: 'text', text: value })
                          .run();
                        setOpen(false);
                      }}
                      className='min-h-8 min-w-8 rounded-md px-2 text-sm text-stone-700 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-500'
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default EditorSymbols;
