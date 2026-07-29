import React, {createContext, useContext, useState, useCallback, useEffect, useRef} from 'react';
import {tasksApi, slotsApi, notificationsApi, getAuthToken} from '../services/api';
import {connectSocket, disconnectSocket} from '../services/socket';
import {getCurrentPositionSafe} from '../utils/location';
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
  keyCollectedAt?: number;
  completedAt?: number;
  eta?: number; // minutes
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
  dismissAlert: () => void;
  fetchTaskHistory: (params?: {doctorId?: number}) => Promise<ParkingTask[]>;
  requestRetrieval: (eta: number) => Promise<number>;
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
    keyCollectedAt: toEpoch(t.keyCollectedAt),
    completedAt: toEpoch(t.completedAt),
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
        // The loud alarm (siren + red banner) is reserved for exactly two
        // moments, nothing else — not task creation, not driver assigned,
        // not key collected, not in transit:
        //   1. The car got parked (driver marks it parked → status
        //      'completed' on a 'park' task).
        //   2. After a retrieval, the car is at the gate (status
        //      'delivered' on a 'retrieve' task — the driver's brought it
        //      to the entrance; not yet valet-confirmed, but that's exactly
        //      "come get it now").
        // Requires an actual STATUS TRANSITION (existing status differed),
        // not just this task appearing/being upserted, so a page reload or
        // reconnect fetch replaying an already-settled task never re-rings.
        if (me && task.doctorId === me.id && existing && existing.status !== task.status) {
          const justParked = task.type === 'park' && task.status === 'completed';
          const justAtGate = task.type === 'retrieve' && task.status === 'delivered';
          if (justParked || justAtGate) {
            ringAlarm();
            setActiveAlert({
              title: justParked ? 'Car Parked' : 'Car Ready at Gate',
              body: justParked
                ? `${task.carNumber} has been safely parked${task.slotId ? ` at slot ${task.slotId}` : ''}.`
                : `${task.carNumber} has arrived — please collect it at the entrance.`,
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

  // Doctor/staff only — the real destination is wherever THIS device is
  // right now, since that's who the driver is bringing the car back to.
  const requestRetrieval = useCallback(async (eta: number) => {
    const here = await getCurrentPositionSafe();
    const created = mapTask(await tasksApi.requestRetrieval({eta, destinationLat: here?.lat, destinationLng: here?.lng}));
    setTasks(p => [created, ...p]);
    await pushNotification({
      targetRole: 'valet',
      title: `🚗 Retrieval Requested — ${created.doctorName ?? ''}`,
      body: `Leaving in ${eta} min. Please assign a driver to bring ${created.carNumber} from ${created.slotId ?? 'its slot'}.`,
      type: 'info',
    }).catch(() => {});
    return created.id;
  }, [pushNotification]);

  const markNotificationRead = useCallback(async (id: number) => {
    const updated = mapNotification(await notificationsApi.markRead(id));
    setNotifs(p => p.map(n => (n.id === id ? updated : n)));
  }, []);

  return (
    <Ctx.Provider value={{tasks, slots, notifications, activeAlert, dismissAlert, fetchTaskHistory, requestRetrieval, pushNotification, markNotificationRead}}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() { return useContext(Ctx); }
