import {buildReport, shouldSend} from '../core/copilot/reporter';
import {diagnosticsApi} from './api';

/*
 * Gets a crash off the browser and into something you can read.
 *
 * The motivating failure is this app's own: a hook stranded below an early
 * return took down the valet Jobs screen in production, produced a blank
 * page carrying no information, and was found hours later only because
 * someone photographed it. The error boundary added afterwards made it
 * legible on screen; this makes it legible to whoever can fix it, without
 * anyone having to notice and report it by hand.
 *
 * Three sources, because React sees only one:
 *
 *   - render errors        -> ErrorBoundary calls report()
 *   - uncaught errors      -> window 'error'
 *   - unhandled rejections -> window 'unhandledrejection'
 *
 * The last two matter most here: an async click handler that throws is not
 * a render error, and no boundary will ever see it.
 */

const APP_VERSION = (import.meta as {env?: Record<string, string>}).env?.VITE_APP_VERSION ?? 'web';

let currentScreen: string | undefined;

export function setCurrentScreen(name: string | undefined) {
  currentScreen = name;
}

/**
 * Send one fault. Never throws — a reporter that can fail is a second bug
 * layered on the one being reported, firing exactly when the app is least
 * able to cope.
 */
export function report(err: unknown): void {
  try {
    const r = buildReport(err, {platform: 'web', appVersion: APP_VERSION, screen: currentScreen});
    // Once per session per fault. The backend rate-limits too, but a wedged
    // client should not be relying on the server to stop it hammering.
    if (!shouldSend(r.fingerprint)) return;
    diagnosticsApi.reportError(r).catch(() => {
      /* Offline, signed out, or the backend is the broken thing. A dropped
         crash report is not worth surfacing to the user. */
    });
  } catch {
    /* Reporting must never be the reason something fails. */
  }
}

let installed = false;

/** Install both window handlers. Idempotent; call once at startup. */
export function installCrashReporting(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', ev => report(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', ev => report(ev.reason));
}
