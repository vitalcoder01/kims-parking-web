import React, {createContext, useContext, useState, useCallback, useEffect, useRef} from 'react';
import {tasksApi, slotsApi, notificationsApi, arrivalsApi, driversApi, visitorsApi, getAuthToken} from '../services/api';
import {connectSocket, disconnectSocket, emitDriverLocation} from '../services/socket';
import {ringAlarm, stopAlarm, playChime} from '../services/alarm';
import {initWebPush} from '../services/webPush';
import {getSwRegistration} from '../services/swRegistration';
import {getCurrentPositionSafe} from '../utils/location';
import {useAuth} from './AuthContext';

// Full port of the mobile app's AppStateContext — same wire-format mappers,
// same socket delta events, same "fetch on connect, patch on event" sync
// model, now covering every role (doctor/staff/admin/valet/driver) instead
// of just the desk roles. GPS comes from the browser's Geolocation API in
// place of react-native-geolocation-service; everything else (sockets, REST
// calls, mappers) is identical wire-for-wire with the mobile client.

export type DriverStatus = 'available' | 'busy' | 'off';
export type TaskType = 'park' | 'retrieve';
export type TaskStatus = 'requested' | 'accepted' | 'assigned' | 'key_collected' | 'in_transit' | 'delivered' | 'completed' | 'cancelled';
export type SlotStatus = 'free' | 'occupied' | 'reserved';

export interface Driver {
  id: number;
  name: string;
  phone: string;
  status: DriverStatus;
  currentTaskId?: number;
  completedToday?: number;
}

export interface ParkingTask {
  id: number;
  type: TaskType;
  doctorId: number;
  doctorName: string;
  visitorId?: number;
  isVisitor?: boolean;
  doctorDepartment?: string;
  doctorEmployeeId?: string;
  carNumber: string;
  slotId?: string;
  driverId?: number;
  driverName?: string;
  status: TaskStatus;
  requestedAt?: number;
  assignedAt?: number;
  acceptedAt?: number;
  startedAt?: number;
  valetId?: number;
  valetName?: string;
  escalatedAt?: number;
  arrivalOwnerValetId?: number;
  arrivalOwnerValetName?: string;
  arrivalAcceptedAt?: number;
  retrievalOwnerValetId?: number;
  retrievalOwnerValetName?: string;
  retrievalAcceptedAt?: number;
  retrievalOwnershipSource?: 'OWNER' | 'RECOVERY';
  ownerNotifiedAt?: number;
  recoveryBroadcastAt?: number;
  recalledAt?: number;
  keyCollectedAt?: number;
  completedAt?: number;
  plannedDepartureMinutes?: number;
  plannedDepartureAt?: number;
  retrievalReadyAt?: number;
  trackingProgress?: number;
  driverLat?: number;
  driverLng?: number;
  locationUpdatedAt?: number;
  driverStartLat?: number;
  driverStartLng?: number;
  destinationLat?: number;
  destinationLng?: number;
}

export interface ParkingSlot {
  id: string;
  block: string;
  number: number;
  status: SlotStatus;
  taskId?: number;
  carNumber?: string;
  doctorId?: number;
}

export interface Visitor {
  id: number;
  name: string;
  carNumber?: string;
  mobile: string;
  vehicleType: 'car' | 'bike';
  slotId?: string;
  driverId?: number;
  driverName?: string;
  status: 'parked' | 'pending' | 'delivered' | 'retrieved' | 'cancelled';
  retrievalRequested: boolean;
  valetId?: number;
  escalatedAt?: number;
  driverAssignedAt?: number;
  acceptedAt?: number;
  pickedUpAt?: number;
  cancelledAt?: number;
  cancelReason?: 'no_show' | 'valet_cancelled' | 'parking_failed';
  token: string;
  publicToken: string;
  createdAt: number;
  trackingProgress?: number;
}

// Doctor/staff "I'm on my way" notice — valet-facing only.
export interface ArrivalNotice {
  id: number;
  doctorId: number;
  doctorName: string;
  doctorCarNumber?: string;
  doctorDepartment?: string;
  doctorEmployeeId?: string;
  doctorCardCode?: string;
  eta: number;
  createdAt: number;
}

