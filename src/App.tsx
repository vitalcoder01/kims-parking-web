import React, {useState} from 'react';
import {ThemeProvider, useTheme} from './context/ThemeContext';
import {AuthProvider, useAuth} from './context/AuthContext';
import {AppStateProvider} from './context/AppStateContext';
import {DialogProvider} from './components/AppDialog';
import {useTabHistory} from './hooks/useTabHistory';
import {Icon, IconName} from './components/Icon';
import {AlarmBanner} from './components/AlarmBanner';
import {InstallBanner} from './components/InstallBanner';
import {UpdateBanner} from './components/UpdateBanner';
import {LoginScreen} from './screens/LoginScreen';
import {SignUpScreen} from './screens/SignUpScreen';
import {DesignationScreen} from './screens/DesignationScreen';
import {DoctorHomeScreen} from './screens/DoctorHomeScreen';
import {VirtualCardScreen} from './screens/VirtualCardScreen';
import {VehicleSetupScreen} from './screens/VehicleSetupScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {HistoryScreen} from './screens/HistoryScreen';
import {AdminDashboardScreen} from './screens/admin/AdminDashboardScreen';
import {AdminStaffScreen} from './screens/admin/AdminStaffScreen';
import {AdminAttendanceScreen} from './screens/admin/AdminAttendanceScreen';
import {AdminMapScreen} from './screens/admin/AdminMapScreen';
import {ValetHomeScreen} from './screens/valet/ValetHomeScreen';
import {ValetRecordsScreen} from './screens/valet/ValetRecordsScreen';
import {ValetMapScreen} from './screens/valet/ValetMapScreen';
import {DriverDashboardScreen} from './screens/driver/DriverDashboardScreen';
import {DriverJobsScreen} from './screens/driver/DriverJobsScreen';
import {AnalyticsScreen} from './screens/AnalyticsScreen';

// Web port of the app's AppNavigator: bottom tabs per role.
// Doctor/staff: Home / Setup / Settings — matching the mobile app's current
// DoctorNavigator/StaffNavigator, which folded the old standalone "Parking"
// tab into Home once a doctor only ever has one current session. "Card" and
// "History" are reachable only from links on Home, not bottom tabs.
// Admin: Dashboard / Staff / Attendance / Map / Settings — matching the
// mobile app's AdminNavigator.
// Valet: Dashboard / Jobs / Map / Settings — matching mobile's ValetNavigator
// (internal route keys stayed Queue/Records for continuity; only the
// tabBarLabel changed).
// Driver: Dashboard / My Jobs / Settings — matching mobile's DriverNavigator.

type TabKey =
  | 'Home' | 'Card' | 'History' | 'Setup' | 'Settings'
  | 'Dashboard' | 'Staff' | 'Attendance' | 'Map' | 'Analytics'
  | 'Queue' | 'Records' | 'ValetMap'
  | 'DriverDashboard' | 'Jobs';

interface TabDef {
  key: TabKey;
  label: string;
  icon: IconName;
  headerTitle: string | null; // null = headerShown: false
}

function tabsForRole(role: string | undefined): TabDef[] {
  if (role === 'admin') {
    return [
      {key: 'Dashboard', label: 'Dashboard', icon: 'dashboard', headerTitle: 'Operations'},
      {key: 'Staff', label: 'Staff', icon: 'staff', headerTitle: 'Staff'},
      {key: 'Attendance', label: 'Attendance', icon: 'calendar', headerTitle: 'Attendance'},
      {key: 'Map', label: 'Map', icon: 'map', headerTitle: 'Live Map'},
      {key: 'Analytics', label: 'Analytics', icon: 'analytics', headerTitle: null},
      {key: 'Settings', label: 'Settings', icon: 'settings', headerTitle: 'Settings'},
    ];
  }
  if (role === 'valet') {
    return [
      {key: 'Queue', label: 'Dashboard', icon: 'key', headerTitle: null},
      {key: 'Records', label: 'Jobs', icon: 'clipboard', headerTitle: null},
      {key: 'ValetMap', label: 'Map', icon: 'map', headerTitle: null},
      {key: 'Analytics', label: 'Analytics', icon: 'analytics', headerTitle: null},
      {key: 'Settings', label: 'Settings', icon: 'settings', headerTitle: 'Settings'},
    ];
  }
  if (role === 'driver') {
    return [
      {key: 'DriverDashboard', label: 'Dashboard', icon: 'dashboard', headerTitle: null},
      {key: 'Jobs', label: 'My Jobs', icon: 'tasks', headerTitle: null},
      {key: 'Settings', label: 'Settings', icon: 'settings', headerTitle: 'Settings'},
    ];
  }
  const home: TabDef = {
    key: 'Home', label: 'Home', icon: 'home',
    headerTitle: role === 'staff' ? 'KIMS Staff' : 'KIMS Doctor',
  };
  const setup: TabDef   = {key: 'Setup', label: 'Setup', icon: 'car', headerTitle: null};
  const settings: TabDef = {key: 'Settings', label: 'Settings', icon: 'settings', headerTitle: 'Settings'};
  return [home, setup, settings];
}

