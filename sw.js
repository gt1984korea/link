/* 서비스워커 v5 — 정적 자산 캐싱 + 안드로이드 PWA 설치 요건 충족
 * HTML 내비게이션은 network-first(최신 우선), 그 외 동일 출처는 stale-while-revalidate */
const CACHE = 'vc-v8';
const PRECACHE = ['/', '/firebase-config.js', '/a2hs.js', '/icon-192.png?v=7', '/icon-512.png?v=7'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
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
