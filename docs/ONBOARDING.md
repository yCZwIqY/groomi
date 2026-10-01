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

앱 UI가 바뀌면 기능 설명과 단계별 안내를 함께 검토하세요. 첫 화면의 에디터·댓글은
실제 스크린샷이나 모델의 생성 결과가 아닌 설명용 예시입니다.

SUIT 폰트 라이선스는 `assets/FONT-LICENSE`에 포함되어 있습니다.
