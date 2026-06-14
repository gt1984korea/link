/* Firebase Cloud Messaging 백그라운드 서비스워커
 * 앱이 닫혀 있을 때(또는 백그라운드일 때) 새 암송 구절 푸시를 받아
 * 알림을 띄우고 홈 화면 아이콘에 빨간 배지(setAppBadge)를 표시합니다.
 *
 * 주의: 이 파일은 FCM이 자동으로 '/firebase-messaging-sw.js' 경로에서 찾습니다.
 *        반드시 사이트 루트에 위치해야 하며, index.html과 같은 Firebase 버전(10.12.5)을 씁니다.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDcz1pXcFf8a5vwjQSO7Xz4jU7F6lL_ZEs',
  authDomain: 'victorychurch-665a9.firebaseapp.com',
  projectId: 'victorychurch-665a9',
  storageBucket: 'victorychurch-665a9.firebasestorage.app',
  messagingSenderId: '520614301251',
  appId: '1:520614301251:web:1d5394f050346f9c17cef6'
});

const messaging = firebase.messaging();

// 데이터 전용 메시지를 받아 직접 알림 + 아이콘 배지를 띄웁니다.
// (iOS 웹 푸시는 푸시마다 사용자에게 보이는 알림이 반드시 있어야 하므로 여기서 알림을 표시합니다.)
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || '빅토리처치';
  const body = data.body || '새 암송 구절이 등록되었어요.';

  // 홈 화면 아이콘 빨간 배지 (iOS 16.4+, Android 지원)
  try {
    if (self.navigator && self.navigator.setAppBadge) {
      self.navigator.setAppBadge(1);
    }
  } catch (e) {}

  return self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.png?v=4',
    badge: '/icon-192.png?v=4',
    tag: 'memory-verse',           // 같은 태그는 알림을 덮어써서 중복 방지
    renotify: true,
    data: { url: data.url || '/' }
  });
});

// 알림을 탭하면 앱을 열고(또는 포커스) 배지를 지웁니다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  try {
    if (self.navigator && self.navigator.clearAppBadge) {
      self.navigator.clearAppBadge();
    }
  } catch (e) {}

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