export interface Notification {
  id: number;
  targetRole: string;
  targetId?: number;
  title: string;
  body: string;
  type: 'alarm' | 'info' | 'warning';
  createdAt: number;
  read: boolean;
}

// Live GPS positions streamed over the socket — keyed by driverId.
export interface DriverLocation {
  driverId: number;
  name: string;
  lat: number;
  lng: number;
  at: number;
}

// Socket-driven "driver didn't accept in time / rejected" prompt for the
// valet — consumed by ValetHomeScreen to jump straight into reassignment.
export interface ReassignPrompt {
  kind: 'task' | 'visitor';
  task?: ParkingTask;
  visitor?: Visitor;
  driverName: string | null;
  rejected?: boolean;
}

export interface ActiveAlert {
  title: string;
  body: string;
  type: 'alarm' | 'info' | 'warning';
  at: number;
}

interface AppState {
  drivers: Driver[];
  tasks: ParkingTask[];
  slots: ParkingSlot[];
  visitors: Visitor[];
  arrivalNotices: ArrivalNotice[];
  notifications: Notification[];
  activeAlert: ActiveAlert | null;
  hydrated: boolean;
  driverLocations: Record<number, DriverLocation>;
  onlineDriverIds: number[];
  reassignPrompt: ReassignPrompt | null;
  clearReassignPrompt: () => void;
  dismissAlert: () => void;

  addTask: (task: Omit<ParkingTask, 'id'>) => Promise<number>;
  requestRetrieval: (plannedDepartureMinutes: number) => Promise<number>;
  cancelMyRetrieval: (taskId: number) => Promise<void>;
  sendArrivalNotice: (eta: number) => Promise<void>;
  acceptRetrieval: (taskId: number) => Promise<void>;
  dismissArrivalNotice: (id: number) => Promise<void>;
  updateTask: (id: number, patch: Partial<ParkingTask>) => Promise<void>;
  assignDriver: (taskId: number, driverId: number) => Promise<void>;
  cancelTaskAssignment: (taskId: number) => Promise<void>;
  acceptTask: (taskId: number) => Promise<void>;
  rejectTask: (taskId: number) => Promise<void>;
  markKeyCollected: (taskId: number) => Promise<void>;
  markParked: (taskId: number, slotId: string) => Promise<void>;
  markRetrieved: (taskId: number) => Promise<void>;
  confirmTaskDelivered: (taskId: number) => Promise<void>;
  cancelTask: (taskId: number) => Promise<void>;
  recallTask: (taskId: number) => Promise<void>;
  markTaskReturned: (taskId: number) => Promise<void>;
  fetchTaskHistory: (params?: {doctorId?: number; driverId?: number}) => Promise<ParkingTask[]>;
  reportLocation: (taskId: number, lat: number, lng: number) => Promise<void>;
  setDriverStatus: (driverId: number, status: DriverStatus) => Promise<void>;
  addVisitor: (v: {name: string; carNumber?: string; mobile: string; vehicleType?: 'car' | 'bike'}) => Promise<Visitor>;
  assignVisitorDriver: (visitorId: number, driverId: number) => Promise<void>;
  cancelVisitorAssignment: (visitorId: number) => Promise<void>;
  cancelVisitor: (visitorId: number, reason: 'no_show' | 'valet_cancelled' | 'parking_failed') => Promise<void>;
  assignRetrievalDriver: (visitorId: number, driverId: number) => Promise<void>;
  assignStaffRetrievalDriver: (doctorId: number, driverId: number) => Promise<void>;
  confirmVisitorDelivered: (visitorId: number) => Promise<void>;
  pushNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  refreshTasks: () => Promise<void>;
  markNotificationRead: (id: number) => Promise<void>;
  clearNotifications: () => void;
}

const Ctx = createContext<AppState>({} as AppState);

// A driver's marker goes stale if no GPS ping for this long.
const LOCATION_STALE_MS = 60 * 1000;

