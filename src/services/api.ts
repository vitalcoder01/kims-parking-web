import axios, {AxiosError, AxiosInstance} from 'axios';
import {API_BASE_URL} from '../config/api';

// Direct port of the mobile app's services/api.ts — same endpoints, same
// backend, same conditional-GET ETag cache.
const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {'Content-Type': 'application/json'},
  validateStatus: status => (status >= 200 && status < 300) || status === 304,
});

const etagCache = new Map<string, {etag: string; data: unknown}>();

function conditionalGetKey(config: {method?: string; url?: string; params?: unknown}): string | null {
  if ((config.method ?? 'get').toLowerCase() !== 'get') return null;
  return `${config.url ?? ''}?${JSON.stringify(config.params ?? {})}`;
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

client.interceptors.request.use(config => {
  if (authToken) {
    config.headers = config.headers ?? ({} as any);
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  const key = conditionalGetKey(config);
  const cached = key ? etagCache.get(key) : undefined;
  if (cached) {
    config.headers = config.headers ?? ({} as any);
    config.headers['If-None-Match'] = cached.etag;
  }
  return config;
});

client.interceptors.response.use(
  res => {
    const key = conditionalGetKey(res.config);
    if (!key) return res;

    if (res.status === 304) {
      const cached = etagCache.get(key);
      if (cached) res.data = cached.data;
      return res;
    }

    const etag = res.headers?.etag ?? (res.headers as any)?.ETag;
    if (etag) etagCache.set(key, {etag, data: res.data});
    return res;
  },
  (error: AxiosError<{error?: {message?: string}}>) => {
    const status = error.response?.status;
    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (status === 401 && !isLoginCall) {
      onUnauthorized?.();
    }
    const message = error.response?.data?.error?.message ?? error.message ?? 'Network error';
    return Promise.reject(new Error(message));
  },
);

// ── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    client.post('/auth/login', {username, password}).then(r => r.data as {token: string; user: any}),
  register: (name: string, phone: string, password: string) =>
    client.post('/auth/register', {name, phone, password}).then(r => r.data as {token: string; user: any}),
  me: () => client.get('/auth/me').then(r => r.data.user),
};

// ── Users ────────────────────────────────────────────────────────────────
export const usersApi = {
  lookupByCardCode: (code: string) =>
    client.get(`/users/by-card/${code}`).then(r => r.data.user),
  updateMe: (patch: {carNumber?: string; phone?: string; carModel?: string; carColor?: string; vehicleType?: 'car' | 'bike'}) =>
    client.patch('/users/me', patch).then(r => r.data.user),
  updateMyDesignation: (role: 'doctor' | 'staff') =>
    client.patch('/users/me/designation', {role}).then(r => r.data.user),
};

// ── Tasks ────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: {doctorId?: number; driverId?: number; status?: string; type?: string}) =>
    client.get('/tasks', {params}).then(r => r.data.tasks),
  // Full past-sessions log — bypasses the isCurrent filter the live-board
  // `list()` call uses, so this returns everything ever, not just whatever's
  // currently active.
  history: (params?: {doctorId?: number; driverId?: number}) =>
    client.get('/tasks', {params: {...params, history: true}}).then(r => r.data.tasks),
  get: (id: number) => client.get(`/tasks/${id}`).then(r => r.data.task),
  // plannedDepartureMinutes: 0 | 15 | 30 | custom — when the doctor intends
  // to leave. Planning info for the valet team, never rendered back as an
  // arrival ETA. The retrieval's actual destination now comes from the
  // assigning valet's own live GPS (captured at assign time), so no
  // doctor-side location is sent here any more.
  requestRetrieval: (data: {plannedDepartureMinutes: number}) =>
    client.post('/tasks/request-retrieval', data).then(r => r.data.task),
  cancelMyRetrieval: (id: number) =>
    client.patch(`/tasks/${id}/cancel-my-retrieval`).then(r => r.data.task),
};

