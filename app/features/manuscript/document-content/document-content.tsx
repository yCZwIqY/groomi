import DnEditor from '~/components/editor/dn-editor';
import { useEffect, useRef, useState } from 'react';
import DnSwitch from '~/components/common/switch/dn-switch';
import type { Option } from '~/components';
import DnButton from '~/components/common/buttons/dn-button';
import { showToast } from '~/lib/toast-manager';
import Comments from '~/features/manuscript/document-content/comments/comments';
import { useDocumentContent } from '~/features/manuscript/document-content/hooks';
import StoryMemoryReviewModal from '~/features/manuscript/document-content/story-memory/story-memory-review-modal';
import { generateStoryMemory } from '~/lib/electron/story-memory-api';
import { useBackgroundTasks, useIsDocumentBusy } from '~/stores/use-background-tasks';

type Props = {
  workspaceData: WorkspaceNode;
  onUpdated?: (workspaceData: WorkspaceNode) => void;
};

type DocumentTextStatus = {
  charsWithSpaces: number;
  charsWithoutSpaces: number;
};

type ShowType = 'DRAFT' | 'MANUSCRIPT' | 'SPLIT';
const AUTOSAVE_DELAY_MS = 1_000;
const ShowTypeOptions: Option<ShowType>[] = [
  {
    value: 'DRAFT',
    label: '초안만',
  },
  {
    value: 'SPLIT',
    label: '분할보기',
  },
  {
    value: 'MANUSCRIPT',
    label: '원고만',
  },
];

