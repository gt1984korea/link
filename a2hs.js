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
  // 삼성 인터넷(안드로이드) — 크로미움 기반이지만 beforeinstallprompt 가 안 뜨는
  // 경우가 있어, 네이티브 프롬프트가 없을 때 전용 수동 안내를 보여준다.
  var isSamsung = /SamsungBrowser/i.test(ua);

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
    "border-radius:14px;font-size:19px;font-weight:800;padding:17px;cursor:pointer}" +
    // iOS 시각 가이드 전용
    ".a2hs-ios-intro{display:flex;align-items:center;gap:12px;background:#f3f4f6;border-radius:14px;padding:12px 14px;margin-bottom:16px}" +
    ".a2hs-ios-intro .ic{width:42px;height:42px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto}" +
    ".a2hs-ios-intro .ic img{width:90%;height:auto}" +
    ".a2hs-ios-intro .nm{font-weight:700;font-size:15px;color:#111}" +
    ".a2hs-ios-intro .sub{font-size:12px;color:#6b7280;margin-top:1px}" +
    ".a2hs-visual{border-top:1px solid #eee;padding:18px 0}" +
    ".a2hs-visual:first-of-type{border-top:0;padding-top:6px}" +
    ".a2hs-visual .head{display:flex;align-items:center;gap:12px;margin-bottom:10px}" +
    ".a2hs-visual .badge{width:28px;height:28px;border-radius:50%;background:#2563eb;color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}" +
    ".a2hs-visual .ttl{font-size:17px;font-weight:800;color:#111;letter-spacing:-.01em}" +
    ".a2hs-visual .desc{font-size:14px;color:#4b5563;line-height:1.55;margin:0 0 12px 40px}" +
    ".a2hs-visual .desc b{color:#1d4ed8}" +
    ".a2hs-visual .phone{margin:0 0 0 40px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:14px;display:flex;justify-content:center;align-items:center;position:relative;overflow:hidden}" +
    ".a2hs-visual .phone svg{display:block;max-width:100%;height:auto}" +
    // 추가 확정 화면 미리보기 — 실제 앱 아이콘을 SVG 위에 정확한 위치로 겹쳐 표시
    ".a2hs-add-mock{position:relative;display:block;width:100%}" +
    ".a2hs-add-mock svg{display:block;width:100%;height:auto}" +
    ".a2hs-add-mock-ic{position:absolute;left:15.38%;top:35.56%;width:23.08%;height:33.33%;" +
    "border-radius:22%;object-fit:cover;box-shadow:0 1px 4px rgba(16,26,63,.18)}" +
    "@keyframes a2hs-pulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.6);opacity:0}100%{transform:scale(1.6);opacity:0}}" +
    ".a2hs-pulse{transform-origin:center;animation:a2hs-pulse 1.6s ease-out infinite}" +
    // 커스텀 다이얼로그 (alert 대체)
    "@keyframes a2hs-fade-in{from{opacity:0}to{opacity:1}}" +
    "@keyframes a2hs-pop-in{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}" +
    ".a2hs-dlg{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:20px;" +
    "font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;" +
    "animation:a2hs-fade-in .2s ease-out}" +
    ".a2hs-dlg.show{display:flex}" +
    ".a2hs-dlg-dim{position:absolute;inset:0;background:rgba(16,26,63,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}" +
    ".a2hs-dlg-card{position:relative;background:#fff;border-radius:22px;max-width:340px;width:100%;padding:28px 24px 20px;" +
    "box-shadow:0 20px 60px rgba(16,26,63,.25),0 4px 16px rgba(0,0,0,.08);animation:a2hs-pop-in .28s cubic-bezier(.34,1.56,.64,1);text-align:center}" +
    ".a2hs-dlg-ic{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#e7f6ef,#d1f0e0);" +
    "display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:#2bb673}" +
    ".a2hs-dlg-ic.warn{background:linear-gradient(135deg,#fff4e6,#ffe4cc);color:#f59e0b}" +
    ".a2hs-dlg-h{font-size:18px;font-weight:800;color:#101a3f;margin:0 0 8px;letter-spacing:-.01em}" +
    ".a2hs-dlg-msg{font-size:15px;color:#4b5563;line-height:1.55;margin:0 0 22px;white-space:pre-line}" +
    ".a2hs-dlg-ok{display:block;width:100%;background:#2bb673;color:#fff;border:0;border-radius:14px;" +
    "font-size:16px;font-weight:800;padding:14px;cursor:pointer;transition:transform .1s,background .2s;" +
    "font-family:inherit}" +
    ".a2hs-dlg-ok:hover{background:#249a61}" +
    ".a2hs-dlg-ok:active{transform:scale(.97)}";
    var style = document.createElement("style");
    style.id = "a2hs-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- 3-1. 커스텀 다이얼로그 (alert 대체) ----------
  var dlg;
  function showDialog(opts) {
    injectStyle();
    if (typeof opts === "string") opts = { message: opts };
    var title = opts.title || "안내";
    var message = opts.message || "";
    var variant = opts.variant || "info"; // info | warn
    var okText = opts.okText || "확인";

    if (!dlg) {
      dlg = document.createElement("div");
      dlg.className = "a2hs-dlg";
      dlg.innerHTML =
        '<div class="a2hs-dlg-dim"></div>' +
        '<div class="a2hs-dlg-card" role="dialog" aria-modal="true">' +
          '<div class="a2hs-dlg-ic"></div>' +
          '<h3 class="a2hs-dlg-h"></h3>' +
          '<p class="a2hs-dlg-msg"></p>' +
          '<button class="a2hs-dlg-ok" type="button"></button>' +
        '</div>';
      document.body.appendChild(dlg);
      var close = function () { dlg.classList.remove("show"); };
      dlg.querySelector(".a2hs-dlg-dim").addEventListener("click", close);
      dlg.querySelector(".a2hs-dlg-ok").addEventListener("click", close);
    }
    var ic = dlg.querySelector(".a2hs-dlg-ic");
    ic.className = "a2hs-dlg-ic" + (variant === "warn" ? " warn" : "");
    ic.innerHTML = variant === "warn"
      ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>'
      : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>';
    dlg.querySelector(".a2hs-dlg-h").textContent = title;
    dlg.querySelector(".a2hs-dlg-msg").textContent = message;
    dlg.querySelector(".a2hs-dlg-ok").textContent = okText;
    dlg.classList.add("show");
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
    // 삼성 인터넷: 네이티브 prompt()가 즉시 설치창 대신 수동적인
    // "웹 앱을 설치할 수 있음" 알림만 띄우는 경우가 많아(버튼은 계속 로딩만)
    // 사용자가 "설치가 안 된다"고 느낀다. → 네이티브 프롬프트에 의존하지 않고
    // 그 알림을 누르는 법 + 메뉴 수동 추가 안내를 항상 보여준다.
    if (deferredPrompt && !isSamsung) {
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
        // 크롬/엣지에서 deferredPrompt 가 없다는 건 이미 설치되어 있거나
        // PWA 설치 조건(HTTPS + SW + manifest)이 미충족인 경우.
        // 안내 시트를 띄우지 않고 짧은 알림 후 종료.
        if (ls(K.installed) === "1") {
          showDialog({ title: "이미 설치되어 있어요", message: "시작 메뉴 또는 바탕화면에서 열어 주세요." });
        } else {
          showDialog({ variant: "warn", title: "설치를 시작할 수 없어요", message: "페이지를 새로고침(F5) 후 다시 시도해 주세요." });
        }
        return; // 시트 표시하지 않음
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
      // iOS Safari: 네이티브 설치 API 없음 → 시각 가이드 시트 사용
      if (ls(K.installed) === "1") {
        showDialog({ title: "이미 설치되어 있어요", message: "앱 아이콘에서 열어 주세요." });
        return;
      }
      h.textContent = "아이폰 바로가기 만들기";
      sub.innerHTML = "아래 <b>3단계</b> 만 따라하면 끝나요. 약 10초면 충분해요.";

      // 사이트 아이콘 + 이름 인트로
      var iconUrl = CFG.icon || "icon-192.png";
      steps.innerHTML =
        '<div class="a2hs-ios-intro">' +
          '<div class="ic"><img src="' + iconUrl + '" alt=""></div>' +
          '<div>' +
            '<div class="nm">' + escapeHtml(CFG.siteName) + '</div>' +
            '<div class="sub">이 페이지를 홈 화면에 추가해요</div>' +
          '</div>' +
        '</div>' +
        iosStep(1,
          "사파리 화면 <b>아래쪽 가운데</b>의 <b>공유 버튼</b>(↑)을 누르세요",
          iosVisualShareBar()
        ) +
        iosStep(2,
          "메뉴를 <b>위로 스크롤</b>해서 <b>홈 화면에 추가</b>를 누르세요",
          iosVisualShareMenu()
        ) +
        iosStep(3,
          "오른쪽 위 <b>추가</b>를 누르면 완료!",
          iosVisualAddScreen()
        );
    } else if (isSamsung) {
      // 삼성 인터넷: 네이티브 프롬프트(deferredPrompt)가 없으면 여기로 온다.
      // 짧은 알림으로 끝내지 말고, 삼성 인터넷 메뉴 기준 수동 안내를 보여준다.
      if (ls(K.installed) === "1") {
        showDialog({ title: "이미 설치되어 있어요", message: "앱 아이콘에서 열어 주세요." });
        return;
      }
      h.textContent = "삼성 인터넷 바로가기 만들기";
      sub.innerHTML = "두 가지 방법 중 <b>편한 쪽</b>으로 하시면 돼요.";

      var iconUrl2 = CFG.icon || "icon-192.png";

      // 방법 ①: 삼성 인터넷이 자동으로 띄우는 "웹 앱을 설치할 수 있음" 알림
      //  — 화면 상단(또는 알림창)에 이 알림이 보이면, 그것만 누르면 바로 설치된다.
      //    가장 쉬운 길이라 맨 위에 강조해서 보여준다.
      var tip = document.createElement("div");
      tip.style.cssText =
        "display:flex;gap:12px;align-items:center;background:#eff6ff;border:1.5px solid #2563eb;" +
        "border-radius:14px;padding:14px;margin-bottom:18px";
      tip.innerHTML =
        '<div style="flex:0 0 auto;width:42px;height:42px;border-radius:10px;overflow:hidden;' +
          'background:#fff;display:flex;align-items:center;justify-content:center">' +
          '<img src="' + iconUrl2 + '" alt="" style="width:100%;height:100%;object-fit:cover">' +
        '</div>' +
        '<div style="font-size:15px;line-height:1.5;color:#1d4ed8">' +
          '<b>가장 쉬운 방법!</b><br>화면에 <b>“웹 앱을 설치할 수 있음”</b> 알림이 보이면, ' +
          '그 알림만 <b>누르면</b> 바로 설치돼요.' +
        '</div>';
      steps.appendChild(tip);

      var or = document.createElement("div");
      or.style.cssText =
        "text-align:center;font-size:14px;color:#9ca3af;font-weight:700;margin:0 0 6px";
      or.textContent = "— 알림이 안 보이면 아래대로 —";
      steps.appendChild(or);

      // 방법 ②: 메뉴를 통한 수동 추가 (삼성 인터넷 메뉴는 화면 오른쪽 아래 ≡ 버튼)
      var manual = document.createElement("div");
      manual.innerHTML =
        step(1, '화면 <b>오른쪽 아래</b>의 <b>메뉴</b>(≡ 삼선 버튼)를 누르세요') +
        step(2, '<b>현재 페이지 추가</b> 를 누르세요') +
        step(3, '<b>홈 화면</b> 을 선택하고 <b>추가</b> 를 누르면 끝!');
      steps.appendChild(manual);

      // Google Play 프로텍트 경고 안내 — 삼성/안드로이드에서 앱(WebAPK) 설치 시
      // "안전하지 않은 앱 차단됨" 경고가 뜰 수 있다. 교회 앱은 안전하며,
      // 크게 보이는 '확인'은 설치를 '취소'하므로, 작은 글씨 '무시하고 설치하기'를
      // 눌러야 설치가 진행된다 — 이 부분을 헷갈리는 분이 많아 강조해서 안내한다.
      var warn = document.createElement("div");
      warn.style.cssText =
        "display:flex;gap:12px;align-items:flex-start;background:#fff7ed;" +
        "border:1.5px solid #f59e0b;border-radius:14px;padding:14px;margin-top:18px";
      warn.innerHTML =
        '<div style="flex:0 0 auto;font-size:22px;line-height:1.2">⚠️</div>' +
        '<div style="font-size:15px;line-height:1.55;color:#92400e">' +
          '설치 도중 <b>“안전하지 않은 앱 차단됨”</b>(Google Play 프로텍트) 경고가 ' +
          '떠도 <b>안전한 교회 앱</b>이에요.<br>' +
          '<b>큰 파란 “확인” 버튼은 설치를 취소</b>하니 누르지 마시고, ' +
          '그 위에 있는 작은 글씨 <b>“무시하고 설치하기”</b>를 누르면 설치가 완료돼요.' +
        '</div>';
      steps.appendChild(warn);
    } else {
      // 안드로이드 크롬: deferredPrompt 가 없다는 건 이미 설치되었거나
      // 설치 조건이 미충족된 경우. 안내 시트 대신 짧은 알림으로 끝낸다.
      if (ls(K.installed) === "1") {
        showDialog({ title: "이미 설치되어 있어요", message: "앱 아이콘에서 열어 주세요." });
      } else {
        showDialog({ variant: "warn", title: "설치를 시작할 수 없어요", message: "페이지를 새로고침한 후 다시 시도해 주세요." });
      }
      return; // 시트 표시하지 않음
    }
    sheet.classList.add("show");
  }

  // 외부 브라우저로 보낼 "설치 전용 페이지" URL을 생성
  function installPageUrl() {
    // 현재 경로 기준으로 install.html 절대 URL 만들기
    var path = location.pathname.replace(/[^/]*$/, "") + "install.html";
    return location.origin + path;
  }

  // 인앱 → 외부 브라우저로 자동 전환
  // 외부 브라우저는 "설치 전용 페이지(install.html)"를 보여주어
  // 사용자가 큰 버튼 하나만 누르면 바로 PWA 설치가 시작되도록 한다.
  function openInExternalBrowser() {
    var externalUrl = installPageUrl();
    var target = null;

    // iOS는 카카오/라인/네이버용 커스텀 스킴이 동작하지 않고, window.open('_blank') 도
    // "같은 인앱 브라우저의 새 탭"만 열어 똑같은 페이지가 다시 뜬다(네이버 인앱 iOS 확인됨).
    // 유일하게 통하는 방법: x-safari-https:// 스킴(iOS 17+) → 진짜 사파리로 전환.
    // 실패 시(구형 iOS) 인앱 브라우저의 ≡ 메뉴 > "Safari로 열기"를 직접 누르도록 안내.
    if (isIOS) {
      var startedAt = Date.now();
      try { location.href = "x-safari-" + externalUrl; } catch (e) {}
      setTimeout(function () {
        if (!document.hidden && (Date.now() - startedAt) < 4000) {
          showDialog({ variant: "warn", title: "사파리로 열어 주세요", message: "화면 오른쪽 아래 ≡ (메뉴)를 누른 뒤 'Safari로 열기'를 선택해 주세요." });
        }
      }, 1200);
      return;
    }

    if (inApp.kakao) {
      target = "kakaotalk://web/openExternal?url=" + encodeURIComponent(externalUrl);
    } else if (inApp.line) {
      var sep = externalUrl.indexOf("?") >= 0 ? "&" : "?";
      location.href = externalUrl + sep + "openExternalBrowser=1";
      return;
    } else if (inApp.naver) {
      target = "naversearchapp://inappbrowser?url=" + encodeURIComponent(externalUrl) + "&target=new";
    } else if (isAndroid) {
      target = "intent://" + externalUrl.replace(/^https?:\/\//, "") +
               "#Intent;scheme=" + (location.protocol.replace(":", "") || "https") +
               ";package=com.android.chrome;end";
    }

    if (target) {
      location.href = target;
      setTimeout(function () {
        try { window.open(externalUrl, "_blank"); } catch (e) {}
      }, 2000);
    } else {
      try { window.open(externalUrl, "_blank"); } catch (e) {}
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
  function iosStep(n, descHtml, svgHtml) {
    return '<div class="a2hs-visual">' +
             '<div class="head"><div class="badge">' + n + '</div>' +
               '<div class="ttl">' + (n === 1 ? "공유 버튼 누르기" : n === 2 ? "홈 화면에 추가 선택" : "추가 누르기") + '</div>' +
             '</div>' +
             '<p class="desc">' + descHtml + '</p>' +
             '<div class="phone">' + svgHtml + '</div>' +
           '</div>';
  }

  // [iOS Step 1] 사파리 하단 툴바 — 공유 아이콘 강조
  function iosVisualShareBar() {
    return '' +
'<svg viewBox="0 0 260 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="사파리 하단 공유 버튼">' +
  '<rect x="20" y="10" width="220" height="100" rx="10" fill="#fff" stroke="#e5e7eb"/>' +
  '<rect x="40" y="22" width="180" height="8" rx="3" fill="#e5e7eb"/>' +
  '<rect x="40" y="40" width="120" height="6" rx="3" fill="#f3f4f6"/>' +
  '<rect x="40" y="54" width="160" height="6" rx="3" fill="#f3f4f6"/>' +
  '<rect x="40" y="68" width="100" height="6" rx="3" fill="#f3f4f6"/>' +
  // 하단 툴바
  '<rect x="20" y="115" width="220" height="30" rx="8" fill="#f8fafc" stroke="#e5e7eb"/>' +
  // 왼쪽 화살표
  '<path d="M50 130 l-6 0 M50 130 l3 -3 M50 130 l3 3" stroke="#9ca3af" stroke-width="2" fill="none" stroke-linecap="round"/>' +
  // 오른쪽 화살표
  '<path d="M82 130 l6 0 M88 130 l-3 -3 M88 130 l-3 3" stroke="#9ca3af" stroke-width="2" fill="none" stroke-linecap="round"/>' +
  // 공유 아이콘 (강조됨)
  '<g transform="translate(124 122)">' +
    '<circle cx="6" cy="8" r="14" fill="#2563eb" opacity=".15" class="a2hs-pulse"/>' +
    '<rect x="-2" y="5" width="16" height="12" rx="2" fill="none" stroke="#2563eb" stroke-width="2"/>' +
    '<path d="M6 14 L6 -3 M2 1 L6 -3 L10 1" stroke="#2563eb" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</g>' +
  // 책 아이콘
  '<rect x="170" y="125" width="14" height="11" rx="1" fill="none" stroke="#9ca3af" stroke-width="1.5"/>' +
  // 탭 아이콘
  '<rect x="200" y="124" width="13" height="13" rx="2" fill="none" stroke="#9ca3af" stroke-width="1.5"/>' +
  '<rect x="203" y="121" width="13" height="13" rx="2" fill="none" stroke="#9ca3af" stroke-width="1.5"/>' +
'</svg>';
  }

  // [iOS Step 2] 공유 메뉴 — "홈 화면에 추가" 강조
  function iosVisualShareMenu() {
    return '' +
'<svg viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="공유 메뉴에서 홈 화면에 추가">' +
  '<rect x="20" y="10" width="220" height="180" rx="14" fill="#fff" stroke="#e5e7eb"/>' +
  // 사이트 미리보기
  '<rect x="32" y="22" width="196" height="36" rx="8" fill="#f3f4f6"/>' +
  '<rect x="42" y="32" width="26" height="16" rx="3" fill="#cbd5e1"/>' +
  '<rect x="74" y="32" width="120" height="6" rx="3" fill="#94a3b8"/>' +
  '<rect x="74" y="42" width="80" height="5" rx="2" fill="#cbd5e1"/>' +
  // 첫줄: 아이콘 행 (AirDrop, 메시지, 메일…)
  '<g>' +
    '<circle cx="50" cy="78" r="14" fill="#eff6ff"/>' +
    '<text x="50" y="82" font-size="10" text-anchor="middle" fill="#2563eb" font-weight="700">AD</text>' +
    '<circle cx="92" cy="78" r="14" fill="#dcfce7"/>' +
    '<text x="92" y="82" font-size="10" text-anchor="middle" fill="#16a34a" font-weight="700">M</text>' +
    '<circle cx="134" cy="78" r="14" fill="#dbeafe"/>' +
    '<text x="134" y="82" font-size="10" text-anchor="middle" fill="#1d4ed8" font-weight="700">@</text>' +
    '<circle cx="176" cy="78" r="14" fill="#fce7f3"/>' +
    '<text x="176" y="82" font-size="10" text-anchor="middle" fill="#be185d" font-weight="700">···</text>' +
  '</g>' +
  '<line x1="32" y1="102" x2="228" y2="102" stroke="#e5e7eb"/>' +
  // 리스트 항목들
  '<rect x="32" y="110" width="196" height="22" rx="6" fill="#f8fafc"/>' +
  '<text x="44" y="125" font-size="11" fill="#6b7280">링크 복사</text>' +
  '<text x="210" y="125" font-size="13" fill="#9ca3af" text-anchor="middle">⌐</text>' +

  // 홈 화면에 추가 — 강조 (파란 라인)
  '<rect x="32" y="138" width="196" height="28" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>' +
  '<text x="44" y="156" font-size="12" fill="#1d4ed8" font-weight="800">홈 화면에 추가</text>' +
  '<g transform="translate(204 152)">' +
    '<circle cx="0" cy="0" r="11" fill="#2563eb" opacity=".18" class="a2hs-pulse"/>' +
    '<rect x="-7" y="-7" width="14" height="14" rx="3" fill="none" stroke="#2563eb" stroke-width="1.8"/>' +
    '<path d="M0 -3 L0 3 M-3 0 L3 0" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round"/>' +
  '</g>' +

  '<rect x="32" y="172" width="196" height="14" rx="6" fill="#f8fafc"/>' +
'</svg>';
  }

  // [iOS Step 3] 추가 확정 화면 — 우측 상단 "추가" 강조
  function iosVisualAddScreen() {
    var iconUrl = CFG.icon || "icon-192.png";
    // SVG <image>는 innerHTML 삽입 시 비율/클립이 브라우저마다 깨져 아이콘이
    // 잘려 보이는 문제가 있어, 실제 <img> 를 SVG 위에 정확한 위치로 겹쳐 그린다.
    return '' +
'<div class="a2hs-add-mock">' +
  '<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="홈 화면에 추가 확정 화면">' +
    '<rect x="20" y="10" width="220" height="160" rx="14" fill="#fff" stroke="#e5e7eb"/>' +
    // 헤더: 취소 / 제목 / 추가
    '<text x="42" y="34" font-size="12" fill="#6b7280">취소</text>' +
    '<text x="130" y="34" font-size="13" fill="#111" text-anchor="middle" font-weight="700">홈 화면에 추가</text>' +
    // 추가 버튼 강조
    '<g>' +
      '<circle cx="208" cy="29" r="20" fill="#2563eb" opacity=".15" class="a2hs-pulse"/>' +
      '<rect x="190" y="20" width="38" height="20" rx="6" fill="#2563eb"/>' +
      '<text x="209" y="34" font-size="12" fill="#fff" text-anchor="middle" font-weight="800">추가</text>' +
    '</g>' +
    '<line x1="30" y1="50" x2="230" y2="50" stroke="#e5e7eb"/>' +
    // 미리보기 카드 텍스트 (아이콘 자리는 비워두고 실제 <img> 를 겹친다)
    '<rect x="112" y="68" width="110" height="14" rx="4" fill="#f3f4f6"/>' +
    '<text x="118" y="78" font-size="9" fill="#111" font-weight="700">빅토리처치</text>' +
    '<rect x="112" y="88" width="100" height="9" rx="3" fill="#f3f4f6"/>' +
    '<text x="118" y="95" font-size="7" fill="#9ca3af">victorychurch.nz</text>' +
    // 안내 텍스트
    '<text x="40" y="146" font-size="9" fill="#6b7280">홈 화면에서 빠르게 열 수 있도록 아이콘이 추가됩니다.</text>' +
  '</svg>' +
  '<img class="a2hs-add-mock-ic" src="' + iconUrl + '" alt="">' +
'</div>';
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
