const { chromium } = require('playwright');
const URL = 'https://victorychurch-665a9.web.app/';
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#verseCard:not(.hidden)', { timeout: 15000 });

  const diag = await page.evaluate(() => {
    const out = {};
    out.ttsBtnCount = document.querySelectorAll('#ttsBtn').length;
    const btn = document.getElementById('ttsBtn');
    const r = btn.getBoundingClientRect();
    out.rect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    out.elementAtCenter = top ? (top.id || top.tagName + '.' + top.className) : 'null';
    out.centerInsideBtn = btn.contains(top);
    const cs = getComputedStyle(btn);
    out.pointerEvents = cs.pointerEvents;
    out.disabled = btn.disabled;
    out.visibility = cs.visibility + '/' + cs.display + '/opacity:' + cs.opacity;
    // 핸들러 실행 여부 확인용 플래그 심기
    btn.addEventListener('click', () => { window.__clickFired = true; }, true);
    return out;
  });
  console.log('DIAG:', JSON.stringify(diag, null, 2));

  // 1) 실제 클릭
  await page.locator('#ttsBtn').click();
  await page.waitForTimeout(300);
  console.log('after locator.click → label=', await page.locator('#ttsBtnLabel').textContent(),
              '| __clickFired=', await page.evaluate(() => window.__clickFired || false),
              '| playing=', await page.locator('#ttsBtn').evaluate(el => el.classList.contains('playing')));

  // 2) JS dispatch 클릭 (오버레이 우회)
  await page.evaluate(() => { window.__clickFired = false; document.getElementById('ttsBtn').click(); });
  await page.waitForTimeout(300);
  console.log('after el.click() → label=', await page.locator('#ttsBtnLabel').textContent(),
              '| __clickFired=', await page.evaluate(() => window.__clickFired || false),
              '| playing=', await page.locator('#ttsBtn').evaluate(el => el.classList.contains('playing')));

  await browser.close();
})();
