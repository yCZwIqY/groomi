# Groomi (그루미)

웹소설 작가를 위한 원고 관리 및 AI 리뷰 데스크톱 앱입니다. 워크스페이스 단위로 원고를 관리하고, 로컬 LLM(Ollama)을 이용해 가상 독자 댓글을 생성해 초고를 검토할 수 있습니다.

## 주요 기능

- **워크스페이스/원고 관리**: 폴더 트리 구조로 시리즈·화차를 정리하고, 화별로 초안(draft)과 원고(manuscript)를 분리해서 관리합니다. 그룹(폴더) 생성 시 **장편/단편**을 선택할 수 있고, 단편 그룹의 회차는 서로 줄거리를 이어가지 않고 독립적으로 관리됩니다.
- **에디터**: Tiptap 기반 에디터로 초안/분할/원고 보기를 전환하며 집필하고, 공백 포함·미포함 글자 수를 실시간으로 확인할 수 있습니다.
- **AI 가상 독자 댓글 생성**: 로컬 LLM(Ollama)을 통해 연령대, 독자 전문성, 톤, 개수를 설정해 실제 독자처럼 반응하는 댓글을 생성합니다. 생성된 댓글은 회차별로 저장되어 다시 열어도 유지되며(최신 생성분이 위로, 생성일 내림차순), 개별 삭제도 가능합니다.
- **회차별 스토리 메모리**: 저장 시 AI가 현재까지의 줄거리, 중요도(상/중/하)별 주요 사건, 등장인물, 떡밥(아직 해결되지 않은 복선·약속)을 생성하고, 사용자가 탭으로 구분된 모달에서 검토·수정한 뒤 회차별로 저장합니다. 등장인물은 이전 회차 목록을 유지하면서 변경된 부분만 갱신되고, 떡밥은 해당 화에서 회수(해결)되면 목록에서 제거됩니다. 댓글 생성 시 n-2화까지는 줄거리 요약을, n-1·n화는 원문 전체를 맥락으로 사용해 설정 오류나 개연성 문제를 짚어줍니다.
- **장편 그룹 상세 탭**: 그룹 상세 페이지에서 하위목록 외에 현재까지 줄거리/사건/등장인물/떡밥을 그룹 내 가장 최근 회차 기준으로 읽기 전용으로 확인할 수 있습니다.
- **백그라운드 작업 표시**: 저장 후 스토리 메모리 생성, 댓글 생성은 화면을 막지 않고 백그라운드에서 진행되며, 우상단의 작은 표시창에서 진행 상황을 확인할 수 있습니다. 작업 중인 회차는 저장/댓글 생성만 잠기고, 완료되면 토스트 알림이 뜹니다.
- **댓글 스타일 예시 등록**: 원하는 톤·길이의 예시 댓글을 저장해두면 생성 결과에 반영됩니다.
- **완전 로컬 실행**: 모든 AI 기능은 로컬에서 구동되는 Ollama를 통해 처리되며, 외부 클라우드 LLM을 사용하지 않습니다.

## 기술 스택

- **App Shell**: Electron
- **Frontend**: React 19, React Router 7 (SSR 비활성화, SPA 모드), TypeScript, TailwindCSS 4
- **에디터**: Tiptap
- **AI**: Ollama(로컬 LLM)
- **상태 관리**: Zustand
- **패키징**: electron-builder (Windows NSIS 설치파일)

## 사전 준비

