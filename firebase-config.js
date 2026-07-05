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

// 중보기도 컬렉션 경로: /prayers/{id}
// 각 문서: { id, name, title, content, visibility('public'|'private'), prayCount, status('active'|'hidden'), createdAt }
//  - title(기도 제목): 공개/비공개 모두 게시판에 노출
//  - content(내용): 공개 글만 여기에 저장(게시판 노출). 비공개 글은 content=='' 이고 실제 내용은 아래 별도 컬렉션에.
export const PRAYER_COLLECTION = "prayers";

// 비공개 기도 "내용" 전용 컬렉션: /prayerContents/{id} = { text }
// 게시판(prayer.html)은 이 컬렉션을 아예 읽지 않음 → 비공개 내용이 방문자에게 전송되지 않음.
// admin.html(중보기도팀)만 읽어 확인(관례적 비공개 — 자세한 내용은 PRAYER_SETUP.md 참고).
export const PRAYER_CONTENT_COLLECTION = "prayerContents";

// 관리자 비밀번호 (간단 게이트용 — 진짜 보안은 Firestore 규칙으로)
// 변경하려면 이 값을 바꾸세요.
export const ADMIN_PASSCODE = "victory2026";
