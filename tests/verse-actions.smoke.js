// 좋아요·공유 액션 바 스모크 테스트 (라이브 사이트 대상)
// 실행: node verse-actions.smoke.js
const { chromium } = require('playwright');

const URL = 'https://victorychurch-665a9.web.app/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  let failed = false;
  const check = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' - ' + msg); if (!cond) failed = true; };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // 구절 카드가 보일 때까지 대기 (Firestore 활성 구절 필요)
  try {
    await page.waitForSelector('#verseCard:not(.hidden)', { timeout: 15000 });
  } catch (e) {
    console.log('WARN - 활성 구절 카드가 표시되지 않음(활성 구절이 없을 수 있음). 액션 바 존재만 확인합니다.');
  }

  check(await page.locator('#likeBtn').count() === 1, '좋아요 버튼 존재');
  check(await page.locator('#shareBtn').count() === 1, '공유 버튼 존재');

  const visible = await page.locator('#verseCard:not(.hidden)').count() === 1;
  if (visible) {
    // 깨끗한 상태에서 시작하도록 좋아요 플래그 초기화
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('vc_liked_')).forEach(k => localStorage.removeItem(k));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#verseCard:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(1500); // verseStats onSnapshot이 placeholder('0')를 실제 값으로 갱신할 시간

    const before = parseInt((await page.locator('#likeCount').textContent()).replace(/[^\d]/g, '') || '0', 10);

    // 좋아요 +1
    await page.locator('#likeBtn').click();
    await page.waitForTimeout(2500);
    const pressedAfter = await page.locator('#likeBtn').getAttribute('aria-pressed');
    const liked = await page.locator('#likeBtn').evaluate(el => el.classList.contains('liked'));
    const after = parseInt((await page.locator('#likeCount').textContent()).replace(/[^\d]/g, '') || '0', 10);
    check(pressedAfter === 'true' && liked, '좋아요 클릭 후 활성 상태(aria-pressed/liked)');
    check(after === before + 1, `좋아요 +1 반영 (${before} → ${after})`);

    // 좋아요 취소 -1 (집계 원복)
    await page.locator('#likeBtn').click();
    await page.waitForTimeout(2500);
    const pressedBack = await page.locator('#likeBtn').getAttribute('aria-pressed');
    const back = parseInt((await page.locator('#likeCount').textContent()).replace(/[^\d]/g, '') || '0', 10);
    check(pressedBack === 'false', '다시 클릭 후 비활성 상태');
    check(back === before, `좋아요 -1 원복 (${after} → ${back})`);
  }

  // 지난 구절 모달 좋아요 테스트
  const pastToggleCount = await page.locator('#pastToggle:not(.hidden)').count();
  if (pastToggleCount === 1) {
    await page.locator('#pastToggle').click();
    await page.waitForTimeout(500);
    const pastItemCount = await page.locator('.past-item').count();
    if (pastItemCount > 0) {
      await page.evaluate(() => {
        Object.keys(localStorage).filter(k => k.startsWith('vc_liked_')).forEach(k => localStorage.removeItem(k));
      });
      await page.locator('.past-item').first().click();
      await page.waitForSelector('#verseModal.show', { timeout: 5000 });
      check(await page.locator('#modalLikeBtn').count() === 1, '지난 구절 모달에 좋아요 버튼 존재');
      await page.waitForTimeout(1500); // verseStats onSnapshot이 placeholder('0')를 실제 값으로 갱신할 시간

      const mBefore = parseInt((await page.locator('#modalLikeCount').textContent()).replace(/[^\d]/g, '') || '0', 10);
      await page.locator('#modalLikeBtn').click();
      await page.waitForTimeout(2500);
      const mPressed = await page.locator('#modalLikeBtn').getAttribute('aria-pressed');
      const mAfter = parseInt((await page.locator('#modalLikeCount').textContent()).replace(/[^\d]/g, '') || '0', 10);
      check(mPressed === 'true', '지난 구절 좋아요 클릭 후 활성 상태');
      check(mAfter === mBefore + 1, `지난 구절 좋아요 +1 반영 (${mBefore} → ${mAfter})`);

      // 원복
      await page.locator('#modalLikeBtn').click();
      await page.waitForTimeout(2500);
      const mBack = parseInt((await page.locator('#modalLikeCount').textContent()).replace(/[^\d]/g, '') || '0', 10);
      check(mBack === mBefore, `지난 구절 좋아요 -1 원복 (${mAfter} → ${mBack})`);

      // 활성 구절 카드 카운트와 독립적인지 확인 (다른 verseId)
      if (visible) {
        const activeCount = parseInt((await page.locator('#likeCount').textContent()).replace(/[^\d]/g, '') || '0', 10);
        console.log(`INFO - 활성 구절 좋아요=${activeCount}, 지난 구절 좋아요=${mBefore} (서로 별도 집계)`);
      }
    } else {
      console.log('WARN - 지난 구절 항목이 없어 모달 좋아요 테스트를 건너뜀');
    }
  } else {
    console.log('WARN - 지난 구절 토글이 없어 모달 좋아요 테스트를 건너뜀');
  }

  check(errors.length === 0, '콘솔/페이지 에러 없음' + (errors.length ? (' → ' + errors.join(' | ')) : ''));

  await browser.close();
  console.log(failed ? '\nRESULT: FAILED' : '\nRESULT: OK');
  process.exit(failed ? 1 : 0);
})();
