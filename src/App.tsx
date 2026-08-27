import React, {useState, useEffect, Suspense} from 'react';
import {ThemeProvider, useTheme} from './context/ThemeContext';
import {AuthProvider, useAuth} from './context/AuthContext';
import {AppStateProvider} from './context/AppStateContext';
import {DialogProvider} from './components/AppDialog';
import {useTabHistory} from './hooks/useTabHistory';
import {Icon, IconName} from './components/Icon';
import {AlarmBanner} from './components/AlarmBanner';
import {InstallBanner} from './components/InstallBanner';
import {UpdateBanner} from './components/UpdateBanner';
import {ErrorBoundary} from './components/ErrorBoundary';
import {CopilotOverlay} from './components/copilot/CopilotOverlay';
import {installCrashReporting, setCurrentScreen} from './services/crashReporting';
// LoginScreen stays eager: it is what a signed-out visitor sees first, and
// making the very first paint wait on a second round-trip would be a
// pessimisation, not an optimisation.
import {LoginScreen} from './screens/LoginScreen';

/*
 * Every other screen is loaded on demand.
 *
 * An account has exactly one role, so a doctor was downloading the admin
 * console, the valet desk and the driver app before their own home screen
 * could paint -- roughly three quarters of the screen code in this bundle is
 * unreachable for any given user. Splitting per screen lets the browser
 * fetch only what that person's tabs can actually reach.
 *
 * `.then(m => ({default: m.X}))` because these are named exports and
 * React.lazy wants a default.
 */
// M is inferred from the module the import() actually resolves to, so M[K]
// is the real component type — each screen below keeps its exact props and
// is still type-checked at the call site.
const lazyScreen = <K extends string, M extends Record<K, React.ComponentType<any>>>(
  load: () => Promise<M>,
  key: K,
): React.LazyExoticComponent<M[K]> =>
  React.lazy(() => load().then(m => ({default: m[key]}), onChunkError));

/*
 * A chunk request can 404 for one specific, entirely normal reason: we
 * deployed while this tab was open, so the filenames this page was built
 * against no longer exist on the server. Before splitting, that couldn't
 * happen mid-session — everything was already downloaded.
 *
 * Reloading picks up the new index.html and its new filenames. The
 * sessionStorage flag makes it strictly one attempt, so a genuinely broken
 * chunk shows the error instead of reload-looping the browser.
 */
function onChunkError(err: unknown): never {
  try {
    if (!sessionStorage.getItem('kims-chunk-reload')) {
      sessionStorage.setItem('kims-chunk-reload', '1');
      window.location.reload();
    }
  } catch { /* storage blocked (private mode) — fall through and surface it */ }
  throw err;
}

const load = {
  AdminLoginScreen:      () => import('./screens/AdminLoginScreen'),
  SignUpScreen:          () => import('./screens/SignUpScreen'),
  DesignationScreen:     () => import('./screens/DesignationScreen'),
  DoctorHomeScreen:      () => import('./screens/DoctorHomeScreen'),
  VirtualCardScreen:     () => import('./screens/VirtualCardScreen'),
  VehicleSetupScreen:    () => import('./screens/VehicleSetupScreen'),
  SettingsScreen:        () => import('./screens/SettingsScreen'),
  HistoryScreen:         () => import('./screens/HistoryScreen'),
  AdminDashboardScreen:  () => import('./screens/admin/AdminDashboardScreen'),
  AdminStaffScreen:      () => import('./screens/admin/AdminStaffScreen'),
  AdminAttendanceScreen: () => import('./screens/admin/AdminAttendanceScreen'),
  AdminMapScreen:        () => import('./screens/admin/AdminMapScreen'),
  ValetHomeScreen:       () => import('./screens/valet/ValetHomeScreen'),
  ValetRecordsScreen:    () => import('./screens/valet/ValetRecordsScreen'),
  ValetMapScreen:        () => import('./screens/valet/ValetMapScreen'),
  DriverDashboardScreen: () => import('./screens/driver/DriverDashboardScreen'),
  DriverJobsScreen:      () => import('./screens/driver/DriverJobsScreen'),
  AnalyticsScreen:       () => import('./screens/AnalyticsScreen'),
};

