// Great-circle distance in meters. (Identical to the mobile app's utils/geo.ts.)
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const WALK_SPEED_MPS = 1.3;
const DRIVE_SPEED_MPS = 3.5;
const NOMINAL_TRIP_METERS = 300;

export interface TripEstimate {
  progress: number; // 0..1
  etaMinutes: number;
  distanceRemainingM: number | null;
}

export function computeTrip(opts: {
  startLat?: number | null; startLng?: number | null;
  lat?: number | null; lng?: number | null;
  destinationLat?: number | null; destinationLng?: number | null;
  mode: 'walk' | 'drive';
}): TripEstimate | null {
  const {startLat, startLng, lat, lng, destinationLat, destinationLng, mode} = opts;
  if (lat == null || lng == null) return null;

  const speed = mode === 'walk' ? WALK_SPEED_MPS : DRIVE_SPEED_MPS;

  if (destinationLat != null && destinationLng != null) {
    const remaining = haversineMeters(lat, lng, destinationLat, destinationLng);
    const total = (startLat != null && startLng != null)
      ? haversineMeters(startLat, startLng, destinationLat, destinationLng)
      : remaining;
    const progress = total > 5
      ? Math.max(0, Math.min(1, 1 - remaining / total))
      : (remaining < 15 ? 1 : 0);
    const etaMinutes = Math.max(0, Math.round(remaining / speed / 60));
    return {progress, etaMinutes, distanceRemainingM: Math.round(remaining)};
  }

  if (startLat == null || startLng == null) return null;
  const traveled = haversineMeters(startLat, startLng, lat, lng);
  const progress = Math.max(0, Math.min(1, traveled / NOMINAL_TRIP_METERS));
  const remaining = Math.max(0, NOMINAL_TRIP_METERS - traveled);
  const etaMinutes = Math.max(0, Math.round(remaining / speed / 60));
  return {progress, etaMinutes, distanceRemainingM: null};
}
