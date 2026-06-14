/* 웹 푸시 알림 등록 모듈
 * - "새 구절 알림 받기" 버튼(#btnNotify)을 제어합니다.
 * - 알림 권한을 요청하고 FCM 토큰을 받아 Firestore(pushTokens)에 저장합니다.
 * - 저장된 토큰으로 Cloud Function이 새 구절 등록 시 푸시를 보냅니다.
 *
 * iOS는 "홈 화면에 추가된 앱(PWA)"에서 열었을 때만 푸시가 됩니다(사파리 탭 ❌, iOS 16.4+).
 */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, doc, setDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { getMessaging, getToken, onMessage, isSupported }
  from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js';
import { firebaseConfig } from './firebase-config.js';

/* ⚠️ 설정 필요: Firebase Console > 프로젝트 설정 > 클라우드 메시징 >
 *   "웹 푸시 인증서(Web Push certificates)"에서 생성한 공개 키(공개 VAPID 키)를 붙여넣으세요.
 *   이 값은 공개되어도 안전합니다. */
const VAPID_PUBLIC_KEY = 'BPRqNPfK0el8WlcpV9IR3s2ou6qNa4abKH_15WXmDJ036HQn_kBYk_IH2lTJZj6NUqrEq_c9z60ckzO8AusIF3c';

const btn  = document.getElementById('btnNotify');
const hint = document.getElementById('notifyHint');

function setHint(msg) { if (hint) hint.textContent = msg || ''; }
function setBtn(label, disabled) {
  if (!btn) return;
  const span = btn.querySelector('.notify-label') || btn;
  span.textContent = label;
  btn.disabled = !!disabled;
}

// iOS이면서 홈 화면 PWA로 실행된 상태가 아닌지 판별
const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

let app, db, messaging;

async function init() {
  if (!btn) return;

  const supported = await isSupported().catch(() => false);

  // iOS 사파리 탭(미설치) → 먼저 홈 화면에 추가하도록 안내
  if (isiOS && !isStandalone) {
    setBtn('홈 화면 추가 후 가능', true);
    setHint('아이폰은 위 "바로가기 만들기"로 홈 화면에 추가한 뒤, 그 앱에서 열면 알림을 켤 수 있어요.');
    return;
  }

  if (!supported || !('Notification' in window)) {
    setBtn('이 기기는 알림 미지원', true);
    setHint('');
    return;
  }

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  messaging = getMessaging(app);

  // 현재 권한 상태에 따라 버튼 표시
  if (Notification.permission === 'granted') {
    setBtn('알림 켜짐 ✓', false);
    setHint('새 암송 구절이 등록되면 알려드릴게요.');
    // 이미 허용된 경우 토큰을 갱신/보강
    registerToken().catch(() => {});
  } else if (Notification.permission === 'denied') {
    // 차단 상태: 앱에선 재요청 불가 → 눌러서 기기 설정 안내 팝업을 열도록 유지
    setBtn('알림 차단됨 · 켜는 법 보기', false);
    setHint('기기 설정에서 이 앱의 알림을 허용해 주세요.');
  } else {
    setBtn('새 구절 알림 받기', false);
    setHint('');
  }

  btn.addEventListener('click', onEnableClick);

  // 앱이 열려 있는 동안(포그라운드) 푸시가 오면 배지를 지웁니다.
  onMessage(messaging, () => {
    try { navigator.clearAppBadge && navigator.clearAppBadge(); } catch (e) {}
  });
}

async function onEnableClick() {
  // 차단된 경우: 권한 재요청이 막혀 있으므로 기기별 설정 안내 팝업을 띄움
  if (Notification.permission === 'denied') {
    openGuide();
    return;
  }
  setBtn('허용 요청 중…', true);
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      setBtn('새 구절 알림 받기', false);
      setHint('알림을 허용해야 새 구절 소식을 받을 수 있어요.');
      return;
    }
    await registerToken();
    setBtn('알림 켜짐 ✓', false);
    setHint('새 암송 구절이 등록되면 알려드릴게요.');
  } catch (e) {
    console.warn('[push] enable failed', e);
    setBtn('다시 시도', false);
    // 폰에서는 콘솔을 볼 수 없으므로 실제 실패 원인을 화면에 함께 표시합니다.
    const reason = (e && (e.code || e.message)) ? `${e.code || ''} ${e.message || ''}`.trim() : '알 수 없는 오류';
    setHint('알림 등록 실패: ' + reason);
  }
}

async function registerToken() {
  if (VAPID_PUBLIC_KEY.startsWith('PASTE_')) {
    console.warn('[push] VAPID 공개 키가 설정되지 않았습니다 (push.js).');
    throw new Error('VAPID key not set');
  }
  const token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY });
  if (!token) throw new Error('no token');

  // 토큰을 문서 ID로 저장 → 같은 기기 재등록 시 자동으로 덮어써 중복 방지
  await setDoc(doc(db, 'pushTokens', token), {
    token,
    ua: navigator.userAgent,
    platform: isiOS ? 'ios' : 'other',
    updatedAt: Date.now()
  }, { merge: true });

  return token;
}

/* ── 알림 차단 해제 안내 팝업 ───────────────────────────── */
const guideEl = document.getElementById('notifyGuide');

function detectPlatform() {
  if (isiOS) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

function openGuide() {
  if (!guideEl) {
    // 팝업 마크업이 없으면 최소한 안내만
    alert('기기 설정 → 이 앱(또는 브라우저) → 알림에서 "허용"으로 바꿔 주세요.');
    return;
  }
  const plat = detectPlatform();
  guideEl.querySelectorAll('.guide-steps').forEach((el) => {
    el.hidden = el.getAttribute('data-platform') !== plat;
  });
  guideEl.classList.add('show');
}

function closeGuide() {
  if (guideEl) guideEl.classList.remove('show');
}

if (guideEl) {
  const closeBtn = document.getElementById('guideCloseBtn');
  const refreshBtn = document.getElementById('guideRefreshBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeGuide);
  if (refreshBtn) refreshBtn.addEventListener('click', () => location.reload());
  // 배경 클릭 / ESC로 닫기
  guideEl.addEventListener('click', (e) => { if (e.target === guideEl) closeGuide(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && guideEl.classList.contains('show')) closeGuide();
  });
}

init();
