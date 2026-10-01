import { StoryMemoryCard } from '~/features/manuscript/story-memory/story-memory-card';
import { StoryMemoryHeading } from '~/features/manuscript/story-memory/story-memory-heading';
import { StoryMemoryState } from '~/features/manuscript/story-memory/story-memory-state';
import { StoryMemoryTag } from '~/features/manuscript/story-memory/story-memory-tag';
import { storyMemoryTextClass } from '~/features/manuscript/story-memory/story-memory-styles';
import { useEffect, useState } from 'react';
import type { Option } from '~/components';
import DnSwitch from '~/components/common/switch/dn-switch';
import WorkspaceList from '~/features/manuscript/workspace-data/workspace-list';
import { getLatestStoryMemory } from '~/lib/electron/story-memory-api';
import { onWorkspaceTreeChanged } from '~/lib/electron/workspace-api';

type TabKey = 'list' | 'synopsis' | 'events' | 'characters' | 'plotHooks';

const TABS: Option<TabKey>[] = [
  { value: 'list', label: '하위목록' },
  { value: 'synopsis', label: '현재까지 줄거리' },
  { value: 'events', label: '사건' },
  { value: 'characters', label: '등장인물' },
  { value: 'plotHooks', label: '떡밥' },
];

const IMPORTANCE_LEVELS = ['상', '중', '하'] as const;
const IMPORTANCE_TAG_TONES = { 상: 'high', 중: 'medium', 하: 'neutral' } as const;

interface Props {
  tree: WorkspaceNode[];
  groupPath: string;
}