// ── Arrival notices ─────────────────────────────────────────────────────
// Doctor/staff "I'm on my way" notice — valet-facing only, not a
// ParkingTask. Only `create` is needed here; list/dismiss are valet-only.
export const arrivalsApi = {
  create: (eta: number) => client.post('/arrivals', {eta}).then(r => r.data.arrival),
};

// ── Slots ────────────────────────────────────────────────────────────────
export const slotsApi = {
  list: (params?: {status?: string; block?: string}) =>
    client.get('/slots', {params}).then(r => r.data.slots),
  occupancy: () => client.get('/slots/occupancy').then(r => r.data),
};

// ── Notifications ────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => client.get('/notifications').then(r => r.data.notifications),
  push: (data: {targetRole: string; targetId?: number; title: string; body: string; type?: string}) =>
    client.post('/notifications', data).then(r => r.data.notification),
  markRead: (id: number) =>
    client.patch(`/notifications/${id}/read`).then(r => r.data.notification),
  // FCM token registration — lets pushes reach this browser even when the
  // web app isn't open (same endpoint the mobile app uses).
  registerDevice: (token: string, platform = 'web') =>
    client.post('/notifications/register-device', {token, platform}).then(() => undefined),
  // Called on logout so this browser stops receiving the signed-out
  // account's pushes instead of staying bound to it until someone else
  // logs in here (same endpoint/behavior as the mobile app).
  unregisterDevice: (token: string) =>
    client.post('/notifications/unregister-device', {token}).then(() => undefined),
};

// ── Drivers ──────────────────────────────────────────────────────────────
export const driversApi = {
  list: (params?: {status?: string}) =>
    client.get('/drivers', {params}).then(r => r.data.drivers),
};

// ── Admin ────────────────────────────────────────────────────────────────
/** The admin-tunable operational knobs. Mirrors DEFAULTS in setting.service.js. */
export interface OpsSettings {
  /** Seconds a driver has to accept before the valet is asked to reassign. */
  driverAcceptTimeoutSeconds: string;
  /** Seconds the owning valet has to respond before recovery releases it. */
  ownerResponseTimeoutSeconds: string;
  /** How far ahead of a planned departure the retrieval becomes actionable. */
  retrievalLeadTimeMinutes: string;
}

export const adminApi = {
  dashboard: () => client.get('/admin/dashboard').then(r => r.data),
  listUsers: () => client.get('/admin/users').then(r => r.data.users),
  createUser: (data: {
    employeeId: string; name: string; role: 'doctor' | 'staff' | 'valet' | 'driver' | 'admin';
    password: string; department?: string; cardCode?: string; phone?: string; carNumber?: string;
  }) => client.post('/admin/users', data).then(r => r.data.user),
  updateUser: (id: number, patch: {
    name?: string; role?: 'doctor' | 'staff' | 'valet' | 'driver' | 'admin';
    department?: string; cardCode?: string; phone?: string; carNumber?: string;
  }) => client.patch(`/admin/users/${id}`, patch).then(r => r.data.user),
  resetPassword: (id: number, password: string) =>
    client.patch(`/admin/users/${id}/password`, {password}).then(r => r.data),
  deleteUser: (id: number) => client.delete(`/admin/users/${id}`).then(() => undefined),
  getSettings: () => client.get('/admin/settings').then(r => r.data.settings as OpsSettings),
  updateSettings: (patch: Partial<Record<keyof OpsSettings, number | string>>) =>
    client.patch('/admin/settings', patch).then(r => r.data.settings as OpsSettings),
  attendanceToday: () => client.get('/admin/attendance/today').then(r => r.data.attendance),
  attendanceMonthly: (month: string) =>
    client.get('/admin/attendance/monthly', {params: {month}}).then(r => r.data as {
      month: string;
      users: {userId: number; name: string; role: string; employeeId: string; days: {date: string; checkIn: string | null; checkOut: string | null; vehiclesHandled: number}[]}[];
    }),
};

export default client;
