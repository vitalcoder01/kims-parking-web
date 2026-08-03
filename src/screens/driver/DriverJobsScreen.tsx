import React, {useState, useEffect} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useMyDriverId, isMyJob} from '../../hooks/useMyDriverId';
import {useAppState} from '../../context/AppStateContext';
import {useTheme} from '../../context/ThemeContext';
import {computeTrip} from '../../utils/geo';
import {Icon, IconName} from '../../components/Icon';
import {PressableScale} from '../../components/PressableScale';

// Direct port of the mobile app's driver DriverJobsScreen — the driver's
// current assigned job (accept/reject, key-collected, in-transit, parked,
// delivered/returned) plus today's completed list, DOM/CSS in place of RN's
// View/Text/StyleSheet/Animated. The route progress bar that mobile animates
// with Animated.Value is done here with a plain CSS width transition instead
// — same visual result, no native driver to opt out of.
//
// Also adds a "Visitor Pickups" section that mobile doesn't have yet: a
// visitor's park/retrieve leg already runs through the exact same
// ParkingTask machinery as a staff job (see the backend's visitor.service.js
// and task.service.js), so it already shows up as this driver's Active Job
// above with the normal actions — but serializeTask deliberately withholds
// the visitor's phone number from every driver's task view (the same
// widening-of-privacy-surface the backend comment there warns about), so
// there's genuinely new information to show here: the Visitor record itself,
// filtered to the ones assigned to this driver, has the mobile number the
// task card doesn't.

function SkeletonBlock({height, width = '100%', radius = 10, style}: {height: number; width?: number | string; radius?: number; style?: React.CSSProperties}) {
  const {colors} = useTheme();
  return <div className="pulse" style={{height, width, borderRadius: radius, backgroundColor: colors.cardAlt, ...style}} />;
}

function SkeletonCard({lines = 3, style}: {lines?: number; style?: React.CSSProperties}) {
  const {colors} = useTheme();
  return (
    <div style={{borderRadius: 22, border: `1px solid ${colors.border}`, padding: 20, backgroundColor: colors.surface, ...style}}>
      <SkeletonBlock height={14} width="40%" style={{marginBottom: 14}} />
      {Array.from({length: lines}, (_, i) => (
        <SkeletonBlock key={i} height={16} width={i === lines - 1 ? '55%' : '85%'} style={{marginBottom: 10}} />
      ))}
    </div>
  );
}

