import CommentItem from '~/features/manuscript/document-content/comments/comment-item';
import GenerateComment from '~/features/manuscript/document-content/comments/generate-comment';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { listGeneratedComments, removeGeneratedComment } from '~/lib/electron/comment-api';
import { showToast } from '~/lib/toast-manager';
import { StoryMemoryState } from '~/features/manuscript/story-memory/story-memory-state';

interface Props {
  documentPath: string;
  documentTitle: string;
}
const Comments = ({ documentPath, documentTitle }: Props) => {
  const [comments, setComments] = useState<GeneratedComment[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>();

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || comments.length <= 15) {
      setListHeight(undefined);
      return;
    }

    const visibleItems = Array.from(list.children).slice(0, 15);
    const measure = () => {
      const first = visibleItems[0].getBoundingClientRect();
      const last = visibleItems[14].getBoundingClientRect();
      // 실제 카드 높이를 기준으로 긴 댓글과 줄바꿈에도 15개가 보이도록 한다.
      setListHeight(Math.ceil(last.bottom - first.top));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    visibleItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [comments]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const list = await listGeneratedComments(documentPath);
        if (isMounted) {
          setComments(list);
        }
      } catch {
        if (isMounted) {
          setComments([]);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [documentPath]);

  const handleRemove = async (id: string) => {
    try {
      await removeGeneratedComment(documentPath, id);
      setComments((prev) => prev.filter((comment) => comment.id !== id));
    } catch (error) {
      showToast(error instanceof Error ? error.message : '댓글 삭제에 실패했습니다.', 'danger');
    }
  };

  return (
    <div>
      <GenerateComment
        documentPath={documentPath}
        documentTitle={documentTitle}
        onGenerated={(generatedComments) => {
          setComments((prev) => [...generatedComments, ...prev]);
        }}
      />
      <div className={'mt-5 mb-3 flex items-center gap-2'}>
        <h3 className={'text-sm font-semibold text-stone-900'}>독자 댓글</h3>
        <span className={'rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600'}>
          {comments.length}
        </span>
      </div>
      <div
        ref={listRef}
        className={'flex flex-col gap-3 overflow-y-auto pr-1'}
        style={{ maxHeight: listHeight, scrollbarGutter: 'stable' }}
        role={'region'}
        aria-label={'독자 댓글 목록'}
        tabIndex={comments.length > 15 ? 0 : undefined}
      >
        {comments.length === 0 && <StoryMemoryState>아직 생성된 댓글이 없습니다.</StoryMemoryState>}
        {comments?.map((comment: GeneratedComment) => (
          <CommentItem
            key={comment.id}
            onRemove={() => void handleRemove(comment.id)}
            {...comment}
          />
        ))}
      </div>
    </div>
  );
};

export default Comments;
