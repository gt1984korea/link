/**
 * 헌금 섹션 — 은행 앱 열기 버튼 기기별 분기 검증 + 계좌 복사 검증
 * --------------------------------------------------------------
 * Android(Chromium+Android UA): intent://<pkg>;...browser_fallback_url=<Play 스토어>
 * iOS(WebKit iPhone):           앱 URL 스킴(scheme://) 먼저 시도 → 미설치 시 App Store 폴백
 * Desktop(Chromium):            기본 <a href>(은행 웹) — JS 가로채기 없음 → popup
 *
 * 실행:
 *   1) (link 폴더) python -m http.server 8080   # 또는 npx serve -l 8080 .
 *   2) (tests 폴더) node bank-buttons.test.js
 */

const { chromium, webkit, devices } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const URL = `${BASE_URL}/index.html`;

// 기대값 (index.html 의 data-* 속성과 일치해야 함)
const BANKS = {
  ANZ: {
    pkg: 'nz.co.anz.android.mobilebanking',
    iosScheme: 'anzgomoney://',
    ios: 'https://apps.apple.com/nz/app/anz-gomoney-new-zealand/id685125525',
    androidStore: 'https://play.google.com/store/apps/details?id=nz.co.anz.android.mobilebanking',
    web: 'anz.co.nz',
  },
  ASB: {
    pkg: 'nz.co.asb.asbmobile',
    iosScheme: 'asbmobile://',
    ios: 'https://apps.apple.com/nz/app/asb-mobile-banking/id434348489',
    androidStore: 'https://play.google.com/store/apps/details?id=nz.co.asb.asbmobile',
    web: 'asb.co.nz',
  },
  BNZ: {
    pkg: 'nz.co.bnz.droidbanking',
    iosScheme: 'bnzmobile://',
    ios: 'https://apps.apple.com/nz/app/bnz-mobile/id443045792',
    androidStore: 'https://play.google.com/store/apps/details?id=nz.co.bnz.droidbanking',
    web: 'bnz.co.nz',
  },
};

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log(`   ✅ ${name}`); pass++; }
  else { console.error(`   ❌ ${name}${extra ? '  → ' + extra : ''}`); fail++; }
}

function bankBtn(page, label) {
  // .give-bank-btn 중 .bk 텍스트가 정확히 일치하는 것
  return page.locator('.give-bank-btn', { has: page.locator('.bk', { hasText: new RegExp(`^${label}$`) }) });
}

// 클릭 시 bank:nav 이벤트를 가로채(실제 이동 차단) URL 을 수집하는 헬퍼 주입
async function installNavCapture(page) {
  const captured = [];
  await page.exposeFunction('__recordBankNav', (url) => { captured.push(url); });
  await page.addInitScript(() => {
    window.addEventListener('bank:nav', (e) => {
      e.preventDefault();                 // 실제 location 이동 차단
      window.__recordBankNav(e.detail.url);
    }, true);
  });
  return captured;
}

async function testMobile({ engine, deviceName, kind }) {
  console.log(`\n▶ ${kind}  (${deviceName})`);
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ ...devices[deviceName], locale: 'ko-KR' });
  const page = await context.newPage();
  const captured = await installNavCapture(page);
  page.on('pageerror', (err) => console.error('   ⚠️ pageerror:', err.message));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.give-bank-btn', { timeout: 8000 });

  for (const label of Object.keys(BANKS)) {
    captured.length = 0;
    await bankBtn(page, label).click();
    await page.waitForTimeout(150); // 이벤트 콜백 왕복 여유
    const url = captured[0];
    const exp = BANKS[label];
    if (kind === 'Android') {
      check(`${label} → intent:// 스킴`, !!url && url.startsWith('intent://'), url);
      check(`${label} → 패키지 ${exp.pkg}`, !!url && url.includes('package=' + exp.pkg), url);
      check(`${label} → Play 스토어 폴백`, !!url && url.includes(encodeURIComponent(exp.androidStore)), url);
    } else { // iOS — 앱 스킴을 먼저 시도(미설치 시 App Store 폴백)
      check(`${label} → 앱 스킴 ${exp.iosScheme}`, url === exp.iosScheme, url);
    }
  }

  await context.close();
  await browser.close();
}

async function testDesktop() {
  console.log(`\n▶ Desktop  (Chromium)`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();
  await installNavCapture(page); // 데스크톱은 이벤트가 발생하면 안 됨
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.give-bank-btn', { timeout: 8000 });

  for (const label of Object.keys(BANKS)) {
    const exp = BANKS[label];
    // 데스크톱은 target=_blank 기본 동작 → 새 페이지(popup)
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
      bankBtn(page, label).click(),
    ]);
    if (popup) {
      check(`${label} → 은행 웹(${exp.web})`, popup.url().includes(exp.web), popup.url());
      await popup.close();
    } else {
      check(`${label} → 은행 웹 새 탭 열림`, false, '팝업 미발생');
    }
  }

  await context.close();
  await browser.close();
}

async function testCopy() {
  console.log(`\n▶ 계좌번호 복사  (Chromium)`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'ko-KR',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#copyAcctBtn', { timeout: 8000 });

  const expected = (await page.locator('#giveAcct').textContent()).trim();
  await page.locator('#copyAcctBtn').click();
  await page.waitForTimeout(200);

  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('클립보드에 계좌번호 복사됨', clip.trim() === expected, `clip="${clip}" expected="${expected}"`);
  const label = (await page.locator('#copyAcctLabel').textContent()).trim();
  check('버튼 라벨이 "복사 완료!" 로 변경', label === '복사 완료!', label);
  const copied = await page.locator('#copyAcctBtn').evaluate((el) => el.classList.contains('copied'));
  check('버튼에 copied 클래스 적용', copied);

  await context.close();
  await browser.close();
}

async function run() {
  await testMobile({ engine: chromium, deviceName: 'Pixel 5', kind: 'Android' });
  await testMobile({ engine: webkit, deviceName: 'iPhone 14 Pro', kind: 'iOS' });
  await testDesktop();
  await testCopy();

  console.log(`\n──────────────────────────────`);
  console.log(`결과: ${pass} 통과 / ${fail} 실패`);
  console.log(`──────────────────────────────`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => { console.error('❌ 실행 오류:', err); process.exit(1); });
