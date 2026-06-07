/**
 * a2hs.js — "홈 화면에 바로가기 추가" 안내 배너 (모바일 전용, 모든 브라우저 대응)
 * ------------------------------------------------------------------
 * victorychurch.nz 등 어떤 사이트에도 그대로 붙여넣어 사용.
 *
 * 사용법 (사이트의 </body> 직전에 한 줄):
 *   <script src="a2hs.js" defer
 *     data-site-name="Victory Church"
 *     data-icon="/icon-192.png"></script>
 *
 * 노출 빈도 옵션 (전부 선택):
 *   data-dismiss-days   X(닫기) 누르면 숨기는 일수            (기본 7)
 *   data-cooldown-hours 그냥 지나간 뒤 다시 뜨기까지 최소 시간 (기본 12)
 *   data-max-shows      이 횟수만큼 떴는데도 안 누르면 그만 노출 (기본 5)
 *
 * 동작:
 *  - PC / 이미 홈화면 실행중 / (안드로이드)이미 설치됨 → 표시 안 함
 *  - Android Chrome/Edge/Samsung → 가능하면 '진짜 설치', 아니면 메뉴 안내
 *  - iOS Safari/Chrome → 공유 → '홈 화면에 추가' 그림 안내
 *  - 카카오/인스타/페북/라인/네이버 인앱 → '외부 브라우저로 열기' 안내
 */
