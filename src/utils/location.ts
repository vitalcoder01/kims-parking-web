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
