const { chromium, devices } = require('playwright');
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ ...devices['Galaxy S9+'], locale:'ko-KR', userAgent: UA });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8080/install.html', { waitUntil:'load' });
  await p.waitForTimeout(500);
  await p.evaluate(()=>{ window.__promptCalled=false; const e=new Event('beforeinstallprompt'); e.prompt=()=>{window.__promptCalled=true;return Promise.resolve();}; e.userChoice=Promise.resolve({outcome:'accepted'}); window.dispatchEvent(e); });
  await p.waitForTimeout(200);
  await p.locator('#installBtn').click();
  await p.waitForTimeout(400);
  const modalShown = await p.locator('#ppModal.show').count();
  await p.locator('#ppGo').click();
  await p.waitForTimeout(300);
  const promptCalled = await p.evaluate(()=>window.__promptCalled);
  const modalClosed = (await p.locator('#ppModal.show').count())===0;
  console.log('설치버튼→모달표시=',modalShown===1,' 계속설치하기→prompt()=',promptCalled,' 모달닫힘=',modalClosed);

  // 닫기 버튼도 동작 확인
  await p.locator('#installBtn').click(); await p.waitForTimeout(300);
  // deferredPrompt는 위에서 null 됐으니 다시 합성
  await p.evaluate(()=>{ const e=new Event('beforeinstallprompt'); e.prompt=()=>{};e.userChoice=Promise.resolve({outcome:'dismissed'}); window.dispatchEvent(e); });
  await p.locator('#installBtn').click(); await p.waitForTimeout(300);
  const reopened = await p.locator('#ppModal.show').count()===1;
  if (reopened) { await p.locator('#ppCancel').click(); await p.waitForTimeout(200); }
  const closedByCancel = (await p.locator('#ppModal.show').count())===0;
  console.log('재오픈=',reopened,' 닫기버튼동작=',closedByCancel);
  console.log('pageerrors:', errs.length?errs:'none');
  await b.close();
})();
