import React, {useState, useRef, useEffect} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useTheme} from '../../context/ThemeContext';
import {BRAND_GRADIENT, BRAND_GRADIENT_DARK, gradientCss} from '../../theme/colors';
import {Icon, IconName} from '../../components/Icon';
import {PressableScale} from '../../components/PressableScale';
import {DriverPickerList} from '../../components/DriverPickerList';
import {usersApi, tasksApi, visitorsApi, isJobGone} from '../../services/api';
import {formatPlate, isCompletePlate} from '../../utils/plate';
import {VehicleNumberInput} from '../../components/VehicleNumberInput';
import {useValetActions, isMyJobToRun} from './useValetActions';
import type {ParkingTask} from '../../context/AppStateContext';
import {useAppState} from '../../context/AppStateContext';
import {
  plannedDepartureLabel, minutesUntilDeparture, departureClockLabel,
  enRouteSeconds, fmtDuration,
} from '../../utils/retrievalClocks';

// Web (DOM) port of the mobile app's ValetHomeScreen — same screens, same
// state machine, same business logic. Navigation between the five
// "screens" here (home/scan/assign/visitor/retrievals) is local component
// state, exactly like the mobile version — the web app's own tab router
// only decides when this whole component is mounted (the "Queue" tab,
// labelled "Dashboard" now that the home screen below is one).
//
// Native-only pieces have no web equivalent and are dropped/adapted:
//   - Alert.alert / the AppDialog system -> window.alert / window.confirm
//   - Vibration/haptics -> dropped (no-op)
//   - RefreshControl / pull-to-refresh -> dropped (the socket keeps state live)
//   - FlatList/SectionList -> plain .map() over a <div> list
//   - StatusBar -> dropped (no web equivalent)

type Screen = 'home' | 'scan' | 'assign' | 'visitor' | 'retrievals';

type QueueTab = 'mine' | 'team';

// Planned-departure badge colours, most urgent first. This shows ONLY when
// the doctor intends to leave — it is not a delivery estimate.
function departureTone(left: number | null, c: any): string {
  if (left == null) return c.textMuted;
  if (left <= 0) return c.error;      // due, or overdue
  if (left <= 10) return '#F97316';   // orange
  if (left <= 20) return c.warning;   // yellow
  if (left <= 30) return c.info ?? '#3B82F6';
  return c.success;                   // furthest out — least urgent
}

// Placeholder blocks shown while the first fetch is still in flight —
// shaped like the content they stand in for so nothing shifts when real
// data lands. DOM port of the mobile app's SkeletonCard, kept local since
// this is the only screen on web that needs it so far.
function SkeletonCard({lines = 2, style}: {lines?: number; style?: React.CSSProperties}) {
  const {colors} = useTheme();
  return (
    <div style={{borderRadius: 20, border: `1px solid ${colors.border}`, padding: 20, backgroundColor: colors.surface, ...style}}>
      <div className="skel-pulse" style={{height: 26, width: '55%', borderRadius: 7, backgroundColor: colors.cardAlt}} />
      {Array.from({length: lines}, (_, i) => (
        <div key={i} className="skel-pulse" style={{height: 12, width: i === lines - 1 ? '40%' : '75%', borderRadius: 6, backgroundColor: colors.cardAlt, marginTop: 10}} />
      ))}
    </div>
  );
}

