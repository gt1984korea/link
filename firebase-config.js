// Firebase 설정 (victorychurch-665a9)
// ⚠️ 아래 값을 Firebase Console > 프로젝트 설정 > 내 앱(웹) 에서 복사해 채워주세요.
// apiKey 는 공개되어도 무방합니다(보안은 Firestore 보안 규칙으로).
export const firebaseConfig = {
  apiKey: "REPLACE_ME_API_KEY",
  authDomain: "victorychurch-665a9.firebaseapp.com",
  projectId: "victorychurch-665a9",
  storageBucket: "victorychurch-665a9.appspot.com",
  messagingSenderId: "REPLACE_ME_SENDER_ID",
  appId: "REPLACE_ME_APP_ID"
};

// 암송 구절 문서 경로: /site/memoryVerse
// 필드: text(string), reference(string), updatedAt(serverTimestamp)
export const VERSE_DOC_PATH = { collection: "site", id: "memoryVerse" };

// 관리자 비밀번호 (간단 게이트용 — 진짜 보안은 Firestore 규칙으로)
// 변경하려면 이 값을 바꾸세요.
export const ADMIN_PASSCODE = "victory2026";
