// 방문/클릭 자체 통계 모듈 — Firestore /stats/{YYYY-MM-DD} 문서에 일자별로 카운트.
// GA(파이어베이스 애널리틱스)와 별개로, admin.html 통계 탭이 기간별 조회에 사용한다.
// 문서 구조: { clicks: { btnLive: n, ... }, views: { home: n, prayer: n }, updatedAt }
import { doc, setDoc, increment, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const STATS_COLLECTION = "stats";

// 로컬 날짜 기준 "오늘" 키 (방문자 기기 기준)
export function statsDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function bump(db, field, key) {
  if (!db || !key) return;
  try {
    const ref = doc(db, STATS_COLLECTION, statsDayKey());
    setDoc(ref, { [field]: { [key]: increment(1) }, updatedAt: serverTimestamp() }, { merge: true })
      .catch((e) => console.warn("[stats] write failed", e));
  } catch (e) {
    console.warn("[stats] bump failed", e);
  }
}

// 버튼 클릭 1회 집계
export function trackClick(db, buttonId) { bump(db, "clicks", buttonId); }

// 화면(페이지) 방문 1회 집계
export function trackView(db, page) { bump(db, "views", page); }
