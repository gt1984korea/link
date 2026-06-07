/**
 * iOS Safari (WebKit) 시뮬레이션 + 자동 스크린샷
 * --------------------------------------------------
 * - WebKit 엔진으로 iPhone 환경에서 페이지 렌더링
 * - index.html, install.html 각각 캡처
 * - install.html에서 "바로가기 만들기" 클릭 → iOS 가이드 시트 열고 캡처
 * - 시트 전체를 스크롤 끝까지 내려가며 단계별로도 캡처
 *
 * 실행:
 *   1) cd tests
 *   2) npm install
 *   3) npm run install:browsers
 *   4) (link 폴더에서 별도 터미널) python -m http.server 8080
 *   5) npm run test:ios
 */

const { webkit, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const OUT_DIR = path.join(__dirname, 'screenshots');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// iPhone 디바이스 프로파일 — Playwright 내장
const TARGETS = [
  { name: 'iPhone-14-Pro', device: devices['iPhone 14 Pro'] },
  { name: 'iPhone-SE',     device: devices['iPhone SE']     },
];

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function shoot(page, file, opts = {}) {
  const fullPath = path.join(OUT_DIR, file);
  await page.screenshot({ path: fullPath, fullPage: !!opts.fullPage });
  console.log('   📸', path.relative(__dirname, fullPath));
}

async function run() {
  await ensureDir(OUT_DIR);
  const browser = await webkit.launch({ headless: true });

  for (const target of TARGETS) {
    console.log(`\n▶ ${target.name}`);
    const context = await browser.newContext({
      ...target.device,
      locale: 'ko-KR',
      timezoneId: 'Pacific/Auckland',
    });
    const page = await context.newPage();

    // 1) 메인 페이지(index.html)
    console.log(' • index.html');
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(400); // 폰트 로딩 여유
    await shoot(page, `${target.name}_01_index.png`);
    await shoot(page, `${target.name}_01_index_full.png`, { fullPage: true });

    // 2) 설치 전용 페이지(install.html) — 일반 진입
    console.log(' • install.html');
    await page.goto(`${BASE_URL}/install.html`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await shoot(page, `${target.name}_02_install.png`);
    await shoot(page, `${target.name}_02_install_full.png`, { fullPage: true });

    // 3) install.html에서 "바로가기 만들기" 클릭 → iOS 가이드 시트 열기
    console.log(' • install.html → iOS 가이드 시트');
    await page.locator('#installBtn').click();
    await page.waitForSelector('#iosSheet.show', { timeout: 5000 }).catch(() => {
      console.warn('   ⚠️ iosSheet 가 .show 클래스를 얻지 못함 (iOS 분기 미작동)');
    });
    await page.waitForTimeout(500); // 시트 슬라이드인 애니메이션 대기
    await shoot(page, `${target.name}_03_ios_sheet_top.png`);

    // 4) 시트 안 스크롤 — 4개 단계 각각 캡처
    const card = page.locator('.ios-card');
    if (await card.count()) {
      const steps = page.locator('.ios-step');
      const count = await steps.count();
      console.log(`   - 가이드 단계 ${count}개 발견`);
      for (let i = 0; i < count; i++) {
        await steps.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        await shoot(page, `${target.name}_04_ios_step${i + 1}.png`);
      }

      // 시트 전체 (스크롤 가능 영역만)
      await card.evaluate((el) => { el.scrollTop = 0; });
      await page.waitForTimeout(200);
      const cardBox = await card.boundingBox();
      if (cardBox) {
        await page.screenshot({
          path: path.join(OUT_DIR, `${target.name}_05_ios_sheet_full.png`),
          fullPage: true,
        });
        console.log('   📸', `${target.name}_05_ios_sheet_full.png`);
      }
    }

    // 5) standalone 모드(이미 설치된 것처럼) 시뮬레이션
    console.log(' • install.html (이미 설치된 상태 시뮬레이션)');
    await page.goto(`${BASE_URL}/install.html`, { waitUntil: 'load' });
    await page.evaluate(() => {
      // standalone 강제 + localStorage 설정
      try { localStorage.setItem('a2hs_installed', '1'); } catch (e) {}
      // 'done' 클래스 직접 토글 — 실제 standalone matchMedia 결과는 못 바꾸지만 UI 표시 확인용
      document.getElementById('root').classList.add('done');
    });
    await page.waitForTimeout(300);
    await shoot(page, `${target.name}_06_install_done.png`);

    await context.close();
  }

  await browser.close();
  console.log(`\n✅ 완료 — screenshots/ 폴더 확인`);
}

run().catch((err) => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
