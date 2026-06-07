// Firebase 설정 (victorychurch-665a9)
export const firebaseConfig = {
  apiKey: "AIzaSyDcz1pXcFf8a5vwjQSO7Xz4jU7F6lL_ZEs",
  authDomain: "victorychurch-665a9.firebaseapp.com",
  projectId: "victorychurch-665a9",
  storageBucket: "victorychurch-665a9.firebasestorage.app",
  messagingSenderId: "520614301251",
  appId: "1:520614301251:web:1d5394f050346f9c17cef6",
  measurementId: "G-5FHZJHRSQF"
};

// 암송 구절 문서 경로: /site/memoryVerse
// 필드: text(string), reference(string), updatedAt(serverTimestamp)
export const VERSE_DOC_PATH = { collection: "site", id: "memoryVerse" };

// 관리자 비밀번호 (간단 게이트용 — 진짜 보안은 Firestore 규칙으로)
// 변경하려면 이 값을 바꾸세요.
export const ADMIN_PASSCODE = "victory2026";
