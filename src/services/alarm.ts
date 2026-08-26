// Web alarm system — the browser counterpart of the mobile app's
// ringAssignmentAlarm (notifications.ts): a loud, looping two-tone siren
// via WebAudio + vibration, used for alarm-grade events (task initiated /
// driver assigned / reassign warnings).
//
// Chrome's autoplay policy only lets an AudioContext actually run sound if
// it was created/resumed during a real user gesture (click/tap/keydown) —
// one created later from an async socket callback stays 'suspended'
// forever and plays silently. unlockOnFirstGesture() below listens for the
// page's first click/touchstart/keydown (capture phase, fires once) and
// creates+resumes the context there, so by the time any later alarm fires
// asynchronously the context is already running.

let ctx: AudioContext | null = null;
let stopFlag = false;
let ringing = false;
let autoStopTimer: number | undefined;

function createCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function ensureCtx(): AudioContext | null {
  // Called from an async event (socket message) — never itself a gesture.
  // Still worth attempting: some browsers unlock on ANY resume() call, and
  // if unlockOnFirstGesture() already ran, ctx is already live here anyway.
  return createCtx();
}

let unlocked = false;
/** Call once, early, from a real user-gesture handler (or globally on first
 *  page interaction) so later async alarms are guaranteed to have sound. */
export function unlockOnFirstGesture() {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;
  const unlock = () => {
    createCtx();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/*
 * Vibration, attempted only when the browser will actually allow it.
 *
 * Chrome gates navigator.vibrate behind "sticky activation" -- the page must
 * have received at least one real click/tap/keypress in its lifetime. An
 * alarm is asynchronous by nature (it fires from a socket message, not a
 * gesture), so on a page nobody has touched yet every call is blocked and
 * logged as an Intervention. sirenCycle fires one per 1.2s cycle for the
 * full 45s ring, so a single unattended alarm printed roughly 37 console
 * errors and vibrated nothing.
 *
 * Checking hasBeenActive does not make vibration work where it was blocked
 * -- nothing in-page can -- it stops the app pretending it did and drowning
 * the console at the exact moment someone is trying to read it.
 *
 * navigator.userActivation is Chromium-only. Where it is absent (Firefox,
 * and Safari which has no vibrate at all) we attempt the call as before
 * rather than assume a restriction that browser may not have.
 *
 * The reliable path for a phone sitting untouched is not this: it is the
 * service worker's showNotification({vibrate}), which is not gated on
 * activation. See public/sw.js. This stays as the in-page enhancement for
 * when the tab is already open and in use.
 */
function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const activation = (navigator as any).userActivation;
  if (activation && activation.hasBeenActive === false) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* Some browsers throw instead of returning false when blocked. */
  }
}

function tone(freq: number, at: number, dur: number, gainDb = 0.28) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainDb, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function sirenCycle() {
  if (!ctx || stopFlag) { ringing = false; return; }
  const t = ctx.currentTime;
  // two-tone "assignment alarm" pattern, ~1.2s per cycle
  tone(880, t, 0.25);
  tone(660, t + 0.3, 0.25);
  tone(880, t + 0.6, 0.25);
  vibrate([300, 150, 300]);
  window.setTimeout(sirenCycle, 1200);
}

/** Ring the looping alarm (idempotent — re-calling refreshes, never stacks). */
export function ringAlarm(autoStopMs = 45000) {
  if (!ensureCtx()) return;
  stopFlag = false;
  window.clearTimeout(autoStopTimer);
  autoStopTimer = window.setTimeout(() => stopAlarm(), autoStopMs);
  if (!ringing) {
    ringing = true;
    sirenCycle();
  }
}

export function stopAlarm() {
  stopFlag = true;
  ringing = false;
  window.clearTimeout(autoStopTimer);
  vibrate(0);
}

export function isAlarmRinging() {
  return ringing && !stopFlag;
}

/** Short two-note chime for ordinary (non-alarm) notifications. */
export function playChime() {
  if (!ensureCtx() || !ctx) return;
  const t = ctx.currentTime;
  const soft = (freq: number, at: number, dur: number) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.15, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };
  soft(740, t, 0.18);
  soft(988, t + 0.16, 0.28);
  vibrate(120);
}
