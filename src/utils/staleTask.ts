import type { ParkingTask } from '../context/AppStateContext';

export interface StaleTaskInfo {
  isStale: boolean;
  isCritical: boolean;
  elapsedMinutes: number;
  elapsedLabel: string;
}

/**
 * Computes whether a task is stale / stuck in progress.
 * Real-world valet parking runs take 3-8 minutes.
 * A task running for >30m indicates an abandoned device, lost runner,
 * unrecorded park, or offline client.
 */
export function getTaskStaleInfo(task: ParkingTask, now = Date.now()): StaleTaskInfo {
  if (task.status === 'completed' || task.status === 'cancelled') {
    return { isStale: false, isCritical: false, elapsedMinutes: 0, elapsedLabel: '' };
  }

  const startTime = task.assignedAt
    ? Number(task.assignedAt)
    : task.requestedAt
    ? Number(task.requestedAt)
    : task.startedAt
    ? Number(task.startedAt)
    : now;

  const elapsedMs = Math.max(0, now - startTime);
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

  let elapsedLabel = '';
  if (elapsedMinutes < 60) {
    elapsedLabel = `${elapsedMinutes}m in progress`;
  } else if (elapsedMinutes < 1440) {
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    elapsedLabel = mins > 0 ? `${hours}h ${mins}m in progress` : `${hours}h in progress`;
  } else {
    const days = Math.floor(elapsedMinutes / 1440);
    elapsedLabel = `${days}d in progress`;
  }

  const isPark = task.type === 'park';
  const isStale = isPark ? elapsedMinutes >= 30 : elapsedMinutes >= 20;
  const isCritical = elapsedMinutes >= 90;

  return {
    isStale,
    isCritical,
    elapsedMinutes,
    elapsedLabel,
  };
}
