// Registers /sw.js once (PWA caching + FCM background push live in the same
// worker) and hands the registration to whoever needs it (webPush.ts) — plus
// update detection, so an already-open tab can tell the user a new deploy
// has shipped instead of silently running stale JS forever.
import {FIREBASE_CONFIG} from '../config/firebase';

let regPromise: Promise<ServiceWorkerRegistration | null> | null = null;

// sw.js is a static file Vite doesn't bundle, so it can't read import.meta.env
// — hand it the same Firebase config via the registration URL instead of
// hardcoding real values in a committed file.
function swUrl(): string {
  const params = new URLSearchParams();
  if (FIREBASE_CONFIG.apiKey) params.set('apiKey', FIREBASE_CONFIG.apiKey);
  if (FIREBASE_CONFIG.projectId) params.set('projectId', FIREBASE_CONFIG.projectId);
  if (FIREBASE_CONFIG.messagingSenderId) params.set('messagingSenderId', FIREBASE_CONFIG.messagingSenderId);
  if (FIREBASE_CONFIG.storageBucket) params.set('storageBucket', FIREBASE_CONFIG.storageBucket);
  if (FIREBASE_CONFIG.appId) params.set('appId', FIREBASE_CONFIG.appId);
  const qs = params.toString();
  return qs ? `/sw.js?${qs}` : '/sw.js';
}

type UpdateListener = () => void;
const updateListeners = new Set<UpdateListener>();

function notifyUpdateAvailable() {
  updateListeners.forEach(l => l());
}

export function onUpdateAvailable(listener: UpdateListener): () => void {
  updateListeners.add(listener);
  return () => updateListeners.delete(listener);
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (regPromise) return regPromise;
  if (!('serviceWorker' in navigator)) {
    regPromise = Promise.resolve(null);
    return regPromise;
  }

  regPromise = navigator.serviceWorker
    .register(swUrl())
    .then(reg => {
      // A worker already sitting in 'waiting' when we register (e.g. a
      // background tab that missed the install event) is itself an
      // available update.
      if (reg.waiting) notifyUpdateAvailable();

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // 'installed' + an existing controller means this is an UPDATE,
          // not the very first install (no controller yet) — only the
          // former is something to tell the user about.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdateAvailable();
          }
        });
      });

      // Catches updates published while this tab was already open —
      // browsers check for a new sw.js on navigation/reload automatically,
      // but a long-lived open tab otherwise wouldn't notice for a while.
      const recheck = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') recheck();
      });
      window.setInterval(recheck, 30 * 60 * 1000);

      return reg;
    })
    .catch(() => null);

  return regPromise;
}

/** Activates the waiting worker and reloads once it takes control. */
export function applyServiceWorkerUpdate() {
  regPromise?.then(reg => {
    if (!reg?.waiting) return;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return; // controllerchange can fire more than once
      reloaded = true;
      window.location.reload();
    });
    reg.waiting.postMessage('SKIP_WAITING');
  });
}

export function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  return registerServiceWorker();
}
