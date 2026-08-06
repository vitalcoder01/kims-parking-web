/* KIMS Parking web — one service worker for both jobs:
 *  1. PWA app-shell caching so the installed app opens instantly / offline.
 *  2. FCM background push — the delivery path that still works when no tab
 *     is open (the browser wakes this worker for a high-priority push, and
 *     it raises the notification, alarm-grade for type 'alarm').
 *
 * Mirrors the mobile app's pushMessaging.ts: everything Firebase is guarded —
 * until FIREBASE_CONFIG.appId + VAPID are filled in (see src/config/
 * firebase.ts for where to mint them), push init silently no-ops and the
 * worker still does PWA caching.
 */

/* ── FCM background messaging ─────────────────────────────────────────── */
// This file is served as a static asset (Vite doesn't bundle public/), so it
// can't read import.meta.env — the actual values live in .env and get
// appended to the registration URL by swRegistration.ts (e.g.
// /sw.js?apiKey=...&projectId=...). Never hardcode real values here.
const swParams = new URLSearchParams(self.location.search);
const FIREBASE_CONFIG = {
  apiKey: swParams.get('apiKey') || '',
  projectId: swParams.get('projectId') || '',
  messagingSenderId: swParams.get('messagingSenderId') || '',
  storageBucket: swParams.get('storageBucket') || '',
  appId: swParams.get('appId') || '',
};

if (FIREBASE_CONFIG.appId) {
  try {
    importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
    firebase.initializeApp(FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    // Backend sends data-only messages ({title, body, type, ...}) — see
    // kims-parking-backend/src/services/push.service.js.
    messaging.onBackgroundMessage(payload => {
      const data = (payload && payload.data) || {};
      const title = data.title || 'KIMS Parking';
      const body = data.body || '';
      const isAlarm = data.type === 'alarm';
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: isAlarm ? 'kims-alarm' : `kims-${Date.now()}`,
        renotify: isAlarm,
        requireInteraction: isAlarm,
        vibrate: isAlarm ? [400, 200, 400, 200, 400, 200, 400] : [200, 100, 200],
        data: {type: data.type || 'info'},
      });
    });
  } catch (e) {
    /* Firebase unavailable — PWA caching below still works. */
  }
}

// Tapping a notification focuses (or opens) the app.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});

/* ── PWA app-shell caching ────────────────────────────────────────────── */
// Bump this string on every deploy that should force an update check. Since
// hashed JS/CSS filenames change per build but this FILE didn't always
// change too, the browser's normal "new service worker available" detection
// never fired — installed/already-open tabs kept running old code
// indefinitely with no way to know a fix had shipped. Changing this value
// makes sw.js itself byte-different each time, which the browser DOES
// detect, triggering the update flow that UpdateBanner listens for.
const CACHE = 'kims-parking-web-v23';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  // Deliberately no skipWaiting() here — a freshly installed worker waits
  // until the page asks it to take over (see the message listener below),
  // so an update never yanks the UI out from under someone mid-action. The
  // waiting state is exactly what registration.onupdatefound/.waiting
  // detects to show the "Update available" banner.
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never intercept API/socket traffic — realtime data must always be live.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  // Navigations: network-first, fall back to the cached shell when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Hashed build assets: cache-first (immutable filenames).
  event.respondWith(
    caches.match(event.request).then(hit => {
      if (hit) return hit;
      return fetch(event.request).then(res => {
        if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, copy));
        }
        return res;
      });
    }),
  );
});