(function () {
  "use strict";

  // ---------- 0. 설정 ----------
  var thisScript = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  function attr(name, def) {
    var v = thisScript && thisScript.getAttribute("data-" + name);
    return v === null || v === undefined || v === "" ? def : v;
  }
  var CFG = {
    siteName: attr("site-name", document.title || "이 사이트"),
    icon: attr("icon", ""),
    dismissDays: parseFloat(attr("dismiss-days", "7")),
    cooldownHours: parseFloat(attr("cooldown-hours", "12")),
    maxShows: parseInt(attr("max-shows", "5"), 10)
  };
  var K = {
    until: "a2hs_dismissed_until", // 이 시각까지 숨김 (ms)
    shows: "a2hs_shows",           // 누적 노출 횟수
    last: "a2hs_last_shown",       // 마지막 노출 시각 (ms)
    installed: "a2hs_installed"    // "1"이면 영구 숨김
  };
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setLs(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }

  // ---------- 1. 환경 감지 ----------
  var ua = navigator.userAgent || "";
  var isAndroid = /android/i.test(ua);
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isMobile = isAndroid || isIOS;

  var inApp = {
    kakao: /KAKAOTALK/i.test(ua),
    instagram: /Instagram/i.test(ua),
    facebook: /FBAN|FBAV|FB_IAB/i.test(ua),
    line: /Line/i.test(ua),
    naver: /NAVER\(inapp/i.test(ua) || /\bNAVER\b/i.test(ua),
    daum: /DaumApps/i.test(ua)
  };
  var isInApp = inApp.kakao || inApp.instagram || inApp.facebook || inApp.line || inApp.naver || inApp.daum;

  var isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
                     window.navigator.standalone === true;

  // ---------- 2. 네이티브 설치 프롬프트 (가장 먼저 등록) ----------
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener("appinstalled", function () {
    setLs(K.installed, "1");
    closeBanner();
  });

  // ---------- 3. 표시 게이트 (비동기: 안드로이드 설치 감지 포함) ----------
  if (!isMobile || isStandalone) return;
  if (ls(K.installed) === "1") return;            // 이미 설치 확인됨 → 영구 숨김

  gate().then(function (ok) { if (ok) start(); });

  function gate() {
    // 3-1) 하드 숨김 기간
    var until = parseInt(ls(K.until) || "0", 10);
    if (until && Date.now() < until) return Promise.resolve(false);
    // 3-2) 최대 노출 횟수 초과
    var shows = parseInt(ls(K.shows) || "0", 10);
    if (shows >= CFG.maxShows) return Promise.resolve(false);
    // 3-3) 쿨다운 (그냥 보고 지나간 경우 너무 자주 안 뜨게)
    var last = parseInt(ls(K.last) || "0", 10);
    if (last && Date.now() - last < CFG.cooldownHours * 3600 * 1000) return Promise.resolve(false);
    // 3-4) 안드로이드: 이미 설치돼 있는지 감지
    return isAlreadyInstalled().then(function (installed) {
      if (installed) { setLs(K.installed, "1"); return false; }
      return true;
    });
  }

  // 안드로이드 Chrome 한정: 설치된 PWA 감지 (manifest의 related_applications 필요)
  function isAlreadyInstalled() {
    if (!navigator.getInstalledRelatedApps) return Promise.resolve(false);
    return navigator.getInstalledRelatedApps().then(function (apps) {
      return !!(apps && apps.length > 0);
    }).catch(function () { return false; });
  }

  // ---------- 4. 시작: 노출 기록 + UI 빌드 ----------
  function start() {
    setLs(K.shows, parseInt(ls(K.shows) || "0", 10) + 1);
    setLs(K.last, Date.now());
    injectStyle();
    buildUI();
    setTimeout(function () { banner.classList.add("show"); }, 600);
  }

  // ---------- 5. 스타일 ----------
  function injectStyle() {
    var css =
    ".a2hs-banner{position:fixed;top:0;left:0;right:0;z-index:2147483646;" +
    "background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;" +
    "box-shadow:0 2px 12px rgba(0,0,0,.25);padding:env(safe-area-inset-top) 0 0 0;" +
    "transform:translateY(-110%);transition:transform .35s cubic-bezier(.22,1,.36,1)}" +
    ".a2hs-banner.show{transform:translateY(0)}" +
    ".a2hs-row{display:flex;align-items:center;gap:12px;padding:12px 14px}" +
    ".a2hs-ic{width:40px;height:40px;border-radius:10px;flex:0 0 auto;background:#fff;" +
    "display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden}" +
    ".a2hs-ic img{width:100%;height:100%;object-fit:cover}" +
    ".a2hs-txt{flex:1 1 auto;min-width:0;line-height:1.35}" +
    ".a2hs-t1{font-weight:700;font-size:15px}" +
    ".a2hs-t2{font-size:12px;opacity:.85;margin-top:1px}" +
    ".a2hs-btn{flex:0 0 auto;background:#fff;color:#1d4ed8;border:0;border-radius:999px;" +
    "font-weight:700;font-size:14px;padding:9px 16px;cursor:pointer}" +
    ".a2hs-btn:active{transform:scale(.96)}" +
    ".a2hs-x{flex:0 0 auto;background:transparent;border:0;color:#fff;opacity:.7;" +
    "font-size:22px;line-height:1;cursor:pointer;padding:4px 6px}" +
    ".a2hs-sheet{position:fixed;inset:0;z-index:2147483647;display:none}" +
    ".a2hs-sheet.show{display:block}" +
    ".a2hs-dim{position:absolute;inset:0;background:rgba(0,0,0,.5)}" +
    ".a2hs-card{position:absolute;left:0;right:0;bottom:0;background:#fff;color:#111;" +
    "border-radius:20px 20px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));" +
    "transform:translateY(100%);transition:transform .35s cubic-bezier(.22,1,.36,1);max-height:85vh;overflow:auto}" +
    ".a2hs-sheet.show .a2hs-card{transform:translateY(0)}" +
    ".a2hs-h{font-size:18px;font-weight:800;margin:0 0 4px}" +
    ".a2hs-sub{font-size:13px;color:#666;margin:0 0 16px}" +
    ".a2hs-step{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid #f0f0f0}" +
    ".a2hs-step:first-of-type{border-top:0}" +
    ".a2hs-n{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:#2563eb;color:#fff;" +
    "font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}" +
    ".a2hs-sd{flex:1;font-size:14px;line-height:1.5;padding-top:2px}" +
    ".a2hs-sd b{color:#1d4ed8}" +
    ".a2hs-ico{display:inline-flex;vertical-align:-3px;margin:0 2px}" +
    ".a2hs-close2{display:block;width:100%;margin-top:18px;background:#111;color:#fff;border:0;" +
    "border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer}" +
    ".a2hs-copy{display:block;width:100%;margin-top:10px;background:#2563eb;color:#fff;border:0;" +
    "border-radius:12px;font-size:15px;font-weight:700;padding:14px;cursor:pointer}";
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- 6. 아이콘 ----------
  var SHARE_IOS = '<svg class="a2hs-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>';
  var PLUS = '<svg class="a2hs-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  var DOTS = '<svg class="a2hs-ico" width="20" height="20" viewBox="0 0 24 24" fill="#2563eb"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

  // ---------- 7. UI 빌드 ----------
  var banner, sheet;
  function buildUI() {
    banner = document.createElement("div");
    banner.className = "a2hs-banner";
    var iconHTML = CFG.icon ? '<img src="' + CFG.icon + '" alt="">' : "⛪";
    banner.innerHTML =
      '<div class="a2hs-row">' +
        '<div class="a2hs-ic">' + iconHTML + '</div>' +
        '<div class="a2hs-txt">' +
          '<div class="a2hs-t1">' + escapeHtml(CFG.siteName) + ' 홈 화면에 추가</div>' +
          '<div class="a2hs-t2">한 번 추가하면 앱처럼 바로 열려요</div>' +
        '</div>' +
        '<button class="a2hs-btn" type="button">바로가기</button>' +
        '<button class="a2hs-x" type="button" aria-label="닫기">&times;</button>' +
      '</div>';
    document.body.appendChild(banner);

    sheet = document.createElement("div");
    sheet.className = "a2hs-sheet";
    sheet.innerHTML =
      '<div class="a2hs-dim"></div>' +
      '<div class="a2hs-card">' +
        '<h3 class="a2hs-h"></h3>' +
        '<p class="a2hs-sub"></p>' +
        '<div class="a2hs-steps"></div>' +
        '<div class="a2hs-extra"></div>' +
        '<button class="a2hs-close2" type="button">알겠어요</button>' +
      '</div>';
    document.body.appendChild(sheet);

    banner.querySelector(".a2hs-btn").addEventListener("click", onAddClick);
    banner.querySelector(".a2hs-x").addEventListener("click", function () {
      closeBanner();
      setLs(K.until, Date.now() + CFG.dismissDays * 24 * 3600 * 1000); // X → N일 숨김
    });
    sheet.querySelector(".a2hs-dim").addEventListener("click", closeSheet);
    sheet.querySelector(".a2hs-close2").addEventListener("click", closeSheet);
  }

  function onAddClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (res) {
        if (res && res.outcome === "accepted") {
          setLs(K.installed, "1");
          closeBanner();
        }
        deferredPrompt = null;
      });
      return;
    }
    openSheet();
  }

  // ---------- 8. 브라우저별 안내 ----------
  function openSheet() {
    var h = sheet.querySelector(".a2hs-h");
    var sub = sheet.querySelector(".a2hs-sub");
    var steps = sheet.querySelector(".a2hs-steps");
    var extra = sheet.querySelector(".a2hs-extra");
    extra.innerHTML = ""; steps.innerHTML = "";

    if (isInApp) {
      h.textContent = "외부 브라우저로 열어주세요";
      var appName = inApp.kakao ? "카카오톡" : inApp.instagram ? "인스타그램" :
                    inApp.facebook ? "페이스북" : inApp.line ? "라인" :
                    inApp.naver ? "네이버" : "현재 앱";
      sub.textContent = appName + " 안에서는 홈 화면 추가가 안 돼요. " +
                        (isIOS ? "Safari" : "Chrome") + "로 열면 추가할 수 있어요.";
      if (isAndroid) {
        steps.innerHTML =
          step(1, '오른쪽 위 ' + DOTS + ' (더보기) 를 누르세요') +
          step(2, '<b>다른 브라우저로 열기</b> 또는 <b>Chrome으로 열기</b> 선택') +
          step(3, '열린 Chrome에서 다시 <b>바로가기</b> 버튼을 누르세요');
        if (inApp.kakao) {
          var btn = document.createElement("button");
          btn.className = "a2hs-copy";
          btn.textContent = "Chrome으로 바로 열기";
          btn.onclick = function () {
            location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
          };
          extra.appendChild(btn);
        }
      } else {
        steps.innerHTML =
          step(1, '오른쪽 아래(또는 위) ' + DOTS + ' 메뉴를 누르세요') +
          step(2, '<b>Safari로 열기</b> 를 선택하세요') +
          step(3, '열린 Safari에서 다시 <b>바로가기</b> 버튼을 누르세요');
      }
      addCopyButton(extra);
    } else if (isIOS) {
      h.textContent = "홈 화면에 추가하기";
      sub.textContent = "아이폰/아이패드에서는 아래 순서로 추가해요.";
      steps.innerHTML =
        step(1, '화면 아래(또는 위) 의 <b>공유</b> ' + SHARE_IOS + ' 버튼을 누르세요') +
        step(2, '메뉴를 내려서 <b>홈 화면에 추가</b> ' + PLUS + ' 를 누르세요') +
        step(3, '오른쪽 위 <b>추가</b> 를 누르면 완료!');
    } else {
      h.textContent = "홈 화면에 추가하기";
      sub.textContent = "사용 중인 브라우저 메뉴에서 추가할 수 있어요.";
      steps.innerHTML =
        step(1, '오른쪽 위 ' + DOTS + ' (메뉴) 를 누르세요') +
        step(2, '<b>홈 화면에 추가</b> 또는 <b>앱 설치</b> 를 누르세요') +
        step(3, '<b>추가</b> 를 누르면 완료!');
    }
    sheet.classList.add("show");
  }

  function addCopyButton(container) {
    var copy = document.createElement("button");
    copy.className = "a2hs-copy";
    copy.textContent = "주소 복사하기";
    copy.onclick = function () {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { copy.textContent = "복사됨! 브라우저에 붙여넣으세요"; });
      } else {
        var t = document.createElement("textarea");
        t.value = url; document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); copy.textContent = "복사됨! 브라우저에 붙여넣으세요"; } catch (e) {}
        document.body.removeChild(t);
      }
    };
    container.appendChild(copy);
  }

  // ---------- 9. 헬퍼 ----------
  function step(n, html) {
    return '<div class="a2hs-step"><div class="a2hs-n">' + n + '</div>' +
           '<div class="a2hs-sd">' + html + '</div></div>';
  }
  function closeSheet() { sheet.classList.remove("show"); }
  function closeBanner() {
    if (!banner) return;
    banner.classList.remove("show");
    setTimeout(function () { if (banner && banner.parentNode) banner.parentNode.removeChild(banner); }, 400);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
