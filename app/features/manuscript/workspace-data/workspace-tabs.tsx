import { useEffect, useState } from 'react';
import type { Option } from '~/components';
import DnSwitch from '~/components/common/switch/dn-switch';
import WorkspaceList from '~/features/manuscript/workspace-data/workspace-list';
import { getLatestStoryMemory } from '~/lib/electron/story-memory-api';

type TabKey = 'list' | 'synopsis' | 'events' | 'characters' | 'plotHooks';

const TABS: Option<TabKey>[] = [
  { value: 'list', label: '하위목록' },
  { value: 'synopsis', label: '현재까지 줄거리' },
  { value: 'events', label: '사건' },
  { value: 'characters', label: '등장인물' },
  { value: 'plotHooks', label: '떡밥' },
];

const IMPORTANCE_LEVELS = ['상', '중', '하'] as const;

interface Props {
  tree: WorkspaceNode[];
  groupPath: string;
}

const WorkspaceTabs = ({ tree, groupPath }: Props) => {
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [storyMemory, setStoryMemory] = useState<StoryMemory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!groupPath) {
      setStoryMemory(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const load = async () => {
      try {
        const memory = await getLatestStoryMemory(groupPath);
        if (isMounted) {
          setStoryMemory(memory);
        }
      } catch {
        if (isMounted) {
          setStoryMemory(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [groupPath, tree.length]);

  return (
    <div className={'flex flex-col gap-4'}>
      <DnSwitch
        options={TABS}
        setValue={setActiveTab}
        value={activeTab}
      />

      {activeTab === 'list' && <WorkspaceList tree={tree} />}

      {activeTab === 'synopsis' && (
        <section className={'rounded-lg bg-white p-5 shadow-md'}>
          {loading ? (
            <div className={'text-sm text-neutral-400'}>불러오는 중...</div>
          ) : storyMemory?.synopsis ? (
            <p className={'whitespace-pre-wrap text-sm text-neutral-700'}>
              {storyMemory.synopsis}
            </p>
          ) : (
            <div className={'text-sm text-neutral-400'}>아직 생성된 줄거리가 없습니다.</div>
          )}
        </section>
      )}

      {activeTab === 'events' && (
        <section className={'flex flex-col gap-3 rounded-lg bg-white p-5 shadow-md'}>
          {!loading && (!storyMemory?.events || storyMemory.events.length === 0) && (
            <div className={'text-sm text-neutral-400'}>아직 생성된 사건이 없습니다.</div>
          )}
          {IMPORTANCE_LEVELS.map((importance) => {
            const events =
              storyMemory?.events?.filter((event) => event.importance === importance) ?? [];

            if (events.length === 0) {
              return null;
            }

            return (
              <div key={importance}>
                <div className={'text-xs font-bold text-neutral-500'}>[{importance}]</div>
                <ul className={'list-disc pl-5 text-sm text-neutral-700'}>
                  {events.map((event, index) => (
                    <li key={index}>{event.description}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === 'characters' && (
        <section className={'flex flex-col gap-3 rounded-lg bg-white p-5 shadow-md'}>
          {!loading && (!storyMemory?.characters || storyMemory.characters.length === 0) && (
            <div className={'text-sm text-neutral-400'}>아직 등록된 인물이 없습니다.</div>
          )}
          {storyMemory?.characters?.map((character, index) => (
            <div
              className={'rounded-lg border border-neutral-200 p-3'}
              key={index}
            >
              <div className={'font-bold text-neutral-900'}>{character.name}</div>
              {character.keywords.length > 0 && (
                <div className={'text-xs text-neutral-400'}>{character.keywords.join(', ')}</div>
              )}
              <div className={'mt-1 text-sm text-neutral-700'}>{character.info}</div>
              <div className={'mt-1 whitespace-pre-wrap text-sm text-neutral-600'}>
                {character.summary}
              </div>
            </div>
          ))}
        </section>
      )}

      {activeTab === 'plotHooks' && (
        <section className={'flex flex-col gap-2 rounded-lg bg-white p-5 shadow-md'}>
          {!loading && (!storyMemory?.plotHooks || storyMemory.plotHooks.length === 0) && (
            <div className={'text-sm text-neutral-400'}>아직 남아있는 떡밥이 없습니다.</div>
          )}
          {storyMemory?.plotHooks?.map((hook, index) => (
            <div
              className={'flex gap-3 text-sm'}
              key={index}
            >
              <div className={'w-24 shrink-0 font-bold text-primary-600'}>{hook.plantedAt}</div>
              <div className={'text-neutral-700'}>{hook.description}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default WorkspaceTabs;
