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

/** Error thrown by every API call — carries the server's machine-readable code. */
export class ApiCallError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiCallError';
    this.code = code;
    this.status = status;
  }
}

/** True when a call failed because the job it targeted moved on (taken,
 * vanished, or finished) before the request landed — see ValetHomeScreen for
 * the three ways that happens. */
export const isJobGone = (err: unknown) =>
  err instanceof ApiCallError && err.code === 'JOB_GONE';

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
  (error: AxiosError<{error?: {message?: string; code?: string}}>) => {
    const status = error.response?.status;
    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (status === 401 && !isLoginCall) {
      onUnauthorized?.();
    }
    const message = error.response?.data?.error?.message ?? error.message ?? 'Network error';
    // Carry the server's machine-readable code through. Callers that only
    // read `.message` are unaffected; the ones that need to branch on WHICH
    // conflict happened (e.g. isJobGone) now can, without string-matching
    // copy that gets reworded.
    return Promise.reject(new ApiCallError(message, error.response?.data?.error?.code, status));
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
  // Every field optional — server only updates what's present, so an
  // "edit name" flow sends just {name}. Server does the real validation.
  updateMe: (patch: {carNumber?: string; phone?: string; carModel?: string; carColor?: string; vehicleType?: 'car' | 'bike'; name?: string; username?: string}) =>
    client.patch('/users/me', patch).then(r => r.data.user),
  updateMyDesignation: (role: 'doctor' | 'staff') =>
    client.patch('/users/me/designation', {role}).then(r => r.data.user),
  // Password change: always requires the current password, always its own
  // call (never bundled with updateMe) so the security guarantee cannot
  // be skipped by accident. Nothing returned on success.
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    client.post('/users/me/password', {currentPassword, newPassword}).then(() => undefined),
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
  create: (data: {type: 'park' | 'retrieve'; doctorId: number; carNumber: string; slotId?: string}) =>
    client.post('/tasks', data).then(r => r.data.task),
  // plannedDepartureMinutes: 0 | 15 | 30 | custom — when the doctor intends
  // to leave. Planning info for the valet team, never rendered back as an
  // arrival ETA. The retrieval's actual destination now comes from the
  // assigning valet's own live GPS (captured at assign time), so no
  // doctor-side location is sent here any more.
  requestRetrieval: (data: {plannedDepartureMinutes: number}) =>
    client.post('/tasks/request-retrieval', data).then(r => r.data.task),
  cancelMyRetrieval: (id: number) =>
    client.patch(`/tasks/${id}/cancel-my-retrieval`).then(r => r.data.task),
  // lat/lng (optional): the valet's own live location at the moment of
  // assignment — for a retrieve task this becomes its destination.
  assignDriver: (id: number, driverId: number, coords?: {lat: number; lng: number}) =>
    client.patch(`/tasks/${id}/assign`, {driverId, lat: coords?.lat, lng: coords?.lng}).then(r => r.data.task),
  assignRetrievalDriverForDoctor: (doctorId: number, driverId: number, coords?: {lat: number; lng: number}) =>
    client.patch(`/tasks/doctor/${doctorId}/assign-retrieval`, {driverId, lat: coords?.lat, lng: coords?.lng}).then(r => r.data.task),
  cancelAssignment: (id: number) =>
    client.patch(`/tasks/${id}/cancel-assignment`).then(r => r.data.task),
  accept: (id: number) =>
    client.patch(`/tasks/${id}/accept`).then(r => r.data.task),
  reject: (id: number) =>
    client.patch(`/tasks/${id}/reject`).then(r => r.data.task),
  keyCollected: (id: number) =>
    client.patch(`/tasks/${id}/key-collected`).then(r => r.data.task),
  inTransit: (id: number) =>
    client.patch(`/tasks/${id}/in-transit`).then(r => r.data.task),
  park: (id: number, slotId: string) =>
    client.patch(`/tasks/${id}/park`, {slotId}).then(r => r.data.task),
  retrieve: (id: number) =>
    client.patch(`/tasks/${id}/retrieve`).then(r => r.data.task),
  confirmDelivered: (id: number) =>
    client.patch(`/tasks/${id}/confirm-delivered`).then(r => r.data.task),
  cancel: (id: number) =>
    client.patch(`/tasks/${id}/cancel`).then(r => r.data.task),
  // Valet: close a parked session whose car already left without anyone
  // requesting a retrieval — frees the slot it was holding.
  closeParked: (id: number) =>
    client.patch(`/tasks/${id}/close-parked`).then(r => r.data.task),
  acceptRetrieval: (id: number) =>
    client.patch(`/tasks/${id}/accept-retrieval`).then(r => r.data.task),
  // Valet dismissed a reassign prompt ("Later") without picking a driver —
  // tells the server this valet has seen it, so the recovery sweep doesn't
  // keep treating the job as unattended and pulling in every other valet.
  acknowledge: (id: number) =>
    client.patch(`/tasks/${id}/acknowledge`).then(() => undefined),
  // "Later" on the repeating driver-reminder prompt — stops it permanently
  // for this ticket (see backend driverReminder.js), unlike acknowledge
  // above which only defers the one-time escalation prompt.
  silenceDriverReminder: (id: number) =>
    client.patch(`/tasks/${id}/silence-driver-reminder`).then(() => undefined),
  // Valet: abort a park job the driver is already out on — brings the car
  // back to the counter instead of parking it.
  recall: (id: number) =>
    client.patch(`/tasks/${id}/recall`).then(r => r.data.task),
  // Driver: "car returned to the valet counter" after a recall.
  markReturned: (id: number) =>
    client.patch(`/tasks/${id}/returned`).then(r => r.data.task),
  updateLocation: (id: number, lat: number, lng: number) =>
    client.patch(`/tasks/${id}/location`, {lat, lng}).then(r => r.data.task),
};

