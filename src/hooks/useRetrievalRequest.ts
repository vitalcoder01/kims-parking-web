import {useAuth} from '../context/AuthContext';
import {useAppState} from '../context/AppStateContext';

// Direct port of the mobile app's hook. Reads the real, backend-tracked
// retrieval state rather than a local, unpersisted "I picked a time" flag.
export function useRetrievalRequest() {
  const {user} = useAuth();
  const {tasks, requestRetrieval} = useAppState();

  const myTasks = tasks.filter(t => t.doctorId === user?.id);
  const activeRetrieve = myTasks.find(t => t.type === 'retrieve' && t.status !== 'completed' && t.status !== 'cancelled');

  // No clock here any more. This used to tick every second so callers could
  // derive elapsed time, but the only thing that ever read it was a mm:ss
  // counter that has since been removed — the doctor's planned departure is
  // never rendered back to them as an estimate (see utils/retrievalClocks).
  // What was left re-rendered the whole Home screen once a second to
  // produce identical output. Whether a driver has set off is
  // `activeRetrieve.startedAt != null`, which needs no clock.
  return {activeRetrieve, requestRetrieval};
}
