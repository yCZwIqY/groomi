import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  LuAlignCenter,
  LuAlignLeft,
  LuAlignRight,
  LuBold,
  LuItalic,
  LuList,
  LuListOrdered,
  LuRedo2,
  LuStrikethrough,
  LuUndo2,
} from 'react-icons/lu';
import EditorSymbols from './editor-symbols';

const DnEditorToolbar = ({ editor }: { editor: Editor | null }) => {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      editable: editor?.isEditable ?? false,
      undo: editor?.can().undo() ?? false,
      redo: editor?.can().redo() ?? false,
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      strike: editor?.isActive('strike') ?? false,
      left: editor?.isActive({ textAlign: 'left' }) ?? false,
      center: editor?.isActive({ textAlign: 'center' }) ?? false,
      right: editor?.isActive({ textAlign: 'right' }) ?? false,
      bullet: editor?.isActive('bulletList') ?? false,
      ordered: editor?.isActive('orderedList') ?? false,
    }),
  });
  const groups = [
    [
      {
        label: '실행 취소 (Ctrl+Z)',
        icon: LuUndo2,
        disabled: !state?.undo,
        run: () => editor?.chain().focus().undo().run(),
      },
      {
        label: '다시 실행 (Ctrl+Shift+Z)',
        icon: LuRedo2,
        disabled: !state?.redo,
        run: () => editor?.chain().focus().redo().run(),
      },
    ],
    [
      {
        label: '굵게 (Ctrl+B)',
        icon: LuBold,
        active: state?.bold,
        run: () => editor?.chain().focus().toggleBold().run(),
      },
      {
        label: '기울임 (Ctrl+I)',
        icon: LuItalic,
        active: state?.italic,
        run: () => editor?.chain().focus().toggleItalic().run(),
      },
      {
        label: '취소선',
        icon: LuStrikethrough,
        active: state?.strike,
        run: () => editor?.chain().focus().toggleStrike().run(),
      },
    ],
    [
      {
        label: '왼쪽 정렬',
        icon: LuAlignLeft,
        active: state?.left,
        run: () => editor?.chain().focus().setTextAlign('left').run(),
      },
      {
        label: '가운데 정렬',
        icon: LuAlignCenter,
        active: state?.center,
        run: () => editor?.chain().focus().setTextAlign('center').run(),
      },
      {
        label: '오른쪽 정렬',
        icon: LuAlignRight,
        active: state?.right,
        run: () => editor?.chain().focus().setTextAlign('right').run(),
      },
    ],
    [
      {
        label: '글머리 목록',
        icon: LuList,
        active: state?.bullet,
        run: () => editor?.chain().focus().toggleBulletList().run(),
      },
      {
        label: '번호 목록',
        icon: LuListOrdered,
        active: state?.ordered,
        run: () => editor?.chain().focus().toggleOrderedList().run(),
      },
    ],
  ];
  return (
    <div
      role='group'
      aria-label='본문 서식'
      className='flex flex-wrap items-center gap-2'
    >
      {groups.map((group, index) => (
        <div
          key={index}
          className='flex gap-0.5 border-stone-200 [&:not(:last-child)]:border-r [&:not(:last-child)]:pr-2'
        >
          {group.map(({ label, icon: Icon, run, ...button }) => (
            <button
              key={label}
              type='button'
              title={label}
              aria-label={label}
              aria-pressed={'active' in button ? !!button.active : undefined}
              disabled={!state?.editable || ('disabled' in button && button.disabled)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-default disabled:opacity-30 ${'active' in button && button.active ? 'bg-primary-50 text-primary-600' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}
            >
              <Icon
                size={16}
                aria-hidden='true'
              />
            </button>
          ))}
        </div>
      ))}
      <EditorSymbols editor={editor} />
    </div>
  );
};
export default DnEditorToolbar;
