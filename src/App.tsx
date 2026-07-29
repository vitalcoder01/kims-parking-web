import React, {useState} from 'react';
import {ThemeProvider, useTheme} from './context/ThemeContext';
import {AuthProvider, useAuth} from './context/AuthContext';
import {AppStateProvider} from './context/AppStateContext';
import {Icon, IconName} from './components/Icon';
import {AlarmBanner} from './components/AlarmBanner';
import {InstallBanner} from './components/InstallBanner';
import {UpdateBanner} from './components/UpdateBanner';
import {LoginScreen} from './screens/LoginScreen';
import {DoctorHomeScreen} from './screens/DoctorHomeScreen';
import {VirtualCardScreen} from './screens/VirtualCardScreen';
import {VehicleSetupScreen} from './screens/VehicleSetupScreen';
import {ParkingScreen} from './screens/ParkingScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {HistoryScreen} from './screens/HistoryScreen';

// Web port of the app's AppNavigator: bottom tabs per role. Doctors get
// Home / Parking / Setup / Settings; staff get Home / Setup / Settings —
// the same split as the mobile DoctorNavigator/StaffNavigator. "Card" and
// "History" are reachable only from links on Home, not bottom tabs.

type TabKey = 'Home' | 'Card' | 'History' | 'Parking' | 'Setup' | 'Settings';

interface TabDef {
  key: TabKey;
  label: string;
  icon: IconName;
  headerTitle: string | null; // null = headerShown: false
}

function tabsForRole(role: string | undefined): TabDef[] {
  const home: TabDef = {
    key: 'Home', label: 'Home', icon: 'home',
    headerTitle: role === 'staff' ? 'KIMS Staff' : 'KIMS Doctor',
  };
  const parking: TabDef = {key: 'Parking', label: 'Parking', icon: 'parking', headerTitle: 'My Parking'};
  const setup: TabDef   = {key: 'Setup', label: 'Setup', icon: 'car', headerTitle: null};
  const settings: TabDef = {key: 'Settings', label: 'Settings', icon: 'settings', headerTitle: 'Settings'};
  return role === 'staff' ? [home, setup, settings] : [home, parking, setup, settings];
}

function RoleRouter() {
  const {colors} = useTheme();
  const {user} = useAuth();
  const [tab, setTab] = useState<TabKey>('Home');

  const tabs = tabsForRole(user?.role);
  const activeTab = tabs.find(t => t.key === tab);
  // Card/History are hidden routes (no tab bar entry) with their own
  // full-bleed layout.
  const isCard = tab === 'Card';
  const isHistory = tab === 'History';

  const screen =
    isCard              ? <VirtualCardScreen onBack={() => setTab('Home')} />
    : isHistory           ? <HistoryScreen onBack={() => setTab('Home')} />
    : tab === 'Home'      ? <DoctorHomeScreen onOpenCard={() => setTab('Card')} onOpenHistory={() => setTab('History')} />
    : tab === 'Parking'   ? <ParkingScreen />
    : tab === 'Setup'     ? <VehicleSetupScreen onBack={() => setTab('Home')} />
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
  const {user, isLoading} = useAuth();

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

  return user ? <RoleRouter /> : <LoginScreen />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppStateProvider>
          <AppInner />
        </AppStateProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