- Node.js, [pnpm](https://pnpm.io/)
- [Ollama](https://ollama.com/) 설치 및 실행
  - 댓글 생성/회차 정보 요약 모델: `EXAONE 4.0` (추천, 한국어 특화, EXAONE3.5 후속 모델)
    - 공식 Ollama 라이브러리에는 아직 없어 커뮤니티 빌드(`ingu627/exaone4.0`)로 받아야 하며, 상업적 배포 전 라이선스 확인이 필요합니다.

의존성 설치:

```bash
pnpm install
```

## 개발

Vite 개발 서버와 Electron을 동시에 실행합니다.

```bash
pnpm dev
```

## 페이지별 UI 스크린샷

```bash
pnpm test:ui:screenshots
```

임시 작업 폴더의 테스트 원고로 UI 테스트를 실행하며, `release/ui-screenshots/`에
작업실, 분할 편집, 원고 편집, 초안 편집, 설정, AI 리뷰와 라이선스 모달을 PNG로 저장합니다.
스크린샷 모드의 창 크기는 1920×1080이며 PNG에는 창 테두리를 제외한 앱 화면이 담깁니다.
AI 화면은 모의 응답으로 촬영하며, 실제 API 키·개인 원고·유료 AI 호출을 사용하지 않습니다.
`GROOMI_UI_SCREENSHOT_DIR` 환경변수로 저장 폴더를 바꿀 수 있습니다.

## 타입 체크

```bash
pnpm typecheck
```

## 빌드 / 배포

프로덕션 빌드:

```bash
pnpm build
```

Windows 설치파일(NSIS) 생성:

```bash
pnpm dist:win
```

Microsoft Store용 MSIX 패키지(x64) 생성:

```bash
pnpm dist:msix
```

Windows에서 실행하며, 결과는 `release/groomi-{version}-x64.msix`입니다.
electron-builder 26의 `appx` 타깃과 MakeAppx를 사용해 `.msix` 패키지를 생성합니다.
Store 설정은 `electron-builder.msix.cjs`에 있으며, Partner Center의 앱 식별 정보와
일치해야 합니다. 현재 Identity Name은 `Jiyoon.Groomi`, Publisher Display Name은
`Jiyoon`입니다. 타일 및 시작 메뉴 이미지는 `assets/msix/appx/`에 있습니다.

이 명령은 Store 제출용 미서명 패키지를 생성합니다. Microsoft가 심사 후 서명하므로
Store 제출을 위해 별도 인증서를 구매할 필요는 없습니다. 미서명 파일은 일반적인
더블클릭 설치가 불가능합니다. 로컬 설치 테스트에는 별도 테스트 서명과 인증서 신뢰
설정 또는 Store의 비공개 배포를 사용하세요. 테스트 서명 키를 저장소에 커밋하지 마세요.

제출 전 Windows App Certification Kit와 실제 MSIX 설치 환경에서 시작 메뉴 실행,
원고 저장·복원, 앱 업데이트, Ollama 및 OpenRouter 연결을 검증하세요. 심사 메모에는
AI 기능의 외부 의존성과 테스트 방법을 안내하고, `runFullTrust` 권한이 Electron 앱의
실행과 사용자가 선택한 원고 폴더·SQLite 데이터 처리에 필요함을 설명하세요.

NSIS 설치파일은 `release/groomi-{version}.exe`, MSIX 패키지는
`release/groomi-{version}-x64.msix`로 생성됩니다.

## 라이선스 및 출처 고지

설정의 **라이선스 및 출처 보기**에서 라이브러리·폰트·아이콘의 버전, 라이선스,
저작권 고지와 출처를 검색할 수 있습니다. 원문은 앱에 포함되므로 오프라인에서도
열립니다. 긴 원문은 페이지를 나눠 표시합니다.

UI 아이콘은 MIT 라이선스의 Tabler Icons로 통일했습니다. 사용하지 않는 다른
`react-icons` 컬렉션은 배포 패키지에서 제외하며, 빌드 시 다른 세트의 import를 검사합니다.
`pnpm licenses:generate`는 `public/licenses/`를 생성하고, 개발·빌드 명령에서도 자동 실행됩니다.
누락된 원문을 보완하는 파일과 출처는 `assets/licenses/`에 있습니다.
`jy-headless`는 저작자 확인을 받아 MIT 저작권 고지를 보완했습니다.
별도 고지 파일이 없는 `@epic-web/invariant`는 표준 MIT 본문과 메타데이터를
표시하며, 원저작권 고지 확인이 필요하다는 표시를 유지합니다.

## 프로젝트 구조

```
app/                     # React Router 프론트엔드
├── routes/              # /workroom, /manuscript, /manuscript/:id, /setting, /design-system
├── features/
│   ├── manuscript/      # 워크스페이스·문서 데이터 및 원고 작성 화면
│   └── settings/        # AI 모델 설정, 댓글 스타일 예시, 휴지통
├── components/          # 에디터, 공용 UI 컴포넌트
├── stores/              # Zustand 스토어
└── lib/                 # Electron IPC 연동, Ollama API 클라이언트

electron/                # Electron 메인 프로세스
├── main.ts              # 앱 진입점
├── windows/             # BrowserWindow 설정
├── ipc/                 # 렌더러 ↔ 메인 프로세스 통신
├── services/            # 워크스페이스, 스토리 메모리, 댓글 생성 등 비즈니스 로직
├── repositories/        # 로컬 파일/DB 접근
└── db/                  # SQLite 관련 코드
```

## 주요 라우트

| 경로                             | 설명                                                  |
| -------------------------------- | ----------------------------------------------------- |
| `/workroom`                      | 최근 작업한 워크스페이스·문서를 보여주는 대시보드     |
| `/manuscript`, `/manuscript/:id` | 워크스페이스(폴더) 탐색 또는 문서 작성/댓글 생성 화면 |
| `/setting`                       | AI 모델 설정, 댓글 스타일 예시 관리, 휴지통           |
| `/design-system`                 | 내부 UI 컴포넌트 확인용 페이지                        |
