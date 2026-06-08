const { webkit } = require('playwright');
const path = require('path');

async function run() {
  console.log('Launching WebKit browser...');
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Pacific/Auckland',
  });
  const page = await context.newPage();

  // 브라우저 내 콘솔 로그 수집
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  console.log('Navigating to http://localhost:8080/index.html ...');
  await page.goto('http://localhost:8080/index.html');

  // 로딩 후 몇 초간 관찰하며 elText의 텍스트가 어떻게 바뀌는지 모니터링
  console.log('Monitoring #verseText content changes for 5 seconds...');
  for (let i = 0; i < 25; i++) {
    const text = await page.locator('#verseText').textContent();
    const ref = await page.locator('#verseRef').textContent();
    console.log(`[t=${i * 200}ms] verseText: "${text}", verseRef: "${ref}"`);
    await page.waitForTimeout(200);
  }

  // 새로고침(재방문) 테스트 - 로컬 캐시가 적용된 상태
  console.log('\n--- Reloading page (Local Cache should be active) ---');
  await page.reload();
  
  for (let i = 0; i < 25; i++) {
    const text = await page.locator('#verseText').textContent();
    const ref = await page.locator('#verseRef').textContent();
    console.log(`[t=${i * 200}ms] (Reloaded) verseText: "${text}", verseRef: "${ref}"`);
    await page.waitForTimeout(200);
  }

  await browser.close();
}

run().catch(console.error);
