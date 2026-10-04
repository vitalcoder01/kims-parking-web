import React, {useState, useRef, useEffect, useMemo} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useTheme} from '../../context/ThemeContext';
import {Icon} from '../../components/Icon';
import {DriverPickerList} from '../../components/DriverPickerList';
import {useValetActions} from './useValetActions';
import type {ParkingSlot, ParkingTask} from '../../context/AppStateContext';
import {useAppState} from '../../context/AppStateContext';
import {useDialog} from '../../components/AppDialog';
import {
  departureClockLabel,
  minutesUntilDeparture,
  departurePriority,
  agoLabel,
} from '../../utils/retrievalClocks';
import {TaskResolutionModal} from '../../components/TaskResolutionModal';
import {getTaskStaleInfo} from '../../utils/staleTask';
import {VehiclePlateBadge} from '../../components/VehiclePlateBadge';
import {useUndoToast} from '../../components/UndoToast';
import {playQuickActionChime, playDispatchChime} from '../../utils/audioChimes';

interface LotValetScreenProps {
  onSwitchStation?: () => void;
  isSupervisor?: boolean;
}

type UrgencyTab = 'all' | 'now' | 'soon' | 'later';
type FleetFilter = 'all' | 'ready' | 'onTask' | 'offDuty';

export function LotValetScreen({onSwitchStation, isSupervisor}: LotValetScreenProps) {
  const {user} = useAuth();
  const dialog = useDialog();
  const {colors, isDark} = useTheme();
  const {slots, cleanupStaleTasks, forceResolveTask, updateTask} = useAppState();
  const {showUndoToast} = useUndoToast();

  const {
    tasks,
    drivers,
    visitors,
    availableDrivers,
    assignTaskDriver,
    confirmParkedByValet,
    requestOtherStationDriver,
    closeParkedSession,
    closeParkedVisitor,
    recallTask,
  } = useValetActions();

  // ── Local State ──
  const [urgencyTab, setUrgencyTab] = useState<UrgencyTab>('all');
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('all');
  const [selectedBlock, setSelectedBlock] = useState<string>('all');
  const [slotSearch, setSlotSearch] = useState<string>('');
  const [showBayOverview, setShowBayOverview] = useState<boolean>(false);

  // Stale Resolution & Fail-Safe State
  const [resolvingTask, setResolvingTask] = useState<ParkingTask | null>(null);
  const [sweepingStale, setSweepingStale] = useState<boolean>(false);

  // Inbound Bay Allocation State
  const [selectedSlotForTask, setSelectedSlotForTask] = useState<Record<number, string>>({});
  const [confirmingParkedId, setConfirmingParkedId] = useState<number | null>(null);

  // Outbound Runner Dispatch State
  const [dispatchingTask, setDispatchingTask] = useState<ParkingTask | null>(null);
  const [assigningDriverId, setAssigningDriverId] = useState<number | null>(null);
  const [driverSearch, setDriverSearch] = useState<string>('');
  const [transferringTaskId, setTransferringTaskId] = useState<number | null>(null);

  // Refresh clock for departure countdowns (every 10 seconds)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(iv);
  }, []);

  const todayLabel = new Date().toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});

  // ── Derived Data: Inbound Cars needing Bay Confirmation ──
  const inboundTasks = useMemo(() => {
    return tasks.filter(t =>
      t.type === 'park' &&
      (t.status === 'key_collected' || t.status === 'in_transit' || t.status === 'assigned')
    );
  }, [tasks]);

  // ── Derived Data: Retrieval Requests (Sorted by Departure Urgency) ──
  const retrievalTasks = useMemo(() => {
    const list = tasks.filter(t =>
      t.type === 'retrieve' &&
      (t.status === 'requested' || t.status === 'accepted')
    );

    return list.sort((a, b) => {
      const prioA = departurePriority(a.requestedAt, a.plannedDepartureMinutes, now);
      const prioB = departurePriority(b.requestedAt, b.plannedDepartureMinutes, now);
      if (prioA !== prioB) return prioA - prioB;
      const leftA = minutesUntilDeparture(a.requestedAt, a.plannedDepartureMinutes, now) ?? 999;
      const leftB = minutesUntilDeparture(b.requestedAt, b.plannedDepartureMinutes, now) ?? 999;
      return leftA - leftB;
    });
  }, [tasks, now]);

  // Urgency Counts & Filtered List
  const urgencyGroups = useMemo(() => {
    const nowList: ParkingTask[] = [];
    const soonList: ParkingTask[] = [];
    const laterList: ParkingTask[] = [];

    retrievalTasks.forEach(t => {
      const left = minutesUntilDeparture(t.requestedAt, t.plannedDepartureMinutes, now);
      if (left == null || left <= 0) {
        nowList.push(t);
      } else if (left <= 15) {
        soonList.push(t);
      } else {
        laterList.push(t);
      }
    });

    return {
      all: retrievalTasks,
      now: nowList,
      soon: soonList,
      later: laterList,
    };
  }, [retrievalTasks]);

  const visibleRetrievals = urgencyGroups[urgencyTab];

  // ── Free Slots Data ──
  const freeSlots = useMemo(() => {
    return slots.filter(s => s.status === 'free');
  }, [slots]);

  const occupiedSlots = useMemo(() => {
    return slots.filter(s => s.status === 'occupied');
  }, [slots]);

  const [plateFilter, setPlateFilter] = useState<string>('');
  const cleanFilter = plateFilter.trim().toUpperCase();

  const filteredInboundTasks = useMemo(() => {
    if (!cleanFilter) return inboundTasks;
    return inboundTasks.filter(t => t.carNumber.toUpperCase().includes(cleanFilter) || (t.doctorName && t.doctorName.toUpperCase().includes(cleanFilter)));
  }, [inboundTasks, cleanFilter]);

  const filteredRetrievals = useMemo(() => {
    if (!cleanFilter) return visibleRetrievals;
    return visibleRetrievals.filter(t => t.carNumber.toUpperCase().includes(cleanFilter) || (t.doctorName && t.doctorName.toUpperCase().includes(cleanFilter)));
  }, [visibleRetrievals, cleanFilter]);

  // 1-Tap Quick Actions for Stale Tasks with Undo Toast
  const handleQuickPark = async (t: ParkingTask) => {
    playQuickActionChime();
    const targetSlot = selectedSlotForTask[t.id] || t.slotId || freeSlots[0]?.id || 'A-01';
    const oldStatus = t.status;
    try {
      await forceResolveTask(t.id, {
        action: 'complete_parked',
        slotId: targetSlot,
        reason: 'lot_valet_quick_pill_parked',
      });
      showUndoToast({
        message: `${t.carNumber} parked in ${targetSlot}`,
        onUndo: async () => {
          await updateTask(t.id, { status: oldStatus });
        },
      });
    } catch (err: any) {
      dialog.alert(err.message || 'Could not park vehicle');
    }
  };

  const handleQuickVoid = async (t: ParkingTask) => {
    playQuickActionChime();
    const oldStatus = t.status;
    try {
      await forceResolveTask(t.id, {
        action: 'void_cancel',
        reason: 'lot_valet_quick_pill_void',
      });
      showUndoToast({
        message: `Run for ${t.carNumber} cancelled`,
        onUndo: async () => {
          await updateTask(t.id, { status: oldStatus });
        },
      });
    } catch (err: any) {
      dialog.alert(err.message || 'Could not void run');
    }
  };

  // Available blocks in lot (e.g. A, B, C, D)
  const availableBlocks = useMemo(() => {
    const set = new Set<string>();
    slots.forEach(s => {
      if (s.block) set.add(s.block);
    });
    return Array.from(set).sort();
  }, [slots]);

  // Filtered Slots for the Bay Overview Grid
  const filteredSlots = useMemo(() => {
    const q = slotSearch.trim().toLowerCase();
    return slots.filter(s => {
      const matchesBlock = selectedBlock === 'all' || s.block === selectedBlock;
      if (!matchesBlock) return false;
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        (s.carNumber && s.carNumber.toLowerCase().includes(q))
      );
    });
  }, [slots, selectedBlock, slotSearch]);

  // ── Fleet Statistics ──
  const readyDrivers = drivers.filter(d => d.status === 'available');
  const onTaskDrivers = drivers.filter(d => d.status === 'busy');
  const offDutyDrivers = drivers.filter(d => d.status === 'off');
  const completedRunsToday = drivers.reduce((acc, d) => acc + (d.completedToday ?? 0), 0);

  // ── Handlers ──
  const handleConfirmParked = async (task: ParkingTask) => {
    const slotId = (selectedSlotForTask[task.id] || task.slotId || '').trim().toUpperCase();
    if (!slotId) {
      dialog.alert('Please specify or pick a parking bay number.', {title: 'Bay Required'});
      return;
    }

    if (confirmingParkedId != null) return;
    setConfirmingParkedId(task.id);
    try {
      await confirmParkedByValet(task.id, slotId);
      playQuickActionChime();
      // Clean up selection
      setSelectedSlotForTask(prev => {
        const next = {...prev};
        delete next[task.id];
        return next;
      });
    } catch (err: any) {
      dialog.alert(err.message || 'Could not confirm vehicle parked', {title: 'Action Failed'});
    } finally {
      setConfirmingParkedId(null);
    }
  };

  const handleAssignDriverToRetrieval = async (driverId: number) => {
    if (!dispatchingTask || assigningDriverId != null) return;
    setAssigningDriverId(driverId);
    try {
      await assignTaskDriver(dispatchingTask.id, driverId);
      playDispatchChime();
      setDispatchingTask(null);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not assign runner driver', {title: 'Assignment Failed'});
    } finally {
      setAssigningDriverId(null);
    }
  };

  const handleTransferToGate = async (task: ParkingTask) => {
    const confirmed = await dialog.confirm({
      title: 'Transfer to Gate Station',
      message: `No available runners in the lot for ${task.carNumber}?\n\nThis will send a high-priority chime to the Gate Station desk to dispatch an entrance runner to fetch this car.`,
      confirmText: 'Transfer Job to Gate',
      cancelText: 'Cancel',
      tone: 'warning',
    });
    if (!confirmed) return;

    setTransferringTaskId(task.id);
    try {
      await requestOtherStationDriver(task.id);
      if (dispatchingTask?.id === task.id) {
        setDispatchingTask(null);
      }
    } catch (err: any) {
      dialog.alert(err.message || 'Failed to transfer job to Gate', {title: 'Transfer Failed'});
    } finally {
      setTransferringTaskId(null);
    }
  };

  const handleFreeAbandonedSlot = async (slot: ParkingSlot) => {
    const confirmed = await dialog.confirm({
      title: `Free Bay ${slot.id}`,
      message: `Has vehicle ${slot.carNumber || 'in bay'} physically exited Bay ${slot.id}?\n\nThis will free Bay ${slot.id} back to available inventory.`,
      confirmText: 'Free Slot Now',
      cancelText: 'Cancel',
      tone: 'error',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      if (slot.taskId != null) {
        await closeParkedSession(slot.taskId);
      } else {
        const taskInSlot = tasks.find(t => t.slotId === slot.id && t.status !== 'completed' && t.status !== 'cancelled');
        if (taskInSlot) {
          await closeParkedSession(taskInSlot.id);
        } else {
          const visitorInSlot = visitors.find(v => v.slotId === slot.id && v.status === 'parked');
          if (visitorInSlot) {
            await closeParkedVisitor(visitorInSlot.id);
          } else {
            dialog.alert('No linked active parking ticket was found for this bay to close.', {title: 'Cannot Free Bay'});
          }
        }
      }
    } catch (err: any) {
      dialog.alert(err.message || 'Could not free parking slot', {title: 'Action Failed'});
    }
  };

  const handleSweepStale = async () => {
    const confirmed = await dialog.confirm({
      title: 'Sweep Stale Tasks (> 2 Hours)',
      message: 'Are you sure you want to automatically clean up all stuck tasks that have been in process for more than 2 hours?\n\nThis will safely release all drivers, free unused slots, and mark those tasks as void/cancelled.',
      confirmText: 'Run Cleanup Sweep',
      cancelText: 'Cancel',
      tone: 'warning',
      destructive: true,
    });
    if (!confirmed) return;
    setSweepingStale(true);
    try {
      const res = await cleanupStaleTasks(2);
      dialog.alert(`Stale Task Sweep complete! Cleaned up ${res.cleanedCount} stuck tasks out of ${res.totalFound} found.`, {title: 'Cleanup Complete'});
    } catch (err: any) {
      dialog.alert(err.message || 'Failed to cleanup stale tasks', {title: 'Sweep Failed'});
    } finally {
      setSweepingStale(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-VIEW: RUNNER DRIVER DISPATCH DRAWER / MODAL
  // ══════════════════════════════════════════════════════════════════════════
  if (dispatchingTask) {
    const visibleDrivers = availableDrivers
      .filter(d => d.name.toLowerCase().includes(driverSearch.trim().toLowerCase()))
      .slice()
      .sort((a, b) => (a.completedToday ?? 0) - (b.completedToday ?? 0) || a.name.localeCompare(b.name));

    const leftMinutes = minutesUntilDeparture(dispatchingTask.requestedAt, dispatchingTask.plannedDepartureMinutes, now);
    const departureText = departureClockLabel(dispatchingTask.requestedAt, dispatchingTask.plannedDepartureMinutes, dispatchingTask.plannedDepartureAt);

    return (
      <div className="valet-workstation-viewport" style={{backgroundColor: isDark ? '#0B0F17' : '#F8FAFC'}}>
        <div className="valet-container" style={{maxWidth: 640}}>
          {/* Header */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <button
              type="button"
              className="pressable"
              onClick={() => { setDispatchingTask(null); setDriverSearch(''); }}
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
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textPrimary}}>Back to Lot Board</span>
            </button>
            <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted}}>
              Runner Dispatch
            </span>
          </div>

          {/* Target Vehicle Context Card */}
          <div
            className="valet-glass-card"
            style={{
              padding: 18,
              backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : 'rgba(37,99,235,0.05)',
              border: '1.5px solid rgba(37,99,235,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: '#2563EB',
                  }}
                >
                  Retrieval Assignment
                </span>
                <div style={{fontSize: 20, fontWeight: 800, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums', marginTop: 2}}>
                  {dispatchingTask.carNumber}
                </div>
                <div style={{fontSize: 13, color: colors.textSecondary, marginTop: 2}}>
                  {dispatchingTask.doctorName || 'Guest'}
                </div>
              </div>

              {/* Parked Slot Badge */}
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                  color: isDark ? '#0F172A' : '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: '0.04em',
                }}
              >
                BAY {dispatchingTask.slotId || 'UNKNOWN'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 10,
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                fontSize: 12.5,
              }}
            >
              <span style={{color: colors.textSecondary}}>
                Departure: <strong>{departureText}</strong>
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: (leftMinutes != null && leftMinutes <= 0) ? '#E11D48' : '#2563EB',
                }}
              >
                {leftMinutes != null && leftMinutes <= 0 ? 'DUE NOW' : `${leftMinutes} min remaining`}
              </span>
            </div>
          </div>

          {/* Escape Hatch: No Driver in Lot */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{fontSize: 12.5, fontWeight: 700, color: '#D97706'}}>
                No runners available in the parking bays?
              </div>
              <div style={{fontSize: 11.5, color: colors.textMuted}}>
                Transfer this retrieval job to Gate Counter valets.
              </div>
            </div>
            <button
              type="button"
              className="pressable"
              onClick={() => handleTransferToGate(dispatchingTask)}
              disabled={transferringTaskId === dispatchingTask.id}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                backgroundColor: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {transferringTaskId === dispatchingTask.id ? 'Transferring…' : 'Transfer to Gate'}
            </button>
          </div>

          {/* Search Runner */}
          <div
            style={{
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
              placeholder="Filter lot runner drivers…"
              value={driverSearch}
              onChange={e => setDriverSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Runner List */}
          <DriverPickerList
            drivers={visibleDrivers}
            onAssign={handleAssignDriverToRetrieval}
            assigningId={assigningDriverId}
          />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN VIEW: THE LOT WORKSTATION
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
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(37,99,235,0.25)',
              }}
            >
              <Icon name="car" size={22} color="#2563EB" />
            </div>
            <div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <h1 style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary, margin: 0}}>
                  Parking Lot Desk
                </h1>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: 'rgba(5, 150, 105, 0.12)',
                    color: '#059669',
                    border: '1px solid rgba(5, 150, 105, 0.25)',
                    textTransform: 'uppercase',
                  }}
                >
                  Bay Logistics &bull; Active
                </span>
              </div>
              <div style={{fontSize: 12, color: colors.textSecondary, marginTop: 2}}>
                {user?.name} &bull; {todayLabel}
              </div>
            </div>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            {/* Total Bay Capacity Counter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
              }}
            >
              <div style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669'}} />
              <span style={{fontSize: 12, fontWeight: 700, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>
                {freeSlots.length} Free / {slots.length} Total Bays
              </span>
            </div>

            {/* Supervisor station toggle button */}
            {(isSupervisor || onSwitchStation) && (
              <button
                type="button"
                className="pressable"
                onClick={onSwitchStation}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                  cursor: 'pointer',
                }}
              >
                <Icon name="map" size={14} color={colors.textSecondary} />
                <span style={{fontSize: 12, fontWeight: 600, color: colors.textPrimary}}>
                  Switch to Gate Counter
                </span>
              </button>
            )}
          </div>
        </div>

        {/* RUNNER FLEET STRIP (4 KPIs) - Responsive 2x2 on mobile, 4-col on desktop */}
        <div className="valet-fleet-grid">
          {/* Ready */}
          <div
            className="valet-glass-card pressable"
            onClick={() => setFleetFilter(fleetFilter === 'ready' ? 'all' : 'ready')}
            style={{
              padding: '12px 14px',
              border: fleetFilter === 'ready' ? '1.5px solid #059669' : undefined,
              cursor: 'pointer',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase'}}>
                Ready
              </span>
              <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#059669'}} />
            </div>
            <div style={{fontSize: 20, fontWeight: 800, color: colors.textPrimary, marginTop: 4, fontVariantNumeric: 'tabular-nums'}}>
              {readyDrivers.length}
            </div>
            <div style={{fontSize: 11, color: colors.textSecondary, marginTop: 2}}>
              Available runners
            </div>
          </div>

          {/* On Task */}
          <div
            className="valet-glass-card pressable"
            onClick={() => setFleetFilter(fleetFilter === 'onTask' ? 'all' : 'onTask')}
            style={{
              padding: '12px 14px',
              border: fleetFilter === 'onTask' ? '1.5px solid #2563EB' : undefined,
              cursor: 'pointer',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase'}}>
                On Task
              </span>
              <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#2563EB'}} />
            </div>
            <div style={{fontSize: 20, fontWeight: 800, color: colors.textPrimary, marginTop: 4, fontVariantNumeric: 'tabular-nums'}}>
              {onTaskDrivers.length}
            </div>
            <div style={{fontSize: 11, color: colors.textSecondary, marginTop: 2}}>
              Running or parking
            </div>
          </div>

          {/* Off Duty */}
          <div
            className="valet-glass-card pressable"
            onClick={() => setFleetFilter(fleetFilter === 'offDuty' ? 'all' : 'offDuty')}
            style={{
              padding: '12px 14px',
              border: fleetFilter === 'offDuty' ? '1.5px solid #94A3B8' : undefined,
              cursor: 'pointer',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase'}}>
                Off Duty
              </span>
              <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#94A3B8'}} />
            </div>
            <div style={{fontSize: 20, fontWeight: 800, color: colors.textPrimary, marginTop: 4, fontVariantNumeric: 'tabular-nums'}}>
              {offDutyDrivers.length}
            </div>
            <div style={{fontSize: 11, color: colors.textSecondary, marginTop: 2}}>
              Inactive drivers
            </div>
          </div>

          {/* Done Today */}
          <div
            className="valet-glass-card"
            style={{
              padding: '12px 14px',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase'}}>
                Done Today
              </span>
              <Icon name="check" size={13} color="#059669" />
            </div>
            <div style={{fontSize: 20, fontWeight: 800, color: colors.textPrimary, marginTop: 4, fontVariantNumeric: 'tabular-nums'}}>
              {completedRunsToday}
            </div>
            <div style={{fontSize: 11, color: colors.textSecondary, marginTop: 2}}>
              Runs completed
            </div>
          </div>
        </div>

        {/* Fast Plate Quick Matcher Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 46,
            borderRadius: 10,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            border: `1.5px solid ${plateFilter ? '#2563EB' : isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
            padding: '0 14px',
            boxShadow: plateFilter ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Icon name="search" size={17} color={plateFilter ? '#2563EB' : colors.textMuted} />
          <input
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: 600,
              color: colors.textPrimary,
            }}
            placeholder="Search plate (e.g. 6755) or guest name to filter lot queues…"
            value={plateFilter}
            onChange={e => setPlateFilter(e.target.value)}
          />
          {plateFilter && (
            <button
              type="button"
              onClick={() => setPlateFilter('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <Icon name="close" size={14} color="currentColor" />
            </button>
          )}
        </div>

        {/* SECTION 1: INBOUND CARS TO PARK (BAY ALLOCATION MATRIX) */}
        <div>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12}}>
            <div>
              <h2 style={{fontSize: 15, fontWeight: 800, color: colors.textPrimary, margin: 0}}>
                Inbound Vehicles to Park ({filteredInboundTasks.length})
              </h2>
              <span style={{fontSize: 12, color: colors.textMuted}}>
                Runner drivers descending from gate &bull; Assign bay to complete park
              </span>
            </div>

            {/* Stale Task Sweep Trigger */}
            {inboundTasks.some(t => getTaskStaleInfo(t, now).isStale) && (
              <button
                type="button"
                className="pressable"
                onClick={handleSweepStale}
                disabled={sweepingStale}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Icon name="bolt" size={13} color="#EF4444" />
                <span>{sweepingStale ? 'Sweeping Stale Tasks…' : 'Sweep Stuck Jobs (>2h)'}</span>
              </button>
            )}
          </div>

          {inboundTasks.length === 0 ? (
            <div
              className="valet-glass-card"
              style={{
                padding: '24px 20px',
                textAlign: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
              }}
            >
              <Icon name="check" size={22} color="#059669" />
              <div style={{fontSize: 14, fontWeight: 700, color: colors.textPrimary, marginTop: 6}}>
                All Inbound Vehicles Parked
              </div>
              <div style={{fontSize: 12, color: colors.textMuted, marginTop: 2}}>
                No cars currently descending from the gate counter.
              </div>
            </div>
          ) : (
            <div className="valet-queue-grid">
              {filteredInboundTasks.map(t => {
                const currentSlot = selectedSlotForTask[t.id] ?? (t.slotId || '');
                const nearestFree = freeSlots[0]?.id;
                const staleInfo = getTaskStaleInfo(t, now);

                return (
                  <div
                    key={t.id}
                    className="valet-glass-card"
                    style={{
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      border: staleInfo.isStale
                        ? (staleInfo.isCritical ? '1.5px solid #EF4444' : '1.5px solid #F59E0B')
                        : (currentSlot ? '1.5px solid #2563EB' : undefined),
                    }}
                  >
                    {/* Header */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                      <div>
                        <VehiclePlateBadge plate={t.carNumber} highlightQuery={plateFilter} />
                        <div style={{fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginTop: 4}}>
                          {t.doctorName || 'Guest'} &bull; Runner: {t.driverName || 'Assigned'}
                        </div>
                      </div>

                      <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                        {staleInfo.isStale && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                              padding: '3px 7px',
                              borderRadius: 6,
                              backgroundColor: staleInfo.isCritical ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                              color: staleInfo.isCritical ? '#EF4444' : '#F59E0B',
                              border: `1px solid ${staleInfo.isCritical ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Icon name="bellAlert" size={11} color={staleInfo.isCritical ? '#EF4444' : '#F59E0B'} />
                            Stuck ({staleInfo.elapsedLabel})
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(37,99,235,0.1)',
                            color: '#2563EB',
                          }}
                        >
                          In Transit
                        </span>
                      </div>
                    </div>

                    {/* Integrated Bay Selection Matrix */}
                    <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                      {/* Nearest slot 1-tap chip */}
                      {nearestFree && (
                        <button
                          type="button"
                          className="pressable"
                          onClick={() => setSelectedSlotForTask(prev => ({...prev, [t.id]: nearestFree}))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: 6,
                            backgroundColor: isDark ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.08)',
                            border: '1px solid rgba(37,99,235,0.25)',
                            color: '#2563EB',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Icon name="bolt" size={13} color="#2563EB" />
                          <span>Auto-assign nearest free bay: {nearestFree}</span>
                        </button>
                      )}

                      {/* Quick chips of free slots */}
                      {freeSlots.length > 0 && (
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                          {freeSlots.slice(0, 5).map(sl => (
                            <button
                              key={sl.id}
                              type="button"
                              className="pressable"
                              onClick={() => setSelectedSlotForTask(prev => ({...prev, [t.id]: sl.id}))}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: currentSlot === sl.id ? '1.5px solid #2563EB' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                                backgroundColor: currentSlot === sl.id ? (isDark ? '#2563EB' : '#2563EB') : 'transparent',
                                color: currentSlot === sl.id ? '#FFFFFF' : colors.textPrimary,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {sl.id}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Inline Quick-Pills for Stale Inbound */}
                      {staleInfo.isStale && (
                        <div style={{display: 'flex', gap: 6, marginBottom: 2}}>
                          <button
                            type="button"
                            className="pressable"
                            onClick={() => handleQuickPark(t)}
                            style={{
                              flex: 1,
                              height: 32,
                              borderRadius: 6,
                              backgroundColor: '#059669',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                            }}
                          >
                            <Icon name="check" size={12} color="#FFFFFF" />
                            <span>⚡ Park in {currentSlot || nearestFree || 'Bay'}</span>
                          </button>
                          <button
                            type="button"
                            className="pressable"
                            onClick={() => handleQuickVoid(t)}
                            style={{
                              padding: '0 10px',
                              height: 32,
                              borderRadius: 6,
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: '#EF4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ⚡ Void
                          </button>
                        </div>
                      )}

                      {/* Manual input row + Confirm Button + Resolve Button */}
                      <div style={{display: 'flex', gap: 8, marginTop: 4}}>
                        <input
                          style={{
                            flex: 1,
                            height: 38,
                            borderRadius: 6,
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1'}`,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                            padding: '0 10px',
                            fontSize: 13,
                            fontWeight: 700,
                            color: colors.textPrimary,
                          }}
                          placeholder="Bay ID (e.g. B-14)"
                          value={currentSlot}
                          onChange={e => {
                            const val = e.target.value.toUpperCase();
                            setSelectedSlotForTask(prev => ({...prev, [t.id]: val}));
                          }}
                        />

                        <button
                          type="button"
                          className="pressable"
                          onClick={() => handleConfirmParked(t)}
                          disabled={confirmingParkedId === t.id || !currentSlot.trim()}
                          style={{
                            padding: '0 14px',
                            height: 38,
                            borderRadius: 6,
                            backgroundColor: '#059669',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: 12.5,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: currentSlot.trim() && confirmingParkedId !== t.id ? 'pointer' : 'default',
                            opacity: currentSlot.trim() ? 1 : 0.5,
                          }}
                        >
                          {confirmingParkedId === t.id ? (
                            <span className="spinner" style={{width: 14, height: 14}} />
                          ) : (
                            <>
                              <Icon name="check" size={14} color="#FFFFFF" />
                              <span>Confirm Parked</span>
                            </>
                          )}
                        </button>

                        {/* Operational Force-Resolve Override Button */}
                        <button
                          type="button"
                          className="pressable"
                          onClick={() => setResolvingTask(t)}
                          title="Operational override / resolve stuck parking task"
                          style={{
                            height: 38,
                            padding: '0 10px',
                            borderRadius: 6,
                            backgroundColor: staleInfo.isStale
                              ? (staleInfo.isCritical ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)')
                              : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                            border: `1px solid ${staleInfo.isStale ? (staleInfo.isCritical ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)') : (isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1')}`,
                            color: staleInfo.isStale ? (staleInfo.isCritical ? '#EF4444' : '#F59E0B') : colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Icon name="settings" size={13} color="currentColor" />
                          <span>{staleInfo.isStale ? 'Resolve' : 'Fix'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: RETRIEVAL URGENCY SLA BOARD */}
        <div>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12}}>
            <div>
              <h2 style={{fontSize: 15, fontWeight: 800, color: colors.textPrimary, margin: 0}}>
                Departure Retrieval Requests ({retrievalTasks.length})
              </h2>
              <span style={{fontSize: 12, color: colors.textMuted}}>
                Urgency-prioritized dispatch board &bull; Assign runners or transfer to gate
              </span>
            </div>

            {/* Urgency Filter Tabs */}
            <div
              style={{
                display: 'flex',
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                padding: 3,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
              }}
            >
              {(['all', 'now', 'soon', 'later'] as UrgencyTab[]).map(tab => {
                const count = urgencyGroups[tab].length;
                const isActive = urgencyTab === tab;
                const label = tab === 'all' ? 'All' : tab === 'now' ? 'Due Now' : tab === 'soon' ? 'Soon (<15m)' : 'Scheduled';

                return (
                  <button
                    key={tab}
                    type="button"
                    className="pressable"
                    onClick={() => setUrgencyTab(tab)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: isActive ? (isDark ? '#2563EB' : '#FFFFFF') : 'transparent',
                      color: isActive ? (isDark ? '#FFFFFF' : '#0F172A') : colors.textSecondary,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: isActive && !isDark ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <span>{label}</span>
                    <span style={{fontSize: 10.5, opacity: 0.75}}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredRetrievals.length === 0 ? (
            <div
              className="valet-glass-card"
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
              }}
            >
              <Icon name="check" size={24} color="#059669" />
              <div style={{fontSize: 14, fontWeight: 700, color: colors.textPrimary, marginTop: 8}}>
                No Pending Retrievals in this Category
              </div>
              <div style={{fontSize: 12, color: colors.textMuted, marginTop: 2}}>
                All scheduled vehicle departures are on track.
              </div>
            </div>
          ) : (
            <div className="valet-queue-grid">
              {filteredRetrievals.map(t => {
                const leftMinutes = minutesUntilDeparture(t.requestedAt, t.plannedDepartureMinutes, now);
                const isOverdue = leftMinutes != null && leftMinutes <= 0;
                const isSoon = leftMinutes != null && leftMinutes > 0 && leftMinutes <= 15;
                const clockLabel = departureClockLabel(t.requestedAt, t.plannedDepartureMinutes, t.plannedDepartureAt);

                return (
                  <div
                    key={t.id}
                    className="valet-glass-card"
                    style={{
                      padding: 16,
                      border: isOverdue ? '1.5px solid #E11D48' : isSoon ? '1.5px solid #F59E0B' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {/* Top Row: Bay Identifier & Urgency */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                          color: isDark ? '#0F172A' : '#FFFFFF',
                          fontWeight: 800,
                          fontSize: 13.5,
                          letterSpacing: '0.04em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        BAY {t.slotId || 'TBD'}
                      </div>

                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: isOverdue ? 'rgba(225, 29, 72, 0.12)' : isSoon ? 'rgba(245, 158, 11, 0.12)' : 'rgba(37,99,235,0.1)',
                          color: isOverdue ? '#E11D48' : isSoon ? '#D97706' : '#2563EB',
                          border: `1px solid ${isOverdue ? 'rgba(225, 29, 72, 0.25)' : isSoon ? 'rgba(245, 158, 11, 0.25)' : 'rgba(37,99,235,0.2)'}`,
                        }}
                      >
                        {isOverdue ? 'DUE NOW' : isSoon ? `DUE IN ${leftMinutes} MIN` : 'SCHEDULED'}
                      </span>
                    </div>

                    {/* Middle: Plate & Doctor */}
                    <div>
                      <VehiclePlateBadge plate={t.carNumber} highlightQuery={plateFilter} />
                      <div style={{fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginTop: 4}}>
                        {t.doctorName || 'Guest'}
                      </div>
                      <div style={{fontSize: 11.5, color: colors.textMuted, marginTop: 4}}>
                        Leaves at {clockLabel}
                      </div>
                    </div>

                    {/* Action Row */}
                    <div style={{display: 'flex', gap: 8, marginTop: 4}}>
                      <button
                        type="button"
                        className="pressable"
                        onClick={() => setDispatchingTask(t)}
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
                        <Icon name="people" size={14} color="#FFFFFF" />
                        <span>Assign Runner</span>
                      </button>

                      <button
                        type="button"
                        className="pressable"
                        onClick={() => handleTransferToGate(t)}
                        disabled={transferringTaskId === t.id}
                        title="Transfer to Gate Station (if no runner in lot)"
                        style={{
                          padding: '0 10px',
                          height: 38,
                          borderRadius: 6,
                          backgroundColor: 'transparent',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1'}`,
                          color: colors.textSecondary,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {transferringTaskId === t.id ? '…' : 'No Runner'}
                      </button>

                      <button
                        type="button"
                        className="pressable"
                        onClick={() => setResolvingTask(t)}
                        title="Force resolve / override retrieval"
                        style={{
                          padding: '0 8px',
                          height: 38,
                          borderRadius: 6,
                          backgroundColor: 'transparent',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1'}`,
                          color: colors.textSecondary,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="settings" size={13} color="currentColor" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: SPATIAL BAY OVERVIEW & SEARCH (COLLAPSIBLE / HIGH DENSITY) */}
        <div className="valet-glass-card" style={{padding: '16px 20px'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setShowBayOverview(!showBayOverview)}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <Icon name="map" size={18} color="#2563EB" />
              <div>
                <h3 style={{fontSize: 14, fontWeight: 700, color: colors.textPrimary, margin: 0}}>
                  Spatial Bay Capacity &amp; Occupancy
                </h3>
                <span style={{fontSize: 11.5, color: colors.textMuted}}>
                  {occupiedSlots.length} occupied &bull; {freeSlots.length} free
                </span>
              </div>
            </div>

            <button
              type="button"
              className="pressable"
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {showBayOverview ? 'Hide Bays ▲' : 'Inspect Bays ▼'}
            </button>
          </div>

          {showBayOverview && (
            <div style={{marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12}}>
              {/* Controls Row: Block Filters + Search */}
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between'}}>
                {/* Block Chips */}
                <div style={{display: 'flex', gap: 6}}>
                  <button
                    type="button"
                    className="pressable"
                    onClick={() => setSelectedBlock('all')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: selectedBlock === 'all' ? '1.5px solid #2563EB' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                      backgroundColor: selectedBlock === 'all' ? (isDark ? '#2563EB' : '#2563EB') : 'transparent',
                      color: selectedBlock === 'all' ? '#FFFFFF' : colors.textPrimary,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    All Blocks
                  </button>
                  {availableBlocks.map(block => (
                    <button
                      key={block}
                      type="button"
                      className="pressable"
                      onClick={() => setSelectedBlock(block)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: selectedBlock === block ? '1.5px solid #2563EB' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                        backgroundColor: selectedBlock === block ? (isDark ? '#2563EB' : '#2563EB') : 'transparent',
                        color: selectedBlock === block ? '#FFFFFF' : colors.textPrimary,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Block {block}
                    </button>
                  ))}
                </div>

                {/* Bay Search */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 34,
                    borderRadius: 6,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                    padding: '0 8px',
                    width: 220,
                  }}
                >
                  <Icon name="search" size={14} color={colors.textMuted} />
                  <input
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 12,
                      color: colors.textPrimary,
                    }}
                    placeholder="Search bay ID or plate…"
                    value={slotSearch}
                    onChange={e => setSlotSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Bay Cells Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: 8,
                  maxHeight: 280,
                  overflowY: 'auto',
                  padding: '4px 2px',
                }}
              >
                {filteredSlots.map(slot => {
                  const isOccupied = slot.status === 'occupied';
                  const isReserved = slot.status === 'reserved';

                  return (
                    <div
                      key={slot.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: isOccupied
                          ? `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#CBD5E1'}`
                          : isReserved
                          ? '1px solid rgba(245, 158, 11, 0.4)'
                          : '1px solid rgba(5, 150, 105, 0.3)',
                        backgroundColor: isOccupied
                          ? isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9'
                          : isReserved
                          ? 'rgba(245, 158, 11, 0.08)'
                          : 'rgba(5, 150, 105, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 4,
                      }}
                    >
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span style={{fontSize: 12, fontWeight: 800, color: colors.textPrimary}}>
                          {slot.id}
                        </span>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: isOccupied ? '#94A3B8' : isReserved ? '#F59E0B' : '#059669',
                          }}
                        />
                      </div>

                      {isOccupied && (
                        <div>
                          <div style={{fontSize: 10, fontWeight: 700, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums'}}>
                            {slot.carNumber || 'Occupied'}
                          </div>
                          <button
                            type="button"
                            className="pressable"
                            onClick={() => handleFreeAbandonedSlot(slot)}
                            style={{
                              marginTop: 4,
                              fontSize: 9.5,
                              color: '#E11D48',
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              fontWeight: 600,
                              textAlign: 'left',
                            }}
                          >
                            Force Free
                          </button>
                        </div>
                      )}

                      {!isOccupied && !isReserved && (
                        <span style={{fontSize: 10, color: '#059669', fontWeight: 600}}>
                          Available
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Resolution & Fail-Safe Modal */}
      {resolvingTask && (
        <TaskResolutionModal
          task={resolvingTask}
          onClose={() => setResolvingTask(null)}
        />
      )}
    </div>
  );
}