function RoleRouter() {
  const {colors} = useTheme();
  const {user} = useAuth();
  const [tab, setTab] = useTabHistory<TabKey>(
    user?.role === 'admin' ? 'Dashboard'
    : user?.role === 'valet' ? 'Queue'
    : user?.role === 'driver' ? 'DriverDashboard'
    : 'Home',
  );

  const tabs = tabsForRole(user?.role);
  const activeTab = tabs.find(t => t.key === tab);
  // Card/History are hidden routes (no tab bar entry) with their own
  // full-bleed layout.
  const isCard = tab === 'Card';
  const isHistory = tab === 'History';

  const screen =
    isCard                ? <VirtualCardScreen onBack={() => setTab('Home')} />
    : isHistory            ? <HistoryScreen onBack={() => setTab('Home')} />
    : tab === 'Home'        ? <DoctorHomeScreen onOpenCard={() => setTab('Card')} onOpenHistory={() => setTab('History')} />
    : tab === 'Setup'       ? <VehicleSetupScreen onBack={() => setTab('Home')} />
    : tab === 'Dashboard'   ? <AdminDashboardScreen />
    : tab === 'Staff'       ? <AdminStaffScreen />
    : tab === 'Attendance'  ? <AdminAttendanceScreen />
    : tab === 'Map'         ? <AdminMapScreen />
    : tab === 'Analytics'   ? <AnalyticsScreen />
    : tab === 'Queue'       ? <ValetHomeScreen />
    : tab === 'Records'     ? <ValetRecordsScreen />
    : tab === 'ValetMap'    ? <ValetMapScreen />
    : tab === 'DriverDashboard' ? <DriverDashboardScreen onOpenJobs={() => setTab('Jobs')} />
    : tab === 'Jobs'        ? <DriverJobsScreen />
    : <SettingsScreen />;

  return (
    <div className="phone-frame" style={{backgroundColor: colors.background}}>
      <AlarmBanner />
      <UpdateBanner />
      <InstallBanner />

      {/* Header — matches the app's native-stack header styling */}
      {!isCard && activeTab?.headerTitle && (
        <div style={{
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: '14px 16px',
          textAlign: 'center',
          flexShrink: 0,
        }}>
          <span style={{color: colors.textPrimary, fontWeight: 900, fontSize: 17, letterSpacing: -0.2}}>{activeTab.headerTitle}</span>
        </div>
      )}

      {/* Screen body — keyed so each tab change gets the light fade-in */}
      <div key={tab} className="screen-enter" style={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
        {screen}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        display: 'flex', height: 62, flexShrink: 0,
        backgroundColor: colors.tabBar,
        borderTop: `1px solid ${colors.tabBarBorder}`,
        paddingBottom: 8, paddingTop: 6,
      }}>
        {tabs.map(t => {
          const active = t.key === tab || ((isCard || isHistory) && t.key === 'Home');
          const color = active ? colors.tabIconActive : colors.tabIconInactive;
          return (
            <button
              key={t.key}
              className="pressable"
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
              }}>
              <Icon name={t.icon} size={24} color={color} />
              <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color}}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AppInner() {
  const {colors} = useTheme();
  const {user, isLoading, needsDesignation} = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.background,
      }}>
        <span className="spinner" style={{borderColor: colors.border, borderTopColor: colors.primary, width: 36, height: 36}} />
      </div>
    );
  }

  if (user) return needsDesignation ? <DesignationScreen /> : <RoleRouter />;
  return showSignUp
    ? <SignUpScreen onBackToLogin={() => setShowSignUp(false)} />
    : <LoginScreen onSignUp={() => setShowSignUp(true)} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <DialogProvider>
        <AuthProvider>
          <AppStateProvider>
            <AppInner />
          </AppStateProvider>
        </AuthProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}
