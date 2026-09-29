import { useState } from 'react';
import { AiOutlineCheckCircle, AiOutlineCloseCircle, AiOutlineLoading3Quarters } from 'react-icons/ai';
import { useBackgroundTasks } from '~/stores/use-background-tasks';

const TYPE_LABEL: Record<string, string> = {
  'story-memory': '회차 정보 생성',
  comments: '댓글 생성',
};

function formatElapsed(startedAt: number) {
  const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

  if (seconds < 60) {
    return `${seconds}초 전`;
  }

  return `${Math.round(seconds / 60)}분 전`;
}

const BackgroundTaskIndicator = () => {
  const tasks = useBackgroundTasks((state) => state.tasks);
  const clearFinishedTasks = useBackgroundTasks((state) => state.clearFinishedTasks);
  const [open, setOpen] = useState(false);

  if (tasks.length === 0) {
    return null;
  }

  const runningCount = tasks.filter((task) => task.status === 'running').length;

  return (
    <div className={'fixed right-4 top-4 z-40 flex flex-col items-end'}>
      <button
        className={
          'flex items-center gap-2 rounded-full border border-stone-200 bg-white/95 px-4 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-all hover:-translate-y-0.5'
        }
        onClick={() => setOpen((prev) => !prev)}
        type={'button'}
      >
        {runningCount > 0 ? (
          <AiOutlineLoading3Quarters className={'animate-[spin_1.4s_linear_infinite] text-primary-500'} />
        ) : (
          <AiOutlineCheckCircle className={'text-primary-500'} />
        )}
        <span className={'typo-b6-b text-stone-700'}>
          {runningCount > 0 ? `백그라운드 작업 ${runningCount}건 진행 중` : '백그라운드 작업'}
        </span>
      </button>

      {open && (
        <div
          className={
            'mt-2 max-h-[360px] w-[320px] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.18)]'
          }
        >
          <div className={'flex items-center justify-between px-1 pb-2'}>
            <div className={'typo-b6-b text-stone-500'}>회차 백그라운드 작업 내역</div>
            <button
              className={'typo-b6-r text-stone-400 hover:text-stone-600'}
              onClick={() => clearFinishedTasks()}
              type={'button'}
            >
              완료 항목 지우기
            </button>
          </div>

          <div className={'flex flex-col gap-1'}>
            {tasks.map((task) => (
              <div
                className={'flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-stone-100'}
                key={task.id}
              >
                {task.status === 'running' && (
                  <AiOutlineLoading3Quarters
                    className={'shrink-0 animate-[spin_1.4s_linear_infinite] text-primary-500'}
                  />
                )}
                {task.status === 'done' && (
                  <AiOutlineCheckCircle className={'shrink-0 text-primary-500'} />
                )}
                {task.status === 'error' && (
                  <AiOutlineCloseCircle className={'shrink-0 text-red-500'} />
                )}
                <div className={'flex min-w-0 flex-1 flex-col'}>
                  <div className={'truncate typo-b6-b text-stone-800'}>{task.documentTitle}</div>
                  <div className={'typo-b6-r text-stone-400'}>
                    {TYPE_LABEL[task.type] ?? task.type}
                    {' · '}
                    {task.status === 'running' ? '진행 중' : formatElapsed(task.finishedAt ?? task.startedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BackgroundTaskIndicator;
