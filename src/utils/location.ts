// Best-effort current fix — browser equivalent of the app's utils/location.ts.
// Resolves null on denied permission or timeout rather than throwing, since
// every caller has a sane fallback for "no GPS available".
export async function getCurrentPositionSafe(): Promise<{lat: number; lng: number} | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({lat: pos.coords.latitude, lng: pos.coords.longitude}),
      () => resolve(null),
      {enableHighAccuracy: true, timeout: 8000, maximumAge: 10000},
    );
  });
}

// A retrieval request previously only ever called getCurrentPositionSafe()
// at the exact moment the doctor clicked Confirm — meaning the browser's
// native permission prompt (and the up-to-8s GPS fix itself) both happened
// for the first time mid-action, with the doctor blocked staring at a
// spinner, and silently produced a destination-less trip if permission was
// denied or timed out. warmLocation() lets a caller request+cache a fix
// proactively, earlier, in a moment that's already contextually justified
// (e.g. as soon as the car is confirmed parked) — by the time the doctor
// actually taps Confirm, getFreshOrCachedPosition() below returns instantly.
const CACHE_MAX_AGE_MS = 30_000;
let cachedPosition: {lat: number; lng: number; at: number} | null = null;

export function warmLocation(): void {
  getCurrentPositionSafe().then(pos => {
    if (pos) cachedPosition = {...pos, at: Date.now()};
  }).catch(() => {});
}

export async function getFreshOrCachedPosition(): Promise<{lat: number; lng: number} | null> {
  if (cachedPosition && Date.now() - cachedPosition.at < CACHE_MAX_AGE_MS) {
    return {lat: cachedPosition.lat, lng: cachedPosition.lng};
  }
  const pos = await getCurrentPositionSafe();
  if (pos) cachedPosition = {...pos, at: Date.now()};
  return pos;
}
