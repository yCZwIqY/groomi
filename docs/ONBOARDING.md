# Groomi 안내 페이지

HTML, CSS, 작은 복사 스크립트로 만든 정적 페이지입니다. 빌드와 npm 설치 없이 실행할 수 있습니다.

## 미리보기

프로젝트 루트에서 `python -m http.server 4173 --directory docs`를 실행하고
`http://localhost:4173`을 엽니다. `docs/index.html`을 직접 열어도 내용을 볼 수 있습니다.
명령어 복사는 HTTPS 또는 localhost에서 지원하며, 권한이 없으면 직접 복사할 수 있도록 선택됩니다.

## GitHub Pages

저장소의 Settings → Pages → Build and deployment에서 **Deploy from a branch**를 선택하고
**main / docs**를 지정합니다. 배포 후 예상 주소는 `https://yCZwIqY.github.io/groomi/`입니다.
설정과 배포가 완료되기 전에는 이 주소가 활성화되지 않습니다.

다운로드는 GitHub Releases의 `/latest`로 연결하므로 릴리즈마다 링크를 바꿀 필요가 없습니다.
리소스는 상대 경로를 사용해 `/groomi/` 경로와 로컬 미리보기에서 모두 동작합니다.

앱 UI가 바뀌면 기능 설명과 단계별 안내를 함께 검토하세요. 첫 화면과 기능 소개 아래의 이미지 영역은 실제 앱 캡처를 넣을 공간입니다.
집필 화면, 떡밥 관리, 댓글 목록에 실제 앱 캡처를 적용했습니다.

SUIT 폰트 라이선스는 `assets/FONT-LICENSE`에 포함되어 있습니다.

## 실제 앱 캡처 추가

기능 소개 아래 `#screenshots` 섹션에 3개 이미지 공간이 있습니다.
현재 실제 캡처는 `editor-screenshot.png`, `story-screenshot.png`, `comments-screenshot.png`입니다.
`assets/screenshot-placeholder.svg`는 향후 캡처가 없는 영역에 사용할 안내 이미지입니다.

1. 캡처 파일을 `docs/assets/`에 넣습니다. 예: `editor-screenshot.png`,
   `story-screenshot.png`, `comments-screenshot.png`.
2. `docs/index.html`의 `#screenshots` 안에서 해당 `img`의 `src`를 파일 경로로 바꿉니다.
3. `alt`를 실제 화면 설명으로 바꾸고, `width`와 `height`를 원본 이미지 크기로 지정합니다.
4. 섹션 안내 문구를 실제 화면을 소개하는 내용으로 바꿉니다.

첫 캡처는 넓은 공간, 나머지 두 캡처는 2열로 표시되며 모바일에서는 1열입니다.
이미지는 16:10 영역 안에 잘리지 않고 표시됩니다. 개인 원고와 경로를 확인한 후 공개하세요.

첫 화면의 `.hero-screenshot img`에도 대표 집필 화면 캡처를 넣어주세요.
그 아래 `figcaption`을 실제 화면 설명으로 변경하면 됩니다.