const AdminLoginScreen      = lazyScreen(load.AdminLoginScreen, 'AdminLoginScreen');
const SignUpScreen          = lazyScreen(load.SignUpScreen, 'SignUpScreen');
const DesignationScreen     = lazyScreen(load.DesignationScreen, 'DesignationScreen');
const DoctorHomeScreen      = lazyScreen(load.DoctorHomeScreen, 'DoctorHomeScreen');
const VirtualCardScreen     = lazyScreen(load.VirtualCardScreen, 'VirtualCardScreen');
const VehicleSetupScreen    = lazyScreen(load.VehicleSetupScreen, 'VehicleSetupScreen');
const SettingsScreen        = lazyScreen(load.SettingsScreen, 'SettingsScreen');
const HistoryScreen         = lazyScreen(load.HistoryScreen, 'HistoryScreen');
const AdminDashboardScreen  = lazyScreen(load.AdminDashboardScreen, 'AdminDashboardScreen');
const AdminStaffScreen      = lazyScreen(load.AdminStaffScreen, 'AdminStaffScreen');
const AdminAttendanceScreen = lazyScreen(load.AdminAttendanceScreen, 'AdminAttendanceScreen');
const AdminMapScreen        = lazyScreen(load.AdminMapScreen, 'AdminMapScreen');
const ValetHomeScreen       = lazyScreen(load.ValetHomeScreen, 'ValetHomeScreen');
const ValetRecordsScreen    = lazyScreen(load.ValetRecordsScreen, 'ValetRecordsScreen');
const ValetMapScreen        = lazyScreen(load.ValetMapScreen, 'ValetMapScreen');
const DriverDashboardScreen = lazyScreen(load.DriverDashboardScreen, 'DriverDashboardScreen');
const DriverJobsScreen      = lazyScreen(load.DriverJobsScreen, 'DriverJobsScreen');
const AnalyticsScreen       = lazyScreen(load.AnalyticsScreen, 'AnalyticsScreen');

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

/*
 * Where the creature may wander, by role.
 *
 * Opt-in and deliberately short. Several tabs host their own internal
 * sub-views in local state — ValetHomeScreen switches between scan, assign,
 * visitor and retrievals without the tab ever changing — so roaming on the
 * strength of a tab name would put a drifting character over exactly the
 * work it must never cover. Valet therefore keeps the creature everywhere,
 * corner-anchored and still reporting, and wanders only on Analytics.
 */
const ROAMS_ON: Record<string, readonly TabKey[]> = {
  valet: ['Analytics'],
  driver: ['DriverDashboard'],
  admin: ['Dashboard', 'Analytics'],
  doctor: ['Home'],
  staff: ['Home'],
};

// Which chunk backs each tab. Only used for prefetching — the render path
// below still picks the component directly.
const LOADER_FOR_TAB: Record<TabKey, () => Promise<unknown>> = {
  Home: load.DoctorHomeScreen,
  Card: load.VirtualCardScreen,
  History: load.HistoryScreen,
  Setup: load.VehicleSetupScreen,
  Settings: load.SettingsScreen,
  Dashboard: load.AdminDashboardScreen,
  Staff: load.AdminStaffScreen,
  Attendance: load.AdminAttendanceScreen,
  Map: load.AdminMapScreen,
  Analytics: load.AnalyticsScreen,
  Queue: load.ValetHomeScreen,
  Records: load.ValetRecordsScreen,
  ValetMap: load.ValetMapScreen,
  DriverDashboard: load.DriverDashboardScreen,
  Jobs: load.DriverJobsScreen,
};

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

