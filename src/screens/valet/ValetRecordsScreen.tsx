import React, {useState, useEffect} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {Visitor, ParkingTask, mapVisitor} from '../../context/AppStateContext';
import {Icon} from '../../components/Icon';
import {PressableScale} from '../../components/PressableScale';
import {HScrollHint} from '../../components/HScrollHint';
import {CalendarPicker} from '../../components/CalendarPicker';
import {useDialog} from '../../components/AppDialog';
import {useBackStep} from '../../hooks/useBackStep';
import {useValetActions} from './useValetActions';
import {visitorsApi} from '../../services/api';
import {AdminMapScreen} from '../admin/AdminMapScreen';
import {DriverPickerList} from '../../components/DriverPickerList';

// Direct DOM port of the mobile app's ValetRecordsScreen — same
// Active/Completed session logic for both visitor and staff/doctor tickets,
// the same "ticket stub" card visual language, and the same read-only
// detail sheet. Native-only bits (Alert.alert, FlatList/SectionList,
// RefreshControl) are swapped for window.confirm, plain .map(), and nothing
// (the socket-driven AppStateContext already keeps this live).

function fmtTime(ms?: number) {
  if (!ms) return null;
  return new Date(ms).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
}

const STUB_W = 78;
const NOTCH = 18;

// Placeholder body colours until the visitor's real vehicle colour comes
// through the backend (Vehicle Setup work) — stable per token so a card
// doesn't change colour between refreshes.
const SWATCHES = ['#2E5BFF', '#1FA24A', '#D32F2F', '#F5B301', '#46505C', '#7C3AED', '#0D9488', '#B3B9C4'];
function tokenColour(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return SWATCHES[Math.abs(h) % SWATCHES.length];
}

// Vertical dashed perforation line between the ticket body and its stub.
function PerfLine({color}: {color: string}) {
  return (
    <div style={{width: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexShrink: 0}}>
      {Array.from({length: 14}, (_, i) => (
        <span key={i} style={{width: 2, height: 6, borderRadius: 1, backgroundColor: color}} />
      ))}
    </div>
  );
}

type RecordsTab = 'visitors' | 'staff' | 'map';
type StatusFilter = 'all' | 'active' | 'completed';
// One shared vehicle-lifecycle stage, whether the ticket is a visitor token
// or a staff/doctor session — both run the identical park -> parked ->
// retrieve journey underneath, just through different record shapes.
type StageFilter = 'all' | 'atHospital' | 'transitToLot' | 'parked' | 'transitToHospital';
const STAGE_FILTERS: {key: Exclude<StageFilter, 'all'>; label: string}[] = [
  {key: 'atHospital', label: 'At hospital'},
  {key: 'transitToLot', label: 'Vehicle → parking lot'},
  {key: 'parked', label: 'Parked'},
  {key: 'transitToHospital', label: 'Vehicle → hospital'},
];