const WorkspaceTabs = ({ tree, groupPath }: Props) => {
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [storyMemory, setStoryMemory] = useState<StoryMemory | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const hasChapters = tree.some((node) => node.type === 'document');

  useEffect(() => {
    if (!groupPath) {
      setStoryMemory(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const memory = await getLatestStoryMemory(groupPath);
        if (isMounted) {
          setStoryMemory(memory);
        }
      } catch {
        if (isMounted) {
          setStoryMemory(null);
          setLoadError(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();
    const unsubscribe = onWorkspaceTreeChanged(() => void load());

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [groupPath, tree.length]);

  const textClass = storyMemoryTextClass;
  const tabDetails = {
    list: {
      title: '하위 목록',
      description: '그룹에 속한 회차와 하위 그룹을 확인합니다.',
      count: tree.length,
    },
    synopsis: {
      title: '현재까지 줄거리',
      description: '최신 회차까지 이어진 이야기의 흐름입니다.',
      count: undefined,
    },
    events: {
      title: '주요 사건',
      description: '중요도가 높은 사건부터 확인할 수 있습니다.',
      count: storyMemory?.events.length ?? 0,
    },
    characters: {
      title: '등장인물',
      description: '인물의 정보, 키워드와 이야기 속 행동을 정리합니다.',
      count: storyMemory?.characters.length ?? 0,
    },
    plotHooks: {
      title: '떡밥',
      description: '해결된 떡밥도 보존됩니다. 댓글 생성에는 미해결 항목만 참고합니다.',
      count: storyMemory?.plotHooks.length ?? 0,
    },
  };
  const details = tabDetails[activeTab];
  const emptyMessages = {
    synopsis: '아직 생성된 줄거리가 없습니다.',
    events: '아직 생성된 사건이 없습니다.',
    characters: '아직 등록된 인물이 없습니다.',
    plotHooks: '등록된 떡밥이 없습니다.',
  };
  const isEmpty =
    activeTab !== 'list' &&
    (activeTab === 'synopsis' ? !storyMemory?.synopsis : details.count === 0);

  return (
    <div className={'flex min-w-0 flex-col gap-4'}>
      <div className={'overflow-x-auto pb-1'}>
        <DnSwitch
          options={TABS}
          setValue={setActiveTab}
          value={activeTab}
        />
      </div>
      <section
        className={'flex min-w-0 flex-col gap-4 ui-section p-5'}
        aria-busy={activeTab !== 'list' && loading}
      >
        <StoryMemoryHeading
          title={details.title}
          description={details.description}
          count={activeTab === 'list' || !loading ? details.count : undefined}
        />
        {activeTab === 'list' ? (
          <WorkspaceList tree={tree} />
        ) : loading ? (
          <StoryMemoryState loading>불러오는 중...</StoryMemoryState>
        ) : loadError ? (
          <StoryMemoryState>
            회차 정보를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.
          </StoryMemoryState>
        ) : !storyMemory ? (
          <StoryMemoryState>
            {hasChapters
              ? '마지막 회차에 생성된 정보가 없습니다. 마지막 회차에서 회차 정보를 생성하면 이곳에 표시됩니다.'
              : '그룹에 회차가 없습니다. 회차를 추가한 뒤 회차 정보를 생성해주세요.'}
          </StoryMemoryState>
        ) : isEmpty ? (
          <StoryMemoryState>{emptyMessages[activeTab]}</StoryMemoryState>
        ) : (
          <>
            {activeTab === 'synopsis' && (
              <StoryMemoryCard>
                <p className={textClass}>{storyMemory?.synopsis}</p>
              </StoryMemoryCard>
            )}
            {activeTab === 'events' && (
              <ul className={'flex flex-col gap-3'}>
                {IMPORTANCE_LEVELS.flatMap((importance) =>
                  (storyMemory?.events ?? [])
                    .filter((event) => event.importance === importance)
                    .map((event, index) => (
                      <StoryMemoryCard
                        as={'li'}
                        key={importance + index}
                        className={'flex items-start gap-3'}
                      >
                        <StoryMemoryTag
                          tone={IMPORTANCE_TAG_TONES[importance]}
                          className={'mt-1'}
                          aria-label={'중요도 ' + importance}
                        >
                          {importance}
                        </StoryMemoryTag>
                        <p className={textClass}>{event.description}</p>
                      </StoryMemoryCard>
                    )),
                )}
              </ul>
            )}
            {activeTab === 'characters' &&
              storyMemory?.characters.map((character, index) => (
                <StoryMemoryCard
                  as={'article'}
                  className={'flex flex-col gap-3'}
                  key={index}
                >
                  <h4 className={'break-words text-sm font-semibold text-stone-900'}>
                    {character.name || '이름 없는 인물'}
                  </h4>
                  {character.keywords.length > 0 && (
                    <div className={'flex flex-wrap gap-1.5'}>
                      {character.keywords.map((keyword, keywordIndex) => (
                        <span
                          key={keywordIndex}
                          className={
                            'max-w-full break-words rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700'
                          }
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                  {character.info && <p className={textClass}>{character.info}</p>}
                  {character.summary && (
                    <div className={'border-t border-stone-100 pt-3'}>
                      <div className={'mb-1 text-xs font-medium text-stone-500'}>행동 요약</div>
                      <p className={textClass}>{character.summary}</p>
                    </div>
                  )}
                </StoryMemoryCard>
              ))}
            {activeTab === 'plotHooks' &&
              storyMemory?.plotHooks.map((hook, index) => (
                <StoryMemoryCard
                  as={'article'}
                  className={'flex flex-col gap-3'}
                  key={index}
                >
                  <div className={'flex flex-wrap items-center justify-between gap-2'}>
                    <span className={'min-w-0 break-words text-xs text-stone-500'}>
                      등장 회차{' '}
                      <span className={'font-medium text-stone-700'}>
                        {hook.plantedAt || '미등록'}
                      </span>
                    </span>
                    <StoryMemoryTag tone={hook.status === 'resolved' ? 'neutral' : 'primary'}>
                      {hook.status === 'resolved' ? '해결' : '미해결'}
                    </StoryMemoryTag>
                  </div>
                  <p className={textClass}>{hook.description}</p>
                </StoryMemoryCard>
              ))}
          </>
        )}
      </section>
    </div>
  );
};

export default WorkspaceTabs;
