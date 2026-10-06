// Mock data for the dev preview harness (src/preview). Lets a real screen
// render with representative, backend-free data so the UI can be reviewed and
// snapshotted without standing up the API/socket. Not shipped (preview.html is
// not a production rollup input).
import type {CurrentUser, UserRole} from '../context/AuthContext';
import type {
  AppState, ParkingTask, Driver, ParkingSlot, Visitor, ArrivalNotice, Notification,
} from '../context/AppStateContext';

const now = Date.now();
const min = (n: number) => now - n * 60_000;

export function makeUser(role: UserRole, over: Partial<CurrentUser> = {}): CurrentUser {
  const base: Record<UserRole, Partial<CurrentUser>> = {
    doctor: {name: 'Dr. Aditya Sharma', department: 'Cardiology', cardCode: '482', employeeId: 'KMC-2291'},
    staff:  {name: 'Priya Nair', department: 'Radiology', cardCode: '117', employeeId: 'KMC-5530'},
    valet:  {name: 'Ravi Kumar', employeeId: 'VAL-08', valetStation: 'gate'},
    driver: {name: 'Suresh M', employeeId: 'DRV-14', linkedDriverId: 3, driverStatus: 'available'},
    admin:  {name: 'Kim Admin', employeeId: 'ADM-01'},
  };
  return {
    id: 101, username: 'preview', role,
    name: 'Preview User', employeeId: 'X', ...base[role], ...over,
  } as CurrentUser;
}

export const sampleDrivers: Driver[] = [
  {id: 1, name: 'Mahesh R', phone: '90000 11111', status: 'available', completedToday: 12},
  {id: 2, name: 'Anil K', phone: '90000 22222', status: 'busy', currentTaskId: 5001, completedToday: 9},
  {id: 3, name: 'Suresh M', phone: '90000 33333', status: 'available', completedToday: 7},
  {id: 4, name: 'Vikram S', phone: '90000 44444', status: 'off', completedToday: 0},
];

export const sampleSlots: ParkingSlot[] = [
  {id: 'A-12', block: 'A', number: 12, status: 'occupied', taskId: 5002, carNumber: 'TN 09 AB 1234', doctorId: 101},
  {id: 'A-13', block: 'A', number: 13, status: 'free'},
  {id: 'B-04', block: 'B', number: 4, status: 'occupied', taskId: 5003, carNumber: 'KA 05 MN 7788'},
  {id: 'B-05', block: 'B', number: 5, status: 'reserved'},
];

export const sampleTasks: Record<string, ParkingTask[]> = {
  // Doctor: their car is parked (ready for a departure request)
  parked: [{
    id: 5002, type: 'park', doctorId: 101, doctorName: 'Dr. Aditya Sharma',
    carNumber: 'TN 09 AB 1234', slotId: 'A-12', driverName: 'Mahesh R',
    status: 'completed', requestedAt: min(95), completedAt: min(88),
  }],
  // Doctor: retrieval requested, driver on the way
  retrieving: [{
    id: 5004, type: 'retrieve', doctorId: 101, doctorName: 'Dr. Aditya Sharma',
    carNumber: 'TN 09 AB 1234', slotId: 'A-12', driverId: 1, driverName: 'Mahesh R',
    status: 'assigned', requestedAt: min(4), assignedAt: min(3),
  }],
  empty: [],
  // Valet/admin ops queue
  ops: [
    {id: 5010, type: 'retrieve', doctorId: 201, doctorName: 'Dr. Mehta', doctorDepartment: 'Ortho',
     carNumber: 'TN 10 CD 4521', status: 'requested', requestedAt: min(2)},
    {id: 5011, type: 'retrieve', doctorId: 202, doctorName: 'Dr. Rao', doctorDepartment: 'Neuro',
     carNumber: 'KA 01 EF 9090', driverId: 2, driverName: 'Anil K', status: 'in_transit', requestedAt: min(9), assignedAt: min(7)},
    {id: 5012, type: 'park', doctorId: 203, doctorName: 'Dr. Iyer', doctorDepartment: 'ENT',
     carNumber: 'TN 22 GH 3030', slotId: 'B-04', driverName: 'Mahesh R', status: 'completed', completedAt: min(40)},
  ],
};

export const sampleVisitors: Visitor[] = [
  {id: 7001, name: 'Lakshmi V', carNumber: 'TN 07 KK 5566', mobile: '98888 10101', vehicleType: 'car',
   slotId: 'B-05', status: 'parked', retrievalRequested: false, token: 't1', publicToken: 'p1', createdAt: min(120)},
  {id: 7002, name: 'Rajesh P', carNumber: 'KA 09 LL 2211', mobile: '98888 20202', vehicleType: 'bike',
   status: 'pending', retrievalRequested: true, driverId: 3, driverName: 'Suresh M', token: 't2', publicToken: 'p2', createdAt: min(30)},
];

export const sampleArrivals: ArrivalNotice[] = [
  {id: 9001, doctorId: 201, doctorName: 'Dr. Mehta', doctorCarNumber: 'TN 10 CD 4521',
   doctorDepartment: 'Ortho', doctorCardCode: '771', eta: 10, createdAt: min(3)},
];

export const sampleNotifications: Notification[] = [
  {id: 1, targetRole: 'doctor', title: 'Car ready', body: 'Your car is at the counter', type: 'info', createdAt: min(5), read: false},
];

const noop = async (): Promise<any> => undefined;

/** A complete AppState with no-op actions; pass data overrides per scenario. */
export function makeAppState(over: Partial<AppState> = {}): AppState {
  const base = {
    drivers: [], tasks: [], slots: [], visitors: [], arrivalNotices: [],
    notifications: [], activeAlert: null, hydrated: true, reassignPrompt: null,
    myArrivalNotice: null,
    clearReassignPrompt: () => {}, dismissAlert: () => {}, clearNotifications: () => {},
    addTask: noop, requestRetrieval: noop, cancelMyRetrieval: noop, sendArrivalNotice: noop,
    acceptRetrieval: noop, dismissArrivalNotice: noop, updateTask: noop, assignDriver: noop,
    cancelTaskAssignment: noop, acceptTask: noop, rejectTask: noop, markKeyCollected: noop,
    markParked: noop, markRetrieved: noop, gateHandoff: noop, confirmParkedByValet: noop,
    confirmArrivedByValet: noop, requestOtherStationDriver: noop, confirmTaskDelivered: noop,
    cancelTask: noop, closeParkedSession: noop, recallTask: noop, markTaskReturned: noop,
    fetchTaskHistory: noop, refreshMyArrival: noop, cancelMyArrival: noop, setDriverStatus: noop,
    addVisitor: noop, assignVisitorDriver: noop, cancelVisitorAssignment: noop, cancelVisitor: noop,
    recallVisitor: noop, closeParkedVisitor: noop, assignRetrievalDriver: noop,
    requestVisitorRetrieval: noop, assignStaffRetrievalDriver: noop, requestStaffRetrieval: noop,
    confirmVisitorDelivered: noop, pushNotification: noop, refreshTasks: noop, markNotificationRead: noop,
  } as unknown as AppState;
  return {...base, ...over};
}
