# 이번 주 성경 구절 — 좋아요 · 댓글 · 공유 기능 설계

작성일: 2026-06-15

## 목적

참고 이미지(성경 앱 스타일 카드)처럼, `index.html`의 "이번 주 성경 구절" 카드에
SNS 형태의 인터랙션을 추가한다.

1. **좋아요** — 탭하면 토글, 카운트 표시
2. **댓글** — 이름 + 내용 작성, 최신순 목록, 관리자 삭제
3. **공유** — 구절 + 링크 공유 (횟수 표시 없음, 버튼만)

## 결정 사항 (사용자 확정)

- 집계 단위: **구절별**(verse `id` 기준). 지난 구절도 각자 카운트/댓글 유지.
- 댓글 작성자: **이름 직접 입력**(로그인 없음). 기기에 이름 기억.
- 댓글 관리: **관리자 삭제** — 댓글은 바로 노출, `admin.html`에서 삭제 가능.
- 저장 방식: **별도 컬렉션 분리(A안)** — 구절 단일 문서를 방문자 쓰기로부터 보호.
- 공유 횟수: **표시하지 않음** — 공유 버튼만 두고 카운트/증감 없음.

## 데이터 모델 (Firestore)

기존 구절 문서(`/site/memoryVerse`)는 그대로 두고, 새 컬렉션 2개를 추가한다.

### `/verseStats/{verseId}`
좋아요 카운터.

```
{
  likes:  number    // increment(±1)
}
```

- `verseId`는 구절 배열 항목의 `id`.
- 문서가 없을 수 있으므로 `setDoc(..., { merge: true })` + `increment()`로 생성/증감.

### `/verseComments/{autoId}`
댓글은 별도 컬렉션에 문서 하나당 한 댓글.

```
{
  verseId:   string,   // 어느 구절의 댓글인지
  name:      string,   // 작성자 이름 (최대 50자)
  text:      string,   // 댓글 내용 (최대 1000자)
  createdAt: serverTimestamp()
}
```

- `where('verseId','==', id)` + `orderBy('createdAt','desc')`로 구절별 최신순 조회.
- (인덱스: `verseId` ASC + `createdAt` DESC 복합 인덱스가 필요할 수 있음 — 배포 후
  콘솔 안내 링크로 생성하거나 `firestore.indexes.json`에 추가.)

## index.html (방문자 화면)

### UI
구절 카드(`#verseCard`)의 `읽어주기` 줄(`.tts-row`) 아래에 **액션 바**를 추가한다.

- ❤️ 좋아요 버튼 + 카운트
- 💬 댓글 버튼 + 카운트 (누르면 댓글 패널 토글)
- 🔗 공유 버튼 (카운트 없음)
- 댓글 패널: 이름 입력 + 내용 입력 + 등록 버튼, 그 아래 댓글 목록(최신순)

스타일은 기존 카드 톤(어두운 배경, 둥근 버튼)에 맞춘다.

### 동작
- 활성 구절 렌더링(`renderActive`) 시 현재 `verseId`를 보관하고,
  - `onSnapshot(/verseStats/{verseId})` → 좋아요 수 갱신
  - `onSnapshot(verseComments where verseId==id orderBy createdAt desc)` → 댓글 목록 + 수
  - 구절이 바뀌면 이전 구독을 해제(unsubscribe)하고 새로 구독.
- **좋아요**: 탭 시 `localStorage['vc_liked_<verseId>']` 확인 → 없으면 `likes` +1·플래그
  저장, 있으면 −1·플래그 제거(토글). 버튼은 좋아요 상태를 시각적으로 표시(채워진 하트).
- **댓글**: 이름·내용 입력 후 `addDoc`. 이름은 `localStorage['vc_commenter_name']`에
  저장해 다음 방문 시 자동 입력. 빈 내용은 막고, 길이 제한(이름 50·내용 1000) 클라이언트
  검증. 등록 후 입력창 비움(목록은 onSnapshot으로 자동 반영).
- **공유**: `navigator.share({ title, text: 구절+출처, url: location.href })` 시도.
  미지원 시(주로 데스크톱) 링크를 클립보드 복사 + 토스트 안내. 공유 횟수는 집계하지 않음.

## admin.html (관리자)

- 구절 목록 각 항목 아래(또는 별도 영역)에 해당 구절의 **댓글 목록**을 표시.
- 각 댓글에 **삭제** 버튼 → `deleteDoc(/verseComments/{id})`.
- 기존 passcode 게이트 안에서 동작(화면 보호용).

## firestore.rules

```
match /verseStats/{verseId} {
  allow read: if true;
  allow write: if true;            // increment 카운터용
}

match /verseComments/{commentId} {
  allow read: if true;
  allow create: if request.resource.data.text is string
                && request.resource.data.text.size() <= 1000
                && request.resource.data.name is string
                && request.resource.data.name.size() <= 50;
  allow update: if false;
  allow delete: if true;           // 관리자 화면 삭제(아래 보안 한계 참고)
}
```

### ⚠️ 보안 한계 (명시)
- 기존 정책(`/site/{docId}`의 `allow write: if true`)과 동일한 수준의 개방형 규칙이다.
- `admin.html`의 passcode는 **화면 보호용**일 뿐 보안이 아니므로, 댓글 삭제도 기술적으로는
  클라이언트 누구나 가능하다.
- 소규모/신뢰 환경 전제. 추후 강화하려면 Firebase Auth(관리자 계정)로 `delete`/`write`를
  제한하고, 좋아요/공유 increment는 Cloud Function 또는 App Check로 보호한다.

## 테스트

- 로컬: `firebase emulators:start --only hosting` (또는 `npx serve .`)로 미리보기.
- 확인 항목:
  1. 좋아요 탭 → 카운트 +1, 다시 탭 → −1 (새로고침해도 상태 유지)
  2. 댓글 등록 → 목록 즉시 반영, 이름 자동 기억
  3. admin.html에서 댓글 삭제 → 방문자 화면에서 사라짐
  4. 모바일 공유 시트 동작 / 데스크톱 링크 복사 fallback
  5. 구절이 바뀌면 카운트·댓글이 해당 구절 것으로 교체

## 파일 변경 범위 (루트 기준 — `public/`은 레거시이므로 제외)

- `index.html` — 액션 바 UI + 좋아요/댓글/공유 로직, verseStats/verseComments 구독
- `admin.html` — 구절별 댓글 목록 + 삭제
- `firestore.rules` — verseStats / verseComments 규칙 추가
- (선택) `firestore.indexes.json` — verseComments 복합 인덱스