// ── Visitors ─────────────────────────────────────────────────────────────
export const visitorsApi = {
  suggestPlates: (q: string) =>
    client.get('/visitors/plate-suggest', {params: {q}}).then(r => r.data.plates as string[]),
  list: () => client.get('/visitors').then(r => r.data.visitors),
  // Calendar-wise records view — every visitor checked in on that local
  // calendar day (any status), unbounded by the live list's 24h/active-only
  // window. `date` is 'YYYY-MM-DD'.
  // Inclusive [from, to] calendar range — backs the records tab's date
  // scopes (a single picked day is just from === to).
  byRange: (from: string, to?: string) =>
    client.get('/visitors', {params: {from, to: to ?? from}}).then(r => r.data.visitors),
  create: (data: {name: string; carNumber?: string; mobile: string; vehicleType?: 'car' | 'bike'}) =>
    client.post('/visitors', data).then(r => r.data.visitor),
  assignDriver: (id: number, driverId: number) =>
    client.patch(`/visitors/${id}/assign`, {driverId}).then(r => r.data.visitor),
  cancelAssignment: (id: number) =>
    client.patch(`/visitors/${id}/cancel-assignment`).then(r => r.data.visitor),
  cancel: (id: number, reason: 'no_show' | 'valet_cancelled' | 'parking_failed') =>
    client.patch(`/visitors/${id}/cancel`, {reason}).then(r => r.data.visitor),
  // "Bring my car back" — the key's already with a driver, so this isn't a
  // cancel/no-show anymore. See backend visitor.service.js's recallVisitor.
  recall: (id: number) =>
    client.patch(`/visitors/${id}/recall`).then(r => r.data.visitor),
  assignRetrievalDriver: (id: number, driverId: number) =>
    client.patch(`/visitors/${id}/assign-retrieval`, {driverId}).then(r => r.data.visitor),
  confirmDelivered: (id: number) =>
    client.patch(`/visitors/${id}/confirm-delivered`).then(r => r.data.visitor),
};

// ── Arrival notices ─────────────────────────────────────────────────────
// Doctor/staff "I'm on my way" notice — valet-facing only, not a
// ParkingTask.
export const arrivalsApi = {
  create: (eta: number) => client.post('/arrivals', {eta}).then(r => r.data.arrival),
  list: () => client.get('/arrivals').then(r => r.data.arrivals),
  dismiss: (id: number) => client.patch(`/arrivals/${id}/dismiss`).then(r => r.data.arrival),
  // The caller's own still-open heads-up, or null. Doctor/staff only.
  mine: () => client.get('/arrivals/mine').then(r => r.data.arrival),
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
  setStatus: (id: number, status: 'available' | 'busy' | 'off') =>
    client.patch(`/drivers/${id}/status`, {status}).then(r => r.data.driver),
};

// ── Admin ────────────────────────────────────────────────────────────────
/** The admin-tunable operational knobs. Mirrors DEFAULTS in setting.service.js. */
export interface OpsSettings {
  /** Seconds a driver has to accept before the valet is asked to reassign. */
  driverAcceptTimeoutSeconds: string;
  /** Seconds the owning valet has to respond before recovery releases it. */
  ownerResponseTimeoutSeconds: string;
  /** How far ahead of a planned departure the owning valet is auto-alerted (a valet can still assign early). */
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

// ── Analytics (valet + admin) ───────────────────────────────────────────
export type DriverAnalytics = {
  id: number; name: string;
  parksCompleted: number; retrievesCompleted: number; totalCompleted: number;
  avgParkMinutes: number | null; avgRetrieveMinutes: number | null;
};
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';
export type BlockUtilization = {block: string; count: number};
export type AnalyticsTrend = {labels: string[]; park: number[]; retrieve: number[]};
export type AnalyticsOverview = {
  totalCarsParked: number; totalCarsRetrieved: number; totalJobsCompleted: number;
  avgParkMinutes: number | null; avgRetrieveMinutes: number | null;
  busiestHour: number | null;
  hourlyDistribution: number[];
  blockUtilization: BlockUtilization[];
  // null only for period 'all' — see backend analytics.service.js trendBuckets.
  trend: AnalyticsTrend | null;
  visitorJobs: number; staffJobs: number;
  drivers: DriverAnalytics[];
  generatedAt: string;
  period: AnalyticsPeriod;
};
export const analyticsApi = {
  // period omitted (or 'all') is the original all-time overview — same
  // response shape either way, just scoped to completedAt falling in the
  // period when one is given (see backend analytics.controller.js).
  overview: (period?: AnalyticsPeriod): Promise<AnalyticsOverview> =>
    client.get('/analytics/overview', {params: period && period !== 'all' ? {period} : undefined}).then(r => r.data),
};

export default client;
