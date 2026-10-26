const { test } = require('node:test');
const assert = require('node:assert/strict');
const { VOICES, resolveSpeech, cacheKey, createTtsHandler } = require('../functions/tts.js');
const data = { verses: [{ id: 'verse1', text: '하나님은 사랑이시라.', reference: '요한일서 4:8', ttsStyle: 'calm', audioMode: 'voxcpm2' }] };
const wav = Buffer.alloc(48); wav.write('RIFF'); wav.write('WAVE', 8);
const ttsResponse = audio => new Response(JSON.stringify({ audioContent: audio.toString('base64') }), { headers: { 'Content-Type': 'application/json' } });
function response() {
  return { statusCode: 200, headers: {}, status(n) { this.statusCode = n; return this; }, set(k,v) { this.headers[k] = v; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
}
function setup(overrides = {}) {
  const cache = new Map(); let calls = 0;
  const handler = createTtsHandler({
    readDocument: async () => data,
    readCache: async key => cache.get(key),
    writeCache: async (key, value) => cache.set(key, value),
    getAccessToken: async () => 'server-secret',
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, 'https://texttospeech.googleapis.com/v1/text:synthesize');
      const payload = JSON.parse(options.body);
      assert.equal(payload.input.text, '하나님은 사랑이시라.\n\n요한일서 4:8');
      assert.deepEqual(payload.voice, { languageCode: 'ko-KR', name: VOICES.calm });
      assert.equal(payload.audioConfig.audioEncoding, 'LINEAR16');
      assert.equal(options.headers.Authorization, 'Bearer server-secret');
      return ttsResponse(wav);
    },
    log: () => {}, ...overrides,
  });
  return { handler, calls: () => calls };
}
test('등록한 구절만 낭독하고 본문/스타일 변경 시 캐시를 분리한다', () => {
  const speech = resolveSpeech(data, 'verse1');
  assert.equal(speech.text, '하나님은 사랑이시라.\n\n요한일서 4:8');
  assert.throws(() => resolveSpeech(data, 'missing'), /등록/);
  assert.throws(() => resolveSpeech({ verses: [{ id: 'v', text: '가'.repeat(1201) }] }, 'v'), /1200/);
  assert.notEqual(cacheKey(speech), cacheKey({ ...speech, style: 'warm' }));
  assert.notEqual(cacheKey(speech), cacheKey({ ...speech, text: '다른 구절' }));
  assert.equal(resolveSpeech({ text: '옛 구절' }, 'legacy').text, '옛 구절');
});
test('동일 구절의 동시 요청과 반복 요청은 음성을 한 번만 생성한다', async () => {
  const { handler, calls } = setup();
  const responses = [response(), response()];
  await Promise.all(responses.map(res => handler({ method: 'POST', body: { verseId: 'verse1', text: '무시할 입력' } }, res)));
  assert.equal(calls(), 1);
  assert.deepEqual(responses[0].body, wav);
  assert.equal(responses[1].headers['Content-Type'], 'audio/wav');
  const third = response(); await handler({ method: 'POST', body: { verseId: 'verse1' } }, third);
  assert.equal(calls(), 1); assert.equal(third.statusCode, 200);
});
test('모든 낭독 톤은 한국어 남성 음성을 사용한다', () => {
  assert.deepEqual(Object.keys(VOICES).sort(), ['calm', 'clear', 'warm']);
  for (const name of Object.values(VOICES)) assert.match(name, /^ko-KR-Chirp3-HD-(Charon|Algieba|Alnilam)$/);
  assert.equal(resolveSpeech({ verses: [{ id: 'v', text: '구절', ttsStyle: 'unknown' }] }, 'v').style, 'calm');
});
test('없는 구절과 잘못된 요청은 음성 API를 호출하지 않는다', async () => {
  const { handler, calls } = setup();
  for (const [req, expected] of [[{ method:'GET' },405], [{ method:'POST', body:{ text:'임의 입력' } },400], [{ method:'POST', body:{ verseId:'missing' } },404]]) {
    const res = response(); await handler(req,res); assert.equal(res.statusCode,expected);
  }
  assert.equal(calls(),0);
});
test('미설정·과부하·시간초과·잘못된 오디오를 구분해 알리고 오류를 캐시하지 않는다', async () => {
  for (const [overrides, expected] of [
    [{ getAccessToken: async () => { throw new Error('no credential'); } },503],
    [{ fetchImpl: async () => new Response('', {status:429}) },429],
    [{ fetchImpl: async () => { throw new DOMException('Timeout', 'TimeoutError'); } },504],
    [{ fetchImpl: async () => new Response('', {status:403}) },502],
    [{ fetchImpl: async () => ttsResponse(Buffer.from('not audio')) },502],
  ]) {
    const { handler } = setup(overrides); const res=response();
    await handler({ method:'POST', body:{verseId:'verse1'} },res);
    assert.equal(res.statusCode,expected); assert.equal(typeof res.body.error,'string');
    assert.ok(!JSON.stringify(res.body).includes('server-secret'));
  }
});
