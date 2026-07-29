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
  navigator.vibrate?.([300, 150, 300]);
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
  navigator.vibrate?.(0);
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
  navigator.vibrate?.(120);
}
