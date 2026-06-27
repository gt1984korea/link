// 읽어주기(TTS) 재현/진단 스크립트 — 라이브 사이트 대상
const { chromium } = require('playwright');
const URL = 'https://victorychurch-665a9.web.app/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

  // ElevenLabs / 녹음 / TTS 네트워크 요청 추적
  const net = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/elevenlabs\.io|firebasestorage|\.mp3|audio/i.test(u)) {
      net.push(`${r.status()} ${u.slice(0, 90)}`);
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#verseCard:not(.hidden)', { timeout: 15000 });
    console.log('구절 카드 표시됨');
  } catch {
    console.log('WARN - 활성 구절 카드 미표시');
  }

  // 현재 상태 덤프
  const state = await page.evaluate(() => ({
    ttsBtnExists: !!document.getElementById('ttsBtn'),
    label: document.getElementById('ttsBtnLabel')?.textContent,
    voiceId: window.currentTtsVoiceId || window.lastCachedVoiceId || null,
    fullText: (window.currentFullVerseText || document.getElementById('verseText')?.textContent || '').slice(0, 40),
    verseTextDom: (document.getElementById('verseText')?.textContent || '').slice(0, 40),
    audioUrls: window.currentVerseAudioUrls || window.lastCachedAudioUrls || window.currentVerseAudioUrl || null,
  }));
  console.log('STATE:', JSON.stringify(state, null, 2));

  // 읽어주기 클릭
  await page.locator('#ttsBtn').click();
  // 라벨 변화를 5초간 폴링
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(500);
    const lbl = await page.locator('#ttsBtnLabel').textContent();
    const playing = await page.locator('#ttsBtn').evaluate(el => el.classList.contains('playing'));
    console.log(`t=${(i+1)*0.5}s label="${lbl}" playing=${playing}`);
  }

  console.log('\n--- NETWORK (audio/tts) ---');
  net.forEach(n => console.log(n));
  console.log('\n--- CONSOLE LOGS ---');
  logs.forEach(l => console.log(l));

  await browser.close();
})();
