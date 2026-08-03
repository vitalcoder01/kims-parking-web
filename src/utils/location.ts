// Best-effort current fix — used any time a screen needs to capture "where
// is this browser right now" as a real destination/anchor point (valet's
// counter for a park trip's return leg, doctor's own position for a
// retrieval). Resolves null on denied permission/timeout/unsupported browser
// rather than throwing — every caller has a sane fallback for "no GPS".
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