function toEpoch(v: unknown): number | undefined {
  if (!v) return undefined;
  const t = new Date(v as string).getTime();
  return Number.isNaN(t) ? undefined : t;
}

function mapTask(t: any): ParkingTask {
  return {
    ...t,
    plannedDepartureMinutes: t.plannedDepartureMinutes ?? t.eta ?? undefined,
    requestedAt: toEpoch(t.requestedAt),
    assignedAt: toEpoch(t.assignedAt),
    acceptedAt: toEpoch(t.acceptedAt),
    startedAt: toEpoch(t.startedAt),
    escalatedAt: toEpoch(t.escalatedAt),
    plannedDepartureAt: toEpoch(t.plannedDepartureAt),
    retrievalReadyAt: toEpoch(t.retrievalReadyAt),
    arrivalAcceptedAt: toEpoch(t.arrivalAcceptedAt),
    retrievalAcceptedAt: toEpoch(t.retrievalAcceptedAt),
    ownerNotifiedAt: toEpoch(t.ownerNotifiedAt),
    recoveryBroadcastAt: toEpoch(t.recoveryBroadcastAt),
    recalledAt: toEpoch(t.recalledAt),
    keyCollectedAt: toEpoch(t.keyCollectedAt),
    completedAt: toEpoch(t.completedAt),
    locationUpdatedAt: toEpoch(t.locationUpdatedAt),
  };
}

function mapVisitor(v: any): Visitor {
  return {
    ...v,
    driverAssignedAt: toEpoch(v.driverAssignedAt),
    acceptedAt: toEpoch(v.acceptedAt),
    pickedUpAt: toEpoch(v.pickedUpAt),
    cancelledAt: toEpoch(v.cancelledAt),
    createdAt: toEpoch(v.createdAt) ?? Date.now(),
  };
}

function mapNotification(n: any): Notification {
  return {...n, createdAt: toEpoch(n.createdAt) ?? Date.now()};
}

function mapArrival(a: any): ArrivalNotice {
  return {...a, createdAt: toEpoch(a.createdAt) ?? Date.now()};
}

function upsertById<T extends {id: any}>(list: T[], item: T): T[] {
  return list.some(x => x.id === item.id)
    ? list.map(x => (x.id === item.id ? item : x))
    : [item, ...list];
}

// Browser-tray notification — the web stand-in for the app's notifee tray.
function displayBrowserNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (window.Notification.permission === 'granted') {
    try { new window.Notification(title, {body}); } catch {}
  }
}

