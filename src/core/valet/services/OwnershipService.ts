import type {ParkingTask} from '../../../context/AppStateContext';

/**
 * Every ownership rule the valet module has, in one place. Ported verbatim
 * from useValetActions.ts's isMyJobToRun/isMyRetrieval and the inline
 * `claimable` check in ValetHomeScreen.handleAssignDriverTo — behavior is
 * unchanged, only the location and (for canClaim) the name.
 *
 * Ownership is genuinely two separate, overlapping concepts on a
 * ParkingTask — this service keeps them as two functions rather than
 * collapsing them into one, because they answer different questions and
 * the plan's own success criteria says not to blur behavior for the sake
 * of a tidier API:
 *   - valetId/escalatedAt: who's running THIS JOB right now (canRun).
 *   - retrievalOwnerValetId/arrivalOwnerValetId/recoveryBroadcastAt: who
 *     owns the doctor's whole SESSION, which gates whether an unclaimed
 *     retrieval request is even visible to a given valet (canView).
 */

/** Who is currently dispatching this job (assign driver / key handover /
 *  recall), if anyone. Mirrors the backend's own valetId field — this is
 *  just "read it back", not a computed rule. */
export function getOwnerValetId(t: ParkingTask): number | null {
  return t.valetId ?? null;
}

/** True if `myValetId` is allowed to act on this job right now — assign a
 *  driver, mark the key collected, recall it. An escalated job (stalled
 *  past its owner) opens back up to everyone; an unowned job was never
 *  anyone's alone. */
export function canRun(t: ParkingTask, myValetId: number | null | undefined): boolean {
  if (t.valetId == null) return true;
  if (t.valetId === myValetId) return true;
  const needsDriver = t.status === 'assigned' && !t.driverId;
  return !!t.escalatedAt && needsDriver;
}

/** True if a retrieval request should even be VISIBLE to `myValetId` — the
 *  session-ownership gate, distinct from canRun above. Mirrors
 *  isVisibleToValet() in the backend's task.service.js. */
export function canView(t: ParkingTask, myValetId: number | null | undefined): boolean {
  const owner = t.retrievalOwnerValetId ?? t.arrivalOwnerValetId;
  if (owner == null) return true;                       // never owned — open floor
  if (owner === myValetId) return true;                 // mine
  if (t.retrievalOwnerValetId != null) return t.escalatedAt != null;
  return t.recoveryBroadcastAt != null || t.escalatedAt != null;
}

/** True if `myValetId` tapping "Assign driver" on this retrieval should
 *  ALSO fire the accept-retrieval claim first (see
 *  ValetHomeScreen.handleAssignDriverTo for why claiming happens
 *  synchronously with opening the driver picker, not before it). Only
 *  retrieve jobs have a claim step — a park job has no retrieval to
 *  accept. */
export function canClaim(t: ParkingTask, myValetId: number | null | undefined): boolean {
  return t.type === 'retrieve'
    && myValetId != null
    && (t.status === 'requested' || t.status === 'accepted')
    && t.retrievalOwnerValetId !== myValetId;
}

/** Read-only: has this job stalled past its owner and opened to the team?
 *  (The escalation decision itself is the backend watchdog's — this just
 *  reads the flag it sets.) */
export function isEscalated(t: ParkingTask): boolean {
  return t.escalatedAt != null;
}

/** Read-only: did the session owner's response window lapse, releasing
 *  this retrieval to every valet? (Same caveat as isEscalated — the
 *  backend decides, this reads the result.) */
export function isUnderRecovery(t: ParkingTask): boolean {
  return t.recoveryBroadcastAt != null;
}

/** Two-station handoff model: whether this job counts as "mine" on the
 *  Dashboard's My Jobs / Team Jobs split, on top of canRun's ownership
 *  check. A gate valet's park job keeps valetId (and so canRun/"mine")
 *  pointing at the gate valet for its whole life — write-once, by design,
 *  it's the record of who ran the arrival. But once that job is out with a
 *  driver, finishing it is the LOT valet's job right now, not the gate
 *  valet's — and the mirror is true for a gate valet confirming a
 *  retrieval has arrived. Without this, canRun's strict valetId ownership
 *  buried a card asking a specific valet for action under Team Jobs,
 *  reading as background noise about someone else's job instead of a
 *  clear, prominent thing to do — the exact report that led here: a lot
 *  valet couldn't find anything to act on after a gate handoff, because it
 *  never showed under My Jobs. Purely a display grouping, not a
 *  permission — confirmParkedByValet/confirmArrivedByValet were always
 *  callable regardless of this split; this only makes them easy to find. */
export function isMyStationJob(t: ParkingTask, myStation: 'gate' | 'lot' | null | undefined): boolean {
  if (myStation === 'lot') {
    return t.type === 'park' && (t.status === 'key_collected' || t.status === 'in_transit');
  }
  if (myStation === 'gate') {
    return t.type === 'retrieve' && t.status === 'in_transit';
  }
  return false;
}

// Backward-compatible aliases — useValetActions.ts re-exports these under
// their original names so no call site elsewhere has to change.
export const isMyJobToRun = canRun;
export const isMyRetrieval = canView;
