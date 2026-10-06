import React from 'react';
import {PressableScale} from '../components/PressableScale';
import {useDialog} from '../components/AppDialog';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemeToggleRow, AppSwitch} from '../components/AppSwitch';
import {Icon, IconName} from '../components/Icon';
import {Surface, Text, Button, SegmentedControl} from '../components/ui';
import {spacing, radius} from '../theme';
import {useInstallPrompt} from '../hooks/useInstallPrompt';
import {InstallHelpModal} from '../components/InstallHelpModal';
import {APP_VERSION_NAME, APP_VERSION_CODE} from '../config/version';
import {EditProfileModal, EditProfileMode} from '../components/EditProfileModal';

type ThemeMode = 'light' | 'dark' | 'system';

const ROLE_LABELS: Record<string, string> = {
  doctor: 'Doctor', staff: 'Staff', valet: 'Valet',
  parking_driver: 'Parking Driver', retrieval_driver: 'Retrieval Driver', admin: 'Admin',
};

// Section eyebrow label — one place so every section header matches.
function SectionLabel({children}: {children: React.ReactNode}) {
  return (
    <Text variant="overline" tone="muted" uppercase as="div" style={{marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 1.2}}>
      {children}
    </Text>
  );
}

export function SettingsScreen() {
  const {colors, mode, setMode} = useTheme();
  const {user, logout} = useAuth();
  const dialog = useDialog();

  const {canInstall, installed, promptInstall} = useInstallPrompt();
  const [showInstallHelp, setShowInstallHelp] = React.useState(false);
  const [notifTasks,   setNotifTasks]   = React.useState(true);
  // Which edit-profile modal is open — null means none. One state var so
  // opening a second field cleanly replaces the first instead of stacking.
  const [editMode, setEditMode] = React.useState<EditProfileMode | null>(null);
  const [flashMessage, setFlashMessage] = React.useState<string | null>(null);
  const [installing, setInstalling] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  React.useEffect(() => {
    if (!flashMessage) return;
    const t = window.setTimeout(() => setFlashMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [flashMessage]);

  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);
    try {
      const shown = await promptInstall();
      if (!shown) setShowInstallHelp(true);
    } finally {
      setInstalling(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    if (!await dialog.confirm({title: 'Logout', message: 'Are you sure you want to logout?', destructive: true})) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  };
  const [notifShift,   setNotifShift]   = React.useState(true);
  const [notifUpdates, setNotifUpdates] = React.useState(false);

  const initials = user?.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2) ?? '??';

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background}}>
      <div style={{padding: spacing.base, paddingBottom: spacing['3xl']}}>

        {/* Profile */}
        <Surface elevation="e2" style={{display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm}}>
          <span style={{
            width: 54, height: 54, borderRadius: radius.md, flexShrink: 0,
            border: `1px solid ${colors.primary}33`, backgroundColor: colors.primaryLight,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Text variant="heading" color={colors.primary} style={{fontWeight: 900}}>{initials}</Text>
          </span>
          <div style={{flex: 1, minWidth: 0}}>
            <Text variant="heading" as="div" numberOfLines={1}>{user?.name ?? '—'}</Text>
            <Text variant="bodySm" tone="secondary" as="div" style={{marginTop: 2}}>
              {user ? (ROLE_LABELS[user.role] ?? user.role) : '—'}
              {user?.department ? ` · ${user.department}` : ''}
            </Text>
            <Text variant="caption" color={colors.primary} as="div" style={{marginTop: 3, fontWeight: 800}}>{user?.employeeId ?? '—'}</Text>
          </div>
        </Surface>

        {/* Account — self-service edits for name, login username, and
            password. Each row opens its own modal so a mistap on one field
            cannot accidentally rewrite another. */}
        <SectionLabel>Account</SectionLabel>
        <Surface elevation="e1" padding={0} style={{overflow: 'hidden'}}>
          {([
            {mode: 'name' as const,     label: 'Display name',   value: user?.name ?? '—',     icon: 'user' as IconName},
            {mode: 'username' as const, label: 'Login username', value: user?.username ?? '—', icon: 'userCard' as IconName},
            {mode: 'password' as const, label: 'Password',       value: '••••••••',            icon: 'lock' as IconName},
          ]).map((row, i, arr) => (
            <PressableScale
              key={row.mode}
              onClick={() => setEditMode(row.mode)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing.md,
                padding: `14px ${spacing.base}px`, width: '100%',
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.divider}` : 'none',
                backgroundColor: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}>
              <span style={{
                width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.cardAlt,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={row.icon} size={16} color={colors.textPrimary} />
              </span>
              <span style={{flex: 1, minWidth: 0}}>
                <Text variant="overline" tone="muted" uppercase as="div">{row.label}</Text>
                <Text variant="subhead" as="div" numberOfLines={1} style={{marginTop: 2}}>{row.value}</Text>
              </span>
              <Icon name="chevronRight" size={16} color={colors.textMuted} />
            </PressableScale>
          ))}
        </Surface>

        {/* Appearance */}
        <SectionLabel>Appearance</SectionLabel>
        <ThemeToggleRow />
        <Surface elevation="e1" style={{marginBottom: spacing.sm}}>
          <Text variant="label" tone="secondary" uppercase as="div" style={{marginBottom: spacing.md, letterSpacing: 1}}>Theme mode</Text>
          <SegmentedControl<ThemeMode>
            value={mode}
            onChange={setMode}
            segments={[
              {key: 'light', label: 'Light', icon: 'sun'},
              {key: 'dark', label: 'Dark', icon: 'moon'},
              {key: 'system', label: 'System', icon: 'phone'},
            ]}
          />
        </Surface>

        {/* Notifications */}
        <SectionLabel>Notifications</SectionLabel>
        <Surface elevation="e1">
          <AppSwitch
            label="Task Assignments"
            description="When a new task is assigned to you"
            value={notifTasks}
            onValueChange={setNotifTasks}
          />
          <div style={{height: 1, margin: `${spacing.xs}px 0`, backgroundColor: colors.divider}} />
          <AppSwitch
            label="Shift Reminders"
            description="Start and end of shift alerts"
            value={notifShift}
            onValueChange={setNotifShift}
          />
          <div style={{height: 1, margin: `${spacing.xs}px 0`, backgroundColor: colors.divider}} />
          <AppSwitch
            label="App Updates"
            description="New features and announcements"
            value={notifUpdates}
            onValueChange={setNotifUpdates}
          />
        </Surface>

        {/* App install */}
        {(canInstall || installed) && (
          <>
            <SectionLabel>App</SectionLabel>
            <Surface elevation="e1">
              {installed ? (
                <div style={{display: 'flex', alignItems: 'center', gap: spacing.md}}>
                  <Icon name="check" size={20} color={colors.success} />
                  <Text variant="body" style={{fontWeight: 600}}>Installed as an app on this device</Text>
                </div>
              ) : (
                <PressableScale
                  onClick={handleInstall}
                  disabled={installing}
                  style={{display: 'flex', alignItems: 'center', gap: spacing.md, width: '100%', opacity: installing ? 0.6 : 1, background: 'transparent', border: 'none'}}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.cardAlt,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {installing ? <span className="spinner" style={{width: 16, height: 16}} /> : <Icon name="phone" size={18} color={colors.textPrimary} />}
                  </span>
                  <span style={{textAlign: 'left', flex: 1}}>
                    <Text variant="subhead" as="div">Install App</Text>
                    <Text variant="bodySm" tone="secondary" as="div" style={{marginTop: 2}}>Add KIMS Parking to your home screen</Text>
                  </span>
                  <Icon name="chevronRight" size={18} color={colors.textMuted} />
                </PressableScale>
              )}
            </Surface>
          </>
        )}

        {/* About */}
        <SectionLabel>About</SectionLabel>
        <Surface elevation="e1">
          {[
            ['App Version', `${APP_VERSION_NAME} (${APP_VERSION_CODE})`],
            ['Build', 'Web'],
            ['Hospital', 'KIMS Hospitals'],
          ].map(([label, value], i, arr) => (
            <div
              key={label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${spacing.sm}px 0`, borderBottom: i < arr.length - 1 ? `1px solid ${colors.divider}` : 'none',
              }}>
              <Text variant="bodySm" tone="secondary">{label}</Text>
              <Text variant="bodySm" style={{fontWeight: 700}}>{value}</Text>
            </div>
          ))}
        </Surface>

        {/* Logout — solid primary CTA, matching every other primary action. */}
        <Button
          onClick={handleLogout}
          loading={loggingOut}
          leftIcon="logout"
          size="lg"
          fullWidth
          shape="rounded"
          style={{marginTop: spacing.md}}>
          Logout
        </Button>

      </div>
      {showInstallHelp && <InstallHelpModal onClose={() => setShowInstallHelp(false)} />}
      <EditProfileModal
        mode={editMode}
        onClose={() => setEditMode(null)}
        onSuccess={(m) => setFlashMessage(m)}
      />
      {flashMessage && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: colors.success, color: '#fff',
          padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
          boxShadow: '0 8px 20px rgba(0,0,0,0.25)', zIndex: 10000,
        }}>
          {flashMessage}
        </div>
      )}
    </div>
  );
}
