/**
 * a2hs.js — "홈 화면에 바로가기 추가" 안내 (모바일 전용, 모든 브라우저 대응)
 * ------------------------------------------------------------------
 * 두 가지 방식으로 사용:
 *  (1) 자동 상단 배너  — 그냥 스크립트만 넣으면 모바일에서 배너가 뜸
 *  (2) 버튼으로 직접 호출 — window.A2HS.open() 또는 [data-a2hs] 버튼 클릭
 *
 * 사용 예:
 *   <script src="a2hs.js" defer data-site-name="Victory Church" data-icon="/icon-192.png"></script>
 *   자동 배너 끄고 버튼만 쓰려면:  data-auto-banner="false"
 *   <button data-a2hs>바로가기 만들기</button>   ← 이 버튼이 자동으로 동작
 *
 * 노출 빈도 옵션:
 *   data-dismiss-days(7) / data-cooldown-hours(12) / data-max-shows(5)
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
    autoBanner: attr("auto-banner", "true") !== "false",
    dismissDays: parseFloat(attr("dismiss-days", "7")),
    cooldownHours: parseFloat(attr("cooldown-hours", "12")),
    maxShows: parseInt(attr("max-shows", "5"), 10)
  };
  var K = {
    until: "a2hs_dismissed_until",
    shows: "a2hs_shows",
    last: "a2hs_last_shown",
    installed: "a2hs_installed"
  };
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setLs(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }

  // ---------- 1. 환경 감지 ----------
  var ua = navigator.userAgent || "";
  var isAndroid = /android/i.test(ua);
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isMobile = isAndroid || isIOS;
  var isDesktop = !isMobile;

  // 데스크톱 브라우저 세분화
  var isEdge = /Edg\//i.test(ua);
  var isChrome = /Chrome\//i.test(ua) && !isEdge && !/OPR\//i.test(ua);
  var isFirefox = /Firefox\//i.test(ua);
  var isSafariDesktop = isDesktop && /Safari\//i.test(ua) && !/Chrome\/|Edg\/|OPR\//i.test(ua);
  var isMac = /Macintosh|Mac OS X/i.test(ua);

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
    closeSheet();
  });

  // ---------- 3. 스타일 ----------
  function injectStyle() {
    if (document.getElementById("a2hs-style")) return;
    var css =
    ".a2hs-banner{position:fixed;top:0;left:0;right:0;z-index:2147483646;" +
    "background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;" +
    "box-shadow:0 2px 12px rgba(0,0,0,.25);padding:env(safe-area-inset-top) 0 0 0;" +
    "transform:translateY(-110%);transition:transform .35s cubic-bezier(.22,1,.36,1)}" +
    ".a2hs-banner.show{transform:translateY(0)}" +
    ".a2hs-row{display:flex;align-items:center;gap:12px;padding:12px 14px}" +
    ".a2hs-ic{width:44px;height:44px;border-radius:10px;flex:0 0 auto;background:#fff;" +
    "display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden}" +
    ".a2hs-ic img{width:100%;height:100%;object-fit:cover}" +
    ".a2hs-txt{flex:1 1 auto;min-width:0;line-height:1.35}" +
    ".a2hs-t1{font-weight:700;font-size:16px}" +
    ".a2hs-t2{font-size:13px;opacity:.9;margin-top:1px}" +
    ".a2hs-btn{flex:0 0 auto;background:#fff;color:#1d4ed8;border:0;border-radius:999px;" +
    "font-weight:800;font-size:16px;padding:11px 18px;cursor:pointer}" +
    ".a2hs-btn:active{transform:scale(.96)}" +
    ".a2hs-x{flex:0 0 auto;background:transparent;border:0;color:#fff;opacity:.8;" +
    "font-size:26px;line-height:1;cursor:pointer;padding:4px 8px}" +
    // 안내 시트 (고령층 친화: 큰 글씨)
    ".a2hs-sheet{position:fixed;inset:0;z-index:2147483647;display:none;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}" +
    ".a2hs-sheet.show{display:block}" +
    ".a2hs-dim{position:absolute;inset:0;background:rgba(0,0,0,.5)}" +
    ".a2hs-card{position:absolute;left:0;right:0;bottom:0;background:#fff;color:#111;" +
    "border-radius:22px 22px 0 0;padding:26px 22px calc(26px + env(safe-area-inset-bottom));" +
    "transform:translateY(100%);transition:transform .35s cubic-bezier(.22,1,.36,1);max-height:88vh;overflow:auto}" +
    ".a2hs-sheet.show .a2hs-card{transform:translateY(0)}" +
    ".a2hs-h{font-size:23px;font-weight:800;margin:0 0 6px}" +
    ".a2hs-sub{font-size:16px;color:#555;margin:0 0 18px;line-height:1.5}" +
    ".a2hs-step{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-top:1px solid #eee}" +
    ".a2hs-step:first-of-type{border-top:0}" +
    ".a2hs-n{flex:0 0 auto;width:34px;height:34px;border-radius:50%;background:#2563eb;color:#fff;" +
    "font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center}" +
    ".a2hs-sd{flex:1;font-size:18px;line-height:1.55;padding-top:3px}" +
    ".a2hs-sd b{color:#1d4ed8}" +
    ".a2hs-ico{display:inline-flex;vertical-align:-4px;margin:0 3px}" +
    ".a2hs-close2{display:block;width:100%;margin-top:22px;background:#111;color:#fff;border:0;" +
    "border-radius:14px;font-size:19px;font-weight:800;padding:17px;cursor:pointer}" +
    ".a2hs-copy{display:block;width:100%;margin-top:12px;background:#2563eb;color:#fff;border:0;" +
    "border-radius:14px;font-size:19px;font-weight:800;padding:17px;cursor:pointer}";
    var style = document.createElement("style");
    style.id = "a2hs-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- 4. 아이콘 ----------
  var SHARE_IOS = '<svg class="a2hs-ico" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>';
  var PLUS = '<svg class="a2hs-ico" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  var DOTS = '<svg class="a2hs-ico" width="24" height="24" viewBox="0 0 24 24" fill="#2563eb"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

  // ---------- 5. 시트(안내창) — 항상 준비 ----------
  var sheet;
  function buildSheet() {
    if (sheet) return;
    sheet = document.createElement("div");
    sheet.className = "a2hs-sheet";
    sheet.innerHTML =
      '<div class="a2hs-dim"></div>' +
      '<div class="a2hs-card">' +
        '<h3 class="a2hs-h"></h3>' +
        '<p class="a2hs-sub"></p>' +
        '<div class="a2hs-steps"></div>' +
        '<div class="a2hs-extra"></div>' +
        '<button class="a2hs-close2" type="button">닫기</button>' +
      '</div>';
    document.body.appendChild(sheet);
    sheet.querySelector(".a2hs-dim").addEventListener("click", closeSheet);
    sheet.querySelector(".a2hs-close2").addEventListener("click", closeSheet);
  }

  // ---------- 6. 배너 — 빈도 통과 시에만 ----------
  var banner;
  function showBanner() {
    setLs(K.shows, parseInt(ls(K.shows) || "0", 10) + 1);
    setLs(K.last, Date.now());
    banner = document.createElement("div");
    banner.className = "a2hs-banner";
    var iconHTML = CFG.icon ? '<img src="' + CFG.icon + '" alt="">' : "⛪";
    banner.innerHTML =
      '<div class="a2hs-row">' +
        '<div class="a2hs-ic">' + iconHTML + '</div>' +
        '<div class="a2hs-txt">' +
          '<div class="a2hs-t1">' + escapeHtml(CFG.siteName) + ' 바로가기</div>' +
          '<div class="a2hs-t2">첫 화면에 추가하면 앱처럼 바로 열려요</div>' +
        '</div>' +
        '<button class="a2hs-btn" type="button">추가하기</button>' +
        '<button class="a2hs-x" type="button" aria-label="닫기">&times;</button>' +
      '</div>';
    document.body.appendChild(banner);
    banner.querySelector(".a2hs-btn").addEventListener("click", onAddClick);
    banner.querySelector(".a2hs-x").addEventListener("click", function () {
      closeBanner();
      setLs(K.until, Date.now() + CFG.dismissDays * 24 * 3600 * 1000);
    });
    setTimeout(function () { banner.classList.add("show"); }, 600);
  }

  // ---------- 7. 핵심: 추가 시도 ----------
  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {}
  }
  function onAddClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (res) {
        if (res && res.outcome === "accepted") {
          // 주의: accepted 는 "사용자가 OK 눌렀다"일 뿐, 실제 설치 완료가 아님.
          // 진짜 완료는 'appinstalled' 이벤트에서 확정한다.
          closeBanner();
          emit("a2hs:result", { outcome: "accepted" });
        } else {
          emit("a2hs:result", { outcome: "dismissed" });
        }
        deferredPrompt = null;
      });
      return;
    }
    openSheet();
  }

  // ---------- 8. 브라우저별 안내 ----------
  function openSheet() {
    buildSheet();
    var h = sheet.querySelector(".a2hs-h");
    var sub = sheet.querySelector(".a2hs-sub");
    var steps = sheet.querySelector(".a2hs-steps");
    var extra = sheet.querySelector(".a2hs-extra");
    extra.innerHTML = ""; steps.innerHTML = "";

    if (isDesktop) {
      // 데스크톱: 브라우저별 PWA 설치 / 북마크 안내
      if (isChrome || isEdge) {
        h.textContent = "바탕화면에 바로가기 만들기";
        sub.textContent = "아래 순서대로 바탕화면(또는 시작 메뉴)에 앱처럼 추가해요.";
        var browserName = isEdge ? "엣지" : "크롬";
        var menuIcon = isEdge ? "···" : "⋮";
        steps.innerHTML =
          step(1, '주소창 오른쪽 끝의 <b>설치 아이콘</b> (모니터 + 아래 화살표 모양) 을 누르세요') +
          step(2, '또는 오른쪽 위 <b>' + menuIcon + '</b> 메뉴 → <b>앱</b> → <b>이 사이트를 앱으로 설치</b> 를 누르세요') +
          step(3, '<b>설치</b> 버튼을 누르면 바탕화면에 바로가기가 생겨요!');
        addCopyButton(extra);
      } else if (isSafariDesktop) {
        h.textContent = "Dock에 바로가기 만들기";
        sub.textContent = "맥 사파리에서는 아래 순서대로 추가해요.";
        steps.innerHTML =
          step(1, '메뉴 막대의 <b>파일</b> 을 누르세요') +
          step(2, '<b>Dock에 추가</b> 를 누르세요') +
          step(3, '<b>추가</b> 를 누르면 Dock에 바로가기가 생겨요!');
        extra.innerHTML = '<div style="font-size:14px;color:#666;margin-top:14px;line-height:1.5">' +
          '💡 macOS Sonoma(14) 이상에서 지원돼요. 이전 버전은 아래 <b>주소 복사하기</b>로 즐겨찾기에 추가해 주세요.</div>';
        addCopyButton(extra);
      } else if (isFirefox) {
        h.textContent = "북마크에 추가하기";
        sub.textContent = "파이어폭스는 앱 설치 대신 북마크로 빠르게 열 수 있어요.";
        var shortcut = isMac ? "⌘ + D" : "Ctrl + D";
        steps.innerHTML =
          step(1, '키보드에서 <b>' + shortcut + '</b> 을 누르세요') +
          step(2, '<b>저장</b> 위치를 <b>북마크 도구 모음</b> 으로 선택하세요') +
          step(3, '<b>저장</b> 을 누르면 주소창 아래에 항상 표시돼요!');
        addCopyButton(extra);
      } else {
        h.textContent = "북마크에 추가하기";
        sub.textContent = "지금 쓰시는 브라우저는 북마크(즐겨찾기)로 빠르게 열 수 있어요.";
        var shortcut2 = isMac ? "⌘ + D" : "Ctrl + D";
        steps.innerHTML =
          step(1, '키보드에서 <b>' + shortcut2 + '</b> 을 누르세요') +
          step(2, '<b>북마크 도구 모음</b> 에 저장하세요') +
          step(3, '주소창 아래에 항상 표시돼요!');
        addCopyButton(extra);
      }
    } else if (isInApp) {
      // 인앱 브라우저: 안내 + "바로가기 만들기" 한 개 버튼만
      // 버튼 누르면 외부 브라우저(크롬/사파리)로 자동 전환 시도
      var appName = inApp.kakao ? "카카오톡" : inApp.instagram ? "인스타그램" :
                    inApp.facebook ? "페이스북" : inApp.line ? "라인" :
                    inApp.naver ? "네이버" : "지금 보는 앱";
      h.textContent = appName + " 안에서는 바로가기를 못 만들어요";
      sub.innerHTML = "아래 <b>바로가기 만들기</b> 를 누르면<br>" +
                      "기본 브라우저로 자동으로 열려요.";

      var openBtn = document.createElement("button");
      openBtn.className = "a2hs-copy";
      openBtn.textContent = "바로가기 만들기";
      openBtn.onclick = function () { openInExternalBrowser(); };
      extra.appendChild(openBtn);
    } else if (isIOS) {
      h.textContent = "이렇게 따라 하세요";
      sub.textContent = "아이폰에서는 아래 3단계로 첫 화면에 바로가기를 만들어요.";
      steps.innerHTML =
        step(1, '화면 <b>아래쪽 가운데</b> 의 <b>공유</b> ' + SHARE_IOS + ' (위로 향한 화살표) 를 누르세요') +
        step(2, '목록을 위로 넘겨서 <b>홈 화면에 추가</b> ' + PLUS + ' 를 누르세요') +
        step(3, '오른쪽 위 <b>추가</b> 를 누르면 끝!');
    } else {
      h.textContent = "이렇게 따라 하세요";
      sub.textContent = "아래 순서대로 첫 화면에 바로가기를 만들어요.";
      steps.innerHTML =
        step(1, '화면 오른쪽 위 ' + DOTS + ' (점 세 개) 를 누르세요') +
        step(2, '<b>홈 화면에 추가</b> 또는 <b>앱 설치</b> 를 누르세요') +
        step(3, '<b>추가</b> 를 누르면 끝!');
    }
    sheet.classList.add("show");
  }

  // 인앱 → 외부 브라우저로 자동 전환
  // 각 앱의 공식 외부 열기 스킴 사용. 실패하면 새창 폴백.
  function openInExternalBrowser() {
    var url = location.href;
    var target = null;

    if (inApp.kakao) {
      // 카카오톡: 외부 브라우저 강제 오픈
      target = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url);
    } else if (inApp.line) {
      // 라인: openExternalBrowser=true 쿼리 추가
      var sep = url.indexOf("?") >= 0 ? "&" : "?";
      location.href = url + sep + "openExternalBrowser=1";
      return;
    } else if (inApp.naver) {
      // 네이버 인앱: 외부 브라우저 스킴
      target = "naversearchapp://inappbrowser?url=" + encodeURIComponent(url) + "&target=new";
    } else if (isAndroid) {
      // 안드로이드 일반: 크롬 인텐트로 외부 전환
      target = "intent://" + url.replace(/^https?:\/\//, "") +
               "#Intent;scheme=" + (location.protocol.replace(":", "") || "https") +
               ";package=com.android.chrome;end";
    } else if (isIOS) {
      // iOS 인스타/페북 등: 사파리로 직접 보낼 공식 스킴이 없음
      // → 새창 시도 후, 차단되면 안내
      var w = window.open(url, "_blank");
      if (!w) {
        alert("오른쪽 위 메뉴(···)에서 '사파리로 열기'를 눌러 주세요.");
      }
      return;
    }

    if (target) {
      // 스킴 호출
      location.href = target;
      // 2초 뒤에도 페이지에 머물러 있으면 새창 폴백
      setTimeout(function () {
        try { window.open(url, "_blank"); } catch (e) {}
      }, 2000);
    } else {
      try { window.open(url, "_blank"); } catch (e) {}
    }
  }

  function addCopyButton(container) {
    var copy = document.createElement("button");
    copy.className = "a2hs-copy";
    copy.textContent = "주소 복사하기";
    copy.onclick = function () {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { copy.textContent = "복사됐어요! 인터넷 앱에 붙여넣으세요"; });
      } else {
        var t = document.createElement("textarea");
        t.value = url; document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); copy.textContent = "복사됐어요! 인터넷 앱에 붙여넣으세요"; } catch (e) {}
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
  function closeSheet() { if (sheet) sheet.classList.remove("show"); }
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

  // ---------- 10. 빈도 게이트 (배너 전용) ----------
  function gate() {
    var until = parseInt(ls(K.until) || "0", 10);
    if (until && Date.now() < until) return Promise.resolve(false);
    var shows = parseInt(ls(K.shows) || "0", 10);
    if (shows >= CFG.maxShows) return Promise.resolve(false);
    var last = parseInt(ls(K.last) || "0", 10);
    if (last && Date.now() - last < CFG.cooldownHours * 3600 * 1000) return Promise.resolve(false);
    return isAlreadyInstalled().then(function (installed) {
      if (installed) { setLs(K.installed, "1"); return false; }
      return true;
    });
  }
  function isAlreadyInstalled() {
    if (!navigator.getInstalledRelatedApps) return Promise.resolve(false);
    return navigator.getInstalledRelatedApps().then(function (apps) {
      return !!(apps && apps.length > 0);
    }).catch(function () { return false; });
  }

  // ---------- 11. 시작 ----------
  injectStyle();
  buildSheet();

  // 공개 API + 버튼 자동 연결
  window.A2HS = { open: onAddClick, guide: openSheet };
  function bindButtons() {
    var els = document.querySelectorAll("[data-a2hs]");
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener("click", function (e) { e.preventDefault(); onAddClick(); });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindButtons);
  } else { bindButtons(); }

  // 자동 배너 (모바일 + 빈도 통과)
  if (CFG.autoBanner && isMobile && !isStandalone && ls(K.installed) !== "1") {
    gate().then(function (ok) { if (ok) showBanner(); });
  }
})();
