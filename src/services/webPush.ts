// Web FCM wiring — mirrors the mobile app's pushMessaging.ts. This is the
// delivery path that still works when no tab is open: the token registered
// here lands in the same DeviceToken table the backend pushes to, and the
// service worker (public/sw.js) raises the notification.
//
// Everything is guarded: until FIREBASE_CONFIG.appId + FCM_VAPID_KEY are
// filled in (src/config/firebase.ts explains where to mint them), every
// function silently no-ops — sockets still cover every open-tab case.
import {FIREBASE_CONFIG, FCM_VAPID_KEY} from '../config/firebase';
import {notificationsApi} from './api';
import {ringAlarm, playChime} from './alarm';

export async function initWebPush(swRegistration: ServiceWorkerRegistration | null): Promise<() => void> {
  if (!FIREBASE_CONFIG.appId || !FCM_VAPID_KEY || !swRegistration) return () => {};
  if (!('Notification' in window)) return () => {};

  try {
    const perm = await window.Notification.requestPermission();
    if (perm !== 'granted') return () => {};

    const {initializeApp, getApps} = await import('firebase/app');
    const {getMessaging, getToken, onMessage, isSupported} = await import('firebase/messaging');
    if (!(await isSupported())) return () => {};

    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (token) await notificationsApi.registerDevice(token, 'web').catch(() => {});

    // Foreground pushes: the socket usually beats FCM while a tab is open,
    // but if one lands here, ring/chime the same way the socket path does.
    const unsub = onMessage(messaging, payload => {
      const data = (payload?.data ?? {}) as Record<string, string>;
      if (data.type === 'alarm') ringAlarm();
      else playChime();
    });
    return unsub;
  } catch {
    return () => {};
  }
}

/**
 * Called on logout, while the session token is still valid — drops this
 * browser's registration so it stops receiving the signed-out account's
 * pushes instead of staying bound to it until someone else logs in here.
 * Mirrors the mobile app's unregisterCurrentDevice().
 */
export async function unregisterCurrentWebPush(): Promise<void> {
  if (!FIREBASE_CONFIG.appId || !FCM_VAPID_KEY) return;
  try {
    const {getApps} = await import('firebase/app');
    const {getMessaging, getToken, isSupported} = await import('firebase/messaging');
    if (!(await isSupported())) return;
    const app = getApps()[0];
    if (!app) return; // never initialized this session — nothing to unregister
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {vapidKey: FCM_VAPID_KEY});
    if (token) await notificationsApi.unregisterDevice(token);
  } catch {
    // Best-effort — never block logout over this.
  }
}
