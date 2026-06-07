/* 최소 서비스워커 — 안드로이드 '앱 설치' 조건 충족용 (캐싱 없음) */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () { /* 네트워크 그대로 사용 */ });
