import DnMultiChipGroup from '~/components/common/chip-group/dn-multi-chip-group';
import {
  READING_EXPERIENCE_OPTIONS,
  READING_EXPERIENCE_LEVELS,
  INTEREST_OPTIONS,
  REACTION_OPTIONS,
} from '~/lib/comment-persona-options';
import { useState } from 'react';
import { Link } from 'react-router';
import { DnRangeSlider } from '~/components/common/slider';
import { DnChipGroup } from '~/components/common/chip-group';
import DnButton from '~/components/common/buttons/dn-button';
import { generateComments } from '~/lib/electron/comment-api';
import { getAiStatus, useAiStatus } from '~/hooks/use-ai-status';
import { showToast } from '~/lib/toast-manager';
import { useBackgroundTasks } from '~/stores/use-background-tasks';
import LoadingOverlay from '~/components/common/loading-overlay';

const AGE_STEPS = Array.from({ length: 8 }, (_, index) => (index + 1) * 10);
const COMMENT_COUNT_OPTIONS = [
  { label: '5개', value: 5 },
  { label: '10개', value: 10 },
  { label: '30개', value: 30 },
  { label: '50개', value: 50 },
];

interface Props {
  documentPath: string;
  documentTitle: string;
  onGenerated?: (comments: GeneratedComment[]) => void;
}

