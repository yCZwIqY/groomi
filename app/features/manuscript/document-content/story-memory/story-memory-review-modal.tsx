import { useEffect, useState } from 'react';
import { AiOutlineClose, AiOutlineDelete, AiOutlinePlus } from 'react-icons/ai';

import { useModal } from '~/hooks/use-modal';
import DnButton from '~/components/common/buttons/dn-button';
import DnInput from '~/components/common/inputs/dn-input';
import DnSwitch from '~/components/common/switch/dn-switch';
import { DnSelect } from '~/components/common/selector';
import { saveStoryMemory } from '~/lib/electron/story-memory-api';
import { showToast } from '~/lib/toast-manager';
import type { Option } from '~/components';

const IMPORTANCE_OPTIONS = [
  { label: '상', value: '상' },
  { label: '중', value: '중' },
  { label: '하', value: '하' },
];

type TabKey = 'synopsis' | 'events' | 'characters' | 'plotHooks';

const TABS: Option<TabKey>[] = [
  { value: 'synopsis', label: '현재까지 줄거리' },
  { value: 'events', label: '사건' },
  { value: 'characters', label: '등장인물' },
  { value: 'plotHooks', label: '떡밥' },
];

type CharacterDraft = StoryMemoryCharacter & { keywordsText: string };

interface Props {
  documentPath: string;
  documentTitle: string;
  draft: StoryMemoryDraft | null;
  onSaved?: (memory: StoryMemory) => void;
}

