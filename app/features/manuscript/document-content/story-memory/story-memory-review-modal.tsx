import { useEffect, useState } from 'react';
import { AiOutlineClose } from 'react-icons/ai';

import { useModal } from '~/hooks/use-modal';
import DnButton from '~/components/common/buttons/dn-button';
import DnSwitch from '~/components/common/switch/dn-switch';
import { saveStoryMemory } from '~/lib/electron/story-memory-api';
import { showToast } from '~/lib/toast-manager';
import type { Option } from '~/components';
import SynopsisTab from './synopsis-tab';
import EventsTab from './events-tab';
import CharactersTab, { type CharacterDraft } from './characters-tab';
import PlotHooksTab from './plot-hooks-tab';

type TabKey = 'synopsis' | 'events' | 'characters' | 'plotHooks';

const TABS: Option<TabKey>[] = [
  { value: 'synopsis', label: '현재까지 줄거리' },
  { value: 'events', label: '사건' },
  { value: 'characters', label: '등장인물' },
  { value: 'plotHooks', label: '떡밥' },
];

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
    setCharacters((prev) => [
      ...prev,
      { name: '', info: '', keywords: [], keywordsText: '', summary: '' },
    ]);
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
    setPlotHooks((prev) => [
      ...prev,
      { description: '', plantedAt: documentTitle, status: 'unresolved' },
    ]);
  };

  const handleRemovePlotHook = (index: number) => {
    setPlotHooks((prev) => prev.filter((_, current) => current !== index));
  };

  const handlePlotHookChange = (
    index: number,
    key: 'description' | 'plantedAt' | 'status',
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
      showToast(
        error instanceof Error ? error.message : '회차 정보 저장에 실패했습니다.',
        'danger',
      );
    } finally {
      setSaving(false);
    }
  };

  const { portal, isOpen, setIsOpen } = useModal(
    {
      content: (
        <div className={'ui-modal flex max-h-[80vh] w-[640px] flex-col'}>
          <div className={'flex items-start justify-between pb-2'}>
            <div>
              <div className={'typo-b2-b text-stone-900'}>이번 화 정보 확인</div>
              <div className={'mt-1 typo-b6-r text-stone-400'}>
                AI가 생성한 줄거리·주요 사건·등장인물·떡밥 정보입니다. 필요한 부분을 수정한 뒤
                저장해주세요.
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

          <div className={'min-h-0 flex-1 overflow-y-auto pt-4 pr-1'}>
            {activeTab === 'synopsis' && (
              <SynopsisTab
                synopsis={synopsis}
                onChange={setSynopsis}
              />
            )}

            {activeTab === 'events' && (
              <EventsTab
                events={events}
                onAdd={handleAddEvent}
                onRemove={handleRemoveEvent}
                onChange={handleEventChange}
              />
            )}

            {activeTab === 'characters' && (
              <CharactersTab
                characters={characters}
                onAdd={handleAddCharacter}
                onRemove={handleRemoveCharacter}
                onChange={handleCharacterChange}
              />
            )}

            {activeTab === 'plotHooks' && (
              <PlotHooksTab
                plotHooks={plotHooks}
                onAdd={handleAddPlotHook}
                onRemove={handleRemovePlotHook}
                onChange={handlePlotHookChange}
              />
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
