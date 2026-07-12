ㅜ

# 뉴질랜드 빅토리처치 링크 허브 (Victory Church Link Hub)

Firestore에서 실시간으로 구절을 가져오는 이번 주 암송 구절, 교회 주요 링크 바로가기, 성경 구절 TTS 읽어주기(ElevenLabs/녹음 오디오), 배경 음악 재생, 그리고 홈 화면 바로가기(PWA) 기능을 제공하는 단일 페이지 웹 애플리케이션입니다.

이 프로젝트는 별도의 빌드 단계가 없으며, 순수 HTML, CSS, Vanilla JS로 작성되어 있습니다. Firebase SDK는 ESM CDN 방식을 통해 로드됩니다.

---

## 🚀 로컬 실행 방법 (Local Development)

빌드 프로세스가 없는 정적 웹사이트이므로, 정적 파일을 호스팅할 수 있는 도구를 통해 로컬에서 실행할 수 있습니다.

### 방법 1. `npx serve` 사용 (가장 간단한 방법)

Node.js가 설치되어 있다면 프로젝트 루트 디렉터리에서 아래 명령어를 실행합니다.

```bash
npx serve .
```

실행 후 터미널에 표시되는 로컬 주소(예: `http://localhost:3000`)로 브라우저에서 접속합니다.

### 방법 2. Firebase Emulator 사용 (추천)

Firebase 에뮬레이터를 사용하여 로컬에서 호스팅 환경을 시뮬레이션합니다.

```bash
firebase emulators:start --only hosting
```

콘솔에 표시되는 로컬 호스팅 URL(예: `http://localhost:5000`)로 접속합니다.

### 방법 3. 기타 정적 웹 서버 도구 사용

- **VS Code Live Server**: VS Code를 사용하는 경우 `index.html` 우클릭 -> **Open with Live Server**를 선택하여 실행할 수 있습니다.
- **Python**:
  ```bash
  python -m http.server 8000
  ```

  이후 브라우저에서 `http://localhost:8000`으로 접속합니다.

---

## 📦 배포 (Deployment)

- **수동 배포**: Firebase CLI가 설치되어 있고 로그인이 되어 있는 경우 아래 명령어로 호스팅에 수동 배포할 수 있습니다.
  ```bash
  firebase deploy --only hosting
  ```
- **자동 배포**: `main` 브랜치로 푸시(push)하거나 PR을 병합하면 GitHub Actions (`.github/workflows/deploy.yml`)에 의해 자동으로 Firebase Hosting 실서비스 채널로 배포됩니다.

---

## 📱 a2hs — 홈 화면 바로가기 안내 배너 (PWA Widget)

모바일(안드로이드/아이폰)에서 사이트 방문 시 상단에 **"홈 화면에 추가"** 안내 배너를 띄우는 위젯. 모든 모바일 브라우저(Chrome/Safari/Samsung 및 카카오·인스타 등 인앱) 대응.

### 사용법

사이트의 `</body>` 직전에 한 줄만 추가:

```html
<script src="a2hs.js" defer
  data-site-name="Victory Church"
  data-icon="/icon-192.png"></script>
```

### 옵션

| 속성                    | 기본값      | 설명                                     |
| ----------------------- | ----------- | ---------------------------------------- |
| `data-site-name`      | 페이지 제목 | 배너에 표시할 사이트 이름                |
| `data-icon`           | (없음)      | 배너 아이콘 이미지 경로                  |
| `data-dismiss-days`   | 7           | ×(닫기) 누르면 숨기는 일수              |
| `data-cooldown-hours` | 12          | 그냥 지나간 뒤 다시 뜨기까지 최소 시간   |
| `data-max-shows`      | 5           | 이 횟수만큼 떴는데도 안 누르면 그만 노출 |

### 동작

- PC / 이미 홈화면 실행중 / (안드로이드)이미 설치됨 / 숨김기간 → 표시 안 함
- Android Chrome/Edge/Samsung → 가능하면 진짜 설치, 아니면 메뉴 안내
- iOS Safari/Chrome → 공유 → 홈 화면에 추가 그림 안내
- 카카오/인스타/페북/라인/네이버 인앱 → 외부 브라우저 열기 안내

### 관련 파일

- `a2hs.js` — 핵심 위젯 (이것만 있으면 됨)
- `demo.html` — 테스트/적용 예시
- `manifest.webmanifest`, `sw.js`, `icon-*.png` — (선택) 안드로이드 진짜 설치용 PWA 구성
