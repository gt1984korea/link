/* Cloud Function: 새 암송 구절이 등록되면 웹 푸시 발송
 *
 * 트리거: /site/memoryVerse 문서가 수정될 때
 * 동작: verses 배열에 "새로운 id"가 추가되었으면, pushTokens에 저장된 모든 기기로
 *       데이터 메시지를 보냅니다. 각 기기의 서비스워커(firebase-messaging-sw.js)가
 *       알림을 띄우고 홈 아이콘 배지를 켭니다. 만료된 토큰은 자동 정리합니다.
 */
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

// 구절을 고유 식별 (클라이언트 verseKeyOf와 동일한 규칙)
function keyOf(v) {
  if (!v) return '';
  if (v.id) return String(v.id);
  return (v.startDate || '') + '|' + ((v.text || '').trim());
}

exports.notifyNewVerse = onDocumentUpdated('site/memoryVerse', async (event) => {
  const before = (event.data && event.data.before && event.data.before.data()) || {};
  const after  = (event.data && event.data.after  && event.data.after.data())  || {};

  const beforeKeys = new Set(
    (Array.isArray(before.verses) ? before.verses : []).map(keyOf)
  );
  const afterVerses = Array.isArray(after.verses) ? after.verses : [];
  const newOnes = afterVerses.filter((v) => v && (v.text || '').trim() && !beforeKeys.has(keyOf(v)));

  if (newOnes.length === 0) {
    logger.info('새로 추가된 구절 없음 → 푸시 생략');
    return;
  }

  const latest = newOnes[newOnes.length - 1];
  const ref = (latest.reference || '').trim();
  const body = ref ? `${ref} — 새 암송 구절이 등록되었어요.` : '새 암송 구절이 등록되었어요.';

  const db = getFirestore();
  const snap = await db.collection('pushTokens').get();
  const docs = snap.docs.filter((d) => d.get('token'));
  const tokens = docs.map((d) => d.get('token'));

  if (tokens.length === 0) {
    logger.info('등록된 토큰 없음 → 푸시 생략');
    return;
  }

  const messaging = getMessaging();
  const base = {
    data: { title: '빅토리처치', body, url: '/' },
    webpush: { headers: { Urgency: 'high' }, fcmOptions: { link: '/' } }
  };

  const CHUNK = 500; // sendEachForMulticast 1회 최대 500개
  const invalidTokens = [];

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const res = await messaging.sendEachForMulticast({ ...base, tokens: chunk });
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = (r.error && r.error.code) || '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        ) {
          invalidTokens.push(chunk[idx]);
        }
      }
    });
  }

  // 만료/무효 토큰 정리 (문서 ID = 토큰)
  await Promise.all(
    invalidTokens.map((t) => db.collection('pushTokens').doc(t).delete().catch(() => {}))
  );

  logger.info(`푸시 발송 완료. 대상=${tokens.length}, 무효정리=${invalidTokens.length}`);
});
