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
// ElevenLabs(1순위 엔진). 실패하거나 키가 없으면 위 Google Cloud TTS로 폴백합니다.
// 톤별 voice_settings: stability↓ = 억양 풍부, style↑ = 감정 과장. 들어보고 조정하세요.
const ELEVEN_MODEL = 'eleven_multilingual_v2';
const ELEVEN_SAMPLE_RATE = 24000;
const ELEVEN_SETTINGS = {
  calm:  { stability: 0.55, similarity_boost: 0.75, style: 0.15, speed: 0.92, use_speaker_boost: true },
  warm:  { stability: 0.42, similarity_boost: 0.75, style: 0.35, speed: 0.92, use_speaker_boost: true },
  clear: { stability: 0.65, similarity_boost: 0.75, style: 0.05, speed: 0.95, use_speaker_boost: true },
};
function failure(status, message) { return Object.assign(new Error(message), { status }); }
function resolveSpeech(document, verseId) {
  const verses = Array.isArray(document.verses) ? document.verses : [];
  const verse = verses.find(v => String(v.id) === verseId)
    || (verseId === 'legacy' && !verses.length ? document : null);
  if (!verse || typeof verse.text !== 'string' || !verse.text.trim()) {
    throw failure(404, '등록된 구절을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.');
  }
  const reference = typeof verse.reference === 'string' ? verse.reference.trim() : '';
  const description = typeof verse.description === 'string' ? verse.description.trim() : '';
  // 메인 화면 getFullText()와 같은 순서: 본문 → 출처 → 구절 설명
  const text = verse.text.trim() + (reference ? '\n\n' + reference : '')
    + (description ? '\n\n구절 설명:\n' + description : '');
  if (text.length > 1500) throw failure(400, '자동 낭독은 본문·출처·설명을 합쳐 1500자까지 지원합니다.');
  return { text, style: Object.hasOwn(VOICES, verse.ttsStyle) ? verse.ttsStyle : 'calm' };
}
function cacheKey(speech, eleven) {
  const parts = eleven
    ? ['elevenlabs-v1', speech.text, eleven.voiceId, ELEVEN_MODEL, ELEVEN_SETTINGS[speech.style]]
    : ['gcloud-tts-v1', speech.text, VOICES[speech.style], AUDIO_CONFIG];
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
// ElevenLabs pcm_24000(16-bit mono little-endian)에 WAV 헤더를 붙여 기존 WAV 파이프라인에 맞춥니다.
function pcmToWav(pcm, sampleRate = ELEVEN_SAMPLE_RATE) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii'); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36, 'ascii'); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
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
function createTtsHandler({ readDocument, readCache, writeCache, getAccessToken, getElevenConfig = async () => null, fetchImpl = fetch, log = () => {} }) {
  const pending = new Map();
  async function generateEleven(speech, eleven) {
    const key = cacheKey(speech, eleven);
    const cached = await readCache(key);
    if (cached && isWav(cached)) return cached;
    const upstream = await fetchImpl(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(eleven.voiceId)}?output_format=pcm_${ELEVEN_SAMPLE_RATE}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': eleven.apiKey },
      body: JSON.stringify({ text: speech.text, model_id: ELEVEN_MODEL, voice_settings: ELEVEN_SETTINGS[speech.style] }),
      signal: AbortSignal.timeout(45000), redirect: 'error',
    });
    if (!upstream.ok) throw failure(502, 'ElevenLabs 음성 생성 실패 (' + upstream.status + ')');
    const pcm = Buffer.from(await upstream.arrayBuffer());
    if (!pcm.length || pcm.length > MAX_AUDIO_BYTES) throw failure(502, 'ElevenLabs 음성 크기가 올바르지 않습니다.');
    const audio = pcmToWav(pcm);
    await writeCache(key, audio);
    return audio;
  }
  async function generate(speech, key) {
    let eleven = null;
    try { eleven = await getElevenConfig(); } catch (_) { eleven = null; }
    if (eleven && eleven.apiKey && eleven.voiceId) {
      try { return await generateEleven(speech, eleven); }
      catch (err) { log('ElevenLabs 실패, Google TTS로 폴백', { status: err.status, name: err.name }); }
    }
    return generateGoogle(speech, key);
  }
  async function generateGoogle(speech, key) {
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
module.exports = { VOICES, ELEVEN_SETTINGS, resolveSpeech, cacheKey, pcmToWav, createTtsHandler };
