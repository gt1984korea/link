/**
 * 삼성 인터넷(Samsung Internet) 시뮬레이션 + 자동 스크린샷
 * --------------------------------------------------
 * - Chromium 엔진 + 삼성 인터넷 User-Agent 로 안드로이드 환경 렌더링
 * - index.html 로드 후 a2hs 안내 시트(삼성 분기)를 열어 캡처
 * - 특히 "Google Play 프로텍트 — 안전하지 않은 앱 차단됨" 통과 안내가
 *   제대로 보이는지 확인한다.
 *
 * 실행:
 *   1) cd tests && npm install && npm run install:browsers
 *   2) (link 폴더에서) python -m http.server 8080
 *   3) node samsung-screenshots.js
 */
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const OUT_DIR = path.join(__dirname, 'screenshots');

// 실제 삼성 갤럭시 + 삼성 인터넷 UA
const SAMSUNG_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';

async function run() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Galaxy S9+'],
    userAgent: SAMSUNG_UA,
    locale: 'ko-KR',
    timezoneId: 'Pacific/Auckland',
  });
  const page = await context.newPage();

  console.log('▶ Samsung Internet — index.html');
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  // Gowun Dodum 폰트를 확실히 로드 + 렌더링 적용.
  // index.html 은 display=optional 로 불러와 헤드리스에선 폴백이 고정되므로,
  // 미리보기 정확도를 위해 테스트에서 display=block 스타일시트를 주입한다.
  // (실기기에선 폰트가 캐시되어 자동 적용되므로 이 주입 없이도 정상)
  const fontLoaded = await page.evaluate(async () => {
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=block';
      document.head.appendChild(link);
      await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 3000); });
      await document.fonts.load('400 23px "Gowun Dodum"');
      await document.fonts.ready;
      return document.fonts.check('23px "Gowun Dodum"');
    } catch (e) { return false; }
  });
  console.log('   · Gowun Dodum 로드됨:', fontLoaded);

  // 삼성 안내 시트 강제로 열기 (버튼이 미설치 상태에서 숨겨질 수 있어 API 직접 호출)
  await page.evaluate(() => {
    try { localStorage.removeItem('a2hs_installed'); } catch (e) {}
    window.A2HS && window.A2HS.guide();
  });
  await page.waitForSelector('.a2hs-sheet.show', { timeout: 5000 });
  await page.waitForTimeout(600); // 슬라이드인 + 폰트/아이콘 로딩

  // 시트 상단
  await page.screenshot({ path: path.join(OUT_DIR, 'samsung_01_sheet_top.png') });
  console.log('   📸 samsung_01_sheet_top.png');

  // Play 프로텍트 안내 블록까지 스크롤
  const card = page.locator('.a2hs-card');
  await card.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, 'samsung_02_playprotect.png') });
  console.log('   📸 samsung_02_playprotect.png');

  // 애니메이션 단계별 캡처 — Web Animations API 로 특정 시점에 고정해서 캡처(루프 5000ms).
  // 0.5s 접힘 → 1.5s 손가락 탭 → 2.6s 펼침 → 4.0s 무시하고 설치 강조
  const ppEl = page.locator('.a2hs-pp');
  const seek = (ms) => page.evaluate((t) => {
    document.querySelectorAll('.a2hs-pp, .a2hs-pp *').forEach((el) => {
      (el.getAnimations ? el.getAnimations() : []).forEach((a) => { a.pause(); a.currentTime = t; });
    });
  }, ms);
  const frames = [
    { ms: 500,  name: 'samsung_anim_1_collapsed' },  // 접힌 상태 + 손가락 등장
    { ms: 1500, name: 'samsung_anim_2_tap' },        // 세부정보 더보기 누름(리플)
    { ms: 2600, name: 'samsung_anim_3_expanded' },   // 펼쳐져 무시하고 설치하기 노출
    { ms: 4000, name: 'samsung_anim_4_install' },    // 무시하고 설치하기 강조
  ];
  for (const f of frames) {
    await seek(f.ms);
    await page.waitForTimeout(120);
    await ppEl.screenshot({ path: path.join(OUT_DIR, f.name + '.png'), animations: 'allow' });
    console.log('   📸 ' + f.name + '.png');
  }
  // 다시 재생 상태로 (full page 캡처용)
  await page.evaluate(() => {
    document.querySelectorAll('.a2hs-pp, .a2hs-pp *').forEach((el) => {
      (el.getAnimations ? el.getAnimations() : []).forEach((a) => a.play());
    });
  });

  // 시트 전체(full page)
  await card.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, 'samsung_03_sheet_full.png'), fullPage: true });
  console.log('   📸 samsung_03_sheet_full.png');

  await context.close();
  await browser.close();
  console.log('\n✅ 완료 — tests/screenshots/ 확인');
}

run().catch((err) => { console.error('❌ 오류:', err); process.exit(1); });
