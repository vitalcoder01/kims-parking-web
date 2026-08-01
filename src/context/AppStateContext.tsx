import React, {createContext, useContext, useState, useCallback, useEffect, useRef} from 'react';
import {tasksApi, slotsApi, notificationsApi, arrivalsApi, getAuthToken} from '../services/api';
import {connectSocket, disconnectSocket} from '../services/socket';
import {ringAlarm, stopAlarm, playChime} from '../services/alarm';
import {initWebPush} from '../services/webPush';
import {getSwRegistration} from '../services/swRegistration';
import {useAuth} from './AuthContext';

// Doctor/staff slice of the mobile app's AppStateContext — same wire-format
// mappers, same socket delta events, same "fetch on connect, patch on
// event" sync model. Ops-only data (drivers roster, visitors) is never
// fetched here, exactly like the mobile app skips it for these roles.

export type TaskType = 'park' | 'retrieve';
export type TaskStatus = 'requested' | 'assigned' | 'key_collected' | 'in_transit' | 'delivered' | 'completed' | 'cancelled';
export type SlotStatus = 'free' | 'occupied' | 'reserved';

export interface ParkingTask {
  id: number;
  type: TaskType;
  doctorId: number;
  doctorName: string;
  carNumber: string;
  slotId?: string; // human-readable code, e.g. "A-001"
  driverId?: number;
  driverName?: string;
  status: TaskStatus;
  requestedAt?: number;
  assignedAt?: number;
  acceptedAt?: number;
  // When the driver actually set off — the trip clock anchors here; the
  // doctor's planned departure anchors to requestedAt (see retrievalClocks).
  startedAt?: number;
  keyCollectedAt?: number;
  completedAt?: number;
  eta?: number; // minutes (legacy; superseded by plannedDepartureMinutes)
  // The doctor's planned departure in minutes (0 = now). Valet-side planning
  // information only — never rendered to the doctor as an ETA.
  plannedDepartureMinutes?: number;
  // Absolute departure time, and when the request becomes actionable
  // (departure minus the configured lead time). Before readyAt the request
  // is SCHEDULED: informational only, no actions.
  plannedDepartureAt?: number;
  retrievalReadyAt?: number;
  trackingProgress?: number; // 0-1
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

export interface ActiveAlert {
  title: string;
  body: string;
  type: 'alarm' | 'info' | 'warning';
  at: number;
}

interface AppState {
  tasks: ParkingTask[];
  slots: ParkingSlot[];
  notifications: Notification[];
  activeAlert: ActiveAlert | null;
  hydrated: boolean;
  dismissAlert: () => void;
  fetchTaskHistory: (params?: {doctorId?: number}) => Promise<ParkingTask[]>;
  requestRetrieval: (plannedDepartureMinutes: number) => Promise<number>;
  cancelMyRetrieval: (taskId: number) => Promise<void>;
  sendArrivalNotice: (eta: number) => Promise<void>;
  pushNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  markNotificationRead: (id: number) => Promise<void>;
}

const Ctx = createContext<AppState>({} as AppState);

// ── wire-format -> app-shape mappers (timestamps ISO -> epoch ms) ───────
function toEpoch(v: unknown): number | undefined {
  if (!v) return undefined;
  const t = new Date(v as string).getTime();
  return Number.isNaN(t) ? undefined : t;
}

function mapTask(t: any): ParkingTask {
  return {
    ...t,
    requestedAt: toEpoch(t.requestedAt),
    assignedAt: toEpoch(t.assignedAt),
    acceptedAt: toEpoch(t.acceptedAt),
    startedAt: toEpoch(t.startedAt),
    keyCollectedAt: toEpoch(t.keyCollectedAt),
    completedAt: toEpoch(t.completedAt),
    plannedDepartureAt: toEpoch(t.plannedDepartureAt),
    retrievalReadyAt: toEpoch(t.retrievalReadyAt),
    locationUpdatedAt: toEpoch(t.locationUpdatedAt),
  };
}

function mapNotification(n: any): Notification {
  return {...n, createdAt: toEpoch(n.createdAt) ?? Date.now()};
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
  const [tasks, setTasks]          = useState<ParkingTask[]>([]);
  const [slots, setSlots]          = useState<ParkingSlot[]>([]);
  const [notifications, setNotifs] = useState<Notification[]>([]);
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const dismissAlert = useCallback(() => {
    stopAlarm();
    setActiveAlert(null);
  }, []);

  const fetchAll = useCallback(async () => {
    const [t, s, n] = await Promise.all([
      tasksApi.list(),
      slotsApi.list(),
      notificationsApi.list(),
    ]);
    setTasks(t.map(mapTask));
    setSlots(s);
    setNotifs(n.map(mapNotification));
    setHydrated(true);
  }, []);

  const userRef = useRef(user);
  userRef.current = user;

  // ── True-WebSocket sync — full fetch on connect/reconnect, deltas after.
  useEffect(() => {
    if (!user) {
      // A still-ringing alarm (siren + red banner) otherwise keeps going
      // over the login screen after logout — nothing else dismisses it,
      // since its state was independent of auth state.
      stopAlarm();
      setActiveAlert(null);
      setTasks([]); setSlots([]); setNotifs([]);
      setHydrated(false);
      disconnectSocket();
      return;
    }

    // Ask once for browser notification permission so assignment/status
    // pushes still reach a backgrounded tab.
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
        // The loud alarm (siren + red banner) is reserved for exactly one
        // moment, nothing else — not task creation, not driver assigned,
        // not key collected, not in transit, and NOT the car getting
        // parked (the doctor is already on-site when that happens, so
        // there's nothing for them to act on): only when a retrieval
        // arrives at the gate (status 'delivered' on a 'retrieve' task —
        // the driver's brought it to the entrance; not yet valet-confirmed,
        // but that's exactly "come get it now", the one moment the doctor
        // actually needs to go outside and act).
        // Requires an actual STATUS TRANSITION (existing status differed),
        // not just this task appearing/being upserted, so a page reload or
        // reconnect fetch replaying an already-settled task never re-rings.
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
            // Any other status movement (assigned / key collected / in
            // transit) — a gentle chime only, never the siren.
            playChime();
          }
        }
        return upsertById(p, task);
      });
    });

    socket.on('slot:patch', (slot: ParkingSlot) => {
      setSlots(p => upsertById(p, slot));
    });

    socket.on('notification:new', (raw: any) => {
      const n = mapNotification(raw);
      setNotifs(p => (p.some(x => x.id === n.id) ? p : [n, ...p]));
      const me = userRef.current;
      const isForMe =
        n.targetId === me?.id ||
        n.targetRole === me?.role ||
        n.targetRole === 'all';
      if (!isForMe) return;
      // Alarm-grade notifications ring loud + raise the in-app banner;
      // everything else gets a chime + tray notification (same split as the
      // mobile app's notification:new handler).
      if (n.type === 'alarm') {
        ringAlarm();
        setActiveAlert({title: n.title, body: n.body, type: 'alarm', at: Date.now()});
      } else {
        playChime();
      }
      displayBrowserNotification(n.title, n.body);
    });

    // FCM device registration — pushes reach this browser even with the app
    // closed once the Firebase web credentials are configured.
    let cleanupPush: (() => void) | undefined;
    getSwRegistration().then(reg => initWebPush(reg)).then(fn => { cleanupPush = fn; }).catch(() => {});

    return () => {
      cleanupPush?.();
      stopAlarm();
      disconnectSocket();
    };
  }, [user?.id, fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTaskHistory = useCallback(async (params?: {doctorId?: number}) => {
    const rows = await tasksApi.history(params);
    return rows.map(mapTask);
  }, []);

  const pushNotification = useCallback(async (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const created = mapNotification(
      await notificationsApi.push({targetRole: n.targetRole, targetId: n.targetId, title: n.title, body: n.body, type: n.type}),
    );
    setNotifs(p => (p.some(x => x.id === created.id) ? p : [created, ...p]));
  }, []);

  // Doctor/staff only. The retrieval's destination is no longer captured
  // from the doctor's own device — it now comes from the assigning valet's
  // live GPS at the moment they pick a driver (matching the backend and the
  // mobile app), so this just sends the planned-departure minutes and lets
  // the server create the task.
  const requestRetrieval = useCallback(async (plannedDepartureMinutes: number) => {
    const created = mapTask(await tasksApi.requestRetrieval({plannedDepartureMinutes}));
    setTasks(p => [created, ...p]);
    await pushNotification({
      targetRole: 'valet',
      title: `🚗 Retrieval Requested — ${created.doctorName ?? ''}`,
      body: `Leaving ${plannedDepartureMinutes <= 0 ? 'now' : `in ${plannedDepartureMinutes} min`}. Please plan to bring ${created.carNumber} from ${created.slotId ?? 'its slot'}.`,
      type: 'info',
    }).catch(() => {});
    return created.id;
  }, [pushNotification]);

  // Calling off a departure. The backend refuses once the driver has
  // actually set off — at that point the car is out of its slot and
  // "cancel" would describe nothing real.
  const cancelMyRetrieval = useCallback(async (taskId: number) => {
    const updated = mapTask(await tasksApi.cancelMyRetrieval(taskId));
    setTasks(p => upsertById(p, updated));
  }, []);

  // Doctor/staff "I'm on my way" notice — valet-facing only, no ParkingTask
  // created yet. No notification pushed from here: an arrival is not work,
  // it's a heads-up, and the valet queue picks it up over the socket delta.
  const sendArrivalNotice = useCallback(async (eta: number) => {
    await arrivalsApi.create(eta);
  }, []);

  const markNotificationRead = useCallback(async (id: number) => {
    const updated = mapNotification(await notificationsApi.markRead(id));
    setNotifs(p => p.map(n => (n.id === id ? updated : n)));
  }, []);

  return (
    <Ctx.Provider value={{tasks, slots, notifications, activeAlert, hydrated, dismissAlert, fetchTaskHistory, requestRetrieval, cancelMyRetrieval, sendArrivalNotice, pushNotification, markNotificationRead}}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() { return useContext(Ctx); }
