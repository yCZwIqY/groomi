export type DefaultCommentStyleExample = {
  content: string;
  tone: string;
  ageGroup: number | null;
  expertiseLevel: number;
};

const DEFAULT_COMMENT_STYLE_EXAMPLES: DefaultCommentStyleExample[] = [
  {
    content: '아니 왜 니가 대신 죽는데',
    tone: '몰입',
    ageGroup: 10,
    expertiseLevel: 0,
  },
  {
    content: '끝까지 이름 안 부르다가 이제 부르네 ㅠㅠ',
    tone: '몰입',
    ageGroup: 20,
    expertiseLevel: 0,
  },
  {
    content: '잠깐 저 편지 아직 안 읽었잖아',
    tone: '기대',
    ageGroup: 10,
    expertiseLevel: 0,
  },
  {
    content: '짐 챙겨온 거ㅋㅋㅋㅋ 갈 생각이었네',
    tone: '캐릭터 반응',
    ageGroup: 10,
    expertiseLevel: 20,
  },
  {
    content: '결국 같이 가네ㅋㅋ',
    tone: '캐릭터 반응',
    ageGroup: 20,
    expertiseLevel: 20,
  },
  {
    content: '근데 열쇠 얘기만 나오면 말 돌림',
    tone: '추측',
    ageGroup: 20,
    expertiseLevel: 20,
  },
  {
    content: '근데 편지는 왜 숨긴 거임?',
    tone: '의문',
    ageGroup: 20,
    expertiseLevel: 40,
  },
  {
    content: '엥 얘 앞에서 죽은 거 아니었어요? 제가 뭐 놓쳤나',
    tone: '의문',
    ageGroup: 20,
    expertiseLevel: 40,
  },
  {
    content: '벌써 용서해준다고? 좀 허무한데',
    tone: '아쉬움',
    ageGroup: 30,
    expertiseLevel: 60,
  },
  {
    content: '여기 갑자기 장소 바뀐 거 맞죠? 순간 한 문단 건너뛴 줄',
    tone: '아쉬움',
    ageGroup: 20,
    expertiseLevel: 60,
  },
  {
    content: '맨손으로도 열 수 있었으면 열쇠는 왜 찾은 거지',
    tone: '분석',
    ageGroup: 30,
    expertiseLevel: 80,
  },
  {
    content: '했다 했다 했다... 여기 읽다 자꾸 걸림',
    tone: '분석',
    ageGroup: 40,
    expertiseLevel: 100,
  },
  {
    content: '아 그래서 아까 문 안 잠갔구나',
    tone: '분석',
    ageGroup: 30,
    expertiseLevel: 100,
  },
  {
    content: '여기 문단 좀 나눠주세요 눈 아파요',
    tone: '지적',
    ageGroup: 20,
    expertiseLevel: 100,
  },
  {
    content: "여기 '갖다'는 '같다' 오타인 듯!",
    tone: '지적',
    ageGroup: 30,
    expertiseLevel: 80,
  },
  {
    content: '민준이었잖아 갑자기 민수 누구임',
    tone: '지적',
    ageGroup: 30,
    expertiseLevel: 100,
  },
  {
    content: '와 안 열었어 다행이다',
    tone: '몰입',
    ageGroup: null,
    expertiseLevel: 0,
  },
  {
    content: '둘 다 끝까지 미안하단 말 안 하네',
    tone: '캐릭터 반응',
    ageGroup: null,
    expertiseLevel: 60,
  },
  {
    content: '아니 쟤가 왜 저걸 받아줌?',
    tone: '의문',
    ageGroup: null,
    expertiseLevel: 80,
  },
  {
    content: '이번엔 먼저 손 내미네요',
    tone: '몰입',
    ageGroup: null,
    expertiseLevel: 80,
  },
];

export function getDefaultCommentStyleExamples(): DefaultCommentStyleExample[] {
  return DEFAULT_COMMENT_STYLE_EXAMPLES.map((example) => ({ ...example }));
}
