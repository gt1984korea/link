# Code Review Report — 메인 화면 (2026-07-20)

## Summary
- Files reviewed: 8 (index.html, push.js, firebase-config.js, sw.js, firebase-messaging-sw.js, a2hs.js, firebase.json, firestore.rules)
- Issues found: 9 (Critical: 1, Major: 4, Minor: 4)
- Score: 78/100

## Critical Issues

1. **[index.html:3719] ElevenLabs API 키가 클라이언트에 하드코딩되어 노출됨** — 신뢰도 High
   페이지 소스에서 누구나 `XI_KEY`를 추출해 자기 용도로 사용할 수 있어 과금/쿼터 도용 위험이 있다.
   Firestore 규칙 같은 서버 측 보호 장치가 전혀 없는 순수 시크릿이다.
   **Suggestion**: 기존 `pushTokenCount` 패턴처럼 Cloud Function(`onRequest`) + hosting rewrite로
   TTS 프록시 엔드포인트를 만들고 키는 함수 환경변수로 이동. 노출된 키는 즉시 회전(재발급).

## Major Issues

1. **[index.html:2529] NEW 배지 기능 전체가 무동작 (요소 누락)** — 신뢰도 High
   `getElementById('verseNewBadge')`가 참조하는 요소가 HTML에 존재하지 않는다.
   CSS(`.verse .new-badge`, 305행)와 로직(`updateNewBadge`, 2707행)은 있으나 배지가 절대 표시되지 않고,
   `if (!newBadge) return` 가드 때문에 에러 없이 조용히 실패한다.
   **Suggestion**: 구절 카드 `.label-left` 안에 `<span class="new-badge hidden" id="verseNewBadge">NEW</span>` 추가.

2. **[index.html:3379-3386] 데스크톱에서 이미지 공유 모달에 액션 버튼이 하나도 없음** — 신뢰도 High
   액션 영역에 "공유하기"(`imgShareBtn`) 버튼 하나뿐인데(2135행), `navigator.canShare` 파일 공유
   미지원 환경(PC 크롬/엣지 등)에서는 이 버튼을 숨기기만 한다. CLAUDE.md에 문서화된 의도
   ("공유 미지원 시 저장(다운로드) 버튼 노출")와 달리 저장 버튼이 코드에 없어, 데스크톱 사용자는
   만든 이미지를 저장할 방법이 없다.
   **Suggestion**: "저장" 버튼 추가 — `canvas.toBlob` → `URL.createObjectURL` → `<a download>` 클릭.

3. **[push.js:137 / firebase-messaging-sw.js / CLAUDE.md] 서비스워커 이중화 + 문서-코드 불일치** — 신뢰도 High
   push.js가 메시징 SW로 `sw.js`를 등록하는데, 파일 상단 주석(126-132행)과 CLAUDE.md는
   `firebase-messaging-sw.js`를 등록한다고 설명한다. 실제로 `firebase-messaging-sw.js`는 어디서도
   등록되지 않는 죽은 파일이며, push 핸들러가 sw.js에 중복 존재한다. 또한 CLAUDE.md는 sw.js를
   "no-op(캐싱 없음)"이라 하지만 실제로는 프리캐시 + stale-while-revalidate 캐싱 SW(v9)다.
   지금은 동작하지만, 다음에 푸시 표시 로직을 firebase-messaging-sw.js에서만 고치면 반영되지 않는 함정이다.
   **Suggestion**: firebase-messaging-sw.js 삭제(또는 sw.js로 단일화 명시), CLAUDE.md·주석 갱신.

4. **[index.html:4017] 녹음 재생 실패 시 무한 재시도 루프** — 신뢰도 High
   `curAudio.onerror = advance` 구조상 등록된 녹음 URL이 전부 실패하면(만료된 Storage 토큰,
   삭제된 파일 등) 사용자가 멈추기를 누를 때까지 약 3초 간격으로 영원히 재요청한다.
   **Suggestion**: 연속 실패 카운터를 두고 전체 URL이 1회전 모두 실패하면 `stopTTS()` + 토스트 안내.

## Minor Issues

1. **[index.html:1762,1795,1817] `aria-expanded="false"`가 갱신되지 않음** — 채널 버튼이 아코디언에서
   "미리보기 상시 노출 + 클릭 시 외부 링크" 방식으로 바뀌었는데 속성이 남아 스크린리더에 잘못된
   상태를 알린다. → 속성 제거 권장.
2. **[sw.js:4 vs index.html:20-23] 프리캐시 아이콘 버전 불일치** — SW는 `icon-192.png?v=7`을
   프리캐시하지만 페이지는 `?v=4`를 참조해 프리캐시가 적중하지 않는다(대역폭 낭비).
3. **[sw.js:42-52] 같은 출처 JS의 stale-while-revalidate** — `firebase-config.js?v=2` 등은 쿼리
   버전을 올리지 않고 내용만 바꾸면 배포 후 첫 방문에서 구버전이 서빙된다(운영 시 주의).
4. **[index.html:1659-1682, 3579-3595] 구절 캐시 렌더 로직 중복** — 인라인 스크립트와 모듈에서
   같은 verseCache 복원을 두 번 수행. 동작 문제는 없으나 수정 시 두 곳을 함께 고쳐야 한다.

## Recommendations
- ElevenLabs 키 회전 및 Cloud Function 프록시 이전을 최우선으로 처리
- NEW 배지 요소·저장 버튼 추가는 소규모 수정으로 즉시 가능
- CLAUDE.md의 서비스워커 관련 서술(no-op sw.js, firebase-messaging-sw.js 등록)을 현재 코드에 맞게 갱신
- 잘 된 부분: 날짜 기반 구절 분류, 좋아요 낙관적 UI+롤백, 세션 ID 기반 TTS 중복 재생 방지,
  뉴스 DOM diff(이미지 재다운로드 방지), Firestore 규칙의 필드 단위 검증(prayers)은 견고하게 설계됨
