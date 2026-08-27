import {getSocket} from './socket';
import {getSyncState} from './syncClock';

/*
 * "Why am I not getting alerts?" — answered in the browser, by the person
 * holding the phone.
 *
 * Same purpose as the mobile check, different failure surface. On web there
 * is no notifee and no channel: alerts depend on the browser's Notification
 * permission and on a service worker being registered and active, and both
 * can be denied or evicted without the app noticing. An installed PWA whose
 * worker was evicted looks completely healthy and silently stops alerting —
 * the web equivalent of the channel failure that made 1.9.12 alert nobody.
 *
 * Each row answers one question, so the diagnosis is which part is broken
 * rather than "notifications don't work".
 */

export type HealthState = 'ok' | 'warn' | 'fail' | 'checking';

export interface HealthItem {
  key: 'connection' | 'sync' | 'permission' | 'worker';
  label: string;
  state: HealthState;
  detail: string;
  fix?: 'requestPermission';
}

const MIN = 60_000;

export async function runHealthCheck(): Promise<HealthItem[]> {
  const items: HealthItem[] = [];
  const now = Date.now();

  const connected = getSocket()?.connected ?? false;
  items.push({
    key: 'connection',
    label: 'Live connection',
    state: connected ? 'ok' : 'fail',
    detail: connected
      ? 'Receiving live updates.'
      : 'Not connected — the screen may be showing old information.',
  });

  // Distinguishes "quiet" from "stuck": a socket can report connected while
  // nothing has actually landed for an hour.
  const {lastSyncAt, lastSyncFailedAt} = getSyncState();
  const age = lastSyncAt == null ? null : now - lastSyncAt;
  items.push({
    key: 'sync',
    label: 'Last refresh',
    state: age == null ? 'warn' : age > 10 * MIN ? 'warn' : 'ok',
    detail: age == null
      ? 'Nothing has loaded yet this session.'
      : `${Math.max(1, Math.round(age / MIN))} min ago${lastSyncFailedAt ? ' — the last attempt failed.' : '.'}`,
  });

  // Browser permission. Once denied, Chrome will not prompt again from a
  // button — it has to be changed in site settings, so the copy says so
  // rather than offering a fix that cannot work.
  const supported = typeof Notification !== 'undefined';
  const perm = supported ? Notification.permission : 'unsupported';
  items.push({
    key: 'permission',
    label: 'Notification permission',
    state: perm === 'granted' ? 'ok' : perm === 'default' ? 'warn' : 'fail',
    detail:
        !supported ? 'This browser does not support notifications.'
      : perm === 'granted' ? 'Alerts are allowed.'
      : perm === 'default' ? 'Not asked yet — allow alerts to hear job assignments.'
      : 'Blocked. Chrome will not ask again from here — change it in site settings (tap the padlock in the address bar).',
    fix: perm === 'default' ? 'requestPermission' : undefined,
  });

  // The service worker is what raises a notification when no tab is open.
  // Without an ACTIVE one, background alerts silently do not happen.
  let workerState: HealthState = 'fail';
  let workerDetail = 'Service worker not registered — background alerts will not arrive.';
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.active) {
        workerState = 'ok';
        workerDetail = 'Background alerts are set up.';
      } else if (reg) {
        workerState = 'warn';
        workerDetail = 'Registered but not active yet — reload the page.';
      }
    } else {
      workerDetail = 'This browser does not support background alerts.';
    }
  } catch {
    workerDetail = 'Could not check the service worker.';
  }
  items.push({key: 'worker', label: 'Background alerts', state: workerState, detail: workerDetail});

  return items;
}

/**
 * Asks the browser. Only offered while permission is still 'default' — once
 * denied, this call resolves instantly without prompting, and offering a
 * button that silently does nothing is worse than offering none.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}
