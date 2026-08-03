import {useAuth} from '../context/AuthContext';

/**
 * The signed-in driver's Driver.id, or null if this user isn't a driver.
 * Never falls back to user.id — Driver.id and User.id are separate
 * sequences, so that would silently resolve to a DIFFERENT driver's id
 * whenever the two happen to collide.
 */
export function useMyDriverId(): number | null {
  const {user} = useAuth();
  if (!user || user.role !== 'driver') return null;
  return user.linkedDriverId ?? null;
}

/** True only when this job is genuinely assigned to this driver. */
export function isMyJob(jobDriverId: number | undefined | null, myDriverId: number | null): boolean {
  return myDriverId != null && jobDriverId != null && jobDriverId === myDriverId;
}
