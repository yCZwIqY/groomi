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
    "content": "여기서 표정 안 보여주는 거 아깝다",
    "tone": "아쉬움",
    "ageGroup": 40,
    "expertiseLevel": 80
  },
  {
    "content": "둘이 싸우는데 설명 들어와서 흐름 끊김",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 80
  },
  {
    "content": "저 능력 갑자기 어디서 남? 앞에 나온 적 있나",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 80
  },
  {
    "content": "했다 했다 했다... 여기 읽다 자꾸 걸림",
    "tone": "분석",
    "ageGroup": 40,
    "expertiseLevel": 100
  },
  {
    "content": "아 그때 문 안 잠근 게 이거였네",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 100
  },
  {
    "content": "여기 문단 좀 나눠주세요 눈 아파요",
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
    "content": "민준이었잖아 갑자기 민수 누구임",
    "tone": "지적",
    "ageGroup": 30,
    "expertiseLevel": 100
  },
  {
    "content": "와 안 열었어",
    "tone": "몰입",
    "ageGroup": null,
    "expertiseLevel": 0
  },
  {
    "content": "둘 다 끝까지 미안하단 말 안 하네",
    "tone": "캐릭터 반응",
    "ageGroup": null,
    "expertiseLevel": 60
  },
  {
    "content": "아니 쟤가 왜 저걸 받아줌?",
    "tone": "의문",
    "ageGroup": null,
    "expertiseLevel": 80
  },
  {
    "content": "편지는 태웠는데 봉투는 남겼네?",
    "tone": "추측",
    "ageGroup": null,
    "expertiseLevel": 100
  },
  {
    "content": "이번엔 먼저 손 내미네요. 그건 좋다",
    "tone": "몰입",
    "ageGroup": null,
    "expertiseLevel": 80
  }
]`;

export function getDefaultCommentStyleExamples() {
  return JSON.parse(DEFAULT_COMMENT_STYLE_EXAMPLES_JSON) as DefaultCommentStyleExample[];
}