const GenerateComment = ({ documentPath, documentTitle, onGenerated }: Props) => {
  const [startAge, setStartAge] = useState<number>(10);
  const [endAge, setEndAge] = useState<number>(20);
  const [readingExperiences, setReadingExperiences] = useState(
    READING_EXPERIENCE_OPTIONS.map((option) => option.value),
  );
  const [interests, setInterests] = useState(INTEREST_OPTIONS.map((option) => option.value));
  const [reactions, setReactions] = useState(REACTION_OPTIONS.map((option) => option.value));
  const [count, setCount] = useState(10);

  const [loading, setLoading] = useState(false);
  const aiStatus = useAiStatus(documentPath);

  const startTask = useBackgroundTasks((state) => state.startTask);
  const finishTask = useBackgroundTasks((state) => state.finishTask);
  const runningTask = useBackgroundTasks((state) =>
    state.tasks.find((task) => task.documentPath === documentPath && task.status === 'running'),
  );
  const isBusy = Boolean(runningTask);
  const overlayVisible = loading || isBusy;
  const overlayLabel =
    runningTask?.type === 'story-memory' ? '회차 정보 생성 중…' : '댓글 생성 중…';
  const disabled = aiStatus.checking || !aiStatus.ready || loading || isBusy;

  const handleGenerate = async () => {
    if (disabled) return;

    setLoading(true);
    const taskId = startTask({ documentPath, documentTitle, type: 'comments' });

    try {
      const status = await getAiStatus();
      if (!status.ready) throw new Error(status.issue);
      const comments = await generateComments({
        documentPath,
        startAge,
        endAge,
        readingExperiences,
        expertise: Math.max(
          ...readingExperiences.map((experience) => READING_EXPERIENCE_LEVELS[experience]),
        ),
        interests,
        reactions,
        count,
      });

      finishTask(taskId, 'done');
      showToast(`${documentTitle} 댓글 생성이 완료됐습니다.`, 'success');
      onGenerated?.(comments);
    } catch (error) {
      finishTask(
        taskId,
        'error',
        undefined,
        error instanceof Error ? error.message : '댓글 생성에 실패했습니다.',
      );
      showToast(error instanceof Error ? error.message : '댓글 생성에 실패했습니다.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoadingOverlay
      loading={overlayVisible}
      label={overlayLabel}
      className={'rounded-xl border border-stone-200 bg-white/90 p-6 shadow-sm'}
    >
      <div
        className={'mb-6 flex items-center justify-between gap-4 border-b border-stone-100 pb-4'}
      >
        <div>
          <div className={'typo-b3-b text-stone-900'}>댓글 페르소나 설정</div>
          <div className={'mt-1 typo-b5-r text-stone-400'}>
            저장된 원고 내용을 기준으로 독자 반응 댓글을 생성합니다.
            {aiStatus.label && <span className={'ml-2'}>{aiStatus.label}</span>}
          </div>
        </div>
        <DnButton
          className={''}
          variant={'outlined'}
          loading={loading}
          disabled={disabled}
          onClick={handleGenerate}
        >
          {aiStatus.checking
            ? 'AI 설정 확인 중'
            : loading
              ? '댓글 생성 중'
              : isBusy
                ? '다른 작업 진행 중'
                : '댓글 생성'}
        </DnButton>
      </div>
      {!aiStatus.checking && aiStatus.issue && (
        <div className='mb-5 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3'>
          <div>
            <div className='text-sm font-bold text-amber-800'>{aiStatus.issue}</div>
            <Link
              to={'/setting'}
              className={'mt-1 inline-block text-xs text-primary-600'}
            >
              AI 설정
            </Link>
          </div>
          <DnButton
            variant='outlined'
            disabled={aiStatus.checking}
            onClick={() => void aiStatus.refresh()}
          >
            다시 확인
          </DnButton>
        </div>
      )}
      <div className={'flex flex-col gap-6'}>
        <DnMultiChipGroup
          label={'독서 경험'}
          description={'함께 구성할 독자를 선택해주세요. 최소 하나를 선택해야 합니다.'}
          options={READING_EXPERIENCE_OPTIONS}
          value={readingExperiences}
          onChange={setReadingExperiences}
          disabled={disabled}
        />
        <DnMultiChipGroup
          label={'관심사'}
          description={'독자가 주목할 이야기 요소를 선택해주세요.'}
          options={INTEREST_OPTIONS}
          value={interests}
          onChange={setInterests}
          disabled={disabled}
        />
        <DnMultiChipGroup
          label={'반응 성향'}
          description={
            '선호하는 반응을 선택해주세요. 원고에 근거 없는 비판이나 추측은 강제하지 않습니다.'
          }
          options={REACTION_OPTIONS}
          value={reactions}
          onChange={setReactions}
          disabled={disabled}
        />
        <p className={'rounded-lg bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500'}>
          독자마다 선택한 경험·관심사·반응을 조합합니다. 각 항목을 고르게 배정하며, 댓글 수가 적으면
          일부 선택 항목이 포함되지 않을 수 있습니다.
        </p>
        <div className={'flex flex-col gap-3'}>
          <div className={'flex items-center justify-between'}>
            <span className={'text-sm font-semibold text-stone-900'}>댓글 개수</span>
            <span className={'text-xs font-medium text-primary-600'}>{count}개</span>
          </div>
          <DnChipGroup
            className={'flex! flex-wrap'}
            options={COMMENT_COUNT_OPTIONS}
            value={count}
            onChange={setCount}
            disabled={disabled}
          />
        </div>
        <details className={'rounded-xl border border-stone-200 bg-stone-50/50 p-4'}>
          <summary className={'cursor-pointer text-sm font-medium text-stone-600'}>
            보조 설정 · 연령대 {startAge}대 ~ {endAge}대
          </summary>
          <div className={'flex flex-col gap-3 pt-4'}>
            <p className={'text-xs leading-5 text-stone-500'}>
              연령은 말투에 약하게 반영하며, 독자의 이해력이나 반응을 제한하지 않습니다.
            </p>
            <DnRangeSlider
              minValue={10}
              maxValue={80}
              value={[startAge, endAge]}
              onChange={([startAge, endAge]) => {
                setStartAge(startAge);
                setEndAge(endAge);
              }}
              step={10}
              disabled={disabled}
            />
            <div className={'grid grid-cols-8 gap-1 text-center text-xs text-stone-400'}>
              {AGE_STEPS.map((age) => (
                <span
                  key={age}
                  className={age >= startAge && age <= endAge ? 'font-medium text-primary-600' : ''}
                >
                  {age}대
                </span>
              ))}
            </div>
          </div>
        </details>
      </div>
    </LoadingOverlay>
  );
};

export default GenerateComment;