export function DriverJobsScreen() {
  const {user} = useAuth();
  const {tasks, slots, visitors, markParked, markRetrieved, updateTask, pushNotification,
    acceptTask, rejectTask, fetchTaskHistory, markTaskReturned,
    hydrated, refreshTasks} = useAppState();
  const {colors: c} = useTheme();

  const [slotInput, setSlotInput] = useState('');
  // Guards handleMarkParked against a double-tap firing the same "mark
  // parked" call twice while the first is still in flight.
  const [markingParked, setMarkingParked] = useState(false);
  // Shared guard for the rest of the one-tap job actions below (accept,
  // reject, start retrieval, mark returned, mark retrieved) — only one of
  // them is ever visible at a time for a given task stage, so a single flag
  // is enough. None of these had any guard at all before: a slow response
  // left the button tappable, and a second tap either fired the same action
  // twice or landed after the job had already moved past that stage.
  const [actionBusy, setActionBusy] = useState(false);

  const myDriverId = useMyDriverId();
  // 'delivered' means the driver's own part is already done (car dropped at
  // the valet counter) — it's just awaiting the valet's confirmation now,
  // so it shouldn't keep sitting here as this driver's "current job".
  const myTasks = tasks.filter(t => isMyJob(t.driverId, myDriverId) && t.status !== 'completed' && t.status !== 'delivered' && t.status !== 'cancelled');
  const activeTask = myTasks[0] ?? null;

  // The live `tasks` array is bounded to "at most one row per doctor" now —
  // a completed job vanishes from it the moment that doctor's next car comes
  // in, so "completed today" needs the real history, not this list.
  const [history, setHistory] = useState<typeof tasks>([]);
  useEffect(() => {
    if (!myDriverId) return;
    fetchTaskHistory({driverId: myDriverId}).then(setHistory).catch(() => {});
  }, [myDriverId, fetchTaskHistory, tasks.length]);
  const today = new Date().toDateString();
  const completedToday = history.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).toDateString() === today);

  // Visitor pickups/retrievals assigned to this driver — same filter the
  // dashboard uses. Informational only: the actual accept/park/retrieve
  // actions live on the Active Job card above (same underlying task), this
  // just surfaces the visitor contact details that card can't show.
  const myVisitorJobs = visitors.filter(v => isMyJob(v.driverId, myDriverId)
    && (v.status === 'pending' || (v.status === 'parked' && v.retrievalRequested)));

  const trip = computeTrip({
    startLat: activeTask?.driverStartLat, startLng: activeTask?.driverStartLng,
    lat: activeTask?.driverLat, lng: activeTask?.driverLng,
    destinationLat: activeTask?.destinationLat, destinationLng: activeTask?.destinationLng,
    mode: 'drive',
  });
  const liveProgress = trip?.progress ?? 0;

  // A driver tapping Accept on a card the server has already invalidated is
  // the normal end of a stalled assignment, not an error they did anything
  // wrong about: the watchdog rolled it back, or the valet gave it to someone
  // else. The mobile app tells the two cases apart via a JOB_GONE error code
  // (services/api.ts's isJobGone) and shows a softer "reassigned" message for
  // it; the web client's api.ts collapses every failure to a plain Error
  // with just a message, so that distinction isn't available here — every
  // failure gets the same alert, with the server's own message.
  const handleActionError = (err: any, fallback: string) => {
    window.alert(err?.message || fallback);
  };

  const handleAcceptTask = async () => {
    if (!activeTask || actionBusy) return;
    setActionBusy(true);
    try {
      await acceptTask(activeTask.id);
    } catch (err: any) {
      handleActionError(err, 'Could not accept task');
      await refreshTasks().catch(() => {});
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectTask = async () => {
    if (!activeTask || actionBusy) return;
    setActionBusy(true);
    try {
      await rejectTask(activeTask.id);
    } catch (err: any) {
      handleActionError(err, 'Could not reject task');
      await refreshTasks().catch(() => {});
    } finally {
      setActionBusy(false);
    }
  };

  const handleStartRetrieval = async () => {
    if (!activeTask || actionBusy) return;
    setActionBusy(true);
    try {
      await updateTask(activeTask.id, {status: 'in_transit'});
    } catch (err: any) {
      window.alert(err.message || 'Could not start retrieval');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkParked = async () => {
    if (!activeTask || !slotInput.trim() || markingParked) return;
    setMarkingParked(true);
    try {
      await markParked(activeTask.id, slotInput.trim().toUpperCase());
      pushNotification({
        targetRole: `doctor:${activeTask.doctorId}`,
        targetId: activeTask.doctorId,
        title: 'Car Parked',
        body: `Your car has been parked at slot ${slotInput.toUpperCase()} by ${user?.name}.`,
        type: 'info',
      });
      // The session's owner, not the whole team — every other valet gets an
      // inbox entry for a car they have nothing to do with otherwise.
      const parkOwner = activeTask.arrivalOwnerValetId;
      pushNotification({
        targetRole: parkOwner ? `valet:${parkOwner}` : 'valet',
        title: 'Car Parked',
        body: `${activeTask.carNumber} parked at ${slotInput.toUpperCase()} by ${user?.name}`,
        type: 'info',
      });
      setSlotInput('');
    } catch (err: any) {
      window.alert(err.message || 'Could not mark parked');
    } finally {
      setMarkingParked(false);
    }
  };

  // Valet pulled this park job back mid-drive — the car goes back to the
  // counter instead of into a slot. They still have to confirm receipt.
  const handleMarkReturned = async () => {
    if (!activeTask || actionBusy) return;
    setActionBusy(true);
    try {
      await markTaskReturned(activeTask.id);
    } catch (err: any) {
      window.alert(err.message || 'Could not mark returned');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkRetrieved = async () => {
    if (!activeTask || actionBusy) return;
    setActionBusy(true);
    try {
      await markRetrieved(activeTask.id);
      // Alarm-grade — a car is now sitting at the counter waiting on the
      // owner, and nothing else prompts the valet to confirm the handover.
      // The valet who owns this retrieval is the one who has to confirm the
      // handover, so ring them and nobody else. Falls back to the whole team
      // only when the job genuinely has no owner — an unowned car still has
      // to be confirmed by someone.
      const owner = activeTask.retrievalOwnerValetId ?? activeTask.arrivalOwnerValetId;
      pushNotification({
        targetRole: owner ? `valet:${owner}` : 'valet',
        title: '🔔 Car at the counter',
        body: `${activeTask.carNumber} is ready. Confirm once the owner has taken it.`,
        type: 'alarm',
      });
    } catch (err: any) {
      window.alert(err.message || 'Could not mark retrieved');
      return;
    } finally {
      setActionBusy(false);
    }
  };

  const statusMeta: Record<string, {label: string; color: string; bg: string; icon: IconName}> = {
    assigned:      {label: activeTask?.type === 'retrieve' ? 'Go to parking slot' : 'Go to valet counter', color: c.warning, bg: c.warningLight, icon: 'bellAlert'},
    key_collected: {label: 'Driving to park', color: c.primary, bg: c.cardAlt, icon: 'carKey'},
    in_transit:    {label: 'In transit', color: c.primary, bg: c.cardAlt, icon: 'navigate'},
    completed:     {label: 'Done', color: c.success, bg: c.successLight, icon: 'check'},
  };

  const freeSlots = slots.filter(s => s.status === 'free').slice(0, 6);

  return (
    <div className="screen-scroll" style={{backgroundColor: c.background, padding: 20, paddingBottom: 40}}>

      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20}}>
        <div>
          <div style={{fontSize: 12, fontWeight: 600, color: c.textSecondary}}>Your jobs</div>
          <div style={{fontSize: 22, fontWeight: 800, marginTop: 2, color: c.primary}}>{user?.name}</div>
        </div>
        <div style={{borderRadius: 14, border: `1px solid ${c.border}`, padding: '8px 14px', textAlign: 'center', backgroundColor: c.surface}}>
          <div style={{fontSize: 22, fontWeight: 900, color: c.primary}}>{completedToday.length}</div>
          <div style={{fontSize: 10, fontWeight: 600, color: c.textSecondary}}>done today</div>
        </div>
      </div>

      {/* Active task */}
      {!hydrated ? (
        <SkeletonCard lines={3} style={{marginBottom: 20}} />
      ) : activeTask ? (
        <div style={{borderRadius: 22, border: `1px solid ${c.border}`, overflow: 'hidden', marginBottom: 20, backgroundColor: c.surface}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: 14, backgroundColor: c.primary}}>
            <Icon name={activeTask.type === 'park' ? 'arrowDown' : 'arrowUp'} size={16} color={c.textOnPrimary} />
            <span style={{fontSize: 13, fontWeight: 800, letterSpacing: 1, color: c.textOnPrimary}}>{activeTask.type === 'park' ? 'PARKING JOB' : 'RETRIEVAL JOB'}</span>
          </div>

          <div style={{padding: 16, display: 'flex', flexDirection: 'column', gap: 12}}>
            <div style={{display: 'flex', borderRadius: 14, overflow: 'hidden', border: `1px solid ${c.border}`}}>
              <div style={{flex: 1, padding: 12}}>
                <div style={{fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 4, color: c.textMuted}}>CUSTOMER</div>
                <div style={{fontSize: 14, fontWeight: 800, color: c.primary}}>{activeTask.doctorName}</div>
              </div>
              <div style={{flex: 1, padding: 12, borderLeft: `1px solid ${c.border}`}}>
                <div style={{fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 4, color: c.textMuted}}>CAR</div>
                <div style={{fontSize: 14, fontWeight: 800, color: c.primary}}>{activeTask.carNumber}</div>
              </div>
            </div>

            {activeTask.slotId && (
              <div style={{borderRadius: 14, padding: 14, textAlign: 'center', backgroundColor: c.cardAlt}}>
                <div style={{fontSize: 9, fontWeight: 700, letterSpacing: 1, color: c.textSecondary}}>
                  {activeTask.type === 'retrieve' ? 'RETRIEVE FROM' : 'DESTINATION SLOT'}
                </div>
                <div style={{fontSize: 28, fontWeight: 900, marginTop: 2, color: c.primary}}>{activeTask.slotId}</div>
              </div>
            )}

            {activeTask.status in statusMeta && (
              <div style={{display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, backgroundColor: statusMeta[activeTask.status]?.bg}}>
                <Icon name={statusMeta[activeTask.status]?.icon!} size={16} color={statusMeta[activeTask.status]?.color} />
                <span style={{fontSize: 13, fontWeight: 700, color: statusMeta[activeTask.status]?.color}}>
                  {statusMeta[activeTask.status]?.label}
                </span>
              </div>
            )}

            {/* Accept handshake — a freshly assigned job must be accepted
                (or rejected) before anything else; not accepting within
                the admin-set window sends it back to the valet. */}
            {activeTask.status === 'assigned' && !activeTask.acceptedAt && (
              <div style={{display: 'flex', gap: 8}}>
                <PressableScale
                  style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, padding: '0 16px', height: 48, flex: 1, backgroundColor: c.cardAlt, opacity: actionBusy ? 0.6 : 1}}
                  onClick={handleRejectTask} disabled={actionBusy}
                >
                  <Icon name="close" size={15} color={c.primary} />
                  <span style={{fontSize: 13, fontWeight: 800, color: c.primary}}>Reject</span>
                </PressableScale>
                <PressableScale
                  style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, padding: '0 16px', height: 48, flex: 1, backgroundColor: c.primary, opacity: actionBusy ? 0.6 : 1}}
                  onClick={handleAcceptTask} disabled={actionBusy}
                >
                  <Icon name="check" size={15} color={c.textOnPrimary} />
                  <span style={{fontSize: 13, fontWeight: 800, color: c.textOnPrimary}}>Accept</span>
                </PressableScale>
              </div>
            )}

            {/* A park job has no destination at all — the driver just
                drives with the key to whichever free slot they pick, so
                there's nothing to route/ETA against (this used to show
                "Waiting for GPS…" forever for exactly that reason). A
                retrieve job does have a real destination (the assigning
                valet's location, captured in task.service.js
                assignDriver), so the route/ETA panel stays for that. */}
            {activeTask.type === 'retrieve' && (activeTask.status === 'key_collected' || activeTask.status === 'in_transit') && (
              <div style={{borderRadius: 16, border: `1px solid ${c.border}`, padding: 14}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                  <span style={{fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: c.textSecondary}}>LIVE ROUTE</span>
                  {trip ? (
                    <span style={{fontSize: 11, fontWeight: 800, color: c.primary}}>
                      {trip.etaMinutes} min{trip.distanceRemainingM != null ? ` · ${trip.distanceRemainingM}m` : ''}
                    </span>
                  ) : (
                    <span style={{fontSize: 11, fontWeight: 800, color: c.textMuted}}>Waiting for GPS…</span>
                  )}
                </div>
                <div style={{height: 24, position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 6}}>
                  <div style={{position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: c.border}} />
                  <div style={{position: 'absolute', left: 0, height: 3, borderRadius: 2, width: `${liveProgress * 100}%`, backgroundColor: c.primary, transition: 'width 0.4s ease'}} />
                  <div style={{position: 'absolute', left: `${liveProgress * 88}%`, marginTop: -9, marginLeft: -9, transition: 'left 0.4s ease'}}>
                    <Icon name="carSide" size={18} color={c.primary} />
                  </div>
                </div>
              </div>
            )}

            {/* Recalled: the valet wants this car back, not parked. The
                slot picker below is deliberately replaced entirely — an
                attempt to park it would be rejected server-side anyway. */}
            {activeTask.type === 'park' && !!activeTask.recalledAt
              && (activeTask.status === 'key_collected' || activeTask.status === 'in_transit') && (
              <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, backgroundColor: c.warningLight}}>
                  <Icon name="bellAlert" size={16} color={c.warning} />
                  <span style={{fontSize: 13, fontWeight: 700, color: c.warning}}>
                    Do not park — return this car to the valet counter
                  </span>
                </div>
                <PressableScale
                  style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16, backgroundColor: c.primary, opacity: actionBusy ? 0.6 : 1}}
                  onClick={handleMarkReturned} disabled={actionBusy}
                >
                  <Icon name="check" size={16} color={c.textOnPrimary} />
                  <span style={{fontSize: 14, fontWeight: 800, color: c.textOnPrimary}}>{actionBusy ? 'Please wait…' : 'Returned to counter'}</span>
                </PressableScale>
              </div>
            )}

            {activeTask.type === 'park' && !activeTask.recalledAt && (activeTask.status === 'key_collected' || activeTask.status === 'in_transit') && (
              <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                <div style={{display: 'flex', gap: 10}}>
                  <div style={{flex: 1, borderRadius: 14, border: `1.5px solid ${c.border}`, padding: '0 14px', height: 48, display: 'flex', alignItems: 'center', backgroundColor: c.background}}>
                    <input
                      style={{flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontWeight: 700, color: c.primary}}
                      value={slotInput}
                      onChange={e => setSlotInput(e.target.value.toUpperCase())}
                      placeholder="e.g. A-203"
                      onKeyDown={e => { if (e.key === 'Enter' && slotInput.trim()) handleMarkParked(); }}
                    />
                  </div>
                  <PressableScale
                    style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, padding: '0 16px', height: 48, backgroundColor: c.primary, opacity: (slotInput.trim() && !markingParked) ? 1 : 0.35}}
                    onClick={handleMarkParked} disabled={!slotInput.trim() || markingParked}
                  >
                    <Icon name="check" size={15} color={c.textOnPrimary} />
                    <span style={{fontSize: 13, fontWeight: 800, color: c.textOnPrimary, whiteSpace: 'nowrap'}}>{markingParked ? 'Marking…' : 'Mark parked'}</span>
                  </PressableScale>
                </div>
                {freeSlots.length > 0 && (
                  <PressableScale
                    style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, border: `1px solid ${c.border}`, padding: '11px 0', backgroundColor: c.cardAlt}}
                    onClick={() => setSlotInput(freeSlots[0].id)}
                  >
                    <Icon name="bolt" size={14} color={c.primary} />
                    <span style={{fontSize: 12, fontWeight: 800, color: c.primary}}>Auto-assign nearest free slot ({freeSlots[0].id})</span>
                  </PressableScale>
                )}
                <div style={{fontSize: 9, fontWeight: 700, letterSpacing: 1, color: c.textMuted}}>AVAILABLE SLOTS</div>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
                  {freeSlots.map(sl => (
                    <PressableScale key={sl.id} onClick={() => setSlotInput(sl.id)}
                      style={{borderRadius: 10, border: `1px solid ${c.border}`, padding: '7px 12px', backgroundColor: c.cardAlt}}>
                      <span style={{fontSize: 12, fontWeight: 700, color: c.primary}}>{sl.id}</span>
                    </PressableScale>
                  ))}
                </div>
              </div>
            )}

            {activeTask.type === 'retrieve' && activeTask.status === 'assigned' && !!activeTask.acceptedAt && (
              <PressableScale
                style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16, backgroundColor: c.primary, opacity: actionBusy ? 0.6 : 1}}
                onClick={handleStartRetrieval} disabled={actionBusy}
              >
                <Icon name="carKey" size={16} color={c.textOnPrimary} />
                <span style={{fontSize: 14, fontWeight: 800, color: c.textOnPrimary}}>{actionBusy ? 'Please wait…' : 'Start retrieval'}</span>
              </PressableScale>
            )}
            {activeTask.type === 'retrieve' && activeTask.status === 'in_transit' && (
              <PressableScale
                style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16, backgroundColor: c.primary, opacity: actionBusy ? 0.6 : 1}}
                onClick={handleMarkRetrieved} disabled={actionBusy}
              >
                <Icon name="check" size={16} color={c.textOnPrimary} />
                <span style={{fontSize: 14, fontWeight: 800, color: c.textOnPrimary}}>{actionBusy ? 'Please wait…' : 'Delivered to counter'}</span>
              </PressableScale>
            )}
          </div>
        </div>
      ) : (
        <div style={{borderRadius: 22, border: `1px solid ${c.border}`, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20, backgroundColor: c.surface}}>
          <div style={{width: 56, height: 56, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: c.cardAlt}}>
            <Icon name="check" size={26} color={c.textSecondary} />
          </div>
          <div style={{fontSize: 18, fontWeight: 800, marginBottom: 8, color: c.primary}}>No active job</div>
          <div style={{fontSize: 13, textAlign: 'center', lineHeight: '19px', color: c.textSecondary}}>Waiting for the valet to assign a job. You'll get a notification when assigned.</div>
        </div>
      )}

      {/* Visitor pickups — see the module comment at the top of this file:
          this list is new relative to the mobile screen. Purely
          informational (the actions live on the Active Job card above,
          which is the exact same underlying ParkingTask), it exists to show
          the one thing that card can't: the visitor's phone number. */}
      {myVisitorJobs.length > 0 && (
        <>
          <div style={{fontSize: 15, fontWeight: 800, marginBottom: 12, color: c.primary}}>Visitor pickups</div>
          {myVisitorJobs.map(v => (
            <div key={v.id} style={{display: 'flex', alignItems: 'center', borderRadius: 16, border: `1px solid ${c.border}`, padding: 14, marginBottom: 8, gap: 12, backgroundColor: c.surface}}>
              <div style={{width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: c.cardAlt}}>
                <Icon name={v.vehicleType === 'bike' ? 'bike' : 'car'} size={17} color={c.primary} />
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 13, fontWeight: 700, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {v.name || 'Visitor'}{v.carNumber ? ` · ${v.carNumber}` : ''}
                </div>
                <a href={`tel:${v.mobile}`} style={{fontSize: 11, marginTop: 2, color: c.textSecondary, textDecoration: 'none'}}>{v.mobile}</a>
              </div>
              <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 0.5, borderRadius: 8, padding: '5px 9px', whiteSpace: 'nowrap', color: v.status === 'pending' ? c.warning : c.primary, backgroundColor: v.status === 'pending' ? c.warningLight : c.cardAlt}}>
                {v.status === 'pending' ? 'AWAITING PICKUP' : 'READY FOR RETRIEVAL'}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Completed today */}
      {completedToday.length > 0 && (
        <>
          <div style={{fontSize: 15, fontWeight: 800, marginBottom: 12, color: c.primary}}>Completed today</div>
          {completedToday.map(t => (
            <div key={t.id} style={{display: 'flex', alignItems: 'center', borderRadius: 16, border: `1px solid ${c.border}`, padding: 14, marginBottom: 8, gap: 12, backgroundColor: c.surface}}>
              <div style={{width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: c.successLight}}>
                <Icon name={t.type === 'park' ? 'arrowDown' : 'arrowUp'} size={14} color={c.success} />
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 13, fontWeight: 700, color: c.primary}}>{t.type === 'park' ? 'Parked' : 'Retrieved'} — {t.doctorName}</div>
                <div style={{fontSize: 11, marginTop: 2, color: c.textSecondary}}>{t.carNumber} {t.slotId ? `· ${t.slotId}` : ''}</div>
              </div>
              <Icon name="check" size={16} color={c.success} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
