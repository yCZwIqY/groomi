import { StoryMemoryActionButton } from '~/features/manuscript/story-memory/story-memory-action-button';
import DnEditor from '~/components/editor/dn-editor';
import { useRef, useState } from 'react';
import { useDocumentSave } from './hooks/use-document-save';
import { getOllamaRunning } from '~/lib/ollama-api';
import { getSettingInfo } from '~/lib/electron/setting-api';
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
  } = useDocumentContent();
  const [showType, setShowType] = useState<ShowType>('SPLIT');
  const [storyMemoryDraft, setStoryMemoryDraft] = useState<StoryMemoryDraft | null>(null);
  const openedGeneratedDraft = useRef<StoryMemoryDraft | null>(null);
  const { saving, dirty, saveError, clearSaveError, save } = useDocumentSave({
    workspaceData,
    draft,
    manuscript,
    draftStatus,
    manuscriptStatus,
    resetContent,
    onUpdated,
  });

  const startTask = useBackgroundTasks((state) => state.startTask);
  const finishTask = useBackgroundTasks((state) => state.finishTask);
  const pendingStoryMemoryDraft = useBackgroundTasks(
    (state) => state.pendingStoryMemory[workspaceData.path],
  );
  const clearPendingStoryMemory = useBackgroundTasks((state) => state.clearPendingStoryMemory);
  const isBusy = useIsDocumentBusy(workspaceData.path);

  const handleSave = async () => {
    if (isBusy) {
      return;
    }

    try {
      await save();
    } catch {
      showToast('저장에 실패했습니다. 작성 내용은 유지됩니다.', 'danger');
      return;
    }
    showToast('저장완료', 'success');
    // Saving works offline; AI is optional and only starts when configured.
    try {
      const setting = await getSettingInfo();
      if (!setting.selectedLLMModel || !(await getOllamaRunning())) return;
    } catch {
      return;
    }
    const updatedWorkspace = workspaceData;

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
      .catch((error) => {
        finishTask(
          taskId,
          'error',
          undefined,
          error instanceof Error ? error.message : '회차 정보 생성에 실패했습니다.',
        );
        showToast(`${documentTitle} 정보 생성에 실패했습니다.`, 'danger');
      });
  };

  const handleOpenStoryMemory = () => {
    if (isBusy) return;
    openedGeneratedDraft.current = pendingStoryMemoryDraft ?? null;
    if (pendingStoryMemoryDraft) {
      setStoryMemoryDraft({ ...pendingStoryMemoryDraft });
      return;
    }
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
      <div className={'ui-card h-[90dvh] min-w-0 p-4 my-4 flex flex-col overflow-hidden'}>
        <div className={'flex items-center justify-between gap-4'}>
          <div className={'w-[300px]'}>
            <DnSwitch
              options={ShowTypeOptions}
              value={showType}
              setValue={setShowType}
            />
          </div>
          <StoryMemoryActionButton
            onClick={handleOpenStoryMemory}
            disabled={isBusy}
            title={isBusy ? '이 회차의 생성 작업이 끝난 뒤 확인할 수 있습니다.' : undefined}
          >
            사건·인물·떡밥 보기
          </StoryMemoryActionButton>
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
                    clearSaveError();
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
                  clearSaveError();
                  setManuscript(content);
                }}
                setStatus={setManuscriptStatus}
              />
            </div>
          )}
        </div>
        <div className={'flex items-center justify-end gap-2 self-end'}>
          <div className={`typo-b6-r ${saveError ? 'text-red-500' : 'text-stone-400'}`}>
            {saveError
              ? '저장 실패 · 다시 시도해주세요'
              : saving
                ? '저장 중…'
                : dirty
                  ? '저장 대기 중…'
                  : '자동 저장됨'}
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
        onSaved={(memory) => {
          if (
            openedGeneratedDraft.current &&
            useBackgroundTasks.getState().pendingStoryMemory[workspaceData.path] ===
              openedGeneratedDraft.current
          ) {
            clearPendingStoryMemory(workspaceData.path);
          }
          onUpdated?.({
            ...workspaceData,
            document: { ...workspaceData.document, storyMemory: memory },
          });
        }}
      />
    </div>
  );
};