export const DocumentContent = ({ workspaceData, onUpdated }: Props) => {
  const {
    draft,
    setDraft,
    manuscript,
    setManuscript,
    draftStatus,
    setDraftStatus,
    manuscriptStatus,
    setManuscriptStatus,
    resetContent,
    handleUpdate,
  } = useDocumentContent();
  const [showType, setShowType] = useState<ShowType>('SPLIT');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [storyMemoryDraft, setStoryMemoryDraft] = useState<StoryMemoryDraft | null>(null);
  const initializedDocumentPath = useRef<string | null>(null);
  const latestContent = useRef({ draft, manuscript });
  latestContent.current = { draft, manuscript };

  const startTask = useBackgroundTasks((state) => state.startTask);
  const finishTask = useBackgroundTasks((state) => state.finishTask);
  const pendingStoryMemoryDraft = useBackgroundTasks(
    (state) => state.pendingStoryMemory[workspaceData.path],
  );
  const clearPendingStoryMemory = useBackgroundTasks((state) => state.clearPendingStoryMemory);
  const isBusy = useIsDocumentBusy(workspaceData.path);

  useEffect(() => {
    resetContent(workspaceData);
    initializedDocumentPath.current = workspaceData.path;
    setDirty(false);
    setSaveError(false);

    return () => {
      resetContent();
    };
  }, [
    workspaceData.path,
    workspaceData?.document?.manuscript?.content,
    workspaceData?.document?.draft?.content,
  ]);

  useEffect(() => {
    if (initializedDocumentPath.current !== workspaceData.path) {
      return;
    }

    const storedDraft = workspaceData.document?.draft?.content ?? '';
    const storedManuscript = workspaceData.document?.manuscript?.content ?? '';
    setDirty(draft !== storedDraft || manuscript !== storedManuscript);
  }, [
    draft,
    manuscript,
    workspaceData.path,
    workspaceData.document?.draft?.content,
    workspaceData.document?.manuscript?.content,
  ]);

  useEffect(() => {
    if (!dirty || saving || isBusy || saveError) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const savingContent = { draft, manuscript };
      setSaving(true);
      setSaveError(false);
      void handleUpdate(workspaceData)
        .then((updatedWorkspace) => {
          const contentIsStillCurrent =
            latestContent.current.draft === savingContent.draft &&
            latestContent.current.manuscript === savingContent.manuscript;

          if (updatedWorkspace && contentIsStillCurrent) {
            onUpdated?.(updatedWorkspace);
            setDirty(false);
          }
        })
        .catch(() => {
          setSaveError(true);
        })
        .finally(() => {
          setSaving(false);
        });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [dirty, draft, manuscript, isBusy, saveError, workspaceData.path]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && !saving) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty, saving]);

  useEffect(() => {
    if (!pendingStoryMemoryDraft) {
      return;
    }

    setStoryMemoryDraft(pendingStoryMemoryDraft);
    clearPendingStoryMemory(workspaceData.path);
  }, [pendingStoryMemoryDraft, workspaceData.path]);

  const handleSave = async () => {
    if (isBusy) {
      return;
    }

    setSaving(true);
    setSaveError(false);
    let updatedWorkspace: WorkspaceNode | null = null;
    const savingContent = { draft, manuscript };

    try {
      updatedWorkspace = await handleUpdate(workspaceData);
      const contentIsStillCurrent =
        latestContent.current.draft === savingContent.draft &&
        latestContent.current.manuscript === savingContent.manuscript;

      if (updatedWorkspace && contentIsStillCurrent) {
        onUpdated?.(updatedWorkspace);
        setDirty(false);
      }
    } catch {
      setSaveError(true);
      showToast('저장에 실패했습니다.', 'danger');
      return;
    } finally {
      setSaving(false);
    }

    if (!updatedWorkspace?.path) {
      return;
    }

    showToast('저장완료', 'success');

    const documentTitle = updatedWorkspace.document?.title || updatedWorkspace.name || '문서';
    const taskId = startTask({
      documentPath: updatedWorkspace.path,
      documentTitle,
      type: 'story-memory',
    });

    generateStoryMemory(updatedWorkspace.path)
      .then((draft) => {
        finishTask(taskId, 'done', draft);
        showToast(`${documentTitle} 정보 생성이 완료됐습니다.`, 'success');
      })
      .catch(() => {
        finishTask(taskId, 'error');
        showToast(`${documentTitle} 정보 생성에 실패했습니다.`, 'danger');
      });
  };

  const handleOpenStoryMemory = () => {
    const savedMemory = workspaceData.document?.storyMemory;

    setStoryMemoryDraft({
      synopsis: savedMemory?.synopsis ?? '',
      events: savedMemory?.events ?? [],
      characters: savedMemory?.characters ?? [],
      plotHooks: savedMemory?.plotHooks ?? [],
    });
  };

  return (
    <div className={'relative'}>
      <div
        className={'h-[90dvh] min-w-0 bg-white rounded-lg p-4 shadow-md my-4 flex flex-col overflow-hidden'}
      >
        <div className={'flex items-center justify-between gap-4'}>
          <div className={'w-[300px]'}>
            <DnSwitch
              options={ShowTypeOptions}
              value={showType}
              setValue={setShowType}
            />
          </div>
          <DnButton
            onClick={handleOpenStoryMemory}
            variant={'outlined'}
          >
            사건·인물·떡밥 보기
          </DnButton>
        </div>
        <div className={'flex flex-1 gap-4 p-4 overflow-hidden'}>
          {showType !== 'MANUSCRIPT' && (
            <>
              <div className={'flex-1 flex-col flex gap-2'}>
                <div className={'grid grid-cols-2 gap-3'}>
                  <div className={'rounded-lg bg-stone-100 px-4 py-3'}>
                    <div className={'text-xs text-stone-400 pb-1'}> 공백 포함 </div>
                    <div className={'text-sm text-stone-700'}>{draftStatus.charsWithSpaces}자</div>
                  </div>
                  <div className={'rounded-lg bg-stone-100 px-4 py-3'}>
                    <div className={'text-xs text-stone-400 pb-1'}> 공백 미포함</div>
                    <div className={'text-sm text-stone-700'}>
                      {draftStatus.charsWithoutSpaces}자
                    </div>
                  </div>
                </div>
                <DnEditor
                  content={draft}
                  setContent={(content) => {
                    setSaveError(false);
                    setDraft(content);
                  }}
                  setStatus={setDraftStatus}
                />
              </div>
              <div className={'w-px h-full border-r border-neutral-100'} />
            </>
          )}
          {showType !== 'DRAFT' && (
            <div className={'flex-1 flex-col flex gap-2'}>
              <div className={'grid grid-cols-2 gap-3'}>
                <div className={'rounded-lg bg-stone-100 px-4 py-3'}>
                  <div className={'text-xs text-stone-400 pb-1'}> 공백 포함 </div>
                  <div className={'text-sm text-stone-700'}>
                    {manuscriptStatus.charsWithSpaces}자
                  </div>
                </div>
                <div className={'rounded-lg bg-stone-100 px-4 py-3'}>
                  <div className={'text-xs text-stone-400 pb-1'}> 공백 미포함</div>
                  <div className={'text-sm text-stone-700'}>
                    {manuscriptStatus.charsWithoutSpaces}자
                  </div>
                </div>
              </div>
              <DnEditor
                content={manuscript}
                setContent={(content) => {
                  setSaveError(false);
                  setManuscript(content);
                }}
                setStatus={setManuscriptStatus}
              />
            </div>
          )}
        </div>
        <div className={'flex items-center justify-end gap-2 self-end'}>
          <div className={`typo-b6-r ${saveError ? 'text-red-500' : 'text-stone-400'}`}>
            {saveError ? '저장 실패 · 다시 시도해주세요' : saving ? '저장 중…' : dirty ? '저장 대기 중…' : '자동 저장됨'}
          </div>
          {isBusy && (
            <div className={'typo-b6-r text-stone-400'}>
              이 회차는 백그라운드 작업이 진행 중이라 저장·댓글 생성을 사용할 수 없습니다.
            </div>
          )}
          <DnButton
            className={'w-[120px]'}
            disabled={isBusy || saving}
            loading={saving}
            onClick={handleSave}
          >
            저장
          </DnButton>
        </div>
      </div>
      <div className={'flex flex-col gap-2'}>
        <Comments
          documentPath={workspaceData.path}
          documentTitle={workspaceData.document?.title || workspaceData.name}
          key={workspaceData.id}
        />
      </div>
      <StoryMemoryReviewModal
        documentPath={workspaceData.path}
        documentTitle={workspaceData.document?.title || workspaceData.name}
        draft={storyMemoryDraft}
      />
    </div>
  );
};
