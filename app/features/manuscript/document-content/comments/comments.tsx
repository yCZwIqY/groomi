import CommentItem from '~/features/manuscript/document-content/comments/comment-item';
import GenerateComment from '~/features/manuscript/document-content/comments/generate-comment';
import { useEffect, useState } from 'react';
import { listGeneratedComments, removeGeneratedComment } from '~/lib/electron/comment-api';
import { showToast } from '~/lib/toast-manager';

interface Props {
  documentPath: string;
  documentTitle: string;
}
const Comments = ({ documentPath, documentTitle }: Props) => {
  const [comments, setComments] = useState<GeneratedComment[]>([]);

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
      <div className={'flex flex-col gap-2 mt-4'}>
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
