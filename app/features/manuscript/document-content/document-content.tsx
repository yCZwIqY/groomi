import { StoryMemoryActionButton } from '~/features/manuscript/story-memory/story-memory-action-button';
import DnEditor from '~/components/editor/dn-editor';
import { useRef, useState } from 'react';
import { useDocumentSave } from './hooks/use-document-save';
import { getAiStatus, useAiStatus } from '~/hooks/use-ai-status';
import { Link } from 'react-router';
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
  const [preparingStoryMemory, setPreparingStoryMemory] = useState(false);
  const preparingStoryMemoryRef = useRef(false);
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
  const aiStatus = useAiStatus(workspaceData.path);

  const handleSave = async () => {
    if (isBusy || preparingStoryMemoryRef.current) {
      return;
    }

    try {
      await save();
    } catch {
      showToast('저장에 실패했습니다. 작성 내용은 유지됩니다.', 'danger');
      return;
    }
    showToast('저장완료', 'success');
  };

  const handleGenerateStoryMemory = async () => {
    if (isBusy || saving || preparingStoryMemoryRef.current) return;

    const manuscriptBody = new DOMParser().parseFromString(manuscript, 'text/html').body;
    manuscriptBody.querySelectorAll('script, style').forEach((element) => element.remove());
    if (!manuscriptBody.textContent?.trim() && !manuscriptBody.querySelector('img')) {
      showToast(
        '회차 정보를 생성할 원고 본문이 없습니다. 원고를 작성한 뒤 다시 시도해주세요. 초고는 회차 정보 생성에 사용되지 않습니다.',
        'danger',
      );
      return;
    }

    preparingStoryMemoryRef.current = true;
    setPreparingStoryMemory(true);
    try {
      try {
        await save();
      } catch {
        showToast('저장에 실패했습니다. 작성 내용은 유지됩니다.', 'danger');
        return;
      }

      const status = await getAiStatus();
      if (!status.ready) {
        showToast(status.issue, 'danger');
        return;
      }
      startStoryMemoryGeneration();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '회차 정보 생성을 준비하지 못했습니다.',
        'danger',
      );
    } finally {
      preparingStoryMemoryRef.current = false;
      setPreparingStoryMemory(false);
    }
  };

  const startStoryMemoryGeneration = () => {
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
        <div className={'flex max-w-full flex-wrap items-center justify-end gap-2 self-end'}>
          <span
            className={'max-w-[240px] truncate text-xs text-stone-500'}
            title={aiStatus.label}
          >
            {aiStatus.label}
          </span>
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
              이 회차는 백그라운드 작업이 진행 중이라 저장·회차 정보·댓글 생성을 사용할 수 없습니다.
            </div>
          )}
          <DnButton
            className={'w-[120px]'}
            disabled={isBusy || saving || preparingStoryMemory}
            loading={saving}
            onClick={handleSave}
          >
            저장
          </DnButton>
          <DnButton
            variant={'outlined'}
            disabled={
              isBusy || saving || preparingStoryMemory || aiStatus.checking || !aiStatus.ready
            }
            loading={preparingStoryMemory}
            title={'현재 내용을 자동으로 저장한 뒤 회차 정보를 생성합니다.'}
            onClick={handleGenerateStoryMemory}
          >
            회차 정보 생성
          </DnButton>
        </div>
        {!aiStatus.checking && aiStatus.issue && (
          <div className={'mt-2 flex items-center justify-end gap-2 text-xs text-stone-500'}>
            <span>{aiStatus.issue}</span>
            <Link
              to={'/setting'}
              className={'text-primary-600'}
            >
              AI 설정
            </Link>
            <button
              type={'button'}
              onClick={() => void aiStatus.refresh()}
              className={'text-primary-600'}
            >
              다시 확인
            </button>
          </div>
        )}
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
