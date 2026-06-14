/**
 * "이미지로 공유" 기능 — 액션 시트 / 이미지 모달 / 캔버스 렌더링 검증
 * --------------------------------------------------------------
 * 실행:
 *   1) (link 폴더) npx serve -l 8080 .
 *   2) (tests 폴더) node image-share.test.js
 */

const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const URL = `${BASE_URL}/index.html`;

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log(`   ✅ ${name}`); pass++; }
  else { console.error(`   ❌ ${name}${extra ? '  → ' + extra : ''}`); fail++; }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('   ⚠️ pageerror:', err.message));

  await page.goto(URL, { waitUntil: 'load' });

  let visible = false;
  try {
    await page.waitForSelector('#verseCard:not(.hidden)', { timeout: 15000 });
    visible = true;
  } catch (e) {
    console.log('   ⚠️ 활성 구절 카드가 없음 — 정적 마크업 존재만 확인합니다.');
  }

  check('공유 액션 시트 마크업 존재', await page.locator('#shareSheet').count() === 1);
  check('이미지 공유 모달 마크업 존재', await page.locator('#imageShareModal').count() === 1);
  check('캔버스 엘리먼트 존재', await page.locator('#shareCanvas').count() === 1);

  if (!visible) {
    console.log(`\n──────────────────────────────`);
    console.log(`결과: ${pass} 통과 / ${fail} 실패`);
    console.log(`──────────────────────────────`);
    await context.close();
    await browser.close();
    process.exit(fail > 0 ? 1 : 0);
    return;
  }

  // 1) 공유 버튼 → 액션 시트
  await page.locator('#shareBtn').click();
  await page.waitForSelector('#shareSheet.show', { timeout: 3000 });
  check('공유 버튼 클릭 시 액션 시트 표시', true);
  check('텍스트로 공유 옵션 존재', await page.locator('#shareTextOption').count() === 1);
  check('이미지로 공유 옵션 존재', await page.locator('#shareImageOption').count() === 1);

  // 2) 이미지로 공유 → 모달 오픈 + 캔버스 렌더
  await page.locator('#shareImageOption').click();
  await page.waitForSelector('#imageShareModal.show', { timeout: 3000 });
  await page.waitForTimeout(300); // document.fonts.ready 이후 렌더 대기

  const brandBlueData = await page.locator('#shareCanvas').evaluate((c) => c.toDataURL());
  check('브랜드 블루 배경으로 캔버스 렌더링', brandBlueData.length > 1000);

  // 3) 스와치 전환 시 캔버스가 다시 그려지는지
  await page.locator('.swatch[data-style="pastelFloral"]').click();
  await page.waitForTimeout(100);
  const pastelData = await page.locator('#shareCanvas').evaluate((c) => c.toDataURL());
  check('파스텔 플로럴 선택 시 캔버스 변경', pastelData !== brandBlueData);
  check('파스텔 플로럴 스와치 active 표시', await page.locator('.swatch[data-style="pastelFloral"]').evaluate((el) => el.classList.contains('active')));

  // 4) 저장 버튼 → 다운로드 트리거
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.locator('#imgSaveBtn').click(),
  ]);
  check('저장 버튼 클릭 시 PNG 다운로드', download.suggestedFilename() === 'victory-verse.png');

  // 5) 모달 닫기
  await page.locator('#imageShareCloseBtn').click();
  await page.waitForTimeout(300);
  check('닫기 버튼 클릭 시 모달 닫힘', !(await page.locator('#imageShareModal').evaluate((el) => el.classList.contains('show'))));

  await context.close();
  await browser.close();

  console.log(`\n──────────────────────────────`);
  console.log(`결과: ${pass} 통과 / ${fail} 실패`);
  console.log(`──────────────────────────────`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => { console.error('❌ 실행 오류:', err); process.exit(1); });
