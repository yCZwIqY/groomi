import { StoryMemoryHeading } from '~/features/manuscript/story-memory/story-memory-heading';
import { PillActionButton } from '~/components/common/buttons/pill-action-button';
import { StoryMemoryState } from '~/features/manuscript/story-memory/story-memory-state';
import { reviewCardClass, reviewFieldClass } from './review-tab-styles';
import { AiOutlineDelete, AiOutlinePlus } from 'react-icons/ai';
import DnInput from '~/components/common/inputs/dn-input';

export type CharacterDraft = StoryMemoryCharacter & { keywordsText: string };

interface Props {
  characters: CharacterDraft[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (
    index: number,
    key: 'name' | 'info' | 'keywordsText' | 'summary' | 'status',
    value: string,
  ) => void;
}

const CharactersTab = ({ characters, onAdd, onRemove, onChange }: Props) => (
  <div className={'flex flex-col gap-4'}>
    <div className={'flex items-start justify-between gap-4'}>
      <StoryMemoryHeading title={'등장인물 정리'} />
      <PillActionButton
        onClick={onAdd}
        type={'button'}
      >
        <AiOutlinePlus /> 인물 추가
      </PillActionButton>
    </div>
    {characters.length === 0 && <StoryMemoryState>등록된 인물이 없습니다.</StoryMemoryState>}
    {characters.map((character, index) => (
      <div
        className={reviewCardClass}
        key={index}
      >
        {character.introducedAtTitle && (
          <p className={'text-xs text-stone-500'}>최초 등장 · {character.introducedAtTitle}</p>
        )}
        <div className={'flex items-center gap-2'}>
          <DnInput
            size={'s'}
            className={'min-w-0 flex-1 border-stone-200! text-sm!'}
            onChange={(event) => onChange(index, 'name', event.target.value)}
            placeholder={'이름'}
            value={character.name}
          />
          <PillActionButton
            tone={'delete'}
            onClick={() => onRemove(index)}
            type={'button'}
            className={'self-end'}
            aria-label={'항목 ' + (index + 1) + ' 삭제'}
          >
            <AiOutlineDelete /> 삭제
          </PillActionButton>
        </div>
        <DnInput
          size={'s'}
          className={'border-stone-200! text-sm!'}
          aria-label={'인물 정보'}
          onChange={(event) => onChange(index, 'info', event.target.value)}
          placeholder={'정보 (역할, 나이, 소속 등)'}
          value={character.info}
        />
        <select
          aria-label={'인물 상태'}
          className={reviewFieldClass}
          value={character.status ?? 'unknown'}
          onChange={(event) => onChange(index, 'status', event.target.value)}
        >
          <option value={'active'}>활동 중</option>
          <option value={'dead'}>사망</option>
          <option value={'left'}>퇴장</option>
          <option value={'unknown'}>미상</option>
        </select>
        <DnInput
          size={'s'}
          className={'border-stone-200! text-sm!'}
          aria-label={'인물 키워드'}
          onChange={(event) => onChange(index, 'keywordsText', event.target.value)}
          placeholder={'키워드 (쉼표로 구분)'}
          value={character.keywordsText}
        />
        <textarea
          aria-label={'인물 ' + (index + 1) + ' 행동 요약'}
          className={reviewFieldClass + ' w-full resize-y'}
          onChange={(event) => onChange(index, 'summary', event.target.value)}
          placeholder={'스토리에 따른 행동 요약 (최대 5줄)'}
          rows={5}
          value={character.summary}
        />
      </div>
    ))}
  </div>
);

export default CharactersTab;
