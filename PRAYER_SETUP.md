# 중보기도(Prayer) 기능 셋업

교회 성도들이 **기도제목을 나누고 서로 "함께 기도해요" 로 응답**하는 기능입니다.
플레인 HTML/JS + Firestore 로 동작하며 별도 서버·빌드가 없습니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| `prayer.html` | 공개 기도 게시판 (`/prayer` 로 접속). 위로의 말씀, 요청 작성 모달, 공개 목록, "🙏 함께 기도" 카운터 |
| `index.html` | 메뉴에 **중보기도 바로가기** 버튼(`#btnPrayer` → `/prayer`) |
| `admin.html` | **🙏 중보기도** 탭 — 공개/비공개 전체 목록 확인 및 삭제(검열) |
| `firebase-config.js` | `PRAYER_COLLECTION = "prayers"`, `PRAYER_CONTENT_COLLECTION = "prayerContents"` |
| `firestore.rules` | `/prayers/{id}`, `/prayerContents/{id}` 규칙 |

## 데이터 모델

**`/prayers/{id}`** — 게시판의 단일 소스(제목·메타는 공개/비공개 모두 여기 있음):

```
{
  id:         string,                 // crypto.randomUUID()
  name:       string,                 // 작성자가 직접 기재(비우면 '익명'), 최대 40자
  title:      string,                 // 기도 제목, 1~100자 — 공개/비공개 모두 게시판 노출
  content:    string,                 // 내용, ≤1000자. 공개 글만 값이 있고, 비공개 글은 '' (빈 문자열)
  visibility: 'public' | 'private',   // 작성 시 선택
  prayCount:  number,                 // "함께 기도" 카운터 (increment)
  status:     'active' | 'hidden',    // 관리자 숨김용(현재는 삭제만 사용)
  createdAt:  serverTimestamp()
}
```

**`/prayerContents/{id}`** — 비공개 글의 **실제 내용**만 따로 저장(같은 `id` 사용):

```
{ text: string }   // ≤1000자. 게시판은 이 컬렉션을 절대 읽지 않음.
```

암송구절/새소식과 달리 **전용 컬렉션**을 씁니다(사용자 생성·개수 무제한이라 `/site/memoryVerse` 배열에 넣지 않음).

## 공개 / 비공개 동작

- **공개(public)**: 제목+내용이 `prayer.html` 게시판에 노출. 누구나 보고 "🙏 함께 기도" 카운터를 올릴 수 있음.
- **비공개(private)**: **제목은 게시판에 노출**(함께 기도 카운터도 동작)되지만, **내용은 숨김**.
  실제 내용은 `/prayerContents` 에 저장되고 `admin.html` 의 중보기도 탭에서 **중보기도팀(관리자)만** 확인.
  - `prayer.html` 은 `/prayers` 만 읽고 `/prayerContents` 는 **아예 읽지 않으므로**, 비공개 내용이 일반 방문자 브라우저로 전송되지 않습니다.

> ⚠️ **비공개의 한계 (반드시 이해)**: 현재 규칙은 `/prayerContents` `read: if true` 입니다.
> 게시판이 안 불러오므로 방문자에게 전송되진 않지만, 기술적으로 API 를 직접 호출하면 비공개 내용을 읽을 수 있습니다.
> 이는 이 앱의 기존 신뢰 모델(예: `verseStats` 개방형 쓰기)과 동일한 "소규모/신뢰 환경" 전제입니다.
> **완전한 비공개**가 필요하면 아래 "보안 강화" 를 적용하세요.

## Firestore 규칙 요약 (`firestore.rules`)

```
match /prayers/{id} {
  allow read:   if true;                 // 게시판은 제목·메타를 모두 읽음(비공개도 제목 노출)
  allow create: if isValidNewPrayer();   // 필드/길이 검증, 비공개는 content=='', prayCount==0
  allow update: if isPrayCountBump();    // 방문자는 prayCount +1 만 가능(제목/내용 수정 불가)
  allow delete: if true;                 // 관리자 검열용(암호 게이트) — 조작 가능, 신뢰 환경 전제
}
match /prayerContents/{id} {
  allow read:   if true;                 // admin.html 만 읽음(게시판은 안 읽음). 조작 가능, 신뢰 환경 전제
  allow create: if isValidPrayerContent();
  allow update: if false;                // 내용 사후 변조 금지
  allow delete: if true;                 // 관리자 삭제용
}
```

- **create(prayers)**: 키 화이트리스트, `title` 1~100자, `content` ≤1000자, 비공개 글은 `content==''`, `name` ≤40자, `visibility` ∈ {public, private}, `prayCount==0`, `status=='active'`, `createdAt==request.time`.
- **update(prayers)**: `prayCount` 필드만, 정확히 +1 만 허용 → 제목/내용/이름/공개여부 변조 차단, "함께 기도" 는 한 방향(내리기 불가). 기기당 1회는 `localStorage['vc_prayed_{id}']` 로 제한.

## 배포

Firestore 규칙은 **자동 배포(hosting) 대상이 아닙니다.** 수동으로:

```bash
firebase deploy --only firestore:rules
firebase deploy --only hosting        # prayer.html / index.html / admin.html
```

`prayer.html` 은 `cleanUrls: true` 로 `/prayer` 에서 열립니다. `firebase.json` 수정 불필요.

## 보안 강화 (선택 — 비공개를 진짜 비공개로)

관리자를 **Firebase Auth** 로 식별하면 비공개 글을 규칙 차원에서 보호할 수 있습니다.

1. Firebase Console → Authentication → **Email/Password** 활성화, `admin@victorychurch.nz` 계정 생성.
2. `admin.html` 에 `signInWithEmailAndPassword` 추가(현재는 `ADMIN_PASSCODE` 화면 게이트만 있음).
3. 규칙 교체:
   ```
   function isAdmin() {
     return request.auth != null && request.auth.token.email == 'admin@victorychurch.nz';
   }
   match /prayers/{id} {
     allow read:   if resource.data.visibility == 'public' || isAdmin();
     allow create: if isValidNewPrayer();
     allow update: if isPrayCountBump();
     allow delete: if isAdmin();
   }
   ```
   → 비공개 글은 관리자만 읽고 삭제 가능. (기존 `/site` 쓰기 규칙이 이미 이 관리자 이메일을 요구하므로 함께 정리됨.)