export function AppStateProvider({children}: {children: React.ReactNode}) {
  const {user} = useAuth();
  const [drivers, setDrivers]         = useState<Driver[]>([]);
  const [tasks, setTasks]             = useState<ParkingTask[]>([]);
  const [slots, setSlots]             = useState<ParkingSlot[]>([]);
  const [visitors, setVisitors]       = useState<Visitor[]>([]);
  const [arrivalNotices, setArrivals] = useState<ArrivalNotice[]>([]);
  const [notifications, setNotifs]    = useState<Notification[]>([]);
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const [hydrated, setHydrated]       = useState(false);
  const [driverLocations, setDriverLocations] = useState<Record<number, DriverLocation>>({});
  const [onlineDriverIds, setOnlineDriverIds] = useState<number[]>([]);
  const [reassignPrompt, setReassignPrompt]   = useState<ReassignPrompt | null>(null);

  const dismissAlert = useCallback(() => {
    stopAlarm();
    setActiveAlert(null);
  }, []);

  // Only valet/admin screens ever read the full `drivers` roster.
  const needsOpsData = user?.role === 'valet' || user?.role === 'admin';
  // `visitors` is also needed by drivers — DriverJobsScreen's "Visitor
  // Pickups" section filters this list down to the ones assigned to them.
  const needsVisitors = needsOpsData || user?.role === 'driver';

  const fetchAll = useCallback(async () => {
    const [t, s, n, d, v, a] = await Promise.all([
      tasksApi.list(),
      slotsApi.list(),
      notificationsApi.list(),
      needsOpsData ? driversApi.list() : Promise.resolve(null),
      needsVisitors ? visitorsApi.list() : Promise.resolve(null),
      needsOpsData ? arrivalsApi.list() : Promise.resolve(null),
    ]);
    setTasks(t.map(mapTask));
    setSlots(s);
    setNotifs(n.map(mapNotification));
    if (d) setDrivers(d);
    if (v) setVisitors(v.map(mapVisitor));
    if (a) setArrivals(a.map(mapArrival));
    setHydrated(true);
  }, [needsOpsData, needsVisitors]);

  const userRef = useRef(user);
  userRef.current = user;

  const reassignShownAt = useRef(0);
  const clearReassignPrompt = useCallback(() => setReassignPrompt(null), []);

  // ── True-WebSocket sync — full fetch on connect/reconnect, deltas after.
  useEffect(() => {
    if (!user) {
      stopAlarm();
      setActiveAlert(null);
      setTasks([]); setSlots([]); setVisitors([]); setNotifs([]); setDrivers([]); setArrivals([]);
      setDriverLocations({}); setOnlineDriverIds([]); setReassignPrompt(null);
      setHydrated(false);
      disconnectSocket();
      return;
    }

    if ('Notification' in window && window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {});
    }

    const token = getAuthToken();
    if (!token) return;
    const socket = connectSocket(token);

    socket.on('connect', () => { fetchAll().catch(() => {}); });

    socket.on('task:upsert', (raw: any) => {
      const task = mapTask(raw);
      const me = userRef.current;
      setTasks(p => {
        const existing = p.find(t => t.id === task.id);
        if (me && task.doctorId === me.id && existing && existing.status !== task.status) {
          const justAtGate = task.type === 'retrieve' && task.status === 'delivered';
          if (justAtGate) {
            ringAlarm();
            setActiveAlert({
              title: 'Car Ready at Gate',
              body: `${task.carNumber} has arrived — please collect it at the entrance.`,
              type: 'alarm',
              at: Date.now(),
            });
          } else {
            playChime();
          }
        }
        return upsertById(p, task);
      });
      if (task.driverId) {
        setReassignPrompt(prev => (prev?.kind === 'task' && prev.task?.id === task.id ? null : prev));
      }
    });

    socket.on('assignment:cancelled', () => {
      stopAlarm();
    });

    socket.on('visitor:upsert', (raw: any) => {
      const visitor = mapVisitor(raw);
      setVisitors(p => upsertById(p, visitor));
      if (visitor.driverId) {
        setReassignPrompt(prev => (prev?.kind === 'visitor' && prev.visitor?.id === visitor.id ? null : prev));
      }
    });

    socket.on('slot:patch', (slot: ParkingSlot) => {
      setSlots(p => upsertById(p, slot));
    });

    socket.on('driver:patch', (patch: Partial<Driver> & {id: number}) => {
      setDrivers(p => p.map(d => (d.id === patch.id ? {...d, ...patch} : d)));
    });

    socket.on('notification:new', (raw: any) => {
      const n = mapNotification(raw);
      setNotifs(p => (p.some(x => x.id === n.id) ? p : [n, ...p]));
      const me = userRef.current;
      const isForMe =
        n.targetId === me?.id ||
        (me?.linkedDriverId != null && n.targetId === me.linkedDriverId) ||
        n.targetRole === me?.role ||
        n.targetRole === `driver:${me?.linkedDriverId}` ||
        n.targetRole === 'all';
      if (!isForMe) return;
      // A reassign alert arrives twice: once as task:needs-reassign (the
      // in-app dialog) and once as this notification (which rings the
      // alarm). They land within milliseconds of each other, so a short
      // window is enough to tell "companion of the dialog" from "genuinely
      // new".
      if (Date.now() - reassignShownAt.current < 4000) return;
      if (n.type === 'alarm') {
        ringAlarm();
        setActiveAlert({title: n.title, body: n.body, type: 'alarm', at: Date.now()});
      } else {
        playChime();
      }
      displayBrowserNotification(n.title, n.body);
    });

    // ── live map feeds ──
    socket.on('presence:snapshot', ({driverIds}: {driverIds: number[]}) => {
      setOnlineDriverIds(driverIds);
      setDriverLocations(p => Object.fromEntries(Object.entries(p).filter(([id]) => driverIds.some(d => String(d) === id))));
    });

    socket.on('presence:driver', ({driverId, online}: {driverId: number; online: boolean}) => {
      setOnlineDriverIds(p => (online ? [...p.filter(id => id !== driverId), driverId] : p.filter(id => id !== driverId)));
      if (!online) {
        setDriverLocations(p => {
          const next = {...p};
          delete next[driverId];
          return next;
        });
      }
    });

    socket.on('driver:location', (loc: DriverLocation) => {
      setDriverLocations(p => ({...p, [loc.driverId]: loc}));
    });

    // A retrieval just became someone's alone. Anyone who isn't that valet
    // drops it.
    socket.on('task:restrict', ({id, ownerValetId}: {id: number; ownerValetId: number}) => {
      if (user.role !== 'valet' || user.id === ownerValetId) return;
      setTasks(p => p.filter(t => t.id !== id));
    });

    socket.on('task:recovery', ({task}: any) => {
      setTasks(p => upsertById(p, mapTask(task)));
    });

    socket.on('arrival:upsert', (raw: any) => {
      setArrivals(p => upsertById(p, mapArrival(raw)));
    });
    socket.on('arrival:remove', ({id}: {id: number}) => {
      setArrivals(p => p.filter(a => a.id !== id));
    });

    // ── accept-timeout / reject prompts (valet + admin rooms only) ──
    socket.on('task:needs-reassign', ({task, driverName, rejected}: any) => {
      const mapped = mapTask(task);
      setReassignPrompt(prev => {
        if (prev?.kind === 'task' && prev.task?.id === mapped.id) return prev;
        reassignShownAt.current = Date.now();
        return {kind: 'task', task: mapped, driverName, rejected};
      });
    });
    socket.on('visitor:needs-reassign', ({visitor, driverName, rejected}: any) => {
      const mapped = mapVisitor(visitor);
      setReassignPrompt(prev => {
        if (prev?.kind === 'visitor' && prev.visitor?.id === mapped.id) return prev;
        reassignShownAt.current = Date.now();
        return {kind: 'visitor', visitor: mapped, driverName, rejected};
      });
    });

    let cleanupPush: (() => void) | undefined;
    getSwRegistration().then(reg => initWebPush(reg)).then(fn => { cleanupPush = fn; }).catch(() => {});

    return () => {
      cleanupPush?.();
      stopAlarm();
      disconnectSocket();
    };
  }, [user?.id, fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // A reassign prompt says "this job needs a driver" — derived state, not a
  // one-shot event, so it clears itself the instant that's no longer true.
  useEffect(() => {
    if (!reassignPrompt) return;
    const stillNeedsDriver = reassignPrompt.kind === 'task'
      ? tasks.some(t => t.id === reassignPrompt.task?.id && !t.driverId)
      : visitors.some(v => v.id === reassignPrompt.visitor?.id && !v.driverId);
    if (!stillNeedsDriver) setReassignPrompt(null);
  }, [reassignPrompt, tasks, visitors]);

  // A GPS ping is authoritative about ONE thing: where the driver is. Only
  // the position fields are merged; the rest of the local record is left
  // alone (see mobile AppStateContext for why — same "hasn't moved, skip
  // the write" race).
  const reportLocation = useCallback(async (taskId: number, lat: number, lng: number) => {
    const fresh = mapTask(await tasksApi.updateLocation(taskId, lat, lng));
    setTasks(p => p.map(t => (t.id === taskId
      ? {...t,
         driverLat: fresh.driverLat,
         driverLng: fresh.driverLng,
         locationUpdatedAt: fresh.locationUpdatedAt,
         driverStartLat: t.driverStartLat ?? fresh.driverStartLat,
         driverStartLng: t.driverStartLng ?? fresh.driverStartLng,
         trackingProgress: fresh.trackingProgress ?? t.trackingProgress}
      : t)));
  }, []);

  // Single, centralized GPS watcher for the whole app — browser Geolocation
  // in place of react-native-geolocation-service. Runs for the entire
  // logged-in session for a driver (not just during a task): every fix is
  // pushed over the socket so the valet's live map shows all reachable
  // drivers; during an active trip the same fix additionally goes through
  // the REST location endpoint.
  const myDriverId = user?.role === 'driver' ? user.linkedDriverId ?? null : null;
  const activeDriverTask = myDriverId != null
    ? tasks.find(t => t.driverId != null && t.driverId === myDriverId
        && (t.status === 'key_collected' || t.status === 'in_transit'))
    : undefined;
  const activeDriverTaskId = activeDriverTask?.id;
  const activeDriverTaskIdRef = useRef(activeDriverTaskId);
  activeDriverTaskIdRef.current = activeDriverTaskId;

  useEffect(() => {
    if (user?.role !== 'driver') return;
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        emitDriverLocation(latitude, longitude);
        const taskId = activeDriverTaskIdRef.current;
        if (taskId) reportLocation(taskId, latitude, longitude).catch(() => {});
      },
      () => {},
      {enableHighAccuracy: true, maximumAge: 0, timeout: 15000},
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user?.role, user?.id, reportLocation]);

  // One immediate one-shot fix the moment tracking starts, rather than
  // waiting for the ambient watch's next callback — closes the gap the
  // doctor's live tracking screen sits in "Waiting for driver's location…"
  // for.
  useEffect(() => {
    if (user?.role !== 'driver' || !activeDriverTaskId) return;
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        emitDriverLocation(latitude, longitude);
        reportLocation(activeDriverTaskId, latitude, longitude).catch(() => {});
      },
      () => {},
      {enableHighAccuracy: true, timeout: 8000, maximumAge: 0},
    );
  }, [user?.role, activeDriverTaskId, reportLocation]);

  const addTask = useCallback(async (task: Omit<ParkingTask, 'id'>) => {
    const created = await tasksApi.create({
      type: task.type,
      doctorId: task.doctorId,
      carNumber: task.carNumber,
      slotId: task.slotId,
    });
    const mapped = mapTask(created);
    setTasks(p => (p.some(t => t.id === mapped.id) ? p : [...p, mapped]));
    return mapped.id;
  }, []);

  const requestRetrieval = useCallback(async (plannedDepartureMinutes: number) => {
    const created = mapTask(await tasksApi.requestRetrieval({plannedDepartureMinutes}));
    setTasks(p => upsertById(p, created));
    return created.id;
  }, []);

  const sendArrivalNotice = useCallback(async (eta: number) => {
    await arrivalsApi.create(eta);
  }, []);

  const dismissArrivalNotice = useCallback(async (id: number) => {
    await arrivalsApi.dismiss(id);
    setArrivals(p => p.filter(a => a.id !== id));
  }, []);

  const updateTask = useCallback(async (id: number, patch: Partial<ParkingTask>) => {
    if (patch.status === 'in_transit') {
      const updated = mapTask(await tasksApi.inTransit(id));
      setTasks(p => p.map(t => (t.id === id ? updated : t)));
      return;
    }
  }, []);

  const acceptRetrieval = useCallback(async (taskId: number) => {
    stopAlarm();
    const updated = mapTask(await tasksApi.acceptRetrieval(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
  }, []);

  const cancelMyRetrieval = useCallback(async (taskId: number) => {
    const updated = mapTask(await tasksApi.cancelMyRetrieval(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
  }, []);

  const assignDriver = useCallback(async (taskId: number, driverId: number) => {
    stopAlarm();
    const task = tasks.find(t => t.id === taskId);
    const coords = task?.type === 'retrieve' ? await getCurrentPositionSafe() : null;
    const updated = mapTask(await tasksApi.assignDriver(taskId, driverId, coords ? {lat: coords.lat, lng: coords.lng} : undefined));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
    setDrivers(p => p.map(d => (d.id === driverId ? {...d, status: 'busy', currentTaskId: taskId} : d)));
  }, [tasks]);

  const cancelTaskAssignment = useCallback(async (taskId: number) => {
    const freedDriverId = tasks.find(t => t.id === taskId)?.driverId;
    const updated = mapTask(await tasksApi.cancelAssignment(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
    if (freedDriverId != null) setDrivers(p => p.map(d => (d.id === freedDriverId ? {...d, status: 'available', currentTaskId: undefined} : d)));
  }, [tasks]);

  const acceptTask = useCallback(async (taskId: number) => {
    stopAlarm();
    const updated = mapTask(await tasksApi.accept(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
  }, []);

  const rejectTask = useCallback(async (taskId: number) => {
    stopAlarm();
    const updated = mapTask(await tasksApi.reject(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
    if (myDriverId != null) setDrivers(p => p.map(d => (d.id === myDriverId ? {...d, status: 'available', currentTaskId: undefined} : d)));
  }, [myDriverId]);

  const markKeyCollected = useCallback(async (taskId: number) => {
    stopAlarm();
    const updated = mapTask(await tasksApi.keyCollected(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
  }, []);

  const markParked = useCallback(async (taskId: number, slotId: string) => {
    stopAlarm();
    const updated = mapTask(await tasksApi.park(taskId, slotId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
    setSlots(p => p.map(s => (s.id === slotId
      ? {...s, status: 'occupied', taskId, carNumber: updated.carNumber, doctorId: updated.doctorId}
      : s)));
    if (updated.driverId) {
      setDrivers(p => p.map(d => (d.id === updated.driverId ? {...d, status: 'available', currentTaskId: undefined} : d)));
    }
  }, []);

  const markRetrieved = useCallback(async (taskId: number) => {
    stopAlarm();
    const existing = tasks.find(t => t.id === taskId);
    const updated = mapTask(await tasksApi.retrieve(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
    const freedSlotId = existing?.slotId ?? updated.slotId;
    if (freedSlotId) {
      setSlots(p => p.map(s => (s.id === freedSlotId
        ? {...s, status: 'free', taskId: undefined, carNumber: undefined, doctorId: undefined}
        : s)));
    }
    if (updated.driverId) {
      setDrivers(p => p.map(d => (d.id === updated.driverId ? {...d, status: 'available', currentTaskId: undefined} : d)));
    }
  }, [tasks]);

  const confirmTaskDelivered = useCallback(async (taskId: number) => {
    stopAlarm();
    const updated = mapTask(await tasksApi.confirmDelivered(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
  }, []);

  const cancelTask = useCallback(async (taskId: number) => {
    stopAlarm();
    const updated = mapTask(await tasksApi.cancel(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
  }, []);

  const recallTask = useCallback(async (taskId: number) => {
    const updated = mapTask(await tasksApi.recall(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
  }, []);

  const markTaskReturned = useCallback(async (taskId: number) => {
    stopAlarm();
    const updated = mapTask(await tasksApi.markReturned(taskId));
    setTasks(p => p.map(t => (t.id === taskId ? updated : t)));
  }, []);

  const fetchTaskHistory = useCallback(async (params?: {doctorId?: number; driverId?: number}) => {
    const rows = await tasksApi.history(params);
    return rows.map(mapTask);
  }, []);

  const setDriverStatus = useCallback(async (driverId: number, status: DriverStatus) => {
    const updated = await driversApi.setStatus(driverId, status);
    setDrivers(p => p.map(d => (d.id === driverId ? updated : d)));
  }, []);

  const addVisitor = useCallback(async (v: {name: string; carNumber?: string; mobile: string; vehicleType?: 'car' | 'bike'}) => {
    const created = mapVisitor(await visitorsApi.create(v));
    setVisitors(p => upsertById(p, created));
    return created;
  }, []);

  const assignVisitorDriver = useCallback(async (visitorId: number, driverId: number) => {
    stopAlarm();
    const updated = mapVisitor(await visitorsApi.assignDriver(visitorId, driverId));
    setVisitors(p => p.map(v => (v.id === visitorId ? updated : v)));
    setDrivers(p => p.map(d => (d.id === driverId ? {...d, status: 'busy', currentTaskId: visitorId} : d)));
  }, []);

  const cancelVisitorAssignment = useCallback(async (visitorId: number) => {
    const freedDriverId = visitors.find(v => v.id === visitorId)?.driverId;
    const updated = mapVisitor(await visitorsApi.cancelAssignment(visitorId));
    setVisitors(p => p.map(v => (v.id === visitorId ? updated : v)));
    if (freedDriverId != null) setDrivers(p => p.map(d => (d.id === freedDriverId ? {...d, status: 'available', currentTaskId: undefined} : d)));
  }, [visitors]);

  const cancelVisitor = useCallback(async (visitorId: number, reason: 'no_show' | 'valet_cancelled' | 'parking_failed') => {
    const existing = visitors.find(v => v.id === visitorId);
    const updated = mapVisitor(await visitorsApi.cancel(visitorId, reason));
    setVisitors(p => p.map(v => (v.id === visitorId ? updated : v)));
    const driverId = existing?.driverId;
    if (driverId) setDrivers(p => p.map(d => (d.id === driverId ? {...d, status: 'available', currentTaskId: undefined} : d)));
  }, [visitors]);

  const assignRetrievalDriver = useCallback(async (visitorId: number, driverId: number) => {
    stopAlarm();
    const updated = mapVisitor(await visitorsApi.assignRetrievalDriver(visitorId, driverId));
    setVisitors(p => p.map(v => (v.id === visitorId ? updated : v)));
    setDrivers(p => p.map(d => (d.id === driverId ? {...d, status: 'busy', currentTaskId: visitorId} : d)));
  }, []);

  const assignStaffRetrievalDriver = useCallback(async (doctorId: number, driverId: number) => {
    stopAlarm();
    const coords = await getCurrentPositionSafe();
    const updated = mapTask(await tasksApi.assignRetrievalDriverForDoctor(
      doctorId, driverId, coords ? {lat: coords.lat, lng: coords.lng} : undefined,
    ));
    setTasks(p => upsertById(p, updated));
    setDrivers(p => p.map(d => (d.id === driverId ? {...d, status: 'busy', currentTaskId: updated.id} : d)));
  }, []);

  const confirmVisitorDelivered = useCallback(async (visitorId: number) => {
    stopAlarm();
    const updated = mapVisitor(await visitorsApi.confirmDelivered(visitorId));
    setVisitors(p => p.map(v => (v.id === visitorId ? updated : v)));
  }, []);

  const pushNotification = useCallback(async (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const created = mapNotification(
      await notificationsApi.push({targetRole: n.targetRole, targetId: n.targetId, title: n.title, body: n.body, type: n.type}),
    );
    setNotifs(p => (p.some(x => x.id === created.id) ? p : [created, ...p]));
  }, []);

  const markNotificationRead = useCallback(async (id: number) => {
    const updated = mapNotification(await notificationsApi.markRead(id));
    setNotifs(p => p.map(n => (n.id === id ? updated : n)));
  }, []);

  const clearNotifications = useCallback(() => setNotifs([]), []);

  return (
    <Ctx.Provider value={{
      drivers, tasks, slots, visitors, arrivalNotices, notifications, activeAlert, hydrated,
      driverLocations, onlineDriverIds, reassignPrompt, clearReassignPrompt, dismissAlert,
      addTask, requestRetrieval, cancelMyRetrieval, sendArrivalNotice, acceptRetrieval, dismissArrivalNotice, updateTask,
      assignDriver, cancelTaskAssignment, acceptTask, rejectTask, markKeyCollected, markParked, markRetrieved,
      confirmTaskDelivered, cancelTask, recallTask, markTaskReturned, fetchTaskHistory, reportLocation,
      setDriverStatus, addVisitor,
      assignVisitorDriver, cancelVisitorAssignment, cancelVisitor,
      assignRetrievalDriver, assignStaffRetrievalDriver, confirmVisitorDelivered,
      pushNotification, markNotificationRead, clearNotifications, refreshTasks: fetchAll,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() { return useContext(Ctx); }
