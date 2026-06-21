/* Cloud Function: 새 암송 구절 또는 새소식이 등록되면 웹 푸시 발송
 *
 * 트리거: /site/memoryVerse 문서가 수정될 때
 * 동작: verses 배열 또는 news 배열에 "새로운 id"가 추가되었으면, pushTokens에 저장된
 *       모든 기기로 데이터 메시지를 보냅니다. 각 기기의 서비스워커(firebase-messaging-sw.js)가
 *       알림을 띄우고 홈 아이콘 배지를 켭니다. 만료된 토큰은 자동 정리합니다.
 */
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
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

// 새소식을 고유 식별 (id 기준)
function newsKeyOf(n) {
  if (!n) return '';
  if (n.id) return String(n.id);
  return (n.startDate || '') + '|' + (n.imageUrl || '');
}

/* 모든 등록 기기에 동일한 푸시를 보내고 만료 토큰을 정리합니다. */
async function pushToAll(db, body, url) {
  const snap = await db.collection('pushTokens').get();
  const tokens = snap.docs.map((d) => d.get('token')).filter(Boolean);

  if (tokens.length === 0) {
    logger.info('등록된 토큰 없음 → 푸시 생략');
    return;
  }

  const messaging = getMessaging();
  const base = {
    data: { title: '빅토리처치', body, url: url || '/' },
    webpush: { headers: { Urgency: 'high' }, fcmOptions: { link: url || '/' } }
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
}

exports.notifyNewVerse = onDocumentUpdated('site/memoryVerse', async (event) => {
  const before = (event.data && event.data.before && event.data.before.data()) || {};
  const after  = (event.data && event.data.after  && event.data.after.data())  || {};

  // 1) 새 암송 구절 감지
  const beforeKeys = new Set(
    (Array.isArray(before.verses) ? before.verses : []).map(keyOf)
  );
  const afterVerses = Array.isArray(after.verses) ? after.verses : [];
  const newVerses = afterVerses.filter((v) => v && (v.text || '').trim() && !beforeKeys.has(keyOf(v)));

  // 2) 새소식 감지
  const beforeNewsKeys = new Set(
    (Array.isArray(before.news) ? before.news : []).map(newsKeyOf)
  );
  const afterNews = Array.isArray(after.news) ? after.news : [];
  const newNews = afterNews.filter((n) => n && n.imageUrl && !beforeNewsKeys.has(newsKeyOf(n)));

  if (newVerses.length === 0 && newNews.length === 0) {
    logger.info('새로 추가된 구절/새소식 없음 → 푸시 생략');
    return;
  }

  const db = getFirestore();

  // 새 구절 푸시
  if (newVerses.length > 0) {
    const latest = newVerses[newVerses.length - 1];
    const ref = (latest.reference || '').trim();
    const body = ref ? `${ref} — 새 암송 구절이 등록되었어요.` : '새 암송 구절이 등록되었어요.';
    await pushToAll(db, body, '/');
  }

  // 새소식 푸시
  if (newNews.length > 0) {
    await pushToAll(db, '교회에 새소식이 올라왔어요.', '/');
  }
});

/* 알림 구독 기기 수 집계 (admin 화면에서 호출)
 * pushTokens는 보안 규칙상 클라이언트가 목록 조회 불가 → Admin SDK로 집계해 숫자만 반환.
 * 호스팅 rewrite를 통해 /api/push-count 로 같은 출처에서 호출됩니다.
 */
exports.pushTokenCount = onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection('pushTokens').get();
    let ios = 0;
    let android = 0;
    let other = 0;
    snap.forEach((d) => {
      const p = (d.get('platform') || 'other');
      if (p === 'ios') ios += 1;
      else if (p === 'android') android += 1;
      else other += 1;
    });
    res.set('Cache-Control', 'no-store');
    res.json({ count: snap.size, ios, android, other });
  } catch (e) {
    logger.error('pushTokenCount 실패', e);
    res.status(500).json({ error: 'failed' });
  }
});
