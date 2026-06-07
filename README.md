# a2hs — 홈 화면 바로가기 안내 배너

모바일(안드로이드/아이폰)에서 사이트 방문 시 상단에 **"홈 화면에 추가"** 안내 배너를 띄우는 위젯. 모든 모바일 브라우저(Chrome/Safari/Samsung 및 카카오·인스타 등 인앱) 대응.

## 사용법

사이트의 `</body>` 직전에 한 줄만 추가:

```html
<script src="a2hs.js" defer
  data-site-name="Victory Church"
  data-icon="/icon-192.png"></script>
```

## 옵션

| 속성 | 기본값 | 설명 |
|------|--------|------|
| `data-site-name` | 페이지 제목 | 배너에 표시할 사이트 이름 |
| `data-icon` | (없음) | 배너 아이콘 이미지 경로 |
| `data-dismiss-days` | 7 | ×(닫기) 누르면 숨기는 일수 |
| `data-cooldown-hours` | 12 | 그냥 지나간 뒤 다시 뜨기까지 최소 시간 |
| `data-max-shows` | 5 | 이 횟수만큼 떴는데도 안 누르면 그만 노출 |

## 동작

- PC / 이미 홈화면 실행중 / (안드로이드)이미 설치됨 / 숨김기간 → 표시 안 함
- Android Chrome/Edge/Samsung → 가능하면 진짜 설치, 아니면 메뉴 안내
- iOS Safari/Chrome → 공유 → 홈 화면에 추가 그림 안내
- 카카오/인스타/페북/라인/네이버 인앱 → 외부 브라우저 열기 안내

## 파일

- `a2hs.js` — 핵심 위젯 (이것만 있으면 됨)
- `demo.html` — 테스트/적용 예시
- `manifest.webmanifest`, `sw.js`, `icon-*.png` — (선택) 안드로이드 진짜 설치용 PWA 구성
