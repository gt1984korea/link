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

`firebase.json` 은 루트 디렉토리(`.`)를 호스팅 루트로 사용하므로 별도의 빌드/복사 과정 없이 루트의 파일들이 바로 배포됩니다. (기존 레거시 `public/` 폴더는 정리되어 삭제되었습니다.)


## 6. 사용

- 사용자 화면: `https://<도메인>/` — 카드 자동 표시
- 관리자: `https://<도메인>/admin` — 비밀번호 입력 후 편집

## 데이터 구조

Firestore 경로 `site/memoryVerse` (단일 문서 — 별도 컬렉션을 만들지 않으므로 보안 규칙 변경 불필요):

| 필드        | 타입       | 설명               |
|-------------|------------|--------------------|
| `verses`    | array      | 표시 기간이 지정된 구절 목록 (아래 항목 구조 참고) |
| `audioUrl`  | string     | (선택) 공유 녹음 파일 다운로드 URL — 있으면 읽어주기가 TTS 대신 재생 |
| `audioPath` | string     | (선택) Storage 경로 (`audio/memoryVerse`) — 삭제 시 사용 |
| `audioName` | string     | (선택) 원본 파일명 (admin 표시용) |
| `updatedAt` | timestamp  | 서버 기준 수정 시각 |

`verses` 배열의 각 항목:

| 필드        | 타입    | 설명               |
|-------------|---------|--------------------|
| `id`        | string  | 고유 id (`crypto.randomUUID()`) |
| `text`      | string  | 구절 본문          |
| `reference` | string  | 출처 (예: 요 3:16) |
| `voiceId`   | string  | TTS 목소리 ID      |
| `startDate` | string  | 표시 시작일 `YYYY-MM-DD` (로컬, 양 끝 포함) |
| `endDate`   | string  | 표시 종료일 `YYYY-MM-DD` |
| `createdAt` | number  | 생성 시각 `Date.now()` (배열 안에는 `serverTimestamp()` 사용 불가) |

**표시 규칙**: 메인 화면(`index.html`)은 오늘 날짜가 `startDate ~ endDate`(양 끝 포함) 안에 드는
구절을 "이번 주 암송 구절"로 표시합니다. 해당하는 구절이 없으면 카드를 숨깁니다(여러 개면 `startDate`
가장 최근 1개). 종료일이 지난 구절은 "지난 암송 구절" 버튼을 누르면 리스트(텍스트만)로 펼쳐 보입니다.
녹음 파일은 구절별이 아니라 **하나만 공유**하며 현재 활성 구절의 읽어주기에 적용됩니다.

> 하위호환: `verses` 배열이 없고 옛 최상위 `text` 필드만 있는 문서는 "항상 활성" 단일 구절로 취급됩니다.
> `admin.html` 을 열면 그 구절이 편집기에 자동으로 채워지며, 표시 기간을 확인하고 저장하면 `verses`
> 배열로 이전(migration)됩니다.

---

# 구절 음성 녹음 기능 — 설정 가이드

`admin.html` 에서 녹음 파일을 올리면 메인 화면 **읽어주기**가 자동 음성(TTS) 대신
그 녹음을 재생합니다(배경음악은 그대로 깔림). 삭제하면 다시 TTS로 돌아갑니다.

## 1. Firebase Storage 활성화

1. https://console.firebase.google.com → 프로젝트 `victorychurch-665a9` 선택
2. 좌측 메뉴 **Build → Storage → 시작하기**
3. 위치는 Firestore 와 같은 리전 권장(예: `australia-southeast1`)
4. 모드: **프로덕션 모드**로 시작

## 2. Storage 보안 규칙 적용

`storage.rules` 파일을 Firebase Console → **Storage → Rules** 탭에 붙여넣고 **게시**.
(기본은 `allow write: if true` — Firestore 와 동일하게 admin 비밀번호 게이트로만 보호.
진짜 보안이 필요하면 파일 주석의 Firebase Authentication 방식으로 교체하세요.)

> CLI 로도 배포 가능: `firebase deploy --only storage`

## 3. 사용

- 관리자(`/admin`) → "구절 음성 녹음" 카드 → 파일 선택 후 **업로드**
- 업로드 즉시 모든 사용자 화면의 읽어주기가 그 녹음을 재생
- "녹음 삭제(TTS로 복귀)" 버튼으로 언제든 자동 음성으로 되돌림

> 재생은 일반 오디오 엘리먼트로 직접 하므로 별도의 Storage CORS 설정은 필요 없습니다.
