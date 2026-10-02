import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DnEditorToolbar from '~/components/editor/dn-editor-toolbar';
import { useEffect, useId, useState } from 'react';
import { LuFilePenLine, LuNotebookPen } from 'react-icons/lu';
import { Placeholder } from '@tiptap/extensions';
import TextAlign from '~/components/editor/text-align';

interface Props {
  content: string;
  setContent: (content: string) => void;
  setStatus: (status: { charsWithSpaces: number; charsWithoutSpaces: number }) => void;
  editable?: boolean;
  variant?: 'draft' | 'manuscript';
  status: { charsWithSpaces: number; charsWithoutSpaces: number };
}
const DnEditor = ({
  content,
  setContent,
  setStatus,
  status,
  editable = true,
  variant = 'manuscript',
}: Props) => {
  const id = useId();
  const [fontSize, setFontSize] = useState('18');
  const [lineHeight, setLineHeight] = useState('2');
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder:
          variant === 'draft'
            ? '떠오른 장면과 대사를 자유롭게 적어보세요…'
            : '이야기의 다음 문장을 써보세요…',
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': variant === 'draft' ? '초안 본문' : '원고 본문',
        'aria-multiline': 'true',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();

      setContent(editor.getHTML());
      setStatus({
        charsWithSpaces: text.length,
        charsWithoutSpaces: text.replace(/\s+/g, '').length,
      });
    },
  });

  useEffect(() => {
    // Editing-mode synchronization must not emit an update with the editor's
    // initial empty content before the saved manuscript has been hydrated.
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentContent = editor.getHTML();

    if (currentContent !== content) {
      editor
        .chain()
        .setContent(content, { emitUpdate: false })
        .setMeta('addToHistory', false)
        .run();
    }

    const text = editor.getText();

    setStatus({
      charsWithSpaces: text.length,
      charsWithoutSpaces: text.replace(/\s+/g, '').length,
    });
  }, [content, editor, setStatus]);

  return (
    <section className='flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-stone-200 bg-white'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3'>
        <h3 className='flex items-center gap-2 text-sm font-semibold text-stone-700'>
          {variant === 'draft' ? <LuNotebookPen size={17} /> : <LuFilePenLine size={17} />}
          {variant === 'draft' ? '초안' : '원고'}
        </h3>
        <div className='flex items-center gap-3 text-xs text-stone-500'>
          <label className='flex items-center gap-1.5'>
            글자
            <select
              aria-label='본문 글자 크기'
              value={fontSize}
              onChange={(event) => setFontSize(event.target.value)}
              className='rounded-md bg-stone-50 px-1.5 py-1'
            >
              {[16, 18, 20, 22, 24].map((size) => (
                <option
                  key={size}
                  value={size}
                >
                  {size}px
                </option>
              ))}
            </select>
          </label>
          <label className='flex items-center gap-1.5'>
            줄 간격
            <select
              aria-label='본문 줄 간격'
              value={lineHeight}
              onChange={(event) => setLineHeight(event.target.value)}
              className='rounded-md bg-stone-50 px-1.5 py-1'
            >
              {[1.6, 1.8, 2, 2.2].map((height) => (
                <option
                  key={height}
                  value={height}
                >
                  {height}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className='border-b border-stone-100 px-3 py-2'>
        <DnEditorToolbar editor={editor} />
      </div>
      <div
        className='min-h-0 flex-1 overflow-auto bg-stone-50/60 px-4 py-6 sm:px-6'
        onClick={(event) => {
          if (event.target === event.currentTarget) editor?.chain().focus('end').run();
        }}
      >
        <EditorContent
          editor={editor}
          id={id}
          style={{ fontSize: `${fontSize}px`, lineHeight }}
          className='manuscript-page mx-auto min-h-full max-w-[720px] rounded-sm border border-stone-200/70 bg-white px-6 py-8 shadow-[0_3px_16px_rgba(28,25,23,0.03)] sm:px-10'
        />
      </div>
      <div className='flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-4 py-2.5 text-xs text-stone-400'>
        <span>
          <strong className='font-medium text-stone-600'>
            {status.charsWithSpaces.toLocaleString()}자
          </strong>{' '}
          공백 포함
        </span>
        <span>{status.charsWithoutSpaces.toLocaleString()}자 공백 제외</span>
      </div>
    </section>
  );
};

export default DnEditor;
