import { getErrorMessage } from '~/lib/app-error';
import { create } from 'zustand';
import { errorToken, LocalizedAppError } from '~/lib/app-error';
import { getAiStatus } from '~/hooks/use-ai-status';
import { generateComments } from '~/lib/electron/comment-api';
import { generateStoryMemory } from '~/lib/electron/story-memory-api';
import { generateManuscriptReview } from '~/lib/electron/review-api';
import { flushPendingDocument } from '~/lib/pending-document';

export type BackgroundTaskType = 'story-memory' | 'comments' | 'review';
export type BackgroundTaskStatus = 'running' | 'done' | 'error';

export type BackgroundTask = {
  id: string;
  documentPath: string;
  documentTitle: string;
  type: BackgroundTaskType;
  status: BackgroundTaskStatus;
  startedAt: number;
  finishedAt?: number;
  errorMessage?: string;
  usage?: AiTaskUsage;
  commentOptions?: GenerateCommentsPayload;
};

const MAX_TASKS = 30;

interface BackgroundTaskState {
  tasks: BackgroundTask[];
  pendingReview: Record<string, ManuscriptReview>;
  clearPendingReview: (documentPath: string) => void;
  pendingStoryMemory: Record<string, StoryMemoryDraft>;
  startTask: (input: {
    documentPath: string;
    documentTitle: string;
    type: BackgroundTaskType;
    commentOptions?: GenerateCommentsPayload;
  }) => string;
  finishTask: (
    id: string,
    status: 'done' | 'error',
    storyMemoryDraft?: StoryMemoryDraft,
    errorMessage?: string,
    review?: ManuscriptReview,
    usage?: AiTaskUsage,
  ) => void;
  clearPendingStoryMemory: (documentPath: string) => void;
  clearFinishedTasks: () => void;
  retryTask: (id: string) => Promise<void>;
}

export const useBackgroundTasks = create<BackgroundTaskState>((set, get) => ({
  tasks: [],
  pendingStoryMemory: {},
  pendingReview: {},
  clearPendingReview: (documentPath) =>
    set((state) => {
      const next = { ...state.pendingReview };
      delete next[documentPath];
      return { pendingReview: next };
    }),

  startTask: ({ documentPath, documentTitle, type, commentOptions }) => {
    const id = crypto.randomUUID();
    const task: BackgroundTask = {
      id,
      documentPath,
      documentTitle,
      type,
      commentOptions: commentOptions ? structuredClone(commentOptions) : undefined,
      status: 'running',
      startedAt: Date.now(),
    };

    set((state) => ({
      tasks: [task, ...state.tasks].slice(0, MAX_TASKS),
    }));

    return id;
  },

  finishTask: (id, status, storyMemoryDraft, errorMessage, review, usage) => {
    const task = get().tasks.find((candidate) => candidate.id === id);

    set((state) => ({
      tasks: state.tasks.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              status,
              usage: status === 'done' ? usage : undefined,
              finishedAt: Date.now(),
              errorMessage:
                status === 'error'
                  ? errorMessage || getErrorMessage('GROOMI_ERROR:UNKNOWN_ERROR')
                  : undefined,
            }
          : candidate,
      ),
      pendingReview:
        task && status === 'done' && task.type === 'review' && review
          ? { ...state.pendingReview, [task.documentPath]: review }
          : state.pendingReview,
      pendingStoryMemory:
        task && status === 'done' && task.type === 'story-memory' && storyMemoryDraft
          ? { ...state.pendingStoryMemory, [task.documentPath]: storyMemoryDraft }
          : state.pendingStoryMemory,
    }));
  },

  clearPendingStoryMemory: (documentPath) => {
    set((state) => {
      if (!(documentPath in state.pendingStoryMemory)) {
        return state;
      }

      const nextPending = { ...state.pendingStoryMemory };
      delete nextPending[documentPath];

      return { pendingStoryMemory: nextPending };
    });
  },

  clearFinishedTasks: () => {
    set((state) => ({ tasks: state.tasks.filter((task) => task.status === 'running') }));
  },

  retryTask: async (id) => {
    const task = get().tasks.find((candidate) => candidate.id === id);
    if (!task || task.status !== 'error' || (task.type === 'comments' && !task.commentOptions))
      return;
    if (
      get().tasks.some(
        (candidate) =>
          candidate.documentPath === task.documentPath && candidate.status === 'running',
      )
    )
      return;
    set((state) => ({
      tasks: state.tasks.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              status: 'running',
              startedAt: Date.now(),
              finishedAt: undefined,
              errorMessage: undefined,
              usage: undefined,
            }
          : candidate,
      ),
    }));
    try {
      await flushPendingDocument();
      const status = await getAiStatus();
      if (!status.ready) throw new LocalizedAppError(status.code ?? 'UNKNOWN');
      if (task.type === 'comments') {
        const { usage } = await generateComments({
          ...task.commentOptions!,
          documentPath: task.documentPath,
        });
        get().finishTask(id, 'done', undefined, undefined, undefined, usage);
      } else if (task.type === 'story-memory') {
        const { result, usage } = await generateStoryMemory(task.documentPath);
        get().finishTask(id, 'done', result, undefined, undefined, usage);
      } else {
        const { result, usage } = await generateManuscriptReview(task.documentPath);
        get().finishTask(id, 'done', undefined, undefined, result, usage);
      }
    } catch (error) {
      get().finishTask(id, 'error', undefined, errorToken(error));
    }
  },
}));

export function useIsDocumentBusy(documentPath: string) {
  return useBackgroundTasks((state) =>
    state.tasks.some((task) => task.documentPath === documentPath && task.status === 'running'),
  );
}
