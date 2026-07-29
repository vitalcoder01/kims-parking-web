// Registers /sw.js once (PWA caching + FCM background push live in the same
// worker) and hands the registration to whoever needs it (webPush.ts).
let regPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (regPromise) return regPromise;
  if (!('serviceWorker' in navigator)) {
    regPromise = Promise.resolve(null);
    return regPromise;
  }
  regPromise = navigator.serviceWorker
    .register('/sw.js')
    .catch(() => null);
  return regPromise;
}

export function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  return registerServiceWorker();
}