export function ValetRecordsScreen() {
  const {colors} = useTheme();
  const dialog = useDialog();
  const {tasks, visitors, activeVisitors, availableDrivers, hasActiveRetrievalDriver,
    assignVisitorPickupDriver, assignVisitorRetrievalDriver, assignStaffRetrievalDriver, cancelVisitor, cancelVisitorAssignment, recallVisitor, confirmVisitorDelivered,
    confirmTaskDelivered, fetchTaskHistory} = useValetActions();

  const [tab, setTab] = useState<RecordsTab>('visitors');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [pendingVisitorId, setPendingVisitorId] = useState<number | null>(null);
  const [pendingMode, setPendingMode] = useState<'park' | 'retrieve' | null>(null);
  // The staff/doctor equivalent of pendingVisitorId — set when the valet taps
  // "Request retrieval" on a staff ticket, so the same driver-assign screen
  // below can serve both flows.
  const [pendingDoctorTaskId, setPendingDoctorTaskId] = useState<number | null>(null);
  const [assigningDriverId, setAssigningDriverId] = useState<number | null>(null);

  // Browser/PWA back gesture — the Assign Driver screen (below) is a plain
  // conditional full-screen replace, not a real route. Mirrors mobile's
  // BackHandler wiring. (Unlike mobile, the detail sheet below ALSO needs
  // this — RN's <Modal> gets back support for free via onRequestClose, web
  // has no equivalent, so it's wired the same way right by closeDetail.)
  useBackStep(pendingVisitorId != null || pendingDoctorTaskId != null, () => {
    setPendingVisitorId(null); setPendingMode(null); setPendingDoctorTaskId(null);
  });
  const [confirmingVisitorId, setConfirmingVisitorId] = useState<number | null>(null);
  const [recallingVisitorId, setRecallingVisitorId] = useState<number | null>(null);
  const [cancellingAssignmentVisitorId, setCancellingAssignmentVisitorId] = useState<number | null>(null);

  // Calendar-wise records view (Visitors tab only) — 'YYYY-MM-DD', or null
  // for the normal live view. Selecting a date fetches that day's visitors
  // fresh from the unbounded ?date= endpoint rather than filtering the live
  // `visitors` array, which is deliberately capped to the last 24h.
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateVisitors, setDateVisitors] = useState<Visitor[] | null>(null);
  const [dateLoading, setDateLoading] = useState(false);

  useEffect(() => {
    if (!selectedDate) { setDateVisitors(null); return; }
    let cancelled = false;
    setDateLoading(true);
    visitorsApi.byDate(selectedDate)
      .then((rows: any[]) => { if (!cancelled) setDateVisitors(rows.map(mapVisitor)); })
      .catch(() => { if (!cancelled) setDateVisitors([]); })
      .finally(() => { if (!cancelled) setDateLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDate]);

  const todayKey = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const calendarDateLabel = (key: string) => key === todayKey
    ? 'Today'
    : new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
  const [confirmingTaskId, setConfirmingTaskId] = useState<number | null>(null);
  // Detail sheet — shared by both tabs, holds whichever ticket was tapped.
  const [detailVisitor, setDetailVisitor] = useState<Visitor | null>(null);
  const [detailTask, setDetailTask] = useState<ParkingTask | null>(null);
  // Every staff/doctor session ever, not just each doctor's single current
  // one — the live `tasks` array is deliberately bounded to "at most one row
  // per doctor" now, so this tab's actual record view needs its own fetch.
  const [staffHistory, setStaffHistory] = useState<ParkingTask[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'staff') return;
    setHistoryLoading(true);
    fetchTaskHistory().then(setStaffHistory).catch(() => {}).finally(() => setHistoryLoading(false));
    // `tasks` (the live, socket-fed list) changing is our proxy for
    // "something happened" — history itself isn't pushed over the socket,
    // so this piggybacks on the one realtime signal that already exists.
  }, [tab, fetchTaskHistory, tasks]);

  const q = query.trim().toLowerCase();

  // The 4-stage breakdown that appears under "Active" — same stages for a
  // visitor token and a staff/doctor session, since both run the identical
  // park -> parked -> retrieve journey, just through different record shapes.
  const visitorStage = (v: Visitor): Exclude<StageFilter, 'all'> => {
    if (v.status === 'pending') {
      // Key not yet taken vs. already taken and driving to a slot.
      return v.pickedUpAt != null ? 'transitToLot' : 'atHospital';
    }
    // v.status === 'parked' from here on — delivered/retrieved/cancelled
    // visitors don't reach this (they're excluded from activeVisitors, or
    // land under Completed instead of Active).
    if (!v.retrievalRequested) return 'parked';
    return hasActiveRetrievalDriver(v) ? 'transitToHospital' : 'atHospital';
  };

  const staffStage = (t: ParkingTask): Exclude<StageFilter, 'all'> => {
    if (t.type === 'park') {
      if (t.status === 'key_collected' || t.status === 'in_transit') return 'transitToLot';
      if (t.status === 'completed') return 'parked';
      return 'atHospital'; // assigned with no driver yet
    }
    // retrieve — a driver attached means it's accepted the job and is en
    // route either direction; with none it's still waiting to be staffed.
    return t.driverId != null ? 'transitToHospital' : 'atHospital';
  };

  // Completed/All need retrieved (and cancelled, for All) visitors too —
  // activeVisitors is deliberately pre-stripped of both (see useValetActions).
  // A selected calendar date overrides all of that — it's its own fetched
  // snapshot of one specific day, live-bounding doesn't apply to it.
  const visitorsSource = selectedDate ? (dateVisitors ?? []) : statusFilter === 'active' ? activeVisitors : visitors;
  const visitorsFiltered = visitorsSource
    .filter(v => selectedDate || statusFilter === 'all' || (statusFilter === 'completed' ? v.status === 'retrieved' : v.status !== 'retrieved'))
    .filter(v => statusFilter !== 'active' || stageFilter === 'all' || visitorStage(v) === stageFilter)
    .filter(v => !q || v.name?.toLowerCase().includes(q) || v.carNumber?.toLowerCase().includes(q) || v.token.toLowerCase().includes(q));

  // A doctor's most recent task tells us whether their session is still
  // open: history has every park + retrieve row ever, staff and visitor
  // alike, so "parked, nothing pending" is only true when the LATEST row
  // for that doctor is a completed park (a later retrieve row, of any
  // status, means one's already in flight or done).
  const latestTaskByDoctor = new Map<number, ParkingTask>();
  for (const t of staffHistory) {
    if (t.isVisitor) continue;
    const prev = latestTaskByDoctor.get(t.doctorId);
    if (!prev || t.id > prev.id) latestTaskByDoctor.set(t.doctorId, t);
  }
  const canRequestStaffRetrieval = (t: ParkingTask) =>
    t.type === 'park' && t.status === 'completed' && latestTaskByDoctor.get(t.doctorId)?.id === t.id;

  // Active/Completed here means "is the car back with its owner yet", not
  // the raw per-row status — a park row's own status turns 'completed' the
  // moment the car is PARKED, well before anyone's picked it up again. A
  // park row stays Active while it's still the doctor's open session (see
  // canRequestStaffRetrieval); a retrieve row is Active until the valet
  // actually confirms the handover (status -> 'completed'), which is also
  // the moment its paired park row stops being "latest" and flips too.
  const isStaffRowActive = (t: ParkingTask) => {
    if (t.status === 'cancelled') return false; // same convention as elsewhere: cancelled only shows under "All"
    if (t.type === 'retrieve') return t.status !== 'completed';
    return t.status !== 'completed' || latestTaskByDoctor.get(t.doctorId)?.id === t.id;
  };

  // Staff/doctor tab is the actual "how many doctors" record — every park +
  // retrieve task, not just the ones still in progress (that live view is
  // the Home tab's Job Queue; this one's a searchable log). Visitor-linked
  // tasks are excluded — they already have their own tab, and an unscoped
  // history fetch returns every task ever, staff and visitor alike.
  const staffFiltered = staffHistory
    .filter(t => !t.isVisitor)
    .filter(t => statusFilter === 'all' || (statusFilter === 'completed' ? !isStaffRowActive(t) && t.status !== 'cancelled' : isStaffRowActive(t)))
    .filter(t => statusFilter !== 'active' || stageFilter === 'all' || staffStage(t) === stageFilter)
    .filter(t => !q || t.doctorName?.toLowerCase().includes(q) || t.carNumber?.toLowerCase().includes(q));

  const pendingVisitor = pendingVisitorId ? visitors.find(v => v.id === pendingVisitorId) ?? null : null;
  const pendingDoctorTask = pendingDoctorTaskId ? staffHistory.find(t => t.id === pendingDoctorTaskId) ?? null : null;

  const handleAssign = async (driverId: number) => {
    if (!pendingVisitorId && !pendingDoctorTaskId) return;
    if (assigningDriverId != null) return;
    setAssigningDriverId(driverId);
    try {
      if (pendingDoctorTaskId != null) {
        if (!pendingDoctorTask) return;
        await assignStaffRetrievalDriver(pendingDoctorTask.doctorId, driverId);
        setPendingDoctorTaskId(null);
      } else if (pendingVisitorId != null) {
        if (pendingMode === 'retrieve') await assignVisitorRetrievalDriver(pendingVisitorId, driverId);
        else await assignVisitorPickupDriver(pendingVisitorId, driverId);
        setPendingVisitorId(null); setPendingMode(null);
      }
    } catch (err: any) {
      dialog.alert(err.message || 'Something went wrong');
    } finally {
      setAssigningDriverId(null);
    }
  };

  const handleConfirmVisitorDelivered = async (visitorId: number) => {
    if (confirmingVisitorId != null) return;
    setConfirmingVisitorId(visitorId);
    try {
      await confirmVisitorDelivered(visitorId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not confirm handover');
    } finally {
      setConfirmingVisitorId(null);
    }
  };

  const handleConfirmTaskDelivered = async (taskId: number) => {
    if (confirmingTaskId != null) return;
    setConfirmingTaskId(taskId);
    try {
      await confirmTaskDelivered(taskId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not confirm handover');
    } finally {
      setConfirmingTaskId(null);
    }
  };

  const handleCancel = async (visitorId: number) => {
    const ok = await dialog.confirm({
      title: 'Cancel Visitor Token',
      message: 'This will cancel the check-in. This cannot be undone.',
      confirmText: 'Cancel Token', destructive: true,
    });
    if (ok) {
      cancelVisitor(visitorId, 'valet_cancelled').catch(err => dialog.alert(err.message || 'Something went wrong'));
    }
  };

  // Driver's assigned but hasn't accepted (or has, but hasn't collected the
  // key) yet — give up on them now instead of waiting out the accept-timeout
  // window. Mirrors the staff/task flow's "Cancel Assign".
  const handleCancelAssignment = async (visitorId: number) => {
    if (cancellingAssignmentVisitorId != null) return;
    setCancellingAssignmentVisitorId(visitorId);
    try {
      await cancelVisitorAssignment(visitorId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not cancel the assignment');
    } finally {
      setCancellingAssignmentVisitorId(null);
    }
  };

  // Past the key handover the car is physically with a driver — it can't be
  // cancelled/no-shown anymore (see cancelVisitor's backend comment), so
  // this is the only thing left on offer at that stage.
  const handleRecallVisitor = async (visitorId: number, carNumber?: string) => {
    const ok = await dialog.confirm({
      title: 'Bring the Car Back?',
      message: `The driver will be told NOT to park ${carNumber || 'this car'} and to return it to the valet counter instead.`,
      confirmText: 'Recall Car', destructive: true,
    });
    if (!ok) return;
    if (recallingVisitorId != null) return;
    setRecallingVisitorId(visitorId);
    try {
      await recallVisitor(visitorId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not recall the car');
    } finally {
      setRecallingVisitorId(null);
    }
  };

  const ticketStyle = (highlight: boolean): React.CSSProperties => ({
    position: 'relative', display: 'flex', flexDirection: 'row', borderRadius: 22, marginBottom: 14, overflow: 'hidden',
    backgroundColor: colors.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    ...(highlight ? {border: `2px solid ${colors.warning}`} : {}),
  });
  const notchStyle = (pos: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute', right: STUB_W - NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, zIndex: 2,
    backgroundColor: colors.background,
    ...(pos === 'top' ? {top: -NOTCH / 2} : {bottom: -NOTCH / 2}),
  });
  const actionBtnStyle = (bg: string): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, marginTop: 14, backgroundColor: bg,
  });

  // ── Assign-driver step — shared by visitor + staff retrieval flows ──────
  if (pendingVisitor || pendingDoctorTask) {
    return (
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, backgroundColor: colors.background}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 16px'}}>
          <PressableScale
            onClick={() => { setPendingVisitorId(null); setPendingMode(null); setPendingDoctorTaskId(null); }}
            style={{borderRadius: 10, border: `1px solid ${colors.border}`, padding: '8px 12px', backgroundColor: colors.surface}}>
            <span style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>Cancel</span>
          </PressableScale>
          <span style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary}}>Assign Driver</span>
          <div style={{width: 70}} />
        </div>
        <div className="screen-scroll" style={{padding: 20, paddingTop: 0, paddingBottom: 40}}>
          <div style={{fontSize: 16, fontWeight: 700, marginBottom: 20, color: colors.textPrimary}}>
            {pendingDoctorTask
              ? `Assign a driver to retrieve ${pendingDoctorTask.carNumber} for ${pendingDoctorTask.doctorName}`
              : pendingMode === 'retrieve'
              ? `Assign a driver to retrieve ${pendingVisitor!.carNumber} from slot ${pendingVisitor!.slotId} for ${pendingVisitor!.name}`
              : `Tap a driver to collect the key and park ${pendingVisitor!.name}'s car (${pendingVisitor!.carNumber})`}
          </div>
          <DriverPickerList drivers={availableDrivers} onAssign={handleAssign} assigningId={assigningDriverId} />
        </div>
      </div>
    );
  }

  const renderVisitorTicket = (v: Visitor) => {
    const needsDriver = v.status === 'parked' && v.retrievalRequested && !hasActiveRetrievalDriver(v);
    const retrieving = v.status === 'parked' && v.retrievalRequested && !needsDriver;
    const parkedIdle = v.status === 'parked' && !v.retrievalRequested;
    const delivered = v.status === 'delivered';
    // The visitor row itself doesn't track a driver's key handover — that
    // lives on its linked ParkingTask (see backend createVisitor). Reading
    // it here is what tells the difference between "nobody's touched this
    // yet" (Cancel/No-Show is still valid) and "a driver already has the
    // key" (only a recall makes sense from here on).
    const linkedTask = tasks.find(t => t.visitorId === v.id && t.type === 'park' && t.status !== 'completed' && t.status !== 'cancelled');
    // A driver being assigned isn't the same as a driver having the key —
    // the backend's recall guard only accepts a recall once the linked task
    // is actually past key handover (key_collected/in_transit; see backend
    // recallVisitor → taskService().recallTask). pickedUpAt is the moment
    // the driver confirms they've collected the vehicle from the counter,
    // so it's the real gate here (see mobile app's identical fix).
    const keyWithDriver = v.status === 'pending' && !!v.driverId && !!v.pickedUpAt;
    const awaitingAccept = v.status === 'pending' && !!v.driverId && !v.pickedUpAt;
    const awaitingDriver = v.status === 'pending' && !v.driverId;
    const recalled = !!linkedTask?.recalledAt;
    const chipTone = parkedIdle ? colors.success : colors.warning;
    const chipBg = parkedIdle ? colors.successLight : colors.warningLight;
    const chipLabel = parkedIdle ? `Parked · ${v.slotId ?? ''}`
      : delivered ? 'Awaiting pickup confirmation'
      : retrieving ? 'Retrieving'
      : needsDriver ? 'Ready to leave'
      : v.pickedUpAt ? 'Parking now'
      : v.acceptedAt ? 'Collecting key'
      : v.driverId ? 'Awaiting accept'
      : v.status === 'retrieved' ? 'Retrieved'
      : 'Awaiting driver';
    const swatch = tokenColour(v.token);

    return (
      <div key={v.id} style={ticketStyle(delivered)}>
        {/* perforation notches — cut into the card by the screen background */}
        <div style={notchStyle('top')} />
        <div style={notchStyle('bottom')} />

        {/* main body */}
        <div style={{flex: 1, padding: '16px 12px 16px 18px', minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8}}>
            <span style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary}}>{v.name || 'Visitor'}</span>
            <span style={{display: 'flex', alignItems: 'center', gap: 5, borderRadius: 99, padding: '4px 9px', backgroundColor: chipBg}}>
              <span style={{width: 5, height: 5, borderRadius: 3, backgroundColor: chipTone}} />
              <span style={{fontSize: 11.5, fontWeight: 700, color: chipTone}}>{chipLabel}</span>
            </span>
            <PressableScale style={{width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}} onClick={() => setDetailVisitor(v)}>
              <Icon name="info" size={13} color={colors.textSecondary} />
            </PressableScale>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 7}}>
            <span style={{width: 22, height: 10, borderRadius: 3, backgroundColor: swatch, display: 'inline-block'}} />
            <span style={{fontSize: 13, fontWeight: 700, letterSpacing: 1.2, color: colors.textSecondary}}>{v.carNumber ?? 'No plate'}</span>
          </div>

          {parkedIdle && (
            <PressableScale style={actionBtnStyle(colors.primary)}
              onClick={() => { setPendingVisitorId(v.id); setPendingMode('retrieve'); }}>
              <span style={{fontSize: 14, fontWeight: 700, color: colors.textOnPrimary}}>Request retrieval</span>
              <Icon name="arrowRight" size={15} color={colors.textOnPrimary} />
            </PressableScale>
          )}
          {needsDriver && (
            <PressableScale style={actionBtnStyle(colors.warning)}
              onClick={() => { setPendingVisitorId(v.id); setPendingMode('retrieve'); }}>
              <span style={{fontSize: 14, fontWeight: 700, color: '#fff'}}>Assign driver</span>
              <Icon name="arrowRight" size={15} color="#fff" />
            </PressableScale>
          )}
          {retrieving && (
            <div style={{...actionBtnStyle(colors.warningLight)}}>
              <span style={{fontSize: 14, fontWeight: 700, color: colors.warning}}>{v.driverName ?? 'Driver'} en route…</span>
            </div>
          )}
          {delivered && (
            <PressableScale
              style={{...actionBtnStyle(colors.success), opacity: confirmingVisitorId === v.id ? 0.6 : 1}}
              disabled={confirmingVisitorId === v.id}
              onClick={() => handleConfirmVisitorDelivered(v.id)}>
              {confirmingVisitorId === v.id
                ? <span className="spinner" style={{width: 15, height: 15, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} />
                : <Icon name="checkBold" size={15} color="#fff" />}
              <span style={{fontSize: 14, fontWeight: 700, color: '#fff'}}>
                {confirmingVisitorId === v.id ? 'Please wait…' : 'Confirm handed to owner'}
              </span>
            </PressableScale>
          )}
          {/* Awaiting driver — nobody's touched this yet, cancel/no-show is
              still the right call. */}
          {awaitingDriver && (
            <PressableScale style={{...actionBtnStyle('transparent'), border: `1.5px solid ${colors.border}`}}
              onClick={() => handleCancel(v.id)}>
              <Icon name="close" size={14} color={colors.textSecondary} />
              <span style={{fontSize: 14, fontWeight: 700, color: colors.textSecondary}}>Cancel</span>
            </PressableScale>
          )}
          {/* Driver assigned but hasn't collected the key yet — recall isn't
              valid until they do (see keyWithDriver above), so the only real
              action here is giving up on this driver and re-assigning. */}
          {awaitingAccept && (
            <div style={{display: 'flex', gap: 8, marginTop: 14}}>
              <div style={{...actionBtnStyle('transparent'), flex: 1, marginTop: 0, border: `1.5px solid ${colors.border}`}}>
                <Icon name="timer" size={13} color={colors.textMuted} />
                <span style={{fontSize: 13, fontWeight: 700, color: colors.textMuted, whiteSpace: 'nowrap'}}>
                  {v.acceptedAt ? 'Collecting key…' : 'Waiting to accept…'}
                </span>
              </div>
              {!v.acceptedAt && (
                <PressableScale
                  style={{...actionBtnStyle('transparent'), marginTop: 0, border: `1.5px solid ${colors.border}`, padding: '0 14px', width: 'auto'}}
                  disabled={cancellingAssignmentVisitorId === v.id}
                  onClick={() => handleCancelAssignment(v.id)}>
                  <span style={{fontSize: 13, fontWeight: 700, color: colors.textSecondary}}>
                    {cancellingAssignmentVisitorId === v.id ? 'Cancelling…' : 'Cancel Assign'}
                  </span>
                </PressableScale>
              )}
            </div>
          )}
          {/* A driver already has the key — the car is physically gone, so
              cancelling/no-showing it no longer makes sense. The only real
              action left is asking for it back. */}
          {keyWithDriver && !recalled && (
            <PressableScale style={{...actionBtnStyle('transparent'), border: `1.5px solid ${colors.warning}`}}
              onClick={() => handleRecallVisitor(v.id, v.carNumber)}>
              <Icon name="back" size={14} color={colors.warning} />
              <span style={{fontSize: 14, fontWeight: 700, color: colors.warning}}>Bring back my car</span>
            </PressableScale>
          )}
          {keyWithDriver && recalled && linkedTask?.status !== 'delivered' && (
            <div style={actionBtnStyle(colors.cardAlt)}>
              <Icon name="timer" size={14} color={colors.textMuted} />
              <span style={{fontSize: 14, fontWeight: 700, color: colors.textMuted}}>Driver is bringing it back…</span>
            </div>
          )}
          {keyWithDriver && linkedTask?.status === 'delivered' && (
            <PressableScale
              style={{...actionBtnStyle(colors.success), opacity: confirmingTaskId === linkedTask.id ? 0.6 : 1}}
              disabled={confirmingTaskId === linkedTask.id}
              onClick={() => handleConfirmTaskDelivered(linkedTask.id)}>
              {confirmingTaskId === linkedTask.id
                ? <span className="spinner" style={{width: 15, height: 15, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} />
                : <Icon name="checkBold" size={15} color="#fff" />}
              <span style={{fontSize: 14, fontWeight: 700, color: '#fff'}}>
                {confirmingTaskId === linkedTask.id ? 'Please wait…' : 'Confirm car returned'}
              </span>
            </PressableScale>
          )}
        </div>

        {/* ticket stub */}
        <PerfLine color={colors.border} />
        <div style={{width: STUB_W - 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '16px 0', flexShrink: 0}}>
          <span style={{fontSize: 9.5, fontWeight: 700, letterSpacing: 2, color: colors.textMuted}}>TOKEN</span>
          <span style={{fontSize: 24, fontWeight: 800, color: colors.textPrimary}}>#{v.token}</span>
          <span style={{fontSize: 10.5, fontWeight: 600, color: colors.textMuted}}>{v.slotId ?? '—'}</span>
          <span style={{marginTop: 6, width: 22, height: 5, borderRadius: 99, opacity: 0.7, backgroundColor: swatch}} />
        </div>
      </div>
    );
  };

  // Staff/doctor tab — read-only record (assigning drivers / marking key
  // handed off already lives on the Home tab's Job Queue; duplicating those
  // actions here would just be the same "two places for one job" problem
  // this whole redesign was meant to get rid of).
  const renderStaffTicket = (t: ParkingTask) => {
    // 'requested'/'accepted' are the same "no driver yet" state as 'assigned'
    // with no driverId — assignDriver always flips status straight to
    // 'assigned' once a driver is picked, so either of these always means
    // nobody's been assigned yet.
    const needsDriver = (t.status === 'assigned' || t.status === 'requested' || t.status === 'accepted') && !t.driverId;
    const delivered = t.status === 'delivered';
    const cancelled = t.status === 'cancelled';
    const canRetrieve = canRequestStaffRetrieval(t);
    const chipTone = t.status === 'completed' ? colors.success : cancelled ? colors.textMuted : colors.warning;
    const chipBg = t.status === 'completed' ? colors.successLight : cancelled ? colors.cardAlt : colors.warningLight;
    const chipLabel = t.status === 'completed'
      ? (t.type === 'park' ? (canRetrieve ? `Parked · ${t.slotId ?? ''}` : 'Completed') : 'Retrieved')
      : cancelled ? 'Cancelled'
      : delivered ? 'Awaiting pickup confirmation'
      : needsDriver ? 'Awaiting driver'
      : t.status === 'in_transit' ? 'In transit'
      : t.status === 'key_collected' ? 'Driver has key'
      : 'Driver assigned';
    const swatch = tokenColour(`${t.type}-${t.id}`);

    return (
      <div key={t.id} style={ticketStyle(delivered)}>
        <div style={notchStyle('top')} />
        <div style={notchStyle('bottom')} />

        <div style={{flex: 1, padding: '16px 12px 16px 18px', minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8}}>
            <span style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary}}>{t.doctorName}</span>
            <span style={{display: 'flex', alignItems: 'center', gap: 5, borderRadius: 99, padding: '4px 9px', backgroundColor: chipBg}}>
              <span style={{width: 5, height: 5, borderRadius: 3, backgroundColor: chipTone}} />
              <span style={{fontSize: 11.5, fontWeight: 700, color: chipTone}}>{chipLabel}</span>
            </span>
            <PressableScale style={{width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}} onClick={() => setDetailTask(t)}>
              <Icon name="info" size={13} color={colors.textSecondary} />
            </PressableScale>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 7}}>
            <span style={{width: 22, height: 10, borderRadius: 3, backgroundColor: swatch, display: 'inline-block'}} />
            <span style={{fontSize: 13, fontWeight: 700, letterSpacing: 1.2, color: colors.textSecondary}}>{t.carNumber}</span>
          </div>

          {(!!t.driverName || (t.type === 'park' && !!t.completedAt)) && (
            <div style={{marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2}}>
              {!!t.driverName && <span style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>Driver: {t.driverName}</span>}
              {/* Arrival time — when the driver actually parked the car, not
                  when the job was created/assigned. Only meaningful for a
                  park task that's actually reached that point. */}
              {t.type === 'park' && !!t.completedAt && (
                <span style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>Parked at {fmtTime(t.completedAt)}</span>
              )}
            </div>
          )}

          {canRetrieve && (
            <PressableScale style={actionBtnStyle(colors.primary)}
              onClick={() => setPendingDoctorTaskId(t.id)}>
              <span style={{fontSize: 14, fontWeight: 700, color: colors.textOnPrimary}}>Request retrieval</span>
              <Icon name="arrowRight" size={15} color={colors.textOnPrimary} />
            </PressableScale>
          )}

          {delivered && (
            <PressableScale
              style={{...actionBtnStyle(colors.success), opacity: confirmingTaskId === t.id ? 0.6 : 1}}
              disabled={confirmingTaskId === t.id}
              onClick={() => handleConfirmTaskDelivered(t.id)}>
              {confirmingTaskId === t.id
                ? <span className="spinner" style={{width: 15, height: 15, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} />
                : <Icon name="checkBold" size={15} color="#fff" />}
              <span style={{fontSize: 14, fontWeight: 700, color: '#fff'}}>
                {confirmingTaskId === t.id ? 'Please wait…' : 'Confirm handed to owner'}
              </span>
            </PressableScale>
          )}
        </div>

        <PerfLine color={colors.border} />
        <div style={{width: STUB_W - 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '16px 0', flexShrink: 0}}>
          <span style={{fontSize: 9.5, fontWeight: 700, letterSpacing: 2, color: colors.textMuted}}>{t.type === 'park' ? 'PARK' : 'RETRIEVE'}</span>
          <span style={{fontSize: 24, fontWeight: 800, color: colors.textPrimary}}>#{t.id}</span>
          <span style={{fontSize: 10.5, fontWeight: 600, color: colors.textMuted}}>{t.slotId ?? '—'}</span>
          <span style={{marginTop: 6, width: 22, height: 5, borderRadius: 99, opacity: 0.7, backgroundColor: swatch}} />
        </div>
      </div>
    );
  };

  const filtered = tab === 'visitors' ? visitorsFiltered : tab === 'staff' ? staffFiltered : [];
  const totalCount = tab === 'visitors' ? visitorsSource.length : tab === 'staff' ? staffHistory.length : 0;

  const detailRows: [string, string][] | null = detailVisitor ? [
    ['Token', `#${detailVisitor.token}`],
    ['Car number', detailVisitor.carNumber || 'No plate'],
    ['Vehicle', detailVisitor.vehicleType === 'bike' ? 'Bike' : 'Car'],
    ['Mobile', detailVisitor.mobile],
    ['Status', detailVisitor.status],
    ['Slot', detailVisitor.slotId ?? '—'],
    ['Driver', detailVisitor.driverName ?? '—'],
    ['Checked in', fmtTime(detailVisitor.createdAt) ?? '—'],
    ...(detailVisitor.pickedUpAt ? [['Key collected', fmtTime(detailVisitor.pickedUpAt)!]] as [string, string][] : []),
    ...(detailVisitor.cancelledAt ? [['Cancelled', fmtTime(detailVisitor.cancelledAt)!]] as [string, string][] : []),
    ...(detailVisitor.cancelReason ? [['Reason', detailVisitor.cancelReason.replace('_', ' ')]] as [string, string][] : []),
  ] : detailTask ? [
    ['Type', detailTask.type === 'park' ? 'Park' : 'Retrieve'],
    ['Car number', detailTask.carNumber],
    ['Department', detailTask.doctorDepartment || '—'],
    ['Employee ID', detailTask.doctorEmployeeId || '—'],
    ['Status', detailTask.status.replace('_', ' ')],
    ['Slot', detailTask.slotId ?? '—'],
    ['Driver', detailTask.driverName ?? '—'],
    ['Valet', detailTask.valetName ?? '—'],
    ...(detailTask.assignedAt ? [['Assigned', fmtTime(detailTask.assignedAt)!]] as [string, string][] : []),
    ...(detailTask.completedAt ? [['Completed', fmtTime(detailTask.completedAt)!]] as [string, string][] : []),
  ] : null;

  const closeDetail = () => { setDetailVisitor(null); setDetailTask(null); };
  useBackStep(!!(detailVisitor || detailTask), closeDetail);

  return (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, backgroundColor: colors.background}}>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '16px 20px 0'}}>
        <span style={{fontSize: 26, fontWeight: 900, color: colors.textPrimary}}>Jobs</span>
        {tab !== 'map' && (
          <span style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>{filtered.length} of {totalCount}</span>
        )}
      </div>

      {/* Top tab switcher — same underline pattern as the Live Map screen.
          Map Layout used to live as a sub-tab of the Map bottom tab; it's a
          record of the hospital's slots, same as Visitors/Staff are records
          of who's using them, so it moved in here alongside them. */}
      <div style={{display: 'flex', marginTop: 14, borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.surface}}>
        <PressableScale style={{flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0', backgroundColor: 'transparent', borderRadius: 0}} onClick={() => setTab('visitors')}>
          <span style={{fontSize: 14, fontWeight: 800, color: tab === 'visitors' ? colors.textPrimary : colors.textMuted}}>Visitors</span>
          {tab === 'visitors' && <span style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: colors.textPrimary}} />}
        </PressableScale>
        <PressableScale style={{flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0', backgroundColor: 'transparent', borderRadius: 0}} onClick={() => setTab('staff')}>
          <span style={{fontSize: 14, fontWeight: 800, color: tab === 'staff' ? colors.textPrimary : colors.textMuted}}>Staff</span>
          {tab === 'staff' && <span style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: colors.textPrimary}} />}
        </PressableScale>
        <PressableScale style={{flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0', backgroundColor: 'transparent', borderRadius: 0}} onClick={() => setTab('map')}>
          <span style={{fontSize: 14, fontWeight: 800, color: tab === 'map' ? colors.textPrimary : colors.textMuted}}>Map Layout</span>
          {tab === 'map' && <span style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: colors.textPrimary}} />}
        </PressableScale>
      </div>

      {tab === 'map' ? (
        <AdminMapScreen />
      ) : (
      <>
      <div style={{padding: '14px 20px 4px', display: 'flex', gap: 10}}>
        <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, padding: '0 15px', height: 48, backgroundColor: colors.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.04)'}}>
          <Icon name="search" size={17} color={colors.textMuted} />
          <input
            style={{flex: 1, fontSize: 15, fontWeight: 500, padding: 0, border: 'none', outline: 'none', background: 'transparent', color: colors.textPrimary}}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tab === 'visitors' ? 'Search name, car, token' : 'Search doctor, car number'}
          />
          {!!query && (
            <PressableScale onClick={() => setQuery('')} style={{background: 'transparent', border: 'none', padding: 0}}>
              <Icon name="close" size={15} color={colors.textMuted} />
            </PressableScale>
          )}
        </div>
        {tab === 'visitors' && (
          <PressableScale
            style={{
              width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${selectedDate ? colors.primary : colors.border}`,
              backgroundColor: selectedDate ? colors.primary : colors.surface,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onClick={() => setCalendarOpen(true)}>
            <Icon name="calendar" size={17} color={selectedDate ? colors.textOnPrimary : colors.textSecondary} />
          </PressableScale>
        )}
      </div>

      {/* Selected-date banner — this IS the view (not a filter layered on
          top of the live one), so it reads as a distinct mode rather than
          just another chip in the row above. */}
      {tab === 'visitors' && selectedDate && (
        <div style={{display: 'flex', alignItems: 'center', gap: 8, margin: '10px 20px 0', padding: '10px 14px', borderRadius: 14, backgroundColor: colors.cardAlt}}>
          <Icon name="calendar" size={14} color={colors.textSecondary} />
          <span style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary}}>{calendarDateLabel(selectedDate)}</span>
          {dateLoading && <span className="spinner" style={{width: 13, height: 13, marginLeft: 4, borderColor: colors.border, borderTopColor: colors.textMuted}} />}
          <div style={{flex: 1}} />
          <PressableScale onClick={() => setSelectedDate(null)} style={{background: 'transparent', border: 'none', padding: 0}}>
            <Icon name="close" size={16} color={colors.textSecondary} />
          </PressableScale>
        </div>
      )}

      <div style={{display: 'flex', gap: 8, padding: '10px 20px 0'}}>
        {(['active', 'completed', 'all'] as StatusFilter[]).map(f => {
          const on = statusFilter === f;
          return (
            <PressableScale
              key={f}
              disabled={!!selectedDate}
              onClick={() => { setStatusFilter(f); if (f !== 'active') setStageFilter('all'); }}
              style={{flex: 1, textAlign: 'center', borderRadius: 99, border: `1px solid ${on ? colors.primary : colors.border}`, padding: '9px 14px', backgroundColor: on ? colors.primary : colors.surface, opacity: selectedDate ? 0.4 : 1}}
            >
              <span style={{fontSize: 12, fontWeight: 900, fontFamily: 'Arial', color: on ? colors.textOnPrimary : colors.textSecondary}}>
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Completed'}
              </span>
            </PressableScale>
          );
        })}
      </div>

      <CalendarPicker
        visible={calendarOpen}
        value={selectedDate ?? undefined}
        onClose={() => setCalendarOpen(false)}
        onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }}
      />

      {/* Second-level stage row — only meaningful once "Active" narrows the
          list to still-in-flight tickets; a completed/all list mixes every
          stage together, so a stage chip there wouldn't mean anything.
          Same 4 chips, same meaning, whichever tab (Visitors or Staff) is
          showing — it's one shared vehicle-lifecycle filter, not two. */}
      {statusFilter === 'active' && (
        <HScrollHint fadeColor={colors.background} className="hscroll" style={{gap: 8, padding: '10px 20px 0'}}>
          {STAGE_FILTERS.map(sf => {
            const on = stageFilter === sf.key;
            return (
              <PressableScale
                key={sf.key}
                onClick={() => setStageFilter(on ? 'all' : sf.key)}
                style={{borderRadius: 99, border: `1px solid ${on ? colors.primary : colors.border}`, padding: '7px 14px', backgroundColor: on ? colors.primary : colors.surface, flexShrink: 0}}
              >
                <span style={{fontSize: 12, fontWeight: 900, fontFamily: 'Arial', color: on ? colors.textOnPrimary : colors.textSecondary, whiteSpace: 'nowrap'}}>
                  {sf.label}
                </span>
              </PressableScale>
            );
          })}
        </HScrollHint>
      )}

      <div className="screen-scroll" style={{padding: '14px 20px 40px'}}>
        {tab === 'staff' && historyLoading && staffHistory.length === 0 ? (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 48}}>
            <span className="spinner" style={{borderColor: colors.border, borderTopColor: colors.primary}} />
            <span style={{fontSize: 12.5, fontWeight: 500, marginTop: 10, color: colors.textMuted}}>Loading staff records…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 48}}>
            <span style={{fontSize: 14, fontWeight: 600, color: colors.textSecondary}}>{q ? 'No match found' : `No ${tab} records`}</span>
            <span style={{fontSize: 12.5, fontWeight: 500, color: colors.textMuted}}>
              {q ? 'Try a different name, plate, or ID' : tab === 'visitors' ? 'New tokens appear here as they are issued' : 'Staff/doctor parking activity appears here'}
            </span>
          </div>
        ) : tab === 'visitors' ? (filtered as Visitor[]).map(renderVisitorTicket) : (filtered as ParkingTask[]).map(renderStaffTicket)}
      </div>
      </>
      )}

      {/* Detail sheet — small extra context beyond what fits on the ticket
          card itself, for either tab. Read-only; the actual actions stay on
          the card so there's still exactly one place to do anything. */}
      {detailRows && (
        <div
          style={{position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24}}
          onClick={closeDetail}
        >
          <div style={{width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', borderRadius: 22, padding: 20, backgroundColor: colors.surface}} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14}}>
              <span style={{fontSize: 17, fontWeight: 900, flex: 1, marginRight: 12, color: colors.textPrimary}}>
                {detailVisitor ? (detailVisitor.name || 'Visitor') : detailTask?.doctorName}
              </span>
              <PressableScale style={{width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}} onClick={closeDetail}>
                <Icon name="close" size={16} color={colors.textPrimary} />
              </PressableScale>
            </div>

            {detailRows.map(([k, v]) => (
              <div key={k} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.divider}`, gap: 12}}>
                <span style={{fontSize: 12, fontWeight: 700, color: colors.textMuted}}>{k}</span>
                <span style={{fontSize: 13, fontWeight: 700, flexShrink: 1, textAlign: 'right', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: colors.textPrimary}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
