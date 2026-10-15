import errors from '../../electron/common/locales/errors-ko.json';

export const ko = {
  tasks: {
    retry: '재시도',
    cost: {
      label: '사용 금액',
      unavailable: '정보 없음',
      requests: '요청 수 (재시도 포함)',
      partial: '일부 금액 정보가 없어 확인된 금액만 표시합니다.',
    },
  },
  settings: {
    displayLanguage: '화면 언어',
    languagesDescription: '화면 표시 언어와 AI가 생성할 내용의 언어를 설정합니다.',
    title: '설정',
    description: '작업 환경과 AI 기능에 필요한 항목을 관리합니다.',
    language: '언어',
    languageDescription: '화면에 표시할 언어를 선택하세요.',
  },
  workroom: {
    title: '작업실',
    description: '최근 작업을 빠르게 열거나 새로운 작업을 시작합니다.',
    startNew: '새 작업 시작',
    workspaceCountLabel: '워크스페이스',
    documents: '작성 중인 문서',
    recent: {
      title: '최근 작업',
      description: '마지막으로 수정한 작업부터 모았습니다.',
      empty: '아직 작업한 항목이 없습니다. 첫 문서를 만들어보세요.',
    },
    workspaces: {
      title: '최근 생성한 워크스페이스',
      description: '새롭게 만든 공간을 빠르게 확인하세요.',
      empty: '생성된 워크스페이스가 없습니다.',
    },
    loading: '워크스페이스를 불러오는 중입니다.',
  },
  navigation: {
    home: '홈으로 이동',
    expandSidebar: '사이드바 열기',
    collapseSidebar: '사이드바 닫기',
    addItem: '새 문서 혹은 그룹 추가',
  },
  common: {
    collapse: '접기',
    expand: '펼치기',
  },
  backup: {
    reminder: {
      label: '원고 백업 안내',
      error: '백업 기록을 확인해주세요',
      title: '소중한 원고를 백업해주세요',
      overdue: '마지막 백업 이후 일주일 이상 지났습니다. 최근 작업을 별도 위치에 보관해주세요.',
      first: '이 작업 폴더의 백업 기록이 없습니다. 첫 백업으로 원고를 안전하게 보관해주세요.',
    },
    lastBackup: '마지막 백업',
    openSettings: '백업 설정으로 이동',
  },
  date: {
    unavailable: '날짜 정보 없음',
  },
  ai: {
    outputLanguage: {
      title: 'AI 출력 언어',
      description: '화면 언어와 별도로 리뷰·요약·댓글의 언어를 선택합니다.',
      auto: '원고와 같은 언어 (한국어·영어 자동 감지)',
      groupNote:
        '새 작품에 적용됩니다. 작품별 언어는 첫 AI 요청 시 고정되며, 기존 생성 정보가 있으면 그 언어를 유지합니다. 자동 감지는 한국어·영어만 지원하고 판별이 어려우면 영어를 사용합니다.',
      loadError: 'AI 출력 언어를 불러오지 못했습니다. 설정 화면을 다시 열어주세요.',
      saveError: 'AI 출력 언어를 저장하지 못했습니다. 다시 시도해주세요.',
    },
  },
  errors,
} as const;

export type TranslationTree = Widen<typeof ko>;
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];
export type TranslationKey = LeafPaths<typeof ko>;
