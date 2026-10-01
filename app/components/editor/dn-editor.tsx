import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DnEditorToolbar from '~/components/editor/dn-editor-toolbar';
import { useEffect, useId } from 'react';
import { Placeholder } from '@tiptap/extensions';
import TextAlign from '~/components/editor/text-align';

interface Props {
  content: string;
  setContent: (content: string) => void;
  setStatus: (status: { charsWithSpaces: number; charsWithoutSpaces: number }) => void;
  editable?: boolean;
}
const DnEditor = ({ content, setContent, setStatus, editable = true }: Props) => {
  const id = useId();
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: '여기에 내용 입력.',
      }),
    ],
    content,
    editable,
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
      editor.commands.setContent(content, { emitUpdate: false });
    }

    const text = editor.getText();

    setStatus({
      charsWithSpaces: text.length,
      charsWithoutSpaces: text.replace(/\s+/g, '').length,
    });
  }, [content, editor, setStatus]);

  return (
    <div className={'w-full h-full flex flex-col gap-4 overflow-hidden '}>
      <DnEditorToolbar editor={editor} />
      <label
        htmlFor={id}
        className={'flex-1 p-2 overflow-auto'}
        onClick={() => editor?.chain().focus().run()}
      >
        <EditorContent
          editor={editor}
          id={id}
          className={
            'h-full [&>.ProseMirror]:h-full [&>.ProseMirror]:outline-none! [&>.ProseMirror]:border-none! [&>li]:list-decimal!'
          }
        />
      </label>
    </div>
  );
};

export default DnEditor;
