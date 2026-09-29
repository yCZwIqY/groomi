export type DefaultCommentStyleExample = {
  content: string;
  tone: string;
  ageGroup: number | null;
  expertiseLevel: number;
};

const DEFAULT_COMMENT_STYLE_EXAMPLES_JSON = `[
  {
    "content": "안돼 여기서 끊으면 진짜 안돼ㅠㅠㅠㅠ",
    "tone": "몰입",
    "ageGroup": 10,
    "expertiseLevel": 0
  },
  {
    "content": "미쳤다 진짜 미쳤다 이걸 여기서 끊어??",
    "tone": "몰입",
    "ageGroup": 20,
    "expertiseLevel": 0
  },
  {
    "content": "다음화 언제 올라와요 진짜 못 기다리겠음",
    "tone": "기대",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "와 이건 바로 다음화 봐야하는 흐름인데ㅠㅠ 빨리요",
    "tone": "기대",
    "ageGroup": 10,
    "expertiseLevel": 0
  },
  {
    "content": "주인공 넘 착해서 답답한데 그래서 더 좋아함ㅋㅋ",
    "tone": "캐릭터 반응",
    "ageGroup": 10,
    "expertiseLevel": 0
  },
  {
    "content": "이 캐릭터 나오면 분위기 바로 살아남ㅋㅋㅋ",
    "tone": "캐릭터 반응",
    "ageGroup": 10,
    "expertiseLevel": 20
  },
  {
    "content": "악당 너무 매력있어서 큰일났다ㅋㅋㅋㅋ",
    "tone": "캐릭터 반응",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "주인공 진짜 답없다 근데 그게 또 매력임ㅋㅋ",
    "tone": "캐릭터 반응",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "아니 나였어도 개빡쳤다 쟤 완전 부처님이네",
    "tone": "몰입",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "저 인물 뭔가 숨기는 거 있는 듯... 나만 그렇게 느끼나",
    "tone": "추측",
    "ageGroup": 20,
    "expertiseLevel": 20
  },
  {
    "content": "이거 복선 아닐까 싶은데 다음화에서 터질 것 같음",
    "tone": "추측",
    "ageGroup": 30,
    "expertiseLevel": 60
  },
  {
    "content": "근데 얘 방금 한 말이랑 아까 행동이랑 좀 안 맞지 않나요",
    "tone": "의문",
    "ageGroup": 20,
    "expertiseLevel": 40
  },
  {
    "content": "아까 죽은 줄 알았던 애 여기서 멀쩡히 나오는데 설명 없었나요??",
    "tone": "의문",
    "ageGroup": 20,
    "expertiseLevel": 40
  },
  {
    "content": "전개는 좋은데 감정 쌓일 시간이 좀 부족한 느낌",
    "tone": "아쉬움",
    "ageGroup": 30,
    "expertiseLevel": 60
  },
  {
    "content": "장면 전환이 갑자기 튀어서 한 문단 빠진 줄 알았어요",
    "tone": "아쉬움",
    "ageGroup": 20,
    "expertiseLevel": 60
  },
  {
    "content": "표정 묘사가 한 줄만 더 있었으면 감정이 훨씬 잘 살았을 듯",
    "tone": "아쉬움",
    "ageGroup": 40,
    "expertiseLevel": 80
  },
  {
    "content": "이 장면 대사는 좋은데 지문 설명이 많아서 템포가 처짐",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 80
  },
  {
    "content": "설정은 흥미로운데 이번화 안에서 근거가 조금 더 필요해 보여요",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 80
  },
  {
    "content": "문장 끝맺음이 계속 비슷해서 리듬이 단조롭게 느껴지는 부분이 있어요",
    "tone": "분석",
    "ageGroup": 40,
    "expertiseLevel": 100
  },
  {
    "content": "복선 회수 깔끔하네요. 근데 이번화만 놓고 보면 동기 부여가 약해서 다음화에서 더 채워질지 지켜봐야 할 듯",
    "tone": "분석",
    "ageGroup": 30,
    "expertiseLevel": 100
  },
  {
    "content": "가독성이 좀 아쉬워요. 문단을 조금 더 자주 나눠주시면 좋을 것 같습니다",
    "tone": "지적",
    "ageGroup": 20,
    "expertiseLevel": 100
  },
  {
    "content": "'갖다'가 아니라 '같다'인 것 같아요, 오타 확인 부탁드려요",
    "tone": "지적",
    "ageGroup": 30,
    "expertiseLevel": 80
  },
  {
    "content": "이름이 앞화랑 다르게 나온 것 같은데 확인 한번 해주시면 좋을 듯합니다",
    "tone": "지적",
    "ageGroup": 30,
    "expertiseLevel": 100
  }
]`;

export function getDefaultCommentStyleExamples() {
  return JSON.parse(DEFAULT_COMMENT_STYLE_EXAMPLES_JSON) as DefaultCommentStyleExample[];
}

