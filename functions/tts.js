'use strict';
const { createHash } = require('node:crypto');
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
// Google Cloud TTS 한국어 남성 음성(Chirp3-HD). 어느 기기에서 들어도 같은 남성 목소리입니다.
const VOICES = {
  calm: 'ko-KR-Chirp3-HD-Charon',
  warm: 'ko-KR-Chirp3-HD-Algieba',
  clear: 'ko-KR-Chirp3-HD-Alnilam',
};
const AUDIO_CONFIG = { audioEncoding: 'LINEAR16', speakingRate: 0.9 };
function failure(status, message) { return Object.assign(new Error(message), { status }); }
function resolveSpeech(document, verseId) {
  const verses = Array.isArray(document.verses) ? document.verses : [];
  const verse = verses.find(v => String(v.id) === verseId)
    || (verseId === 'legacy' && !verses.length ? document : null);
  if (!verse || typeof verse.text !== 'string' || !verse.text.trim()) {
    throw failure(404, '등록된 구절을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.');
  }
  const reference = typeof verse.reference === 'string' ? verse.reference.trim() : '';
  const text = verse.text.trim() + (reference ? '\n\n' + reference : '');
  if (text.length > 1200) throw failure(400, '자동 낭독은 본문과 출처를 합쳐 1200자까지 지원합니다.');
  return { text, style: Object.hasOwn(VOICES, verse.ttsStyle) ? verse.ttsStyle : 'calm' };
}
function cacheKey(speech) {
  return createHash('sha256').update(JSON.stringify(['gcloud-tts-v1', speech.text, VOICES[speech.style], AUDIO_CONFIG])).digest('hex');
}
function isWav(buffer) {
  return buffer.length >= 44 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
}
async function readAudio(response) {
  const body = await response.json().catch(() => ({}));
  const audio = typeof body.audioContent === 'string' ? Buffer.from(body.audioContent, 'base64') : Buffer.alloc(0);
  if (audio.length > MAX_AUDIO_BYTES) throw failure(502, '생성된 음성이 너무 큽니다. 구절을 짧게 나눠 주세요.');
  if (!isWav(audio)) throw failure(502, '음성 파일을 확인할 수 없습니다. 다시 시도하세요.');
  return audio;
}
function createTtsHandler({ readDocument, readCache, writeCache, getAccessToken, fetchImpl = fetch, log = () => {} }) {
  const pending = new Map();
  async function generate(speech, key) {
    const cached = await readCache(key);
    if (cached && isWav(cached)) return cached;
    let token;
    try { token = await getAccessToken(); } catch (_) { token = null; }
    if (!token) throw failure(503, '자동 낭독 서버 인증에 실패했습니다. 관리자에게 문의하세요.');
    const upstream = await fetchImpl(TTS_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        input: { text: speech.text },
        voice: { languageCode: 'ko-KR', name: VOICES[speech.style] },
        audioConfig: AUDIO_CONFIG,
      }),
      signal: AbortSignal.timeout(45000), redirect: 'error',
    });
    if (upstream.status === 429 || upstream.status === 503) {
      throw failure(429, '음성 생성 서버가 사용 중입니다. 잠시 후 다시 시도하세요.');
    }
    if (!upstream.ok) {
      log('Cloud TTS 오류', { status: upstream.status });
      throw failure(502, '음성 생성에 실패했습니다. 잠시 후 다시 시도하세요.');
    }
    const audio = await readAudio(upstream);
    await writeCache(key, audio);
    return audio;
  }
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.set('Allow', 'POST'); return res.status(405).json({ error: 'POST 요청만 지원합니다.' }); }
    const verseId = req.body && req.body.verseId;
    if (typeof verseId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(verseId)) {
      return res.status(400).json({ error: '저장된 구절을 선택해 주세요.' });
    }
    try {
      const speech = resolveSpeech(await readDocument(), verseId);
      const key = cacheKey(speech);
      let task = pending.get(key);
      if (!task) {
        task = generate(speech, key).finally(() => pending.delete(key));
        pending.set(key, task);
      }
      const audio = await task;
      res.set('Content-Type', 'audio/wav');
      return res.status(200).send(audio);
    } catch (err) {
      const timeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      const status = timeout ? 504 : (err.status || 500);
      log('ttsProxy 실패', { status, name: err.name });
      return res.status(status).json({ error: timeout
        ? '음성 생성 시간이 길어지고 있습니다. 잠시 후 다시 시도하세요.'
        : (err.status ? err.message : '음성을 준비하지 못했습니다. 잠시 후 다시 시도하세요.') });
    }
  };
}
module.exports = { VOICES, resolveSpeech, cacheKey, createTtsHandler };
