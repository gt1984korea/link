# 암송 구절 기능 — 설정 가이드

`index.html` 의 "바로가기 설치" 위에 **이번 주 암송 구절** 카드가 추가되었고,
`admin.html` 에서 구절을 수정하면 모든 사용자에게 **실시간 반영**됩니다.

## 1. Firebase 프로젝트에서 Firestore 활성화

1. https://console.firebase.google.com → 프로젝트 `victorychurch-665a9` 선택
2. 좌측 메뉴 **Build → Firestore Database → 데이터베이스 만들기**
3. 위치: `asia-northeast3` (서울) 또는 `australia-southeast1` (시드니, 뉴질랜드와 가까움) 권장
4. 모드: **프로덕션 모드**로 시작

## 2. 웹 앱 등록 후 설정값 복사

1. 프로젝트 설정(⚙️) → **내 앱 → 웹 앱 추가**(`</>` 아이콘) — 이미 있으면 건너뜀
2. 앱 닉네임 입력(예: `vc-link`), Firebase Hosting 체크 가능
3. 표시되는 `firebaseConfig` 의 값을 복사해
   `firebase-config.js` 의 자리표시자(`REPLACE_ME_...`)에 붙여넣기:

   ```js
   export const firebaseConfig = {
     apiKey: "...",                       // ← 복사
     authDomain: "victorychurch-665a9.firebaseapp.com",
     projectId: "victorychurch-665a9",
     storageBucket: "victorychurch-665a9.appspot.com",
     messagingSenderId: "...",            // ← 복사
     appId: "..."                         // ← 복사
   };
   ```

   ⚠️ `apiKey` 는 공개되어도 안전합니다. 보안은 **Firestore 규칙**으로 합니다.

## 3. Firestore 보안 규칙 적용

`firestore.rules` 파일을 Firebase Console → **Firestore → 규칙** 탭에 붙여넣고 **게시**.

### 가장 간단한 운영 방식 (소규모)

`firestore.rules` 의 `allow write: if false;` 줄을 다음으로 바꿉니다:

```
allow write: if true;
```

이렇게 하면 admin.html 비밀번호 게이트만으로 운영되지만,
**URL을 아는 누구나 콘솔에서 쓸 수 있다**는 점을 인지해야 합니다.

### 권장: Firebase Authentication 추가

`firestore.rules` 의 주석 안내(옵션 2 또는 3)를 참고하세요.
필요하면 말씀해 주세요 — admin.html 에 로그인 폼을 추가해 드립니다.

## 4. 관리자 비밀번호 변경

`firebase-config.js` 의 `ADMIN_PASSCODE` 값을 원하는 값으로 변경하세요.
(이건 화면 보호용일 뿐 진짜 보안은 위 3번입니다.)

## 5. 배포

```bash
cd link
firebase deploy --only hosting
```

`firebase.json` 은 `public/` 디렉토리를 호스팅 루트로 사용합니다.
변경된 파일은 `index.html`, `admin.html`, `firebase-config.js` 모두
**루트와 `public/` 양쪽에** 있어야 합니다 (현재 자동 복사 완료).

> 향후 편의를 위해 빌드 스크립트로 자동 동기화하거나,
> `firebase.json` 의 `public` 을 `.` 로 바꾸는 것을 검토할 수 있습니다.

## 6. 사용

- 사용자 화면: `https://<도메인>/` — 카드 자동 표시
- 관리자: `https://<도메인>/admin` — 비밀번호 입력 후 편집

## 데이터 구조

Firestore 경로 `site/memoryVerse`:

| 필드        | 타입       | 설명               |
|-------------|------------|--------------------|
| `text`      | string     | 구절 본문          |
| `reference` | string     | 출처 (예: 요 3:16) |
| `updatedAt` | timestamp  | 서버 기준 수정 시각 |