// Shown while a screen's chunk is in flight. Same spinner the app already
// uses while auth is resolving, so a chunk fetch looks like any other brief
// load rather than a blank frame.
function ScreenFallback() {
  const {colors} = useTheme();
  return (
    <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <span className="spinner" style={{borderColor: colors.border, borderTopColor: colors.primary, width: 28, height: 28}} />
    </div>
  );
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

  // Gives every crash report a screen name, so a fault arrives as
  // "Records" rather than an anonymous minified stack.
  useEffect(() => { setCurrentScreen(tab); }, [tab]);

  /*
   * Once the first screen is up and the browser is idle, quietly fetch the
   * other tabs this role can reach.
   *
   * Two reasons. Switching tabs stops showing a loading spinner for a
   * network round-trip. And it restores what splitting otherwise takes
   * away from an installed PWA: before, one bundle meant every screen
   * worked offline once the app had loaded; on-demand chunks would mean a
   * tab the user hadn't visited yet is simply unavailable with no signal.
   * Warming them puts every reachable screen in the service worker's cache
   * the same as before.
   *
   * requestIdleCallback so this never competes with the screen the user is
   * actually looking at. Failures are ignored on purpose — this is a
   * prefetch, and the real navigation will surface any genuine problem.
   */
  useEffect(() => {
    const warm = () => {
      for (const t of tabs) {
        if (t.key === tab) continue; // already loading or loaded
        LOADER_FOR_TAB[t.key]?.().catch(() => {});
      }
    };
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(warm, {timeout: 5000});
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 2000); // Safari has no requestIdleCallback
    return () => window.clearTimeout(id);
    // Role decides the tab set; re-running per tab change would be pointless
    // work since import() results are already memoized by the browser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);
  // Card/History are hidden routes (no tab bar entry) with their own
  // full-bleed layout.
  const isCard = tab === 'Card';
  const isHistory = tab === 'History';

  // Cross-tab focus — Dashboard's "View all" / occupancy-card taps land on
  // Map/Staff already pointed at what was tapped, instead of a blank list
  // the admin has to re-filter by hand every time.
  const [mapFocusBlock, setMapFocusBlock] = useState<string | undefined>(undefined);
  const [staffInitialFilter, setStaffInitialFilter] = useState<'all' | 'driver'>('all');

  const screen =
    isCard                ? <VirtualCardScreen onBack={() => setTab('Home')} />
    : isHistory            ? <HistoryScreen onBack={() => setTab('Home')} />
    : tab === 'Home'        ? <DoctorHomeScreen onOpenCard={() => setTab('Card')} onOpenHistory={() => setTab('History')} />
    : tab === 'Setup'       ? <VehicleSetupScreen onBack={() => setTab('Home')} />
    : tab === 'Dashboard'   ? <AdminDashboardScreen
        onOpenMap={(block) => { setMapFocusBlock(block); setTab('Map'); }}
        onOpenDrivers={() => { setStaffInitialFilter('driver'); setTab('Staff'); }}
      />
    : tab === 'Staff'       ? <AdminStaffScreen initialFilter={staffInitialFilter} />
    : tab === 'Attendance'  ? <AdminAttendanceScreen />
    : tab === 'Map'         ? <AdminMapScreen focusBlock={mapFocusBlock} />
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
        {/* Keyed by tab so switching tabs clears a previous crash -- without
            the key the boundary stays in its error state and the next tab
            renders the error screen too. Inside the tab bar, not around it,
            so a broken screen still leaves the user able to navigate away. */}
        <ErrorBoundary key={tab}>
          <Suspense fallback={<ScreenFallback />}>{screen}</Suspense>
        </ErrorBoundary>
      </div>

      {/* Only once signed in, and never over the login screen: there is
          nothing to observe there and no session to report against. */}
      <CopilotOverlay
        idleScreen={(ROAMS_ON[user?.role ?? ''] ?? []).includes(tab)}
        onNavigate={insight => {
          const target = insight.action?.target;
          if (!target) return;
          setTab(
            target === 'records' ? (user?.role === 'valet' ? 'Records' : 'Home')
            : target === 'dashboard' ? (user?.role === 'valet' ? 'Queue' : 'Dashboard')
            : target === 'map' ? (user?.role === 'valet' ? 'ValetMap' : 'Map')
            : 'Home',
          );
        }}
      />

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

  // /admin is its own dedicated sign-in (see AdminLoginScreen), checked
  // before the `user` branch below — otherwise anyone who already had ANY
  // saved session on this browser (doctor, valet, driver, whatever) got
  // dropped straight into their existing dashboard on visiting /admin,
  // never seeing this screen at all, no matter how many times they
  // reloaded. Only an already-signed-in ADMIN skips past it, straight to
  // their normal console — re-authenticating on every visit would be
  // pointless friction for the one role /admin actually belongs to.
  if (window.location.pathname === '/admin' && user?.role !== 'admin') {
    return <Suspense fallback={<ScreenFallback />}><AdminLoginScreen /></Suspense>;
  }

  if (user) {
    return needsDesignation
      ? <Suspense fallback={<ScreenFallback />}><DesignationScreen /></Suspense>
      : <RoleRouter />;
  }
  return showSignUp
    ? <Suspense fallback={<ScreenFallback />}><SignUpScreen onBackToLogin={() => setShowSignUp(false)} /></Suspense>
    : <LoginScreen onSignUp={() => setShowSignUp(true)} />;
}

/*
 * Installed at module scope, not in an effect: a fault thrown during the
 * first render happens before any effect runs, and an app that dies on
 * launch otherwise reports nothing at all.
 */
installCrashReporting();

export default function App() {
  return (
    <ErrorBoundary label="The app failed to start">
    <ThemeProvider>
      <DialogProvider>
        <AuthProvider>
          <AppStateProvider>
            <AppInner />
          </AppStateProvider>
        </AuthProvider>
      </DialogProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
