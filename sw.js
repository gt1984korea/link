/* 서비스워커 v6 — 정적 자산 캐싱 + 안드로이드 PWA 설치 요건 충족
 * HTML 내비게이션은 network-first(최신 우선), 그 외 동일 출처는 stale-while-revalidate */
const CACHE = 'vc-v9';
const PRECACHE = ['/', '/firebase-config.js', '/a2hs.js', '/icon-192.png?v=7', '/icon-512.png?v=7'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 외부 CDN(Firebase, Google Fonts 등)은 브라우저 기본 HTTP 캐시에 위임
  if (url.origin !== self.location.origin) return;

  // HTML 페이지 이동은 항상 최신을 우선 사용(배포 즉시 반영), 오프라인일 때만 캐시 폴백
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('/')))
    );
    return;
  }

  // 그 외 동일 출처 GET: stale-while-revalidate (캐시 즉시 반환 + 백그라운드 갱신)
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});

// FCM이 보낸 푸시 수신 → 알림 표시 + 홈 화면 아이콘 배지(iOS 16.4+/Android)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    try { payload = { data: { body: event.data && event.data.text() } }; } catch (_) {}
  }

  // 데이터 메시지(data) 우선, 없으면 notification, 그래도 없으면 최상위에서 읽기
  const d = payload.data || payload.notification || payload || {};
  const title = d.title || '빅토리처치';
  const body = d.body || '새 암송 구절이 등록되었어요.';
  const url = d.url || '/';

  try {
    if (self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge(1);
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png?v=4',
      badge: '/icon-192.png?v=4',
      tag: 'memory-verse',   // 같은 태그는 알림을 덮어써 중복 방지
      renotify: true,
      data: { url: url }
    })
  );
});

// 알림 탭 → 앱 열기/포커스 + 배지 제거
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  try {
    if (self.navigator && self.navigator.clearAppBadge) self.navigator.clearAppBadge();
  } catch (e) {}

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