const StoryMemoryReviewModal = ({ documentPath, documentTitle, draft, onSaved }: Props) => {
  const [activeTab, setActiveTab] = useState<TabKey>('synopsis');
  const [synopsis, setSynopsis] = useState('');
  const [events, setEvents] = useState<StoryMemoryEvent[]>([]);
  const [characters, setCharacters] = useState<CharacterDraft[]>([]);
  const [plotHooks, setPlotHooks] = useState<StoryMemoryPlotHook[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) {
      return;
    }

    setActiveTab('synopsis');
    setSynopsis(draft.synopsis ?? '');
    setEvents(draft.events ?? []);
    setCharacters(
      (draft.characters ?? []).map((character) => ({
        ...character,
        keywordsText: character.keywords?.join(', ') ?? '',
      })),
    );
    setPlotHooks(draft.plotHooks ?? []);
    setIsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const handleAddEvent = () => {
    setEvents((prev) => [...prev, { description: '', importance: '중' }]);
  };

  const handleRemoveEvent = (index: number) => {
    setEvents((prev) => prev.filter((_, current) => current !== index));
  };

  const handleEventChange = (index: number, key: 'description' | 'importance', value: string) => {
    setEvents((prev) =>
      prev.map((event, current) => (current === index ? { ...event, [key]: value } : event)),
    );
  };

  const handleAddCharacter = () => {
    setCharacters((prev) => [...prev, { name: '', info: '', keywords: [], keywordsText: '', summary: '' }]);
  };

  const handleRemoveCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, current) => current !== index));
  };

  const handleCharacterChange = (
    index: number,
    key: 'name' | 'info' | 'keywordsText' | 'summary',
    value: string,
  ) => {
    setCharacters((prev) =>
      prev.map((character, current) =>
        current === index ? { ...character, [key]: value } : character,
      ),
    );
  };

  const handleAddPlotHook = () => {
    setPlotHooks((prev) => [...prev, { description: '', plantedAt: documentTitle }]);
  };

  const handleRemovePlotHook = (index: number) => {
    setPlotHooks((prev) => prev.filter((_, current) => current !== index));
  };

  const handlePlotHookChange = (
    index: number,
    key: 'description' | 'plantedAt',
    value: string,
  ) => {
    setPlotHooks((prev) =>
      prev.map((hook, current) => (current === index ? { ...hook, [key]: value } : hook)),
    );
  };

  const handleConfirm = async () => {
    setSaving(true);

    try {
      const saved = await saveStoryMemory(documentPath, {
        synopsis,
        events,
        characters: characters.map(({ keywordsText, ...character }) => ({
          ...character,
          keywords: keywordsText
            .split(',')
            .map((keyword) => keyword.trim())
            .filter(Boolean),
        })),
        plotHooks,
      });

      showToast('회차 정보를 저장했습니다.', 'success');
      onSaved?.(saved);
      setIsOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '회차 정보 저장에 실패했습니다.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const { portal, isOpen, setIsOpen } = useModal(
    {
      content: (
        <div
          className={
            'flex max-h-[80vh] w-[640px] flex-col rounded-[28px] bg-stone-50 p-8 text-stone-900 shadow-[0_30px_90px_rgba(15,23,42,0.22)] ring-1 ring-white/70'
          }
        >
          <div className={'flex items-start justify-between pb-2'}>
            <div>
              <div className={'typo-b2-b text-stone-900'}>이번 화 정보 확인</div>
              <div className={'mt-1 typo-b6-r text-stone-400'}>
                AI가 생성한 줄거리·주요 사건·등장인물·떡밥 정보입니다. 필요한 부분을 수정한 뒤 저장해주세요.
              </div>
            </div>
            <button
              type={'button'}
              onClick={() => setIsOpen(false)}
            >
              <AiOutlineClose />
            </button>
          </div>

          <div className={'pt-4'}>
            <DnSwitch
              options={TABS}
              setValue={setActiveTab}
              value={activeTab}
            />
          </div>

          <div className={'flex-1 overflow-y-auto pt-4'}>
            {activeTab === 'synopsis' && (
              <div className={'flex flex-col gap-2'}>
                <div className={'typo-b4-b text-stone-900'}>현재까지 줄거리</div>
                <textarea
                  className={
                    'min-h-[280px] w-full rounded-md border border-gray-500 p-2 text-sm outline-none focus:border-primary-500'
                  }
                  onChange={(event) => setSynopsis(event.target.value)}
                  value={synopsis}
                />
              </div>
            )}

            {activeTab === 'events' && (
              <div className={'flex flex-col gap-2'}>
                <div className={'flex items-center justify-between'}>
                  <div className={'typo-b4-b text-stone-900'}>주요 사건</div>
                  <button
                    className={'flex items-center gap-1 text-xs text-primary-600'}
                    onClick={handleAddEvent}
                    type={'button'}
                  >
                    <AiOutlinePlus /> 사건 추가
                  </button>
                </div>
                {events.length === 0 && (
                  <div className={'text-xs text-stone-400'}>등록된 사건이 없습니다.</div>
                )}
                {events.map((event, index) => (
                  <div
                    className={'flex items-start gap-2'}
                    key={index}
                  >
                    <div className={'w-20 shrink-0'}>
                      <DnSelect
                        onChange={(value) => handleEventChange(index, 'importance', String(value))}
                        options={IMPORTANCE_OPTIONS}
                        value={event.importance}
                      />
                    </div>
                    <textarea
                      className={
                        'flex-1 rounded-md border border-gray-500 p-2 text-sm outline-none focus:border-primary-500'
                      }
                      onChange={(changeEvent) =>
                        handleEventChange(index, 'description', changeEvent.target.value)
                      }
                      value={event.description}
                    />
                    <button
                      onClick={() => handleRemoveEvent(index)}
                      type={'button'}
                    >
                      <AiOutlineDelete />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'characters' && (
              <div className={'flex flex-col gap-2'}>
                <div className={'flex items-center justify-between'}>
                  <div className={'typo-b4-b text-stone-900'}>등장인물 정리</div>
                  <button
                    className={'flex items-center gap-1 text-xs text-primary-600'}
                    onClick={handleAddCharacter}
                    type={'button'}
                  >
                    <AiOutlinePlus /> 인물 추가
                  </button>
                </div>
                {characters.length === 0 && (
                  <div className={'text-xs text-stone-400'}>등록된 인물이 없습니다.</div>
                )}
                {characters.map((character, index) => (
                  <div
                    className={'flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-3'}
                    key={index}
                  >
                    <div className={'flex items-center gap-2'}>
                      <DnInput
                        className={'flex-1'}
                        onChange={(event) => handleCharacterChange(index, 'name', event.target.value)}
                        placeholder={'이름'}
                        value={character.name}
                      />
                      <button
                        onClick={() => handleRemoveCharacter(index)}
                        type={'button'}
                      >
                        <AiOutlineDelete />
                      </button>
                    </div>
                    <DnInput
                      onChange={(event) => handleCharacterChange(index, 'info', event.target.value)}
                      placeholder={'정보 (역할, 나이, 소속 등)'}
                      value={character.info}
                    />
                    <DnInput
                      onChange={(event) =>
                        handleCharacterChange(index, 'keywordsText', event.target.value)
                      }
                      placeholder={'키워드 (쉼표로 구분)'}
                      value={character.keywordsText}
                    />
                    <textarea
                      className={
                        'rounded-md border border-gray-500 p-2 text-sm outline-none focus:border-primary-500'
                      }
                      onChange={(event) =>
                        handleCharacterChange(index, 'summary', event.target.value)
                      }
                      placeholder={'스토리에 따른 행동 요약 (최대 5줄)'}
                      rows={5}
                      value={character.summary}
                    />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'plotHooks' && (
              <div className={'flex flex-col gap-2'}>
                <div className={'flex items-center justify-between'}>
                  <div>
                    <div className={'typo-b4-b text-stone-900'}>떡밥 (미해결 복선)</div>
                    <div className={'typo-b6-r text-stone-400'}>
                      해결(회수)된 항목은 삭제해주세요. 다음 화 생성 시 남아있는 항목만 이어집니다.
                    </div>
                  </div>
                  <button
                    className={'flex items-center gap-1 text-xs text-primary-600'}
                    onClick={handleAddPlotHook}
                    type={'button'}
                  >
                    <AiOutlinePlus /> 떡밥 추가
                  </button>
                </div>
                {plotHooks.length === 0 && (
                  <div className={'text-xs text-stone-400'}>등록된 떡밥이 없습니다.</div>
                )}
                {plotHooks.map((hook, index) => (
                  <div
                    className={'flex items-start gap-2'}
                    key={index}
                  >
                    <DnInput
                      className={'w-28 shrink-0'}
                      onChange={(event) =>
                        handlePlotHookChange(index, 'plantedAt', event.target.value)
                      }
                      placeholder={'등장 화'}
                      value={hook.plantedAt}
                    />
                    <textarea
                      className={
                        'flex-1 rounded-md border border-gray-500 p-2 text-sm outline-none focus:border-primary-500'
                      }
                      onChange={(changeEvent) =>
                        handlePlotHookChange(index, 'description', changeEvent.target.value)
                      }
                      value={hook.description}
                    />
                    <button
                      onClick={() => handleRemovePlotHook(index)}
                      type={'button'}
                    >
                      <AiOutlineDelete />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={'grid grid-cols-2 gap-3 pt-6'}>
            <DnButton
              onClick={() => setIsOpen(false)}
              variant={'outlined'}
            >
              닫기
            </DnButton>
            <DnButton
              loading={saving}
              onClick={() => void handleConfirm()}
            >
              저장
            </DnButton>
          </div>
        </div>
      ),
    },
    [activeTab, synopsis, events, characters, plotHooks, saving],
  );

  return <>{isOpen && portal}</>;
};

export default StoryMemoryReviewModal;