const ellipsis1: React.CSSProperties = {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'};
const clamp2: React.CSSProperties = {display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'};

export function ValetHomeScreen() {
  const {user} = useAuth();
  const {drivers, tasks, visitors, addTask, addVisitor, markKeyCollected,
    activeTasks, availableDrivers, retrievalRequests, assignTaskDriver, assignVisitorPickupDriver,
    cancelTaskAssignment,
    confirmTaskDelivered, cancelTask, recallTask, arrivalNotices, dismissArrivalNotice,
    acceptRetrieval, myValetId} = useValetActions();
  const {hydrated, slots} = useAppState();
  const {colors, isDark} = useTheme();

  const [screen, setScreen] = useState<Screen>('home');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [foundUser, setFoundUser] = useState<any | null>(null);
  const [carNumber, setCarNumber] = useState('');
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Visitor-side counterpart to pendingTaskId — a freshly-created visitor
  // token also needs a driver assigned right away to collect the key.
  const [pendingVisitorId, setPendingVisitorId] = useState<number | null>(null);

  const [vName, setVName] = useState('');
  const [vCar, setVCar] = useState('');
  const [vMobile, setVMobile] = useState('');
  const [vVehicleType, setVVehicleType] = useState<'car' | 'bike'>('car');
  // Mobile is the one field that must be right — it is how the token and the
  // tracking link reach them. Validated inline, but only complained about
  // once they've actually typed something and moved on.
  const [mobileTouched, setMobileTouched] = useState(false);
  const vMobileDigits = vMobile.replace(/\D/g, '');
  const mobileValid = vMobileDigits.length === 10;
  // The plate is how the car is found later — at the desk, in the car park,
  // and in search. Required, but only non-empty: a foreign or temporary
  // registration is still a real plate, and refusing it would strand a car
  // the valet is physically looking at.
  // A complete, parseable Indian plate — not merely non-empty. The valet is
  // reading it off the car in front of them, so a half-typed one is a slip
  // rather than an edge case worth accepting.
  const carValid = isCompletePlate(vCar);
  const [carTouched, setCarTouched] = useState(false);
  const canCheckIn = mobileValid && carValid;

  // Which input currently has the keyboard — drives the focus ring so the
  // active field visibly "wakes up" instead of looking like a static box.
  const [focused, setFocused] = useState<string | null>(null);
  // Assign-driver screen: search box.
  const [driverSearch, setDriverSearch] = useState('');
  const [assigningDriverId, setAssigningDriverId] = useState<number | null>(null);
  // Which job's pending assignment is being cancelled right now — guards
  // against a double-tap firing the cancel-assignment call twice.
  const [cancellingAssignmentId, setCancellingAssignmentId] = useState<number | null>(null);
  // Same guard pattern for the other one-tap job actions that had none at
  // all — a slow response left the button tappable and a second tap either
  // fired a genuine duplicate (arrival -> two key tasks) or hit the server
  // after the first tap already finished the job ("task is currently
  // completed"), which is confusing rather than informative.
  const [confirmingTaskId, setConfirmingTaskId] = useState<number | null>(null);
  const [collectingKeyTaskId, setCollectingKeyTaskId] = useState<number | null>(null);
  const [arrivingId, setArrivingId] = useState<number | null>(null);
  const [assigningToId, setAssigningToId] = useState<number | null>(null);
  // Read from async callbacks that would otherwise close over stale values.
  const assigningDriverIdRef = useRef<number | null>(null);
  assigningDriverIdRef.current = assigningDriverId;
  const screenRef = useRef<Screen>('home');
  screenRef.current = screen;
  const pendingTaskIdRef = useRef<number | null>(null);
  pendingTaskIdRef.current = pendingTaskId;
  const [arrivalQuery, setArrivalQuery] = useState('');
  // Job Queue is split so a valet reads only what they're accountable for.
  // Team jobs stay reachable on the second tab because the key can be handed
  // between valets — see QUEUE_TABS.
  const [queueTab, setQueueTab] = useState<QueueTab>('mine');
  // Deadlines have to visibly tick — a static "wants it in 10 min" rendered
  // once tells the valet nothing about how much of that is left by now.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  // Return-key chaining: enter on one field jumps to the next.
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Arrivals, searchable and soonest-first. Matching code / plate / name in
  // one pass rather than three fields: whoever is at the counter gives you
  // one of the three and the valet shouldn't have to choose which box first.
  const arrivalQ = arrivalQuery.trim().toLowerCase();
  const arrivalsFiltered = [...arrivalNotices]
    .filter(a => !arrivalQ
      || (a.doctorCardCode ?? '').toLowerCase().includes(arrivalQ)
      || (a.doctorCarNumber ?? '').toLowerCase().includes(arrivalQ)
      || (a.doctorName ?? '').toLowerCase().includes(arrivalQ))
    .sort((a, b) => a.eta - b.eta);

  const pendingVisitor = pendingVisitorId ? visitors.find(v => v.id === pendingVisitorId) ?? null : null;
  const pendingTask = pendingTaskId ? tasks.find(t => t.id === pendingTaskId) ?? null : null;

  // Accept-timeout / reject prompt: the backend watchdog (or the driver's
  // explicit reject) freed the job and asked us — the valet — to pick
  // another driver. Confirming jumps straight into the assign screen.
  const {reassignPrompt, clearReassignPrompt} = useAppState();
  useEffect(() => {
    if (!reassignPrompt) return;
    const what = reassignPrompt.kind === 'task'
      ? `${reassignPrompt.task?.carNumber ?? 'this car'} (${reassignPrompt.task?.doctorName ?? ''})`
      : `${reassignPrompt.visitor?.name ?? 'this visitor'}'s car`;
    // Two genuinely different situations share this prompt. A named driver
    // means one was assigned and dropped it. No name means the job never got
    // a driver at all — saying "X didn't accept in time" there is simply
    // false, and it used to print the VALET's own name in that slot.
    const why = reassignPrompt.rejected ? 'rejected the job' : "didn't accept in time";
    const noDriverYet = !reassignPrompt.driverName;
    const title = noDriverYet ? 'Job still needs a driver' : 'Driver did not accept';
    const message = noDriverYet
      ? `${what} still has no driver. Assign one?`
      : `${reassignPrompt.driverName} ${why} for ${what}. Assign another driver?`;
    // window.confirm stands in for the mobile dialog's two-button prompt:
    // OK = "Reassign now", Cancel = "Later".
    const reassignNow = window.confirm(`${title}\n\n${message}`);
    if (reassignNow) {
      if (reassignPrompt.kind === 'task' && reassignPrompt.task) {
        setPendingVisitorId(null);
        setPendingTaskId(reassignPrompt.task.id);
      } else if (reassignPrompt.visitor) {
        setPendingTaskId(null);
        setPendingVisitorId(reassignPrompt.visitor.id);
      }
      setScreen('assign');
    } else {
      // Acknowledge server-side, not just locally — otherwise the sweep
      // still treats this job as unattended and pulls in every valet.
      const id = reassignPrompt.kind === 'task' ? reassignPrompt.task?.id : null;
      if (id) tasksApi.acknowledge(id).catch(() => {});
    }
    clearReassignPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reassignPrompt, clearReassignPrompt]);

  const handleScanCode = async () => {
    if (submitting) return;
    setCodeError('');
    const trimmed = code.trim();
    setSubmitting(true);
    try {
      const found = await usersApi.lookupByCardCode(trimmed);
      setCode('');
      // Staff already set their car number up on their own login — if it's
      // on file, skip straight to driver assignment instead of asking the
      // valet to retype something that's already known.
      if (found.carNumber?.trim()) {
        await createKeyTask(found, found.carNumber.trim());
      } else {
        setFoundUser(found);
        setCarNumber('');
      }
    } catch (err) {
      setCodeError('No user found with this code');
    } finally {
      setSubmitting(false);
    }
  };

  // Creating the ticket and assigning a driver are two separate steps now —
  // this used to walk straight into the assign screen in one continuous
  // motion, but that meant a freshly-created ticket only ever existed for
  // the instant between the two calls, never actually visible as "waiting
  // for a driver". Splitting them means ANY valet (not just whoever
  // scanned the card) can pick it up from the Dashboard's "Driver assign
  // pending" section — the same section an unclaimed retrieval request
  // already lands in, and the backend already creates a park task at
  // status 'assigned' with no driverId, so isAssignPending already
  // recognises it with no server change needed.
  const createKeyTask = async (u: any, plate: string) => {
    try {
      await addTask({
        type: 'park',
        doctorId: u.id,
        doctorName: u.name,
        carNumber: plate.toUpperCase(),
        status: 'assigned',
        assignedAt: Date.now(),
      });
      setFoundUser(null); setCarNumber('');
      setScreen('home');
      window.alert(
        `Ticket created\n\n${plate.toUpperCase()} is now waiting for a driver in "Driver assign pending" on the Dashboard.`,
      );
    } catch (err: any) {
      window.alert(err.message || 'Something went wrong');
    }
  };

  const handleKeyReceived = async () => {
    if (submitting || !foundUser || !carNumber.trim()) return;
    setSubmitting(true);
    try {
      await createKeyTask(foundUser, carNumber.trim());
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignDriver = async (driverId: number) => {
    // Blocks a fast double-tap (same or a different driver) from firing a
    // second assignDriver call before the first has resolved — that could
    // otherwise notify one driver and immediately bump them for another
    // with no confirmation in between.
    if (assigningDriverId != null) return;
    setAssigningDriverId(driverId);
    try {
      if (pendingVisitorId) {
        await assignVisitorPickupDriver(pendingVisitorId, driverId);
        setPendingVisitorId(null);
      } else if (pendingTaskId) {
        await assignTaskDriver(pendingTaskId, driverId);
        setFoundUser(null); setCarNumber(''); setPendingTaskId(null);
      } else {
        return;
      }
      setScreen('home');
    } catch (err: any) {
      // Two very different failures land here. If the job moved on there is
      // nothing left to do on this screen, so close it — leaving the valet
      // on a driver list for someone else's job just invites more failed
      // taps. If it's only that THIS driver got taken, the job is still
      // theirs: stay put so they can pick another without navigating back in.
      if (isJobGone(err)) {
        setPendingTaskId(null); setPendingVisitorId(null);
        setScreen('home');
      }
      window.alert(`${isJobGone(err) ? 'Job already handled' : 'Error'}\n\n${err.message || 'Something went wrong'}`);
    } finally {
      setAssigningDriverId(null);
    }
  };

  // The assign screen was entirely passive: it only learned the job had been
  // taken when the valet tapped a driver and the call failed. pendingTask is
  // already derived from the live socket-fed list, so the screen can know the
  // moment someone else staffs it — and close itself before a wasted tap.
  useEffect(() => {
    if (screen !== 'assign') return;
    // Not while OUR own assignment is in flight — the task gains a driverId
    // the moment it succeeds, and if that arrives before this screen has
    // finished closing, the effect would report the valet's own assignment
    // as someone else stealing the job.
    if (assigningDriverId != null) return;
    // An empty list before the first load is "not known yet", not "gone".
    if (!hydrated) return;

    // Three ways a job stops being assignable, and this screen has to leave
    // for all of them — it is bound to ONE entity, so the entity ceasing to
    // exist has to end the screen, not just the entity changing.
    //
    //   taken     — someone else staffed it; it's still on our list.
    //   vanished  — it left our list entirely. Another valet claiming a
    //               retrieval removes it from every non-owner's app, and a
    //               superseded or cancelled job drops out on the next
    //               refetch.
    //   finished  — still listed, but past the point of taking a driver.
    //
    // Only the first was handled, so the other two left a driver picker open
    // for a job that no longer existed, and the valet found out by tapping a
    // driver and getting an error.
    const taken = (pendingTaskId != null && pendingTask?.driverId != null)
      || (pendingVisitorId != null && pendingVisitor?.driverId != null);
    const vanished = (pendingTaskId != null && !pendingTask)
      || (pendingVisitorId != null && !pendingVisitor);
    const finished = (pendingTask != null && (pendingTask.status === 'completed' || pendingTask.status === 'cancelled'))
      || (pendingVisitor != null && (pendingVisitor.status === 'retrieved' || pendingVisitor.status === 'cancelled'));
    if (!taken && !vanished && !finished) return;

    setPendingTaskId(null); setPendingVisitorId(null);
    setScreen('home');
    if (taken) {
      const who = pendingTask?.valetName ?? 'Another valet';
      window.alert(`Job already handled\n\n${who} already assigned a driver to this job.`);
      return;
    }
    // Nobody to name — it left our list, so we don't know who took it.
    window.alert('Job no longer available\n\nThis job is no longer available.');
  }, [screen, pendingTaskId, pendingVisitorId, pendingTask, pendingVisitor, assigningDriverId, hydrated]);

  const handleAddVisitor = async () => {
    // Name is optional; the mobile number and the plate are not.
    if (!canCheckIn) { setMobileTouched(true); setCarTouched(true); return; }
    // Blocks a fast double-tap from firing two check-ins for the same
    // visitor — unlike handleScanCode/handleKeyReceived (staff), this had no
    // guard at all, client or server, so a slow response left the button
    // tappable and a second tap created a genuine second Visitor row.
    if (submitting) return;
    setSubmitting(true);
    try {
      const visitor = await addVisitor({
        name: vName.trim(),
        // Required now, and sent in canonical form so the stored plate matches
        // what search normalises against.
        carNumber: formatPlate(vCar) ?? vCar.trim().toUpperCase(),
        mobile: vMobileDigits,
        vehicleType: vVehicleType,
      });
      // Shown regardless of WhatsApp: this token is what the visitor brings
      // back to the desk to collect their car, and with WhatsApp off it is
      // the ONLY place it appears. Reading it out is the fallback.
      // Check-in and driver assignment are separate steps — same reasoning
      // as createKeyTask above: the token now sits visibly in "Driver
      // assign pending" on the Dashboard until any valet picks it up,
      // rather than forcing whoever checked the visitor in to also be the
      // one who assigns a driver in the same breath.
      window.alert(
        `Checked in\n\nParking token  ${visitor.token}\n\n${visitor.carNumber || 'Vehicle'} — ${vMobileDigits}\n\n` +
        'Give this token to the visitor. Their car is now waiting for a driver in "Driver assign pending" on the Dashboard.',
      );
      setVName(''); setVCar(''); setVMobile(''); setVVehicleType('car');
      setScreen('home');
    } catch (err: any) {
      window.alert(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmTaskDelivered = async (taskId: number) => {
    if (confirmingTaskId != null) return;
    setConfirmingTaskId(taskId);
    try {
      await confirmTaskDelivered(taskId);
    } catch (err: any) {
      window.alert(err.message || 'Could not confirm handover');
    } finally {
      setConfirmingTaskId(null);
    }
  };

  // Same race, on the departure side. Fires either for the session owner
  // responding inside their window, or for anyone claiming a request the
  // owner never answered.
  // The ONLY way into the driver picker, from both retrieval requests and
  // the Dashboard. They had separate handlers with different behaviour, so
  // the queue's "Assign driver" opened the list without marking the job as
  // handled — leaving it live to every other valet (and to the recovery
  // countdown) for however long the valet spent choosing a driver.
  //
  // One tap. Accepting and assigning were two separate taps, which is one
  // more decision than the valet actually makes: opening the driver list IS
  // them saying they're handling it.
  //
  // The screen opens SYNCHRONOUSLY and the claim runs behind it. Awaiting the
  // claim first is what caused the visible stutter — `await acceptRetrieval()`
  // flushes its setTasks in one tick and `setScreen` in the next, so React
  // painted a frame with the button already relabelled "Assign driver" before
  // navigating away from it.
  //
  // Claiming still happens, and still happens immediately: it is what marks
  // the request as handled, stops the recovery countdown, and takes it off
  // every other valet's screen. Skipping it would leave the request live to
  // the whole team while this valet stands there choosing a driver.
  const handleAssignDriverTo = (t: ParkingTask) => {
    // Guards only the background claim below, not the navigation — the
    // screen change itself already takes the button off-screen on the next
    // render, but two taps landing in the same JS tick (before that commits)
    // could otherwise both fire acceptRetrieval for the same job.
    if (assigningToId === t.id) return;
    setAssigningToId(t.id);
    setPendingTaskId(t.id);
    setScreen('assign');

    // Claim only what is actually claimable. Every condition here is load-
    // bearing:
    //  - park jobs have no retrieval to accept, and `undefined === myValetId`
    //    is false, so without this a park job would fire a claim that can
    //    only fail and would then close this screen underneath the valet;
    //  - a non-valet (admin) has no claim to make and would get a 403;
    //  - past 'accepted' the job already has a driver history, and takeover
    //    of an escalated one is assignDriver's job — its guard lifts on
    //    escalation, whereas claimRetrieval would refuse and close the screen;
    //  - already ours means there is nothing to spend a request on.
    const claimable = t.type === 'retrieve'
      && myValetId != null
      && (t.status === 'requested' || t.status === 'accepted')
      && t.retrievalOwnerValetId !== myValetId;
    if (!claimable) { setAssigningToId(null); return; }

    acceptRetrieval(t.id)
      .catch((err: any) => {
        // Lost the race. Two ways this screen can already be gone, and
        // reporting a second time would stack a dialog behind the first:
        //  - an assignment is in flight (assignDriver claims too, and reports
        //    its own failure) — leave it alone;
        //  - the socket's task:restrict already pulled the job from our list
        //    and the close-effect closed us with its own message.
        if (assigningDriverIdRef.current != null) return;
        if (screenRef.current !== 'assign' || pendingTaskIdRef.current !== t.id) return;
        setPendingTaskId(null);
        setScreen('home');
        window.alert(`Already taken\n\n${err?.message || 'This retrieval request has already been accepted.'}`);
      })
      .finally(() => setAssigningToId(null));
  };

  // Path B — the valet already knows who this is from the arrival card, so
  // skip the 3-digit code lookup entirely. If the plate's on file, jump
  // straight to driver assignment (same as the "already known" branch of
  // handleScanCode); otherwise drop into the scan screen's step 2 with the
  // identity pre-filled, so the valet only has to type the plate in.
  const handleArrivalArrived = async (a: {id: number; doctorId: number; doctorName: string; doctorCarNumber?: string; doctorDepartment?: string; doctorEmployeeId?: string}) => {
    if (arrivingId != null) return;
    if (!a.doctorCarNumber?.trim()) {
      setFoundUser({id: a.doctorId, name: a.doctorName, department: a.doctorDepartment, employeeId: a.doctorEmployeeId});
      setCarNumber('');
      setScreen('scan');
      return;
    }
    setArrivingId(a.id);
    try {
      await createKeyTask({id: a.doctorId, name: a.doctorName}, a.doctorCarNumber.trim());
    } finally {
      setArrivingId(null);
    }
  };

  const handleCancelTask = (taskId: number) => {
    if (!window.confirm('Cancel This Job?\n\nUse this if it’s stuck (e.g. never got a driver) and needs to be cleared.')) return;
    cancelTask(taskId).catch(err => window.alert(err.message || 'Could not cancel'));
  };

  // Give up on a driver who hasn't accepted yet, right now, instead of
  // waiting out the accept-timeout window — the job itself (and, for a
  // visitor, their token) is untouched, just back to "needs a driver".
  const handleCancelAssignment = (taskId: number) => {
    if (cancellingAssignmentId != null) return;
    setCancellingAssignmentId(taskId);
    cancelTaskAssignment(taskId)
      .catch(err => window.alert(err.message || 'Could not cancel the assignment'))
      .finally(() => setCancellingAssignmentId(null));
  };

  // Past the key handover the car is physically with a driver, so it can't
  // just be voided — this tells them to bring it back to the counter.
  const handleRecallTask = (taskId: number, plate: string) => {
    if (!window.confirm(`Bring the Car Back?\n\nThe driver will be told NOT to park ${plate} and to return it to the valet counter instead.`)) return;
    recallTask(taskId).catch(err => window.alert(err.message || 'Could not recall'));
  };

  // ── shared style bits ───────────────────────────────────────────────────
  const circleBackStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${colors.border}`, backgroundColor: colors.surface, flexShrink: 0,
  };
  const headerCompactStyle: React.CSSProperties = {display: 'flex', alignItems: 'center', gap: 12, padding: 16, paddingTop: 20, flexShrink: 0};
  const stepLabelStyle: React.CSSProperties = {fontSize: 10, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8, color: colors.textMuted};
  const stepDescStyle: React.CSSProperties = {fontSize: 16, fontWeight: 700, marginBottom: 18, color: colors.textPrimary};
  const actionBtnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 52,
    padding: '0 24px', width: '100%',
  };
  const inputRowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', borderRadius: 14, padding: '0 10px', height: 58, marginBottom: 16,
    boxShadow: '0 3px 8px rgba(0,0,0,0.06)',
  };
  const inputIconWrapStyle: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginRight: 10, backgroundColor: colors.cardAlt, flexShrink: 0,
  };
  const emptyBoxStyle: React.CSSProperties = {
    borderRadius: 14, border: `1px dashed ${colors.border}`, padding: 24, textAlign: 'center', marginBottom: 16,
  };
  const taskCardBase: React.CSSProperties = {borderRadius: 18, border: `1px solid ${colors.border}`, padding: 16, marginBottom: 12};
  const taskActionBtnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, padding: '12px 0',
    border: '1px solid transparent', width: '100%',
  };
  const inboxTabsStyle: React.CSSProperties = {display: 'flex', borderBottom: `1px solid ${colors.border}`, padding: '0 20px', flexShrink: 0};
  const inboxTabStyle: React.CSSProperties = {flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0'};
  const inboxTabTxtStyle: React.CSSProperties = {fontSize: 13, fontWeight: 800};
  const inboxTabBarStyle: React.CSSProperties = {height: 2, borderRadius: 1, marginTop: 8, alignSelf: 'stretch', width: '100%', backgroundColor: colors.textPrimary};

  // ── SCAN / KEY COLLECTION ──────────────────────────────────────────────
  if (screen === 'scan') {
    return (
      <div style={{display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background}}>
        <div style={headerCompactStyle}>
          <PressableScale onClick={() => { setScreen('home'); setFoundUser(null); setCode(''); setCodeError(''); }} style={circleBackStyle}>
            <Icon name="back" size={18} color={colors.textPrimary} />
          </PressableScale>
          <span style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary}}>Key Collection</span>
        </div>
        <div className="screen-scroll" style={{padding: 20, paddingBottom: 40}}>
          {!foundUser ? (
            <>
              <div style={stepLabelStyle}>STEP 1 — IDENTIFY</div>
              <div style={stepDescStyle}>Enter the 3-digit code from the doctor/staff card</div>
              <div style={{borderRadius: 20, border: `1px solid ${colors.border}`, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, backgroundColor: colors.surface}}>
                {/* OTP-style code entry — three visible cells that fill per
                    digit, driven by one invisible input stretched over them
                    so clicking anywhere focuses the keyboard. */}
                <div style={{position: 'relative', display: 'flex', gap: 14}}>
                  {[0, 1, 2].map(i => {
                    const digit = code[i];
                    const active = focused === 'code' && code.length === i;
                    return (
                      <div key={i} style={{
                        width: 60, height: 72, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: colors.background,
                        border: `${active ? 2 : 1.5}px solid ${active ? colors.textPrimary : colors.border}`,
                      }}>
                        {digit
                          ? <span style={{fontSize: 34, fontWeight: 900, color: colors.textPrimary}}>{digit}</span>
                          : <span style={{width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textMuted}} />}
                      </div>
                    );
                  })}
                  <input
                    style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, fontSize: 1, border: 'none'}}
                    value={code}
                    onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 3)); setCodeError(''); }}
                    onFocus={() => setFocused('code')}
                    onBlur={() => setFocused(null)}
                    onKeyDown={e => { if (e.key === 'Enter' && code.length === 3 && !submitting) handleScanCode(); }}
                    inputMode="numeric"
                    maxLength={3}
                    autoFocus
                  />
                </div>
                {!!codeError && <div style={{fontSize: 13, fontWeight: 600, color: colors.error}}>{codeError}</div>}
                <PressableScale
                  style={{...actionBtnBase, backgroundColor: code.length === 3 && !submitting ? colors.primary : colors.cardAlt}}
                  onClick={handleScanCode} disabled={code.length !== 3 || submitting}
                >
                  <span style={{fontSize: 14, fontWeight: 800, color: code.length === 3 && !submitting ? colors.textOnPrimary : colors.textMuted}}>{submitting ? 'Please wait…' : 'Find Customer'}</span>
                  <Icon name="arrowRight" size={15} color={code.length === 3 && !submitting ? colors.textOnPrimary : colors.textMuted} />
                </PressableScale>
              </div>
            </>
          ) : (
            <>
              <div style={stepLabelStyle}>STEP 2 — CONFIRM & COLLECT KEY</div>
              <div style={{borderRadius: 16, border: `1px solid ${colors.success}40`, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20, backgroundColor: colors.success + '12'}}>
                <div style={{width: 52, height: 52, borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, backgroundColor: colors.successLight}}>
                  <Icon name="check" size={26} color={colors.success} />
                </div>
                <div style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary}}>{foundUser.name}</div>
                <div style={{fontSize: 13, marginTop: 2, color: colors.textSecondary}}>{foundUser.department ?? foundUser.role}</div>
                <div style={{fontSize: 11, marginTop: 4, color: colors.textMuted}}>ID: {foundUser.employeeId}</div>
              </div>
              <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 4, color: colors.textMuted}}>CAR NUMBER PLATE</div>
              <div style={{...inputRowBase, border: `1.5px solid ${focused === 'plate' ? colors.textPrimary : colors.border}`, backgroundColor: colors.surface}}>
                <div style={inputIconWrapStyle}>
                  <Icon name="car" size={16} color={focused === 'plate' ? colors.textPrimary : colors.textMuted} />
                </div>
                <input
                  style={{flex: 1, fontSize: 15, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: colors.textPrimary}}
                  value={carNumber}
                  onChange={e => setCarNumber(e.target.value)} placeholder="e.g. TN09 AB 1234"
                  onFocus={() => setFocused('plate')} onBlur={() => setFocused(null)}
                  onKeyDown={e => { if (e.key === 'Enter' && carNumber.trim()) handleKeyReceived(); }}
                  autoCapitalize="characters" />
              </div>
              <PressableScale
                style={{...actionBtnBase, backgroundColor: carNumber.trim() && !submitting ? colors.primary : colors.cardAlt}}
                onClick={handleKeyReceived} disabled={!carNumber.trim() || submitting}
              >
                <Icon name="check" size={15} color={carNumber.trim() && !submitting ? colors.textOnPrimary : colors.textMuted} />
                <span style={{fontSize: 14, fontWeight: 800, color: carNumber.trim() && !submitting ? colors.textOnPrimary : colors.textMuted}}>{submitting ? 'Please wait…' : 'Key received'}</span>
              </PressableScale>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── ASSIGN DRIVER ──────────────────────────────────────────────────────
  if (screen === 'assign') {
    const closeAssign = () => {
      setScreen('home'); setPendingVisitorId(null); setPendingTaskId(null);
      setDriverSearch('');
    };
    const isRetrieve = pendingTask?.type === 'retrieve';
    // Fewest jobs today first, then alphabetical so the order is stable
    // rather than shuffling between renders on equal counts.
    const visibleDrivers = availableDrivers
      .filter(d => d.name.toLowerCase().includes(driverSearch.trim().toLowerCase()))
      .slice()
      .sort((a, b) => (a.completedToday ?? 0) - (b.completedToday ?? 0) || a.name.localeCompare(b.name));

    return (
      <div style={{display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20, flexShrink: 0}}>
          <PressableScale onClick={closeAssign} style={circleBackStyle}>
            <Icon name="back" size={18} color={colors.textPrimary} />
          </PressableScale>
          <span style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary}}>Assign driver</span>
          <PressableScale onClick={closeAssign} style={{borderRadius: 10, border: `1px solid ${colors.border}`, padding: '9px 14px', backgroundColor: colors.surface}}>
            <span style={{fontSize: 13, fontWeight: 800, color: colors.primary}}>Skip</span>
          </PressableScale>
        </div>
        <div className="screen-scroll" style={{padding: 20, paddingBottom: 40}}>
          {/* Who this actually is — shown before picking a driver so a
              mis-scanned/mis-typed code gets caught here, not after a driver's
              already been notified. */}
          {(pendingVisitor || pendingTask) && (
            <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), borderRadius: 18, padding: 18, marginBottom: 18}}>
              {/* The person leads, the plate sits under it. Each fact is on
                  its own line — a long name must not truncate the plate. */}
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                <span style={{flex: 1, minWidth: 0, fontSize: 20, fontWeight: 900, letterSpacing: -0.3, color: '#FFFFFF', ...ellipsis1}}>
                  {pendingVisitor?.name ?? pendingTask?.doctorName ?? 'Unknown'}
                </span>
                {/* Fixed light-on-dark values, not theme tokens: this card is
                    a dark surface in BOTH themes. Retrieve keeps an amber
                    tint so the two job types stay tellable apart. */}
                <span style={{display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, padding: '5px 8px', backgroundColor: 'rgba(255,255,255,0.14)', flexShrink: 0}}>
                  <span style={{fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: isRetrieve ? '#F5C168' : '#FFFFFF'}}>
                    {isRetrieve ? 'RETRIEVE' : 'PARK'}
                  </span>
                </span>
              </div>
              {/* Who they are, under the name. A visitor has no department,
                  so they get the label that actually applies to them. */}
              <div style={{fontSize: 13, fontWeight: 700, marginTop: 3, color: 'rgba(255,255,255,0.62)', ...ellipsis1}}>
                {pendingVisitor
                  ? (pendingVisitor.vehicleType === 'bike' ? 'Visitor — bike' : 'Visitor')
                  : pendingTask?.doctorDepartment?.trim() || 'Department not on file'}
              </div>

              {/* Label/value rows rather than a run-on line: a valet scans
                  down the left edge for the field they want, and nothing gets
                  truncated away by a long value in front of it. */}
              <div style={{marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.16)', display: 'flex', flexDirection: 'column', gap: 7}}>
                {(() => {
                  const facts: [string, string][] = [];
                  const plate = (pendingVisitor?.carNumber ?? pendingTask?.carNumber ?? '').trim();
                  facts.push(['VEHICLE', plate || 'Plate not on file']);
                  if (pendingTask?.slotId) facts.push(['SLOT', pendingTask.slotId]);
                  if (pendingVisitor?.mobile) facts.push(['MOBILE', pendingVisitor.mobile]);
                  if (pendingVisitor?.token) facts.push(['TOKEN', pendingVisitor.token]);
                  if (!pendingVisitor && pendingTask?.doctorEmployeeId) {
                    facts.push(['STAFF ID', pendingTask.doctorEmployeeId]);
                  }
                  return facts.map(([k, v]) => (
                    <div key={k} style={{display: 'flex', alignItems: 'center'}}>
                      <span style={{width: 88, flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: 'rgba(255,255,255,0.5)'}}>{k}</span>
                      <span style={{flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#FFFFFF', ...ellipsis1}}>{v}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          <div style={stepLabelStyle}>SELECT DRIVER</div>
          <div style={stepDescStyle}>
            {pendingVisitor
              ? `Assign a driver to collect the key and park ${pendingVisitor.name}'s car (${pendingVisitor.carNumber})`
              : isRetrieve
              ? `Assign a driver to retrieve ${pendingTask?.carNumber} from slot ${pendingTask?.slotId}`
              : 'Assign a driver to collect the key and park this car'}
          </div>

          <div style={{display: 'flex', gap: 10, marginBottom: 16}}>
            <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 14, border: `1px solid ${colors.border}`, padding: '0 14px', height: 48, backgroundColor: colors.surface}}>
              <Icon name="search" size={16} color={colors.textMuted} />
              <input
                style={{flex: 1, fontSize: 14, fontWeight: 600, height: 48, border: 'none', outline: 'none', background: 'transparent', color: colors.textPrimary}}
                value={driverSearch}
                onChange={e => setDriverSearch(e.target.value)}
                placeholder="Search drivers…"
              />
            </div>
          </div>

          <DriverPickerList drivers={visibleDrivers} onAssign={handleAssignDriver} assigningId={assigningDriverId} />

          <div style={{display: 'flex', alignItems: 'center', gap: 10, borderRadius: 14, border: `1px solid ${colors.border}`, padding: 14, marginTop: 8, backgroundColor: colors.cardAlt}}>
            <div style={{width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.successLight}}>
              <Icon name="shield" size={16} color={colors.success} />
            </div>
            <span style={{flex: 1, fontSize: 12, fontWeight: 600, lineHeight: '17px', color: colors.textSecondary}}>
              This assignment will notify the driver and update in real-time.
            </span>
            <Icon name="info" size={16} color={colors.textMuted} />
          </div>
        </div>
      </div>
    );
  }

  // ── ARRIVALS ────────────────────────────────────────────────────────
  // Used to be one Inbox screen split between this and Retrieval Requests —
  // that half moved onto the Dashboard's Driver assign pending section
  // (retrievals are work; an arrival notice is only ever a heads-up), so
  // this screen is arrivals-only now.
  if (screen === 'retrievals') {
    return (
      <div style={{display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background}}>
        <div style={headerCompactStyle}>
          <PressableScale onClick={() => setScreen('home')} style={circleBackStyle}>
            <Icon name="back" size={18} color={colors.textPrimary} />
          </PressableScale>
          <span style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary}}>Expected Arrivals</span>
        </div>

        {/* Search is what makes a flood survivable: the valet never scrolls
            this list, they type whatever the person at the counter gives
            them. One box matching code, plate or name — at the counter you
            get whichever of the three they happen to say, and making them
            pick a field first would be a decision with no information. */}
        <div style={{display: 'flex', alignItems: 'center', gap: 8, margin: '12px 20px 0', padding: '0 12px', height: 42, borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, flexShrink: 0}}>
          <Icon name="search" size={15} color={colors.textMuted} />
          <input
            style={{flex: 1, fontSize: 14, fontWeight: 600, padding: 0, border: 'none', outline: 'none', background: 'transparent', color: colors.textPrimary}}
            value={arrivalQuery}
            onChange={e => setArrivalQuery(e.target.value)}
            placeholder="Search code, plate or name"
            autoCapitalize="characters"
            autoCorrect="off"
          />
          {arrivalQuery.length > 0 && (
            <PressableScale onClick={() => setArrivalQuery('')}>
              <Icon name="close" size={15} color={colors.textMuted} />
            </PressableScale>
          )}
        </div>

        <div className="screen-scroll" style={{padding: 20, paddingBottom: 40}}>
          {!hydrated ? (
            <SkeletonCard lines={2} />
          ) : arrivalNotices.length === 0 ? (
            <div style={emptyBoxStyle}>
              <Icon name="inbox" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
              <div style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>Nobody has announced an arrival.</div>
            </div>
          ) : arrivalsFiltered.length === 0 ? (
            <div style={emptyBoxStyle}>
              <Icon name="search" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
              <div style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No arrival matches "{arrivalQuery.trim()}".</div>
            </div>
          ) : arrivalsFiltered.map(a => (
            <div key={a.id} style={{...taskCardBase, backgroundColor: colors.surface}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                <span style={{display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6, padding: '3px 8px', backgroundColor: colors.info + '15'}}>
                  <Icon name="bellAlert" size={11} color={colors.info} />
                  <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: colors.info}}>ARRIVING</span>
                </span>
                {/* Doctors can now say an hour out, and "~60 min" reads
                    worse than "~1 hr" on a card being scanned at a counter. */}
                <span style={{fontSize: 11, fontWeight: 700, color: colors.info}}>
                  ~{a.eta >= 60 ? `${Math.round(a.eta / 6) / 10} hr` : `${a.eta} min`}
                </span>
              </div>
              <div style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>{a.doctorName}</div>
              <div style={{fontSize: 12, fontWeight: 600, marginTop: 2, color: colors.textSecondary, ...ellipsis1}}>
                {a.doctorCarNumber?.trim() || 'Plate not on file'}
              </div>
              {!!a.doctorCardCode && (
                <div style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>Code {a.doctorCardCode}</div>
              )}
              {/* "They've arrived" skips typing the code once they're
                  standing here. "No-show" is not decoration — a notice
                  only clears itself when a key is taken, so without it a
                  doctor who never turns up leaves the blue count
                  permanently wrong. */}
              <div style={{display: 'flex', gap: 8, marginTop: 12}}>
                <PressableScale
                  style={{...taskActionBtnBase, flex: 1, backgroundColor: colors.primary, opacity: arrivingId === a.id ? 0.6 : 1}}
                  disabled={arrivingId === a.id}
                  onClick={() => handleArrivalArrived(a)}>
                  {arrivingId === a.id
                    ? <span className="spinner" style={{width: 15, height: 15, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: colors.textOnPrimary}} />
                    : <Icon name="key" size={13} color={colors.textOnPrimary} />}
                  <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textOnPrimary}}>
                    {arrivingId === a.id ? 'Please wait…' : "They've arrived"}
                  </span>
                </PressableScale>
                <PressableScale style={{...taskActionBtnBase, width: 'auto', border: `1px solid ${colors.border}`, backgroundColor: colors.cardAlt, padding: '0 14px'}}
                  onClick={() => dismissArrivalNotice(a.id)}>
                  <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textSecondary}}>No-show</span>
                </PressableScale>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── VISITOR ────────────────────────────────────────────────────────────
  if (screen === 'visitor') {
    const fields = [
      {key: 'mobile', label: 'Mobile Number', icon: 'phone' as IconName, val: vMobile, set: setVMobile, ph: '10-digit number', numeric: true, required: true},
      {key: 'name', label: 'Name (optional)', icon: 'user' as IconName, val: vName, set: setVName, ph: 'Patient / visitor name', numeric: false, required: false},
    ];
    return (
      <div style={{display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background}}>
        <div style={headerCompactStyle}>
          <PressableScale onClick={() => setScreen('home')} style={circleBackStyle}>
            <Icon name="back" size={18} color={colors.textPrimary} />
          </PressableScale>
          <span style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary}}>Visitor / Patient</span>
        </div>
        <div className="screen-scroll" style={{padding: 20, paddingBottom: 40}}>
          <div style={stepLabelStyle}>VISITOR DETAILS</div>
          <div style={stepDescStyle}>WhatsApp tracking link will be sent automatically</div>
          {/* Mobile leads: it is the only required field, and the one the
              whole flow depends on. Name follows, marked optional so a valet
              doesn't stall asking for something a visitor may not give. */}
          {fields.map((f, i, arr) => {
            const nextKey = arr[i + 1]?.key;
            const showMobileError = f.key === 'mobile' && mobileTouched && !mobileValid;
            const showError = showMobileError;
            return (
              <div key={f.key} style={{marginBottom: 4}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <span style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 4, color: colors.textMuted}}>{f.label.toUpperCase()}</span>
                  {f.required && <span style={{fontSize: 9, fontWeight: 900, letterSpacing: 0.8, marginBottom: 8, marginTop: 4, color: colors.error}}>REQUIRED</span>}
                </div>
                <div style={{...inputRowBase, border: `1.5px solid ${showError ? colors.error : focused === f.key ? colors.textPrimary : colors.border}`, backgroundColor: colors.surface}}>
                  <div style={inputIconWrapStyle}>
                    <Icon name={f.icon} size={16} color={showError ? colors.error : focused === f.key ? colors.textPrimary : colors.textMuted} />
                  </div>
                  <input
                    style={{flex: 1, fontSize: 15, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: colors.textPrimary}}
                    value={f.val}
                    onChange={e => {
                      // Digits only for the phone, so paste and keypad quirks
                      // can't smuggle in spaces or dashes that the length
                      // check would then measure.
                      f.set(f.key === 'mobile' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value);
                    }}
                    ref={r => { fieldRefs.current[f.key] = r; }}
                    onFocus={() => setFocused(f.key)}
                    onBlur={() => {
                      setFocused(null);
                      if (f.key === 'mobile') setMobileTouched(true);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && nextKey) fieldRefs.current[nextKey]?.focus(); }}
                    placeholder={f.ph}
                    inputMode={f.numeric ? 'numeric' : 'text'}
                    autoCapitalize={f.numeric ? 'none' : 'words'} />
                  {f.key === 'mobile' && mobileValid && <Icon name="check" size={16} color={colors.success} />}
                </div>
                {showMobileError && (
                  <div style={{fontSize: 12, fontWeight: 700, marginTop: -10, marginBottom: 10, marginLeft: 2, color: colors.error}}>
                    {vMobileDigits.length === 0 ? 'Mobile number is required' : `Enter all 10 digits (${vMobileDigits.length}/10)`}
                  </div>
                )}
              </div>
            );
          })}
          {/* Its own component: it carries the offline state/RTO dataset, its
              own debounce and cache, and block-level validation, none of
              which belongs in a generic text row. */}
          <VehicleNumberInput
            value={vCar}
            onChange={setVCar}
            touched={carTouched}
            onTouch={() => setCarTouched(true)}
            required
          />

          <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 4, color: colors.textMuted}}>VEHICLE TYPE</div>
          <div style={{display: 'flex', gap: 10, marginBottom: 16}}>
            {(['car', 'bike'] as const).map(t => {
              const on = vVehicleType === t;
              return (
                <PressableScale key={t} onClick={() => setVVehicleType(t)}
                  style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `1.5px solid ${on ? colors.primary : colors.border}`, borderRadius: 14, height: 50, backgroundColor: on ? colors.primary : colors.surface}}>
                  <Icon name={t === 'car' ? 'car' : 'bike'} size={16} color={on ? colors.textOnPrimary : colors.textSecondary} />
                  <span style={{fontSize: 14, fontWeight: 800, color: on ? colors.textOnPrimary : colors.textSecondary}}>{t === 'car' ? 'Car' : 'Bike'}</span>
                </PressableScale>
              );
            })}
          </div>
          {/* Deliberately hedged. Whether WhatsApp actually goes out is the
              backend's call — it depends on Meta credentials the app never
              sees — so this cannot promise a message was sent. The token is
              shown on screen either way, which is what the visitor needs. */}
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 10, borderRadius: 12, border: `1px solid ${colors.border}`, padding: 14, marginBottom: 8, marginTop: 4, backgroundColor: colors.surface}}>
            <Icon name="whatsapp" size={17} color="#25D366" />
            <span style={{flex: 1, fontSize: 12, lineHeight: '17px', color: colors.textSecondary}}>
              A parking token is issued on check-in. If WhatsApp is switched on, the tracking link also goes to {vMobile || 'their number'}.
            </span>
          </div>
          <PressableScale
            style={{...actionBtnBase, backgroundColor: canCheckIn ? colors.primary : colors.cardAlt, marginTop: 8, opacity: submitting ? 0.6 : 1}}
            onClick={handleAddVisitor} disabled={!canCheckIn || submitting}
          >
            <Icon name="whatsapp" size={17} color={canCheckIn ? colors.textOnPrimary : colors.textMuted} />
            <span style={{fontSize: 14, fontWeight: 800, color: canCheckIn ? colors.textOnPrimary : colors.textMuted}}>
              {submitting ? 'Checking in…' : 'Check In'}
            </span>
          </PressableScale>
        </div>
      </div>
    );
  }

  // ── HOME (Dashboard) ─────────────────────────────────────────────────
  const busyDrivers = drivers.filter(d => d.status === 'busy').length;
  const offDrivers = drivers.filter(d => d.status === 'off').length;
  const completedToday = drivers.reduce((sum, d) => sum + (d.completedToday ?? 0), 0);
  const todayLabel = new Date().toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'});

  // ── Dashboard sections — the old flat Job Queue, regrouped by the stage
  // each job is actually stuck at, with the old standalone Retrieval
  // Requests inbox merged straight in (an unclaimed retrieval and a claimed
  // job with no driver yet are the same "needs a driver" wait from the
  // valet's side, so they now live in one section instead of two screens).
  const dashboardJobs = [...activeTasks, ...retrievalRequests];
  const dashboardMine = dashboardJobs.filter(t => isMyJobToRun(t, myValetId));
  const dashboardTeam = dashboardJobs.filter(t => !isMyJobToRun(t, myValetId));
  const dashboardJobsForTab = queueTab === 'mine' ? dashboardMine : dashboardTeam;

  const isAssignPending = (t: ParkingTask) =>
    (t.status === 'assigned' && !t.driverId) || t.status === 'requested' || t.status === 'accepted';
  const isAcceptPending = (t: ParkingTask) => t.status === 'assigned' && !!t.driverId && !t.acceptedAt;
  const isNotCompleted = (t: ParkingTask) => t.status === 'delivered';
  // Accepted and actually moving (key handed over, or en route either
  // direction) — not one of the four named sections, but still a live job
  // that has to stay visible somewhere rather than disappearing off the
  // Dashboard between "driver accepted" and "back at the counter".
  const isJobInProgress = (t: ParkingTask) => !isAssignPending(t) && !isAcceptPending(t) && !isNotCompleted(t);

  const assignPendingJobs = dashboardJobsForTab.filter(isAssignPending);
  const acceptPendingJobs = dashboardJobsForTab.filter(isAcceptPending);
  const inProgressJobs = dashboardJobsForTab.filter(isJobInProgress);
  const notCompletedJobs = dashboardJobsForTab.filter(isNotCompleted);

  // Parked Vehicles — every occupied slot with no retrieval currently in
  // flight against it. A slot stays "occupied" from markParked all the way
  // through to markRetrieved (the retrieve leg never touches slot state), so
  // occupancy alone isn't "sitting idle" — it also needs no live retrieve
  // task, or a car mid-retrieval would double-count as both parked and in
  // progress.
  const parkedVehicles = slots.filter(sl => sl.status === 'occupied' && !tasks.some(t =>
    t.type === 'retrieve' && t.slotId === sl.id && t.status !== 'completed' && t.status !== 'cancelled'));

  // One card, one contextual action button that changes as the job's own
  // stage changes — shared by every Dashboard section below, so a job looks
  // identical no matter which section it's currently filed under.
  const renderJobCard = (t: ParkingTask) => {
    const tc = t.type === 'park' ? colors.primary : colors.warning;
    const needsDriver = t.status === 'assigned' && !t.driverId;
    const isMine = t.valetId === user?.id;
    const isEscalated = !!t.escalatedAt && needsDriver;
    const claimedByOther = !!t.valetId && !isMine && !t.escalatedAt;
    const awaitingAccept = t.status === 'assigned' && !!t.driverId && !t.acceptedAt;
    const needsConfirm = t.status === 'delivered';
    const recalled = !!t.recalledAt;
    const canDispatch = isMyJobToRun(t, myValetId);
    const canRecall = canDispatch && t.type === 'park' && !recalled
      && (t.status === 'key_collected' || t.status === 'in_transit');
    const waitingNote =
        awaitingAccept ? `Waiting for ${t.driverName ?? 'driver'} to accept…`
      : recalled && t.status !== 'delivered' ? `${t.driverName ?? 'Driver'} is bringing it back`
      : t.status === 'key_collected' ? `${t.driverName ?? 'Driver'} has the key`
      : t.status === 'in_transit' ? (t.type === 'park' ? `${t.driverName ?? 'Driver'} is parking it` : `${t.driverName ?? 'Driver'} is bringing it`)
      : t.status === 'requested' || t.status === 'accepted' ? 'Waiting to be claimed'
      : null;
    return (
      <div key={t.id} style={{
        ...taskCardBase,
        backgroundColor: colors.surface,
        border: `${isEscalated ? 2 : 1}px solid ${isEscalated ? colors.error : colors.border}`,
      }}>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 12}}>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontSize: 22, fontWeight: 900, letterSpacing: 0.5, fontVariantNumeric: 'tabular-nums', color: colors.textPrimary, ...ellipsis1}}>{t.carNumber}</div>
            <div style={{fontSize: 12, fontWeight: 600, marginTop: 3, color: colors.textSecondary, ...ellipsis1}}>{t.doctorName}</div>
            {!!t.slotId && (
              <div style={{fontSize: 12, fontWeight: 600, marginTop: 1, color: colors.textMuted, ...ellipsis1}}>Slot {t.slotId}</div>
            )}
          </div>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0}}>
            <span style={{display: 'flex', alignItems: 'center', gap: 3, borderRadius: 8, padding: '5px 9px', backgroundColor: tc}}>
              <Icon name={t.type === 'park' ? 'arrowDown' : 'arrowUp'} size={11} color={colors.textOnPrimary} />
              <span style={{fontSize: 10, fontWeight: 900, color: colors.textOnPrimary}}>{t.type === 'park' ? 'IN' : 'OUT'}</span>
            </span>
            {(isMine || !!t.valetName) && (
              <span style={{
                borderRadius: 6, padding: '3px 7px', maxWidth: 96,
                border: `1px solid ${isMine ? colors.primary + '55' : colors.border}`,
                backgroundColor: isMine ? colors.primary + '1A' : 'transparent',
              }}>
                <span style={{fontSize: 9.5, fontWeight: 900, letterSpacing: 0.6, color: isMine ? colors.primary : colors.textSecondary, ...ellipsis1}}>
                  {isMine ? 'YOURS' : (t.valetName ?? '').split(' ')[0].toUpperCase()}
                </span>
              </span>
            )}
          </div>
        </div>

        {isEscalated && (
          <div style={{display: 'flex', alignItems: 'center', gap: 7, borderRadius: 10, padding: '9px 11px', marginTop: 12, backgroundColor: colors.error + '14'}}>
            <Icon name="bellAlert" size={13} color={colors.error} />
            <span style={{flex: 1, fontSize: 12.5, fontWeight: 800, color: colors.error}}>Needs a driver</span>
          </div>
        )}
        {t.type === 'retrieve' && (() => {
          const en = enRouteSeconds(t, now);
          const mins = t.plannedDepartureMinutes;
          const left = minutesUntilDeparture(t.requestedAt, mins, now);
          if (mins == null && en == null) return null;
          return (
            <div style={{display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, flexWrap: 'wrap'}}>
              {mins != null && (
                <span style={{borderRadius: 6, padding: '3px 8px', backgroundColor: departureTone(left, colors) + '1F'}}>
                  <span style={{fontSize: 11, fontWeight: 900, letterSpacing: 0.5, color: departureTone(left, colors)}}>
                    {plannedDepartureLabel(t.requestedAt, mins, now)}
                  </span>
                </span>
              )}
              {en != null && (
                <span style={{fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>
                  on the way {fmtDuration(en)}
                </span>
              )}
            </div>
          );
        })()}
        {!!waitingNote && !isEscalated && (
          <div style={{fontSize: 12, fontWeight: 600, marginTop: 10, color: colors.textMuted, ...ellipsis1}}>{waitingNote}</div>
        )}

        {(t.status === 'requested' || t.status === 'accepted') && (
          <PressableScale style={{...taskActionBtnBase, marginTop: 12, backgroundColor: colors.primary}}
            onClick={() => handleAssignDriverTo(t)}>
            <Icon name="people" size={13} color={colors.textOnPrimary} />
            <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textOnPrimary}}>Assign driver</span>
          </PressableScale>
        )}
        {needsDriver && claimedByOther && (
          <div style={{...taskActionBtnBase, marginTop: 12, border: `1px solid ${colors.border}`, backgroundColor: 'transparent'}}>
            <Icon name="lock" size={13} color={colors.textMuted} />
            <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textMuted}}>
              {t.valetName ?? 'Another valet'} is handling this
            </span>
          </div>
        )}
        {needsDriver && !claimedByOther && (
          <div style={{display: 'flex', gap: 8, marginTop: 12}}>
            <PressableScale style={{...taskActionBtnBase, flex: 1, backgroundColor: colors.primary}}
              onClick={() => handleAssignDriverTo(t)}>
              <Icon name="people" size={13} color={colors.textOnPrimary} />
              <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textOnPrimary}}>Assign driver</span>
            </PressableScale>
            <PressableScale style={{...taskActionBtnBase, width: 'auto', border: `1px solid ${colors.border}`, backgroundColor: colors.cardAlt, padding: '0 14px'}}
              onClick={() => handleCancelTask(t.id)}>
              <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textSecondary}}>Cancel job</span>
            </PressableScale>
          </div>
        )}
        {t.status === 'assigned' && !needsDriver && t.type === 'park' && (
          awaitingAccept ? (
            <div style={{display: 'flex', gap: 8, marginTop: 12}}>
              <div style={{...taskActionBtnBase, flex: 1, border: `1px solid ${colors.border}`, backgroundColor: 'transparent'}}>
                <Icon name="timer" size={13} color={colors.textMuted} />
                <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textMuted, ...ellipsis1}}>Waiting to accept…</span>
              </div>
              <PressableScale
                style={{...taskActionBtnBase, width: 'auto', border: `1px solid ${colors.border}`, backgroundColor: colors.cardAlt, padding: '0 14px'}}
                disabled={cancellingAssignmentId === t.id}
                onClick={() => handleCancelAssignment(t.id)}>
                <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textSecondary}}>
                  {cancellingAssignmentId === t.id ? 'Cancelling…' : 'Cancel Assign'}
                </span>
              </PressableScale>
            </div>
          ) : (
            <PressableScale
              style={{...taskActionBtnBase, marginTop: 12, backgroundColor: colors.success, opacity: collectingKeyTaskId === t.id ? 0.6 : 1}}
              disabled={collectingKeyTaskId === t.id}
              onClick={async () => {
                if (collectingKeyTaskId != null) return;
                setCollectingKeyTaskId(t.id);
                try {
                  await markKeyCollected(t.id);
                } catch (err: any) {
                  window.alert(err.message || 'Could not mark key handed over');
                } finally {
                  setCollectingKeyTaskId(null);
                }
              }}>
              {collectingKeyTaskId === t.id
                ? <span className="spinner" style={{width: 15, height: 15}} />
                : <Icon name="check" size={14} color="#fff" />}
              <span style={{fontSize: 12.5, fontWeight: 800, color: '#fff'}}>
                {collectingKeyTaskId === t.id ? 'Please wait…' : 'Key handed over'}
              </span>
            </PressableScale>
          )
        )}
        {canRecall && (
          <PressableScale style={{...taskActionBtnBase, marginTop: 12, border: `1px solid ${colors.warning}`, backgroundColor: 'transparent'}}
            onClick={() => handleRecallTask(t.id, t.carNumber)}>
            <Icon name="back" size={13} color={colors.warning} />
            <span style={{fontSize: 12.5, fontWeight: 800, color: colors.warning}}>Bring car back</span>
          </PressableScale>
        )}
        {recalled && (t.status === 'key_collected' || t.status === 'in_transit') && (
          <div style={{...taskActionBtnBase, marginTop: 12, border: `1px solid ${colors.border}`, backgroundColor: 'transparent'}}>
            <Icon name="timer" size={13} color={colors.textMuted} />
            <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textMuted}}>Driver is bringing it back…</span>
          </div>
        )}
        {needsConfirm && (
          <PressableScale
            style={{...taskActionBtnBase, marginTop: 12, backgroundColor: colors.success, opacity: confirmingTaskId === t.id ? 0.6 : 1}}
            disabled={confirmingTaskId === t.id}
            onClick={() => handleConfirmTaskDelivered(t.id)}>
            {confirmingTaskId === t.id
              ? <span className="spinner" style={{width: 15, height: 15}} />
              : <Icon name="checkBold" size={14} color="#fff" />}
            <span style={{fontSize: 12.5, fontWeight: 800, color: '#fff'}}>
              {confirmingTaskId === t.id ? 'Please wait…' : (recalled ? 'Confirm car returned' : 'Confirm handover')}
            </span>
          </PressableScale>
        )}
      </div>
    );
  };

  const jobSection = (title: string, icon: IconName, jobs: ParkingTask[]) => jobs.length === 0 ? null : (
    <div style={{marginBottom: 20}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12}}>
        <Icon name={icon} size={14} color={colors.textPrimary} />
        <span style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>{title} ({jobs.length})</span>
      </div>
      {jobs.map(renderJobCard)}
    </div>
  );

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background}}>
      {/* Header */}
      <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), padding: '16px 20px 20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div>
            <div style={{color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600}}>{todayLabel}</div>
            <div style={{color: '#fff', fontSize: 24, fontWeight: 900, marginTop: 2, marginBottom: 18}}>{user?.name}</div>
          </div>
          {/* Unclaimed retrievals now surface directly in the Driver
              assign pending section below, not behind a separate inbox —
              this badge is arrivals-only (a heads-up, not work waiting to
              be dispatched). */}
          <PressableScale style={{position: 'relative', width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)'}} onClick={() => setScreen('retrievals')}>
            <Icon name="bellAlert" size={20} color="#fff" />
            {arrivalNotices.length > 0 && (
              <span style={{position: 'absolute', bottom: -4, left: -4, minWidth: 18, height: 18, borderRadius: 9, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2F6FA8', border: '1.5px solid #fff'}}>
                <span style={{color: '#fff', fontSize: 10, fontWeight: 800}}>{arrivalNotices.length > 9 ? '9+' : arrivalNotices.length}</span>
              </span>
            )}
          </PressableScale>
        </div>
        <div style={{display: 'flex', alignItems: 'center'}}>
          {[
            ['Ready', availableDrivers.length],
            ['On task', busyDrivers],
            ['Off duty', offDrivers],
            ['Done today', completedToday],
          ].map(([lbl, n], i) => (
            <React.Fragment key={lbl as string}>
              {i > 0 && <div style={{width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 4px'}} />}
              <div style={{flex: 1}}>
                <div style={{color: '#fff', fontSize: 20, fontWeight: 900}}>{n}</div>
                <div style={{color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, marginTop: 2}}>{lbl}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{padding: 16, display: 'flex', flexDirection: 'column', gap: 8}}>
        {/* Primary action grid — 3 across, same dark card language throughout
            (the badge colour carries the "needs attention" signal, not the
            card background, so nothing here introduces a new colour).
            Retrieval Requests used to be a 4th tile here, opening its own
            inbox screen; that inbox is retired now that unclaimed retrievals
            show up directly in the Driver assign pending section below. */}
        <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginBottom: 24}}>
          <PressableScale style={{width: '31.5%', borderRadius: 22, padding: 16, minHeight: 148, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 6px 10px rgba(0,0,0,0.16)', backgroundColor: colors.primary}} onClick={() => setScreen('scan')}>
            <div style={{width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10}}><Icon name="key" size={24} color="#fff" /></div>
            <span style={{color: '#fff', fontSize: 15, fontWeight: 800, textAlign: 'center'}}>Staff</span>
            <span style={{color: 'rgba(255,255,255,0.65)', fontSize: 11, lineHeight: '14px', marginTop: 4, textAlign: 'center', ...clamp2}}>Collect key from doctor / staff</span>
          </PressableScale>
          <PressableScale style={{width: '31.5%', borderRadius: 22, padding: 16, minHeight: 148, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 6px 10px rgba(0,0,0,0.16)', backgroundColor: colors.primary}} onClick={() => setScreen('visitor')}>
            <div style={{width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10}}><Icon name="ticket" size={24} color="#fff" /></div>
            <span style={{color: '#fff', fontSize: 15, fontWeight: 800, textAlign: 'center'}}>Visitor</span>
            <span style={{color: 'rgba(255,255,255,0.65)', fontSize: 11, lineHeight: '14px', marginTop: 4, textAlign: 'center', ...clamp2}}>Patient / VIP token</span>
          </PressableScale>
          <PressableScale
            style={{width: '31.5%', borderRadius: 22, padding: 16, minHeight: 148, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 6px 10px rgba(0,0,0,0.16)', backgroundColor: colors.primary}}
            onClick={() => setScreen('retrievals')}>
            <div style={{width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10}}><Icon name="bellAlert" size={24} color="#fff" /></div>
            <span style={{color: '#fff', fontSize: 15, fontWeight: 800, textAlign: 'center'}}>Expected Arrivals</span>
            <span style={{color: 'rgba(255,255,255,0.65)', fontSize: 11, lineHeight: '14px', marginTop: 4, textAlign: 'center', ...clamp2}}>Heads-up, on the way in</span>
            <span style={{alignSelf: 'center', borderRadius: 99, padding: '4px 9px', marginTop: 10, backgroundColor: arrivalNotices.length > 0 ? '#2F6FA8' : 'rgba(255,255,255,0.14)'}}>
              <span style={{color: '#fff', fontSize: 10.5, fontWeight: 800}}>{arrivalNotices.length} Today</span>
            </span>
          </PressableScale>
        </div>

        {/* Driver status */}
        <div style={{fontSize: 14, fontWeight: 800, marginBottom: 12, color: colors.textPrimary}}>Driver Status ({drivers.length})</div>
        <div className="hscroll" style={{margin: '0 -20px 20px', padding: '0 20px', gap: 10}}>
          {drivers.map(d => {
            const sc = d.status === 'available' ? colors.success : d.status === 'busy' ? colors.warning : colors.textMuted;
            const sl = d.status === 'available' ? 'Ready' : d.status === 'busy' ? 'On task' : 'Off duty';
            return (
              <div key={d.id} style={{borderRadius: 16, border: `1px solid ${colors.border}`, width: 128, flexShrink: 0, overflow: 'hidden', backgroundColor: colors.surface}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderBottom: `1px solid ${colors.divider}`}}>
                  <div style={{width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: sc + '14'}}>
                    <span style={{fontSize: 16, fontWeight: 800, color: sc}}>{d.name[0]}</span>
                  </div>
                  <span style={{flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, color: colors.textPrimary, ...ellipsis1}}>{d.name.split(' ')[0]}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px'}}>
                  <span style={{fontSize: 11, fontWeight: 700, color: sc}}>{sl}</span>
                  <span style={{fontSize: 10, fontWeight: 600, color: colors.textMuted}}>{d.completedToday ?? 0} today</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dashboard — every active job, grouped by the stage it's actually
            stuck at (no more one flat undifferentiated list), plus the
            unclaimed retrieval requests that used to live in their own
            separate inbox. Same card everywhere, same one contextual action
            button per job. */}
        <div style={{fontSize: 14, fontWeight: 800, marginBottom: 12, color: colors.textPrimary}}>Dashboard ({dashboardJobsForTab.length})</div>
        {/* Counts sit on the tabs so a valet can see there IS team work
            without leaving their own list to check. */}
        <div style={{...inboxTabsStyle, padding: 0, marginBottom: 12}}>
          {([['mine', 'My Jobs', dashboardMine.length], ['team', 'Team Jobs', dashboardTeam.length]] as const).map(([key, label, count]) => {
            const active = queueTab === key;
            return (
              <PressableScale key={key} style={inboxTabStyle} onClick={() => setQueueTab(key)}>
                <span style={{...inboxTabTxtStyle, color: active ? colors.textPrimary : count === 0 ? colors.textMuted : colors.textSecondary}}>
                  {label} {count}
                </span>
                {active && <span style={inboxTabBarStyle} />}
              </PressableScale>
            );
          })}
        </div>
        {!hydrated ? (
          <>
            <SkeletonCard lines={2} style={{marginBottom: 12}} />
            <SkeletonCard lines={2} />
          </>
        ) : dashboardJobsForTab.length === 0 ? (
          <div style={emptyBoxStyle}>
            <Icon name="check" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
            <div style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>
              {queueTab === 'mine' ? 'No active jobs' : 'No one else has a job right now'}
            </div>
          </div>
        ) : (
          <>
            {jobSection('Driver assign pending', 'people', assignPendingJobs)}
            {jobSection('Driver acceptance pending', 'timer', acceptPendingJobs)}
            {jobSection('In progress', 'navigate', inProgressJobs)}
            {jobSection('Not completed', 'checkBold', notCompletedJobs)}
          </>
        )}

        {/* Parked Vehicles — not part of the mine/team job split above; a
            parked car isn't anyone's active job, it's just sitting in its
            slot, so this section isn't scoped by the My/Team tab. */}
        <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 12}}>
          <Icon name="car" size={14} color={colors.textPrimary} />
          <span style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>Parked Vehicles ({parkedVehicles.length})</span>
        </div>
        {!hydrated ? (
          <SkeletonCard lines={2} />
        ) : parkedVehicles.length === 0 ? (
          <div style={emptyBoxStyle}>
            <Icon name="car" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
            <div style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No cars parked right now</div>
          </div>
        ) : parkedVehicles.map(sl => {
          const ownerTask = sl.taskId ? tasks.find(t => t.id === sl.taskId) : undefined;
          return (
            <div key={sl.id} style={{...taskCardBase, backgroundColor: colors.surface}}>
              <div style={{display: 'flex', alignItems: 'flex-start', gap: 12}}>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: 22, fontWeight: 900, letterSpacing: 0.5, fontVariantNumeric: 'tabular-nums', color: colors.textPrimary, ...ellipsis1}}>{sl.carNumber ?? 'Unknown plate'}</div>
                  {!!ownerTask?.doctorName && (
                    <div style={{fontSize: 12, fontWeight: 600, marginTop: 3, color: colors.textSecondary, ...ellipsis1}}>{ownerTask.doctorName}</div>
                  )}
                  <div style={{fontSize: 12, fontWeight: 600, marginTop: 1, color: colors.textMuted, ...ellipsis1}}>Slot {sl.id}</div>
                </div>
                <span style={{borderRadius: 8, padding: '6px 10px', backgroundColor: colors.success, flexShrink: 0}}>
                  <span style={{color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 0.8}}>PARKED</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
