export type DefaultCommentStyleExample = {
  content: string;
  tone: string;
  ageGroup: number | null;
  expertiseLevel: number;
};

const DEFAULT_COMMENT_STYLE_EXAMPLES_JSON = `[
  {
    "content": "아니 여기서 끊는 게 어딨어요 ㅠㅠㅠ",
    "tone": "몰입",
    "ageGroup": 10,
    "expertiseLevel": 0
  },
  {
    "content": "와 작가님 여기서 끊으시면 전 어떡하라고요",
    "tone": "몰입",
    "ageGroup": 20,
    "expertiseLevel": 0
  },
  {
    "content": "다음 화 버튼 왜 없음? 현기증 나요",
    "tone": "기대",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "헐 다음 편 주세요 제발요 지금 잠 다 깸",
    "tone": "기대",
    "ageGroup": 10,
    "expertiseLevel": 0
  },
  {
    "content": "얘 또 호구짓하네 아 답답해ㅋㅋㅋ 근데 못 미워하겠음",
    "tone": "캐릭터 반응",
    "ageGroup": 10,
    "expertiseLevel": 0
  },
  {
    "content": "얘만 나오면 댓글창 시끄러워지는 거 개웃김ㅋㅋㅋㅋ",
    "tone": "캐릭터 반응",
    "ageGroup": 10,
    "expertiseLevel": 20
  },
  {
    "content": "분명 악역인데 등장할 때마다 반가움... 망했다",
    "tone": "캐릭터 반응",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "주인공 진짜 노답인데 그 맛에 보는 중ㅋㅋ",
    "tone": "캐릭터 반응",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "나라면 저 자리에서 바로 엎었다 쟤 성격 진짜 좋네",
    "tone": "몰입",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "잠깐 쟤 말 돌린 거 수상한데... 나만 느낌?",
    "tone": "추측",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "아까 반지 굳이 보여준 거 백퍼 복선 같은데",
    "tone": "추측",
    "ageGroup": 30,
    "expertiseLevel": 60
  },
  {
    "content": "근데 방금 한 말 아까 행동이랑 정반대 아님? 일부러 저러는 건가",
    "tone": "의문",
    "ageGroup": 20,
    "expertiseLevel": 40
  },
  {
    "content": "엥 얘 앞에서 죽은 거 아니었어요? 제가 뭐 놓쳤나",
    "tone": "의문",
    "ageGroup": 20,
    "expertiseLevel": 40
  },
  {
    "content": "둘이 벌써 화해한다고? 한 번만 더 싸워도 됐을 듯 좀 아쉽다",
    "tone": "아쉬움",
    "ageGroup": 30,
    "expertiseLevel": 60
  },
  {
    "content": "여기 갑자기 장소 바뀐 거 맞죠? 순간 한 문단 건너뛴 줄",
    "tone": "아쉬움",
    "ageGroup": 20,
    "expertiseLevel": 60
  },
  {
    "content": "여기서 표정 한 줄만 더 있었으면 감정선 제대로 터졌을 것 같은데 아깝네요",
    "tone": "아쉬움",
    "ageGroup": 40,
    "expertiseLevel": 80
  },
  {
    "content": "대사는 팽팽해서 좋은데 중간 설명이 길어서 긴장감이 살짝 끊겨요",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 80
  },
  {
    "content": "설정 자체는 재밌는데 갑자기 저 능력 쓰니까 좀 뜬금없었음 앞에 힌트가 있었나?",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 80
  },
  {
    "content": "여기 문장이 계속 '~했다'로 끝나서 읽는 리듬이 좀 단조로워요",
    "tone": "분석",
    "ageGroup": 40,
    "expertiseLevel": 100
  },
  {
    "content": "초반에 던진 복선 여기서 받는 건 좋았어요 근데 주인공이 저 선택까지 하는 이유는 한 끗 부족한 느낌",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 100
  },
  {
    "content": "이 부분은 문단 한두 번만 더 끊어주면 훨씬 잘 읽힐 듯요",
    "tone": "지적",
    "ageGroup": 20,
    "expertiseLevel": 100
  },
  {
    "content": "여기 '갖다'는 '같다' 오타인 듯!",
    "tone": "지적",
    "ageGroup": 30,
    "expertiseLevel": 80
  },
  {
    "content": "어? 이 인물 앞 화에서는 민준이 아니었나요 이름 바뀐 듯",
    "tone": "지적",
    "ageGroup": 30,
    "expertiseLevel": 100
  }
]`;

export function getDefaultCommentStyleExamples() {
  return JSON.parse(DEFAULT_COMMENT_STYLE_EXAMPLES_JSON) as DefaultCommentStyleExample[];
}

