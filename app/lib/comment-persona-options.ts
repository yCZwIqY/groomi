import type { Option } from '~/components';

// Keep requests compatible with Electron main processes started before chip selection was added.
export const READING_EXPERIENCE_LEVELS = { 입문: 0, 일반: 40, 숙련: 60, '창작 경험': 80 } as const;

export const READING_EXPERIENCE_OPTIONS: Option<
  NonNullable<GenerateCommentsPayload['readingExperiences']>[number]
>[] = [
  { label: '입문', value: '입문' },
  { label: '일반', value: '일반' },
  { label: '숙련', value: '숙련' },
  { label: '창작 경험', value: '창작 경험' },
];
export const INTEREST_OPTIONS: Option<NonNullable<GenerateCommentsPayload['interests']>[number]>[] =
  [
    { label: '캐릭터', value: '캐릭터' },
    { label: '인물 관계', value: '인물 관계' },
    { label: '전개', value: '전개' },
    { label: '세계관', value: '세계관' },
    { label: '문장', value: '문장' },
  ];
export const REACTION_OPTIONS: Option<NonNullable<GenerateCommentsPayload['reactions']>[number]>[] =
  [
    { label: '몰입', value: '몰입' },
    { label: '기대', value: '기대' },
    { label: '질문', value: '의문' },
    { label: '추측', value: '추측' },
    { label: '분석', value: '분석' },
    { label: '아쉬움', value: '아쉬움' },
    { label: '비판', value: '지적' },
  ];
