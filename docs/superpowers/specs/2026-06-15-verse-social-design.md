# 이번 주 성경 구절 — 좋아요 · 공유 기능 설계

작성일: 2026-06-15

## 목적

참고 이미지(성경 앱 스타일 카드)처럼, `index.html`의 "이번 주 성경 구절" 카드에
SNS 형태의 인터랙션을 추가한다.

1. **좋아요** — 탭하면 토글, 카운트 표시
2. **공유** — 구절 + 링크 공유 (횟수 표시 없음, 버튼만)

> 댓글 기능은 범위에서 제외(사용자 결정).

## 결정 사항 (사용자 확정)

- 집계 단위: **구절별**(verse `id` 기준). 지난 구절도 각자 좋아요 수 유지.
- 좋아요: 로그인 없음. 기기당 1회(토글), 기기에 좋아요 여부 기억.
- 공유 횟수: **표시하지 않음** — 공유 버튼만 두고 카운트/증감 없음.
- 저장 방식: **별도 컬렉션(A안)** — 구절 단일 문서를 방문자 쓰기로부터 보호.

## 데이터 모델 (Firestore)

기존 구절 문서(`/site/memoryVerse`)는 그대로 두고, 좋아요 카운터 컬렉션만 추가한다.

### `/verseStats/{verseId}`

```
{
  likes: number    // increment(±1)
}
```

- `verseId`는 구절 배열 항목의 `id`.
- 문서가 없을 수 있으므로 `setDoc(..., { merge: true })` + `increment()`로 생성/증감.

## index.html (방문자 화면)

### UI
구절 카드(`#verseCard`)의 `읽어주기` 줄(`.tts-row`) 아래에 **액션 바**를 추가한다.

- ❤️ 좋아요 버튼 + 카운트
- 🔗 공유 버튼 (카운트 없음)

스타일은 기존 카드 톤(어두운 배경, 둥근 버튼)에 맞춘다.

### 동작
- 활성 구절 렌더링(`renderActive`) 시 현재 `verseId`를 보관하고,
  `onSnapshot(/verseStats/{verseId})`로 좋아요 수를 실시간 갱신.
  구절이 바뀌면 이전 구독을 해제(unsubscribe)하고 새로 구독.
- **좋아요**: 탭 시 `localStorage['vc_liked_<verseId>']` 확인 → 없으면 `likes` +1·플래그
  저장, 있으면 −1·플래그 제거(토글). 버튼은 좋아요 상태를 시각적으로 표시(채워진 하트).
- **공유**: `navigator.share({ title, text: 구절+출처, url: location.href })` 시도.
  미지원 시(주로 데스크톱) 링크를 클립보드 복사 + 토스트 안내. 공유 횟수는 집계하지 않음.

## admin.html

변경 없음(댓글 관리 기능이 없으므로). 좋아요 수는 관리자 개입이 필요 없다.

## firestore.rules

```
match /verseStats/{verseId} {
  allow read: if true;
  allow write: if true;            // 좋아요 increment 카운터용
}
```

### ⚠️ 보안 한계 (명시)
- 기존 정책(`/site/{docId}`의 `allow write: if true`)과 동일한 수준의 개방형 규칙이다.
- 좋아요 increment는 클라이언트 누구나 호출 가능(조작 가능). 소규모/신뢰 환경 전제.
- 추후 강화하려면 App Check 또는 Cloud Function 경유 증감으로 보호한다.

## 테스트

- 로컬: `firebase emulators:start --only hosting` (또는 `npx serve .`)로 미리보기.
- 확인 항목:
  1. 좋아요 탭 → 카운트 +1, 다시 탭 → −1 (새로고침해도 상태 유지)
  2. 모바일 공유 시트 동작 / 데스크톱 링크 복사 fallback
  3. 구절이 바뀌면 좋아요 수가 해당 구절 것으로 교체

## 파일 변경 범위 (루트 기준 — `public/`은 레거시이므로 제외)

- `index.html` — 액션 바 UI(좋아요·공유) + 좋아요 토글/공유 로직, verseStats 구독
- `firestore.rules` — verseStats 규칙 추가
