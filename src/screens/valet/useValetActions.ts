import {useAppState, Visitor, ParkingTask} from '../../context/AppStateContext';
import {useAuth} from '../../context/AuthContext';

// Shared valet data + mutations, used by the Queue/Records/Map screens (web
// port of the mobile app's identically-named hook) so none of them
// re-derive the same filters or duplicate the assign/notify logic.
// Mirrors isVisibleToValet() in the backend's task.service.js.
export function isMyRetrieval(t: ParkingTask, myValetId: number | null | undefined): boolean {
  const owner = t.retrievalOwnerValetId ?? t.arrivalOwnerValetId;
  if (owner == null) return true;
  if (owner === myValetId) return true;
  if (t.retrievalOwnerValetId != null) return t.escalatedAt != null;
  return t.recoveryBroadcastAt != null || t.escalatedAt != null;
}

// Which side of the Job Queue split a job falls on — see the mobile hook
// for the full reasoning behind "mine to run" being wider than "I own it".
export function isMyJobToRun(t: ParkingTask, myValetId: number | null | undefined): boolean {
  if (t.valetId == null) return true;
  if (t.valetId === myValetId) return true;
  const needsDriver = t.status === 'assigned' && !t.driverId;
  return !!t.escalatedAt && needsDriver;
}

export function useValetActions() {
  const {drivers, tasks, visitors, arrivalNotices, dismissArrivalNotice, addTask, assignDriver, cancelTaskAssignment, markKeyCollected, pushNotification, addVisitor,
    assignVisitorDriver, cancelVisitorAssignment, assignRetrievalDriver, assignStaffRetrievalDriver, cancelVisitor, recallVisitor,
    confirmTaskDelivered, confirmVisitorDelivered, cancelTask, closeParkedSession, recallTask, fetchTaskHistory,
    acceptRetrieval} = useAppState();
  const {user} = useAuth();
  const myValetId = user?.role === 'valet' ? user.id : null;

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'requested' && t.status !== 'accepted' && t.status !== 'cancelled');
  const availableDrivers = drivers
    .filter(d => d.status === 'available')
    .sort((a, b) => (a.completedToday ?? 0) - (b.completedToday ?? 0));
  const retrievalRequests = tasks.filter(t =>
    t.type === 'retrieve'
    && (t.status === 'requested' || t.status === 'accepted')
    && isMyRetrieval(t, myValetId));
  const activeVisitors = visitors.filter(v => v.status !== 'retrieved' && v.status !== 'cancelled');
  // Driver.currentTaskId is a ParkingTask id, never a visitor id (see the
  // backend's visitor.service.js freeDriverIfStillOn comment — the same
  // mixup once left a driver stuck "busy" forever because a visitor id
  // happened to collide with an unrelated task id, and separately made this
  // exact check flip back to false right after a driver was assigned and
  // accepted a visitor's retrieval — see the mobile app's identical fix).
  // Resolving the visitor's actual retrieve task first and comparing
  // against ITS id is what actually disambiguates this.
  const hasActiveRetrievalDriver = (v: Visitor) => {
    const task = tasks.find(t => t.visitorId === v.id && t.type === 'retrieve' && t.status !== 'completed' && t.status !== 'cancelled');
    return !!task && drivers.some(d => d.currentTaskId === task.id && d.status === 'busy');
  };

  const assignTaskDriver = async (taskId: number, driverId: number) => {
    await assignDriver(taskId, driverId);
  };

  const assignVisitorPickupDriver = async (visitorId: number, driverId: number) => {
    await assignVisitorDriver(visitorId, driverId);
  };

  const assignVisitorRetrievalDriver = async (visitorId: number, driverId: number) => {
    await assignRetrievalDriver(visitorId, driverId);
  };

  return {
    drivers, tasks, visitors, dismissArrivalNotice, addTask, addVisitor, pushNotification, markKeyCollected, cancelVisitor, recallVisitor,
    arrivalNotices,
    acceptRetrieval, myValetId,
    activeTasks, availableDrivers, retrievalRequests, activeVisitors, hasActiveRetrievalDriver,
    assignTaskDriver, assignVisitorPickupDriver, assignVisitorRetrievalDriver, assignStaffRetrievalDriver,
    cancelTaskAssignment, cancelVisitorAssignment,
    confirmTaskDelivered, confirmVisitorDelivered, cancelTask, closeParkedSession, recallTask, fetchTaskHistory,
  };
}
