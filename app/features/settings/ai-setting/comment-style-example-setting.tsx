import { uiFieldClass } from '~/components/common/ui-styles';
import { useEffect, useState } from 'react';

import DnButton from '~/components/common/buttons/dn-button';
import {
  addCommentExample,
  listCommentExamples,
  removeCommentExample,
} from '~/lib/electron/comment-api';
import { DnChipGroup } from '~/components/common/chip-group';
import {
  READING_EXPERIENCE_OPTIONS,
  READING_EXPERIENCE_LEVELS,
  INTEREST_OPTIONS,
  REACTION_OPTIONS,
} from '~/lib/comment-persona-options';
import { showToast } from '~/lib/toast-manager';
import SettingsSection from '~/components/common/settings-section';
import { StoryMemoryState } from '~/features/manuscript/story-memory/story-memory-state';
import CommentStyleExampleItem from './comment-style-example-item';

const AGE_OPTIONS = [
  { label: '미지정', value: '' },
  ...[10, 20, 30, 40, 50, 60, 70, 80].map((age) => ({ label: age + '대', value: String(age) })),
];
const EXPERIENCE_OPTIONS = [
  { label: '미지정', value: '' },
  ...READING_EXPERIENCE_OPTIONS.map((option) => ({
    label: option.label,
    value: String(READING_EXPERIENCE_LEVELS[option.value]),
  })),
];
const INTEREST_CHIPS = [{ label: '미지정', value: '' }, ...INTEREST_OPTIONS];
const REACTION_CHIPS = [{ label: '미지정', value: '' }, ...REACTION_OPTIONS];

const CommentStyleExampleSetting = () => {
  const [commentExamples, setCommentExamples] = useState<CommentExample[]>([]);
  const [commentExampleContent, setCommentExampleContent] = useState('');
  const [commentExampleInterest, setCommentExampleInterest] = useState('');
  const [loadError, setLoadError] = useState('');
  const [commentExampleTone, setCommentExampleTone] = useState('');
  const [commentExampleAgeGroup, setCommentExampleAgeGroup] = useState('');
  const [commentExampleExpertise, setCommentExampleExpertise] = useState('');
  const [isSavingCommentExample, setIsSavingCommentExample] = useState(false);
  const [removingExampleId, setRemovingExampleId] = useState<string | null>(null);

  useEffect(() => {
    void loadCommentExamples().catch(() => setLoadError('댓글 스타일 예시를 불러오지 못했습니다.'));
  }, []);

  const loadCommentExamples = async () => {
    const examples = await listCommentExamples();
    setCommentExamples(examples);
    setLoadError('');
  };

  const handleAddCommentExample = async () => {
    const content = commentExampleContent.trim();

    if (isSavingCommentExample || !content) {
      return;
    }

    setIsSavingCommentExample(true);

    try {
      await addCommentExample({
        content,
        tone: commentExampleTone || null,
        interest: commentExampleInterest || null,
        ageGroup: commentExampleAgeGroup ? Number(commentExampleAgeGroup) : null,
        expertiseLevel: commentExampleExpertise ? Number(commentExampleExpertise) : null,
      });
      setCommentExampleContent('');
      await loadCommentExamples();
      showToast('댓글 스타일 예시를 저장했습니다.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '예시 저장에 실패했습니다.', 'danger');
    } finally {
      setIsSavingCommentExample(false);
    }
  };

  const handleRemoveCommentExample = async (id: string) => {
    setRemovingExampleId(id);

    try {
      await removeCommentExample(id);
      await loadCommentExamples();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '예시 삭제에 실패했습니다.', 'danger');
    } finally {
      setRemovingExampleId(null);
    }
  };

  return (
    <SettingsSection
      collapsible
      title={'댓글 스타일 예시'}
      description={
        '독서 경험·관심사·반응 성향에 맞는 댓글 문체를 참고합니다. 예시 하나당 각 조건을 하나 선택하거나 미지정으로 남겨주세요.'
      }
      count={commentExamples.length}
    >
      <div className={'flex flex-col gap-5'}>
        <div className={'flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-4'}>
          <label className={'flex flex-col gap-2'}>
            <span className={'text-sm font-medium text-stone-700'}>댓글 내용</span>
            <textarea
              className={`min-h-24 w-full resize-y ${uiFieldClass}`}
              onChange={(event) => setCommentExampleContent(event.target.value)}
              placeholder={'예: 얘는 화난 와중에도 동생부터 챙기네 ㅠㅠ'}
              value={commentExampleContent}
              disabled={isSavingCommentExample}
            />
          </label>
          <fieldset disabled={isSavingCommentExample}>
            <legend className={'mb-2 text-sm font-semibold text-stone-900'}>독서 경험</legend>
            <DnChipGroup
              className={'flex! flex-wrap'}
              options={EXPERIENCE_OPTIONS}
              value={commentExampleExpertise}
              onChange={setCommentExampleExpertise}
              disabled={isSavingCommentExample}
            />
          </fieldset>
          <fieldset disabled={isSavingCommentExample}>
            <legend className={'mb-2 text-sm font-semibold text-stone-900'}>관심사</legend>
            <DnChipGroup
              className={'flex! flex-wrap'}
              options={INTEREST_CHIPS}
              value={commentExampleInterest}
              onChange={setCommentExampleInterest}
              disabled={isSavingCommentExample}
            />
          </fieldset>
          <fieldset disabled={isSavingCommentExample}>
            <legend className={'mb-2 text-sm font-semibold text-stone-900'}>반응 성향</legend>
            <DnChipGroup
              className={'flex! flex-wrap'}
              options={REACTION_CHIPS}
              value={commentExampleTone}
              onChange={setCommentExampleTone}
              disabled={isSavingCommentExample}
            />
          </fieldset>
          <details className={'rounded-lg bg-stone-50 p-3'}>
            <summary className={'cursor-pointer text-sm font-medium text-stone-600'}>
              보조 설정 · 연령대
            </summary>
            <div className={'pt-3'}>
              <DnChipGroup
                className={'flex! flex-wrap'}
                options={AGE_OPTIONS}
                value={commentExampleAgeGroup}
                onChange={setCommentExampleAgeGroup}
                disabled={isSavingCommentExample}
              />
            </div>
          </details>
          <div className={'flex justify-end'}>
            <DnButton
              loading={isSavingCommentExample}
              disabled={!commentExampleContent.trim() || isSavingCommentExample}
              onClick={() => void handleAddCommentExample()}
              variant={'outlined'}
            >
              예시 저장
            </DnButton>
          </div>
        </div>
        {loadError && (
          <div
            role={'alert'}
            className={'flex items-center justify-between gap-3 text-sm text-red-600'}
          >
            {loadError}
            <DnButton
              size={'s'}
              variant={'outlined'}
              onClick={() =>
                void loadCommentExamples().catch(() =>
                  setLoadError('댓글 스타일 예시를 불러오지 못했습니다.'),
                )
              }
            >
              다시 확인
            </DnButton>
          </div>
        )}
        <div className={'flex max-h-[640px] flex-col gap-3 overflow-y-auto pr-1'}>
          {!loadError && commentExamples.length === 0 && (
            <StoryMemoryState>저장된 댓글 스타일 예시가 없습니다.</StoryMemoryState>
          )}
          {commentExamples.map((example) => (
            <CommentStyleExampleItem
              key={example.id}
              example={example}
              removing={removingExampleId === example.id}
              onRemove={() => void handleRemoveCommentExample(example.id)}
            />
          ))}
        </div>
      </div>
    </SettingsSection>
  );
};

export default CommentStyleExampleSetting;
