import React from 'react';
import {useTheme} from '../context/ThemeContext';
import {AuthContext, type CurrentUser, type UserRole, type AuthContextValue} from '../context/AuthContext';
import {AppStateContext, DriverLocationsContext, type AppState} from '../context/AppStateContext';
import {DialogProvider} from '../components/AppDialog';
import {
  makeUser, makeAppState, sampleTasks, sampleDrivers, sampleSlots, sampleVisitors,
  sampleArrivals, sampleNotifications,
} from './mockData';

// Screens under review
import {DoctorHomeScreen} from '../screens/DoctorHomeScreen';
import {DriverDashboardScreen} from '../screens/driver/DriverDashboardScreen';
import {SettingsScreen} from '../screens/SettingsScreen';

const noop: any = () => {};

function mockAuth(user: CurrentUser): AuthContextValue {
  return {
    user, isLoading: false, needsDesignation: false,
    login: async () => user, register: async () => user, logout: async () => {},
    updateProfile: noop, clearNeedsDesignation: noop,
  };
}

/** Wrap a screen in the full provider stack with injected mock data. */
function Harness({user, state, children}: {user: CurrentUser; state: AppState; children: React.ReactNode}) {
  return (
    <AuthContext.Provider value={mockAuth(user)}>
      <AppStateContext.Provider value={state}>
        <DriverLocationsContext.Provider value={{driverLocations: {}, onlineDriverIds: []}}>
          <DialogProvider>{children}</DialogProvider>
        </DriverLocationsContext.Provider>
      </AppStateContext.Provider>
    </AuthContext.Provider>
  );
}

type Entry = {role: UserRole; state: AppState; render: () => React.ReactNode};

function entryFor(screen: string, scenario: string): Entry {
  switch (screen) {
    case 'doctor-home': {
      const tasks = sampleTasks[scenario] ?? sampleTasks.parked;
      const myArrivalNotice = scenario === 'arriving'
        ? {id: 1, doctorId: 101, doctorName: 'Dr. Aditya Sharma', eta: 10, createdAt: Date.now() - 120000}
        : null;
      return {
        role: 'doctor',
        state: makeAppState({tasks, myArrivalNotice}),
        render: () => <DoctorHomeScreen onOpenCard={noop} onOpenHistory={noop} />,
      };
    }
    case 'driver-dashboard': {
      return {
        role: 'driver',
        state: makeAppState({
          tasks: sampleTasks.ops, drivers: sampleDrivers, visitors: sampleVisitors,
          slots: sampleSlots, arrivalNotices: sampleArrivals, notifications: sampleNotifications,
        }),
        render: () => <DriverDashboardScreen onOpenJobs={noop} />,
      };
    }
    case 'settings': {
      return {role: 'doctor', state: makeAppState({}), render: () => <SettingsScreen />};
    }
    default:
      return {
        role: 'doctor',
        state: makeAppState({tasks: sampleTasks.parked}),
        render: () => <DoctorHomeScreen onOpenCard={noop} onOpenHistory={noop} />,
      };
  }
}

export function Preview() {
  const {colors} = useTheme();
  const params = new URLSearchParams(location.search);
  const screen = params.get('screen') ?? 'doctor-home';
  const scenario = params.get('scenario') ?? 'parked';
  const role = (params.get('role') as UserRole) || undefined;

  const entry = entryFor(screen, scenario);
  const user = makeUser(role ?? entry.role);

  return (
    <div style={{minHeight: '100vh', backgroundColor: colors.background}}>
      <div className="phone-frame" style={{backgroundColor: colors.background}}>
        <Harness user={user} state={entry.state}>
          <div className="screen-enter" style={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
            {entry.render()}
          </div>
        </Harness>
      </div>
    </div>
  );
}
