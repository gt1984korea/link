/* 빅토리처치 웹 푸시용 서비스워커 (의존성 0 · 순수 표준 API)
 *
 * 이전 버전은 gstatic에서 Firebase SDK를 importScripts로 불러와 실행했는데,
 * 일부 안드로이드 브라우저에서 그 평가 단계가 깨져 등록이 실패했습니다
 * ("messaging/failed-service-worker-registration: ServiceWorker script evaluation failed").
 *
 * FCM 토큰 발급(getToken)은 이 파일이 "유효한 서비스워커"이기만 하면 되고,
 * 푸시 표시는 표준 push 이벤트로 직접 처리하면 되므로 Firebase SDK가 필요 없습니다.
 * → importScripts 제거로 평가 실패 가능성을 원천 차단합니다.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
