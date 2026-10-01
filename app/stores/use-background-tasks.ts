import { create } from 'zustand';

export type BackgroundTaskType = 'story-memory' | 'comments';
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
};

const MAX_TASKS = 30;

interface BackgroundTaskState {
  tasks: BackgroundTask[];
  pendingStoryMemory: Record<string, StoryMemoryDraft>;
  startTask: (input: {
    documentPath: string;
    documentTitle: string;
    type: BackgroundTaskType;
  }) => string;
  finishTask: (
    id: string,
    status: 'done' | 'error',
    storyMemoryDraft?: StoryMemoryDraft,
    errorMessage?: string,
  ) => void;
  clearPendingStoryMemory: (documentPath: string) => void;
  clearFinishedTasks: () => void;
}

export const useBackgroundTasks = create<BackgroundTaskState>((set, get) => ({
  tasks: [],
  pendingStoryMemory: {},

  startTask: ({ documentPath, documentTitle, type }) => {
    const id = crypto.randomUUID();
    const task: BackgroundTask = {
      id,
      documentPath,
      documentTitle,
      type,
      status: 'running',
      startedAt: Date.now(),
    };

    set((state) => ({
      tasks: [task, ...state.tasks].slice(0, MAX_TASKS),
    }));

    return id;
  },

  finishTask: (id, status, storyMemoryDraft, errorMessage) => {
    const task = get().tasks.find((candidate) => candidate.id === id);

    set((state) => ({
      tasks: state.tasks.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              status,
              finishedAt: Date.now(),
              errorMessage:
                status === 'error' ? errorMessage || '알 수 없는 오류가 발생했습니다.' : undefined,
            }
          : candidate,
      ),
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
}));

export function useIsDocumentBusy(documentPath: string) {
  return useBackgroundTasks((state) =>
    state.tasks.some((task) => task.documentPath === documentPath && task.status === 'running'),
  );
}
