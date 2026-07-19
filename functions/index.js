/* Cloud Function: 새 암송 구절 또는 새소식이 등록되면 웹 푸시 발송
 *
 * 트리거: /site/memoryVerse 문서가 수정될 때
 * 동작: verses 배열 또는 news 배열에 "새로운 id"가 추가되었으면, pushTokens에 저장된
 *       모든 기기로 데이터 메시지를 보냅니다. 각 기기의 서비스워커(sw.js)가
 *       알림을 띄우고 홈 아이콘 배지를 켭니다. 만료된 토큰은 자동 정리합니다.
 */
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const nodemailer = require('nodemailer');

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

/* ElevenLabs TTS 프록시 (index.html "읽어주기"에서 /api/tts 로 호출)
 * API 키를 클라이언트에 노출하지 않기 위해 서버에서 대신 호출합니다.
 * 키 등록(1회): firebase functions:secrets:set ELEVENLABS_KEY
 * 호스팅 rewrite: /api/tts → ttsProxy (firebase.json)
 */
const ELEVENLABS_KEY = defineSecret('ELEVENLABS_KEY');

exports.ttsProxy = onRequest(
  { cors: true, region: 'us-central1', secrets: [ELEVENLABS_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method not allowed' });
      return;
    }
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : '';
    // 남용 방지: 구절 낭독 용도에 맞는 길이/형식만 허용
    if (!text || text.length > 1200) {
      res.status(400).json({ error: 'invalid text' });
      return;
    }
    if (!/^[A-Za-z0-9]{8,64}$/.test(voiceId)) {
      res.status(400).json({ error: 'invalid voiceId' });
      return;
    }
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_KEY.value()
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.78,          // 안정성 높임 (중후하고 신뢰감 있는 억양 유지)
            similarity_boost: 0.85,   // 선명도 높임
            style: 0.0,               // 감정 기복을 최소화하여 정중하고 경건하게 낭독
            use_speaker_boost: true   // 기본 음질 강화 활성화
          }
        })
      });
      if (!r.ok) {
        logger.warn(`ttsProxy 업스트림 오류: ${r.status}`);
        res.status(502).json({ error: 'upstream ' + r.status });
        return;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'no-store');
      res.send(buf);
    } catch (e) {
      logger.error('ttsProxy 실패', e);
      res.status(500).json({ error: 'failed' });
    }
  }
);

/* 중보기도 등록 시 이메일 알림 발송 */
exports.sendPrayerEmail = onDocumentCreated('prayers/{id}', async (event) => {
  const snap = event.data;
  if (!snap) {
    logger.info('데이터 스냅샷 없음');
    return;
  }
  const data = snap.data();
  const id = event.params.id;

  logger.info(`새 중보기도 요청 감지: ${id}`, data);

  const db = getFirestore();
  
  // 1. Firestore에서 SMTP 설정 조회 (보안 상 클라이언트 조회 차단된 systemConfig/email)
  let smtpConfig;
  try {
    const configSnap = await db.collection('systemConfig').doc('email').get();
    if (configSnap.exists) {
      smtpConfig = configSnap.data();
    }
  } catch (err) {
    logger.error('systemConfig/email 조회 실패', err);
  }

  if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
    logger.warn('SMTP 설정이 Firestore(systemConfig/email)에 존재하지 않거나 불완전하여 이메일을 발송할 수 없습니다.');
    return;
  }

  // 2. 비공개 기도제목인 경우, prayerContents/{id} 에서 실제 기도내용 조회
  let content = data.content || '';
  if (data.visibility === 'private') {
    try {
      const contentSnap = await db.collection('prayerContents').doc(id).get();
      if (contentSnap.exists) {
        content = contentSnap.data().text || '';
      }
    } catch (err) {
      logger.error(`비공개 기도내용 조회 실패 (ID: ${id})`, err);
    }
  }

  // 3. SMTP 트랜스포터 설정
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host || 'smtp.naver.com',
    port: smtpConfig.port || 465,
    secure: smtpConfig.secure !== false, // 기본값: true (SSL)
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    }
  });

  const name = data.name || '익명';
  const title = data.title || '(제목 없음)';
  const visibilityText = data.visibility === 'private' ? '비공개' : '공개';
  
  // 뉴질랜드 시간대 기준으로 일시 문자열 생성
  const createdAtStr = data.createdAt 
    ? new Date(data.createdAt.toDate()).toLocaleString('ko-KR', { timeZone: 'Pacific/Auckland' }) 
    : new Date().toLocaleString('ko-KR', { timeZone: 'Pacific/Auckland' });

  // 4. 이메일 본문 작성
  const mailSubject = `[중보기도 요청] ${name} 성도님의 기도제목이 등록되었습니다.`;
  const mailText = `
[새 중보기도 등록 안내]

- 작성자: ${name}
- 등록 일시: ${createdAtStr} (뉴질랜드 시간)
- 공개 여부: ${visibilityText}
- 기도 제목: ${title}

[기도 내용]
${content || '(내용이 없습니다)'}
  `;

  const mailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9eaee; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #16265c; border-bottom: 2px solid #21428d; padding-bottom: 10px; margin-top: 0;">🙏 새 중보기도 등록 안내</h2>
      <p style="font-size: 15px; color: #333333; line-height: 1.6;">새로운 중보기도 제목이 등록되었습니다. 함께 기도해주세요.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <tr style="border-bottom: 1px solid #e9eaee;">
          <th style="text-align: left; padding: 10px 0; width: 120px; color: #666666;">작성자</th>
          <td style="padding: 10px 0; font-weight: bold; color: #1e293b;">${name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e9eaee;">
          <th style="text-align: left; padding: 10px 0; color: #666666;">등록 일시</th>
          <td style="padding: 10px 0; color: #1e293b;">${createdAtStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e9eaee;">
          <th style="text-align: left; padding: 10px 0; color: #666666;">공개 여부</th>
          <td style="padding: 10px 0; color: #1e293b;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; ${data.visibility === 'private' ? 'background-color: #fee2e2; color: #991b1b;' : 'background-color: #dcfce7; color: #166534;'}">
              ${visibilityText}
            </span>
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #e9eaee;">
          <th style="text-align: left; padding: 10px 0; color: #666666;">기도 제목</th>
          <td style="padding: 10px 0; font-weight: bold; color: #16265c; font-size: 15px;">${title}</td>
        </tr>
      </table>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #21428d; padding: 15px; border-radius: 4px; margin-top: 20px;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #475569;">기도 내용</h4>
        <p style="margin: 0; font-size: 14.5px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${content || '(내용이 없습니다)'}</p>
      </div>
      
      <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e9eaee; padding-top: 15px;">
        본 메일은 빅토리처치 중보기도 시스템에서 자동으로 발송되었습니다.
      </div>
    </div>
  `;

  // 수신자 지정 (기본값 설정 및 Firestore 설정 덮어쓰기 지원)
  const defaultTo = 'nzvictorychurch@hotmail.com, gt1984@naver.com';
  const finalTo = smtpConfig.to ? smtpConfig.to : defaultTo;

  try {
    const info = await transporter.sendMail({
      from: `"${smtpConfig.senderName || '빅토리처치 중보기도'}" <${smtpConfig.user}>`,
      to: finalTo,
      subject: mailSubject,
      text: mailText,
      html: mailHtml
    });
    logger.info(`이메일 발송 성공: ${info.messageId} -> 수신자: ${finalTo}`);
  } catch (err) {
    logger.error('이메일 SMTP 발송 오류', err);
  }
});
