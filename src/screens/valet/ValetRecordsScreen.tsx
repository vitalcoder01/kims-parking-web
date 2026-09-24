import React, {useState, useEffect} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {Visitor, ParkingTask, mapVisitor} from '../../context/AppStateContext';
import {Icon} from '../../components/Icon';
import {CalendarPicker} from '../../components/CalendarPicker';
import {useDialog} from '../../components/AppDialog';
import {useAuth} from '../../context/AuthContext';
import {useBackStep} from '../../hooks/useBackStep';
import {useValetActions, canAssignRetrieval} from './useValetActions';
import {visitorsApi} from '../../services/api';
import {selectVisitorStage, selectStaffStage, Stage} from '../../core/valet/selectors/JobStageSelector';
import {
  buildLatestTaskByDoctor,
  canRequestStaffRetrieval as coreCanRequestStaffRetrieval,
  isStaffRowActive as coreIsStaffRowActive,
  matchesStaffStatusFilter,
  matchesVisitorStatusFilter,
} from '../../core/valet/selectors/JobHistorySelector';
import {AdminMapScreen} from '../admin/AdminMapScreen';
import {DriverPickerList} from '../../components/DriverPickerList';

function fmtTime(ms?: number) {
  if (!ms) return null;
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type RecordsTab = 'visitors' | 'staff' | 'map';
type StatusFilter = 'all' | 'active' | 'completed';
type Period = 'live' | 'today' | 'yesterday' | 'week' | 'month';

const PERIODS: {key: Period; label: string}[] = [
  {key: 'live', label: 'Live'},
  {key: 'today', label: 'Today'},
  {key: 'yesterday', label: 'Yesterday'},
  {key: 'week', label: 'This week'},
  {key: 'month', label: 'This month'},
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function periodRange(p: Period): {from: string; to: string} | null {
  if (p === 'live') return null;
  const now = new Date();
  if (p === 'today') return {from: ymd(now), to: ymd(now)};
  if (p === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return {from: ymd(y), to: ymd(y)};
  }
  if (p === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // back to Monday
    return {from: ymd(start), to: ymd(now)};
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {from: ymd(start), to: ymd(now)};
}

function taskDateMs(t: ParkingTask): number {
  return t.completedAt ?? t.assignedAt ?? t.requestedAt ?? 0;
}

type StageFilter = 'all' | Stage;
const STAGE_FILTERS: {key: Exclude<StageFilter, 'all'>; label: string}[] = [
  {key: 'atHospital', label: 'At hospital'},
  {key: 'transitToLot', label: 'Vehicle → Lot'},
  {key: 'parked', label: 'Parked'},
  {key: 'transitToHospital', label: 'Vehicle → Hospital'},
];

export function ValetRecordsScreen() {
  const {colors, isDark} = useTheme();
  const dialog = useDialog();
  const {
    tasks,
    visitors,
    activeVisitors,
    availableDrivers,
    hasActiveRetrievalDriver,
    assignVisitorPickupDriver,
    assignVisitorRetrievalDriver,
    requestVisitorRetrieval,
    assignStaffRetrievalDriver,
    requestStaffRetrieval,
    cancelVisitor,
    cancelVisitorAssignment,
    recallVisitor,
    closeParkedVisitor,
    confirmVisitorDelivered,
    confirmTaskDelivered,
    fetchTaskHistory,
  } = useValetActions();
  const {user} = useAuth();

  const myStation = user?.valetStation ?? null;
  const myValetId = user?.role === 'valet' ? user.id : null;

  const visitorRetrieveTask = (v: {id: number}) =>
    tasks.find(
      t => t.visitorId === v.id && t.type === 'retrieve' && t.status !== 'completed' && t.status !== 'cancelled'
    ) ?? null;

  // ── Navigation & Filter State ──
  const [tab, setTab] = useState<RecordsTab>('visitors');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');

  // Assign Driver State
  const [pendingVisitorId, setPendingVisitorId] = useState<number | null>(null);
  const [pendingMode, setPendingMode] = useState<'park' | 'retrieve' | null>(null);
  const [pendingDoctorTaskId, setPendingDoctorTaskId] = useState<number | null>(null);
  const [assigningDriverId, setAssigningDriverId] = useState<number | null>(null);

  // Operational Action Busy States
  const [closingVisitorId, setClosingVisitorId] = useState<number | null>(null);
  const [requestingRetrievalDoctorId, setRequestingRetrievalDoctorId] = useState<number | null>(null);
  const [requestingRetrievalVisitorId, setRequestingRetrievalVisitorId] = useState<number | null>(null);
  const [confirmingVisitorId, setConfirmingVisitorId] = useState<number | null>(null);
  const [confirmingTaskId, setConfirmingTaskId] = useState<number | null>(null);
  const [recallingVisitorId, setRecallingVisitorId] = useState<number | null>(null);
  const [cancellingAssignmentVisitorId, setCancellingAssignmentVisitorId] = useState<number | null>(null);

  // Calendar & Date Range State
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('live');
  const [dateVisitors, setDateVisitors] = useState<Visitor[] | null>(null);
  const [dateLoading, setDateLoading] = useState(false);

  // Detail Sheet State
  const [detailVisitor, setDetailVisitor] = useState<Visitor | null>(null);
  const [detailTask, setDetailTask] = useState<ParkingTask | null>(null);

  const closeDetail = () => {
    setDetailVisitor(null);
    setDetailTask(null);
  };

  useBackStep(!!(detailVisitor || detailTask), closeDetail);
  useBackStep(pendingVisitorId != null || pendingDoctorTaskId != null, () => {
    setPendingVisitorId(null);
    setPendingMode(null);
    setPendingDoctorTaskId(null);
  });

  // Calendar query
  const activeRange = selectedDate ? {from: selectedDate, to: selectedDate} : periodRange(period);

  useEffect(() => {
    if (!activeRange) {
      setDateVisitors(null);
      return;
    }
    let cancelled = false;
    setDateLoading(true);
    visitorsApi
      .byRange(activeRange.from, activeRange.to)
      .then((rows: any[]) => {
        if (!cancelled) setDateVisitors(rows.map(mapVisitor));
      })
      .catch(() => {
        if (!cancelled) setDateVisitors([]);
      })
      .finally(() => {
        if (!cancelled) setDateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRange?.from, activeRange?.to]);

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const calendarDateLabel = (key: string) =>
    key === todayKey
      ? 'Today'
      : new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});

  // Staff history fetch
  const [staffHistory, setStaffHistory] = useState<ParkingTask[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'staff') return;
    setHistoryLoading(true);
    fetchTaskHistory()
      .then(setStaffHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [tab, fetchTaskHistory, tasks]);

  const q = query.trim().toLowerCase();

  const visitorStage = (v: Visitor): Stage => selectVisitorStage(v, hasActiveRetrievalDriver);
  const staffStage = (t: ParkingTask): Stage => selectStaffStage(t);

  const visitorsSource = activeRange ? dateVisitors ?? [] : statusFilter === 'active' ? activeVisitors : visitors;
  const visitorsFiltered = visitorsSource
    .filter(v => activeRange || matchesVisitorStatusFilter(v, statusFilter))
    .filter(v => statusFilter !== 'active' || stageFilter === 'all' || visitorStage(v) === stageFilter)
    .filter(
      v =>
        !q ||
        v.name?.toLowerCase().includes(q) ||
        v.carNumber?.toLowerCase().includes(q) ||
        v.token.toLowerCase().includes(q)
    );

  const latestTaskByDoctor = buildLatestTaskByDoctor(staffHistory);
  const canRequestStaffRetrieval = (t: ParkingTask) => coreCanRequestStaffRetrieval(t, latestTaskByDoctor);

  const rangeStartMs = activeRange ? new Date(`${activeRange.from}T00:00:00`).getTime() : 0;
  const rangeEndMs = activeRange ? new Date(`${activeRange.to}T00:00:00`).getTime() + 86400000 : 0;

  const staffFiltered = staffHistory
    .filter(t => !t.isVisitor)
    .filter(t => {
      if (!activeRange) return true;
      const ms = taskDateMs(t);
      return ms >= rangeStartMs && ms < rangeEndMs;
    })
    .filter(t => activeRange || matchesStaffStatusFilter(t, statusFilter, latestTaskByDoctor))
    .filter(t => statusFilter !== 'active' || stageFilter === 'all' || staffStage(t) === stageFilter)
    .filter(t => !q || t.doctorName?.toLowerCase().includes(q) || t.carNumber?.toLowerCase().includes(q));

  const pendingVisitor = pendingVisitorId ? visitors.find(v => v.id === pendingVisitorId) ?? null : null;
  const pendingDoctorTask = pendingDoctorTaskId ? staffHistory.find(t => t.id === pendingDoctorTaskId) ?? null : null;

  // ── Actions ──
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
        setPendingVisitorId(null);
        setPendingMode(null);
      }
    } catch (err: any) {
      dialog.alert(err.message || 'Something went wrong', {title: 'Assignment Failed'});
    } finally {
      setAssigningDriverId(null);
    }
  };

  const handleRequestStaffRetrieval = async (doctorId: number) => {
    if (requestingRetrievalDoctorId != null) return;
    setRequestingRetrievalDoctorId(doctorId);
    try {
      await requestStaffRetrieval(doctorId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not send the retrieval request', {title: 'Request Failed'});
    } finally {
      setRequestingRetrievalDoctorId(null);
    }
  };

  const handleRequestVisitorRetrieval = async (visitorId: number) => {
    if (requestingRetrievalVisitorId != null) return;
    setRequestingRetrievalVisitorId(visitorId);
    try {
      await requestVisitorRetrieval(visitorId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not send the retrieval request', {title: 'Request Failed'});
    } finally {
      setRequestingRetrievalVisitorId(null);
    }
  };

  const handleConfirmVisitorDelivered = async (visitorId: number) => {
    if (confirmingVisitorId != null) return;
    setConfirmingVisitorId(visitorId);
    try {
      await confirmVisitorDelivered(visitorId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not confirm handover', {title: 'Error'});
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
      dialog.alert(err.message || 'Could not confirm handover', {title: 'Error'});
    } finally {
      setConfirmingTaskId(null);
    }
  };

  const handleCloseParked = async (v: Visitor) => {
    if (closingVisitorId != null) return;
    const ok = await dialog.confirm({
      title: 'Car already left?',
      message: `This closes ${v.carNumber ?? 'this visitor'}'s session${v.slotId ? ` and marks slot ${v.slotId} FREE` : ''}.\n\nOnly do this if the car has physically gone — nobody ever asked for a retrieval.`,
      confirmText: 'Yes, close it',
      cancelText: 'Cancel',
      tone: 'error',
      destructive: true,
    });
    if (!ok) return;
    setClosingVisitorId(v.id);
    try {
      await closeParkedVisitor(v.id);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not close this session', {title: 'Error'});
    } finally {
      setClosingVisitorId(null);
    }
  };

  const handleCancel = async (visitorId: number) => {
    const ok = await dialog.confirm({
      title: 'Cancel Visitor Token',
      message: 'This will cancel the check-in. This action cannot be undone.',
      confirmText: 'Cancel Token',
      cancelText: 'Keep Token',
      tone: 'error',
      destructive: true,
    });
    if (ok) {
      cancelVisitor(visitorId, 'valet_cancelled').catch(err =>
        dialog.alert(err.message || 'Something went wrong', {title: 'Error'})
      );
    }
  };

  const handleCancelAssignment = async (visitorId: number) => {
    if (cancellingAssignmentVisitorId != null) return;
    setCancellingAssignmentVisitorId(visitorId);
    try {
      await cancelVisitorAssignment(visitorId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not cancel the assignment', {title: 'Error'});
    } finally {
      setCancellingAssignmentVisitorId(null);
    }
  };

  const handleRecallVisitor = async (visitorId: number, carNumber?: string) => {
    const ok = await dialog.confirm({
      title: 'Bring the Car Back?',
      message: `The runner driver will be instructed NOT to park ${carNumber || 'this car'} and to return it to the valet counter instead.`,
      confirmText: 'Recall Car',
      cancelText: 'Cancel',
      tone: 'warning',
      destructive: true,
    });
    if (!ok) return;
    if (recallingVisitorId != null) return;
    setRecallingVisitorId(visitorId);
    try {
      await recallVisitor(visitorId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not recall the car', {title: 'Error'});
    } finally {
      setRecallingVisitorId(null);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-VIEW: DRIVER ASSIGNMENT
  // ══════════════════════════════════════════════════════════════════════════
  if (pendingVisitor || pendingDoctorTask) {
    return (
      <div className="valet-workstation-viewport" style={{backgroundColor: isDark ? '#0B0F17' : '#F8FAFC'}}>
        <div className="valet-container" style={{maxWidth: 640}}>
          {/* Header */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <button
              type="button"
              className="pressable"
              onClick={() => {
                setPendingVisitorId(null);
                setPendingMode(null);
                setPendingDoctorTaskId(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
                cursor: 'pointer',
              }}
            >
              <Icon name="back" size={16} color={colors.textPrimary} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textPrimary}}>Cancel</span>
            </button>
            <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted}}>
              Assign Driver
            </span>
          </div>

          {/* Context Card */}
          <div
            className="valet-glass-card"
            style={{
              padding: 16,
              backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : 'rgba(37,99,235,0.05)',
              border: '1.5px solid rgba(37,99,235,0.22)',
            }}
          >
            <span style={{fontSize: 11, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.6}}>
              Target Vehicle
            </span>
            <div style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums', marginTop: 2}}>
              {pendingDoctorTask ? pendingDoctorTask.carNumber : pendingVisitor?.carNumber || 'Vehicle'}
            </div>
            <div style={{fontSize: 12.5, color: colors.textSecondary, marginTop: 2}}>
              {pendingDoctorTask
                ? `Dr. ${pendingDoctorTask.doctorName} · Retrieval Assignment`
                : pendingMode === 'retrieve'
                ? `Visitor ${pendingVisitor?.name || 'Guest'} · Retrieval from Bay ${pendingVisitor?.slotId || '—'}`
                : `Visitor ${pendingVisitor?.name || 'Guest'} · Key Collection & Park`}
            </div>
          </div>

          <DriverPickerList drivers={availableDrivers} onAssign={handleAssign} assigningId={assigningDriverId} />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER CARD: VISITOR RECORD (Restrained Enterprise Record)
  // ══════════════════════════════════════════════════════════════════════════
  const renderVisitorCard = (v: Visitor) => {
    const needsDriver = v.status === 'parked' && v.retrievalRequested && !hasActiveRetrievalDriver(v);
    const retrieving = v.status === 'parked' && v.retrievalRequested && !needsDriver;
    const parkedIdle = v.status === 'parked' && !v.retrievalRequested;
    const delivered = v.status === 'delivered';
    const retrieveTask = needsDriver ? visitorRetrieveTask(v) : null;
    const canAssignThis = !retrieveTask || canAssignRetrieval(retrieveTask, myValetId, myStation);

    const linkedTask = tasks.find(
      t => t.visitorId === v.id && t.type === 'park' && t.status !== 'completed' && t.status !== 'cancelled'
    );
    const keyWithDriver = v.status === 'pending' && !!v.driverId && !!v.pickedUpAt;
    const awaitingAccept = v.status === 'pending' && !!v.driverId && !v.pickedUpAt;
    const awaitingDriver = v.status === 'pending' && !v.driverId;
    const recalled = !!linkedTask?.recalledAt;

    // Semantic status pill formatting
    const statusText = parkedIdle
      ? `🅿️ Parked · ${v.slotId ?? 'Bay'}`
      : delivered
      ? 'Awaiting pickup confirmation'
      : retrieving
      ? '🏃 Driver en route'
      : needsDriver
      ? '🚨 Ready for retrieval'
      : v.pickedUpAt
      ? 'Parking in progress'
      : v.acceptedAt
      ? 'Collecting key'
      : v.driverId
      ? 'Awaiting accept'
      : v.status === 'retrieved'
      ? '✅ Retrieved'
      : 'Awaiting runner';

    const statusTone = parkedIdle || v.status === 'retrieved'
      ? {bg: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: 'rgba(5, 150, 105, 0.25)'}
      : delivered || needsDriver
      ? {bg: 'rgba(225, 29, 72, 0.1)', color: '#E11D48', border: 'rgba(225, 29, 72, 0.25)'}
      : {bg: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', border: 'rgba(37, 99, 235, 0.25)'};

    return (
      <div
        key={v.id}
        className="valet-glass-card"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          border: delivered ? '1.5px solid #059669' : undefined,
        }}
      >
        {/* Header Row: Token + Plate + Status */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                  color: colors.textSecondary,
                }}
              >
                TOKEN #{v.token}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.04em',
                  color: colors.textPrimary,
                }}
              >
                {v.carNumber ?? 'NO PLATE'}
              </span>
            </div>
            <div style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginTop: 4}}>
              {v.name || 'Visitor'}
            </div>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                backgroundColor: statusTone.bg,
                color: statusTone.color,
                border: `1px solid ${statusTone.border}`,
              }}
            >
              {statusText}
            </span>
            <button
              type="button"
              className="pressable"
              onClick={() => setDetailVisitor(v)}
              title="Inspect Lifecycle Timeline"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <Icon name="info" size={14} color={colors.textSecondary} />
            </button>
          </div>
        </div>

        {/* Metadata Details */}
        <div style={{fontSize: 12, color: colors.textMuted, display: 'flex', flexWrap: 'wrap', gap: 12}}>
          <span>Mobile: <strong>{v.mobile}</strong></span>
          {v.slotId && <span>Bay: <strong>{v.slotId}</strong></span>}
          {v.driverName && <span>Runner: <strong>{v.driverName}</strong></span>}
          <span>Checked in: {fmtTime(v.createdAt)}</span>
        </div>

        {/* Action Row */}
        {parkedIdle && (
          <div style={{display: 'flex', gap: 8, marginTop: 2}}>
            <button
              type="button"
              className="pressable"
              onClick={() => {
                if (myStation === 'gate') {
                  handleRequestVisitorRetrieval(v.id);
                  return;
                }
                setPendingVisitorId(v.id);
                setPendingMode('retrieve');
              }}
              disabled={requestingRetrievalVisitorId === v.id}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 6,
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              {requestingRetrievalVisitorId === v.id ? (
                <span className="spinner" style={{width: 14, height: 14}} />
              ) : (
                <>
                  <Icon name="arrowRight" size={14} color="#FFFFFF" />
                  <span>Request Retrieval</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="pressable"
              onClick={() => handleCloseParked(v)}
              disabled={closingVisitorId === v.id}
              title="Car physically left without requesting retrieval"
              style={{
                padding: '0 10px',
                height: 38,
                borderRadius: 6,
                backgroundColor: 'transparent',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                color: colors.textSecondary,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {closingVisitorId === v.id ? 'Closing…' : 'Car Already Left'}
            </button>
          </div>
        )}

        {needsDriver && (
          canAssignThis ? (
            <button
              type="button"
              className="pressable"
              onClick={() => {
                setPendingVisitorId(v.id);
                setPendingMode('retrieve');
              }}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 6,
                backgroundColor: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Icon name="people" size={14} color="#FFFFFF" />
              <span>Assign Retrieval Runner</span>
            </button>
          ) : (
            <div style={{fontSize: 12, color: colors.textMuted, fontStyle: 'italic'}}>
              Waiting for the lot valet to dispatch a runner driver
            </div>
          )
        )}

        {delivered && (
          <button
            type="button"
            className="pressable"
            onClick={() => handleConfirmVisitorDelivered(v.id)}
            disabled={confirmingVisitorId === v.id}
            style={{
              width: '100%',
              height: 38,
              borderRadius: 6,
              backgroundColor: '#059669',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            {confirmingVisitorId === v.id ? (
              <span className="spinner" style={{width: 14, height: 14}} />
            ) : (
              <>
                <Icon name="checkBold" size={14} color="#FFFFFF" />
                <span>Confirm Handed to Owner</span>
              </>
            )}
          </button>
        )}

        {awaitingDriver && (
          <button
            type="button"
            className="pressable"
            onClick={() => handleCancel(v.id)}
            style={{
              width: '100%',
              height: 34,
              borderRadius: 6,
              backgroundColor: 'transparent',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel Token
          </button>
        )}

        {awaitingAccept && (
          <div style={{display: 'flex', gap: 8}}>
            <div style={{flex: 1, fontSize: 12, color: colors.textMuted, display: 'flex', alignItems: 'center'}}>
              {v.acceptedAt ? 'Runner collecting key…' : 'Runner waiting to accept…'}
            </div>
            {!v.acceptedAt && (
              <button
                type="button"
                className="pressable"
                onClick={() => handleCancelAssignment(v.id)}
                disabled={cancellingAssignmentVisitorId === v.id}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                  background: 'transparent',
                  color: colors.textSecondary,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {cancellingAssignmentVisitorId === v.id ? 'Cancelling…' : 'Cancel Assign'}
              </button>
            )}
          </div>
        )}

        {keyWithDriver && !recalled && (
          <button
            type="button"
            className="pressable"
            onClick={() => handleRecallVisitor(v.id, v.carNumber)}
            disabled={recallingVisitorId === v.id}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 6,
              backgroundColor: 'transparent',
              border: '1px solid #D97706',
              color: '#D97706',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {recallingVisitorId === v.id ? 'Recalling…' : 'Recall Vehicle to Gate'}
          </button>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER CARD: STAFF RECORD (Restrained Enterprise Record)
  // ══════════════════════════════════════════════════════════════════════════
  const renderStaffCard = (t: ParkingTask) => {
    const delivered = t.status === 'delivered';
    const cancelled = t.status === 'cancelled';
    const canRetrieve = canRequestStaffRetrieval(t);

    const statusText = t.status === 'completed'
      ? t.type === 'park'
        ? canRetrieve ? `🅿️ Parked · ${t.slotId ?? 'Bay'}` : '✅ Park Completed'
        : '✅ Retrieved'
      : cancelled
      ? 'Cancelled'
      : delivered
      ? 'Awaiting pickup confirmation'
      : t.status === 'in_transit'
      ? '🏃 In transit'
      : t.status === 'key_collected'
      ? 'Driver has key'
      : 'Driver assigned';

    const statusTone = t.status === 'completed'
      ? {bg: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: 'rgba(5, 150, 105, 0.25)'}
      : cancelled
      ? {bg: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9', color: colors.textMuted, border: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}
      : {bg: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', border: 'rgba(37, 99, 235, 0.25)'};

    return (
      <div
        key={t.id}
        className="valet-glass-card"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          border: delivered ? '1.5px solid #059669' : undefined,
        }}
      >
        {/* Header Row */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                }}
              >
                {t.type} #{t.id}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.04em',
                  color: colors.textPrimary,
                }}
              >
                {t.carNumber}
              </span>
            </div>
            <div style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginTop: 4}}>
              {t.doctorName}
            </div>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                backgroundColor: statusTone.bg,
                color: statusTone.color,
                border: `1px solid ${statusTone.border}`,
              }}
            >
              {statusText}
            </span>
            <button
              type="button"
              className="pressable"
              onClick={() => setDetailTask(t)}
              title="Inspect Lifecycle Timeline"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <Icon name="info" size={14} color={colors.textSecondary} />
            </button>
          </div>
        </div>

        {/* Metadata Details */}
        <div style={{fontSize: 12, color: colors.textMuted, display: 'flex', flexWrap: 'wrap', gap: 12}}>
          {t.doctorDepartment && <span>Dept: <strong>{t.doctorDepartment}</strong></span>}
          {t.slotId && <span>Bay: <strong>{t.slotId}</strong></span>}
          {t.driverName && <span>Runner: <strong>{t.driverName}</strong></span>}
          {t.type === 'park' && t.completedAt && <span>Parked: {fmtTime(t.completedAt)}</span>}
        </div>

        {/* Action Row */}
        {canRetrieve && (
          <button
            type="button"
            className="pressable"
            onClick={() =>
              myStation === 'gate' ? handleRequestStaffRetrieval(t.doctorId) : setPendingDoctorTaskId(t.id)
            }
            disabled={requestingRetrievalDoctorId === t.doctorId}
            style={{
              width: '100%',
              height: 38,
              borderRadius: 6,
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            {requestingRetrievalDoctorId === t.doctorId ? (
              <span className="spinner" style={{width: 14, height: 14}} />
            ) : (
              <>
                <Icon name="arrowRight" size={14} color="#FFFFFF" />
                <span>Request Retrieval</span>
              </>
            )}
          </button>
        )}

        {delivered && (
          <button
            type="button"
            className="pressable"
            onClick={() => handleConfirmTaskDelivered(t.id)}
            disabled={confirmingTaskId === t.id}
            style={{
              width: '100%',
              height: 38,
              borderRadius: 6,
              backgroundColor: '#059669',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            {confirmingTaskId === t.id ? (
              <span className="spinner" style={{width: 14, height: 14}} />
            ) : (
              <>
                <Icon name="checkBold" size={14} color="#FFFFFF" />
                <span>Confirm Handed to Owner</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  const filtered = tab === 'visitors' ? visitorsFiltered : tab === 'staff' ? staffFiltered : [];
  const totalCount = tab === 'visitors' ? visitorsSource.length : tab === 'staff' ? staffHistory.length : 0;

  const detailRows: [string, string][] | null = detailVisitor
    ? [
        ['Token', `#${detailVisitor.token}`],
        ['Car number', detailVisitor.carNumber || 'No plate'],
        ['Vehicle', detailVisitor.vehicleType === 'bike' ? 'Bike' : 'Car'],
        ['Mobile', detailVisitor.mobile],
        ['Status', detailVisitor.status],
        ['Slot', detailVisitor.slotId ?? '—'],
        ['Driver', detailVisitor.driverName ?? '—'],
        ['Checked in', fmtTime(detailVisitor.createdAt) ?? '—'],
        ...(detailVisitor.pickedUpAt ? ([['Key collected', fmtTime(detailVisitor.pickedUpAt)!]] as [string, string][]) : []),
        ...(detailVisitor.cancelledAt ? ([['Cancelled', fmtTime(detailVisitor.cancelledAt)!]] as [string, string][]) : []),
        ...(detailVisitor.cancelReason
          ? ([['Reason', detailVisitor.cancelReason.replace('_', ' ')]] as [string, string][])
          : []),
      ]
    : detailTask
    ? [
        ['Type', detailTask.type === 'park' ? 'Park' : 'Retrieve'],
        ['Car number', detailTask.carNumber],
        ['Department', detailTask.doctorDepartment || '—'],
        ['Employee ID', detailTask.doctorEmployeeId || '—'],
        ['Status', detailTask.status.replace('_', ' ')],
        ['Slot', detailTask.slotId ?? '—'],
        ['Driver', detailTask.driverName ?? '—'],
        ['Valet', detailTask.valetName ?? '—'],
        ...(detailTask.assignedAt ? ([['Assigned', fmtTime(detailTask.assignedAt)!]] as [string, string][]) : []),
        ...(detailTask.completedAt ? ([['Completed', fmtTime(detailTask.completedAt)!]] as [string, string][]) : []),
      ]
    : null;

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN VIEW: VALET RECORDS & AUDIT WORKSTATION
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="valet-workstation-viewport" style={{backgroundColor: isDark ? '#0B0F17' : '#F8FAFC'}}>
      <div className="valet-container">
        {/* WORKSTATION HEADER */}
        <div
          className="valet-glass-card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <h1 style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary, margin: 0}}>
                Valet Job Records
              </h1>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: 'rgba(37,99,235,0.1)',
                  color: '#2563EB',
                  border: '1px solid rgba(37,99,235,0.25)',
                  textTransform: 'uppercase',
                }}
              >
                Audit Log
              </span>
            </div>
            <div style={{fontSize: 12, color: colors.textSecondary, marginTop: 2}}>
              Historical session records &bull; Verified vehicle tracking
            </div>
          </div>

          {tab !== 'map' && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: colors.textSecondary,
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {filtered.length} of {totalCount} records
            </div>
          )}
        </div>

        {/* 3-TAB SELECTOR (Visitors | Staff | Map) */}
        <div
          className="valet-glass-card"
          style={{
            padding: 4,
            display: 'flex',
            gap: 4,
          }}
        >
          {(
            [
              ['visitors', '🎟️ Visitors', visitorsFiltered.length],
              ['staff', '👨‍⚕️ Staff & Doctors', staffFiltered.length],
              ['map', '🗺️ Map Layout', null],
            ] as const
          ).map(([key, label, count]) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                type="button"
                className="pressable"
                onClick={() => setTab(key)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: isActive ? (isDark ? '#2563EB' : '#FFFFFF') : 'transparent',
                  color: isActive ? (isDark ? '#FFFFFF' : '#0F172A') : colors.textSecondary,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: isActive && !isDark ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <span>{label}</span>
                {count != null && <span style={{fontSize: 11, opacity: 0.75}}>({count})</span>}
              </button>
            );
          })}
        </div>

        {/* MAP TAB CONTENT */}
        {tab === 'map' ? (
          <div className="valet-glass-card" style={{overflow: 'hidden', minHeight: 500}}>
            <AdminMapScreen />
          </div>
        ) : (
          <>
            {/* SEARCH & CALENDAR BAR */}
            <div style={{display: 'flex', gap: 10}}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
                  padding: '0 12px',
                }}
              >
                <Icon name="search" size={16} color={colors.textMuted} />
                <input
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 13.5,
                    color: colors.textPrimary,
                  }}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={tab === 'visitors' ? 'Search visitor name, plate, token…' : 'Search doctor name, vehicle plate…'}
                />
                {!!query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    style={{background: 'transparent', border: 'none', padding: 0, cursor: 'pointer'}}
                  >
                    <Icon name="close" size={14} color={colors.textMuted} />
                  </button>
                )}
              </div>

              {tab === 'visitors' && (
                <button
                  type="button"
                  className="pressable"
                  onClick={() => setCalendarOpen(true)}
                  title="Filter by custom date"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: `1px solid ${selectedDate ? '#2563EB' : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
                    backgroundColor: selectedDate ? '#2563EB' : isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="calendar" size={16} color={selectedDate ? '#FFFFFF' : colors.textSecondary} />
                </button>
              )}
            </div>

            {/* PERIOD CHIPS */}
            <div style={{display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2}}>
              {PERIODS.map(p => {
                const isActive = !selectedDate && period === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    className="pressable"
                    onClick={() => {
                      setPeriod(p.key);
                      setSelectedDate(null);
                    }}
                    style={{
                      flexShrink: 0,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: isActive ? '1.5px solid #2563EB' : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#CBD5E1'}`,
                      backgroundColor: isActive ? (isDark ? '#2563EB' : '#2563EB') : 'transparent',
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Selected Date Indicator Banner */}
            {!!activeRange && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : 'rgba(37,99,235,0.06)',
                  border: '1px solid rgba(37,99,235,0.2)',
                }}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <Icon name="calendar" size={14} color="#2563EB" />
                  <span style={{fontSize: 12.5, fontWeight: 700, color: colors.textPrimary}}>
                    Date Filter: {activeRange.from === activeRange.to ? calendarDateLabel(activeRange.from) : `${calendarDateLabel(activeRange.from)} — ${calendarDateLabel(activeRange.to)}`}
                  </span>
                  {dateLoading && <span className="spinner" style={{width: 12, height: 12}} />}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(null);
                    setPeriod('live');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#2563EB',
                    cursor: 'pointer',
                  }}
                >
                  Reset to Live &times;
                </button>
              </div>
            )}

            {/* STATUS FILTERS (Active / Completed / All) */}
            <div style={{display: 'flex', gap: 8}}>
              {(['active', 'completed', 'all'] as StatusFilter[]).map(f => {
                const isActive = statusFilter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    className="pressable"
                    disabled={!!activeRange}
                    onClick={() => {
                      setStatusFilter(f);
                      if (f !== 'active') setStageFilter('all');
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: 6,
                      border: isActive ? '1.5px solid #2563EB' : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#CBD5E1'}`,
                      backgroundColor: isActive ? (isDark ? '#2563EB' : '#2563EB') : 'transparent',
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: activeRange ? 'default' : 'pointer',
                      opacity: activeRange ? 0.4 : 1,
                      textTransform: 'capitalize',
                    }}
                  >
                    {f}
                  </button>
                );
              })}
            </div>

            {/* SECOND-LEVEL STAGE FILTERS (when Active) */}
            {statusFilter === 'active' && (
              <div style={{display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2}}>
                {STAGE_FILTERS.map(sf => {
                  const isActive = stageFilter === sf.key;
                  return (
                    <button
                      key={sf.key}
                      type="button"
                      className="pressable"
                      onClick={() => setStageFilter(isActive ? 'all' : sf.key)}
                      style={{
                        flexShrink: 0,
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: isActive ? '1px solid #2563EB' : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}`,
                        backgroundColor: isActive ? 'rgba(37,99,235,0.12)' : 'transparent',
                        color: isActive ? '#2563EB' : colors.textMuted,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {sf.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* RECORDS QUEUE GRID */}
            <div>
              {tab === 'staff' && historyLoading && staffHistory.length === 0 ? (
                <div style={{textAlign: 'center', padding: '40px 0'}}>
                  <span className="spinner" style={{width: 24, height: 24}} />
                  <div style={{fontSize: 12.5, color: colors.textMuted, marginTop: 10}}>Loading staff records…</div>
                </div>
              ) : filtered.length === 0 ? (
                <div
                  className="valet-glass-card"
                  style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
                  }}
                >
                  <Icon name="check" size={24} color="#059669" />
                  <div style={{fontSize: 14, fontWeight: 700, color: colors.textPrimary, marginTop: 8}}>
                    {q ? 'No matching records found' : `No ${tab} records in this view`}
                  </div>
                  <div style={{fontSize: 12, color: colors.textMuted, marginTop: 2}}>
                    {q ? 'Try a different search term or plate.' : 'Vehicle session logs will appear here automatically.'}
                  </div>
                </div>
              ) : (
                <div className="valet-queue-grid">
                  {tab === 'visitors'
                    ? (filtered as Visitor[]).map(renderVisitorCard)
                    : (filtered as ParkingTask[]).map(renderStaffCard)}
                </div>
              )}
            </div>

            <CalendarPicker
              visible={calendarOpen}
              value={selectedDate ?? undefined}
              onClose={() => setCalendarOpen(false)}
              onSelect={date => {
                setSelectedDate(date);
                setCalendarOpen(false);
              }}
            />
          </>
        )}

        {/* DETAIL MODAL: PROGRESSIVE DISCLOSURE TIMELINE */}
        {detailRows && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={closeDetail}
          >
            <div
              className="valet-glass-card"
              style={{
                width: '100%',
                maxWidth: 440,
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: 24,
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16}}>
                <div>
                  <span style={{fontSize: 11, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.6}}>
                    Lifecycle Audit
                  </span>
                  <h3 style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary, margin: '2px 0 0 0'}}>
                    {detailVisitor ? detailVisitor.name || 'Visitor' : detailTask?.doctorName}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={closeDetail}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="close" size={16} color={colors.textPrimary} />
                </button>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                {detailRows.map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'}`,
                      gap: 12,
                    }}
                  >
                    <span style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>{k}</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.textPrimary,
                        textAlign: 'right',
                        textTransform: 'capitalize',
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
