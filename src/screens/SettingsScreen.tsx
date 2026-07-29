import React from 'react';
import {PressableScale} from '../components/PressableScale';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemeToggleRow, AppSwitch} from '../components/AppSwitch';
import {Card} from '../components/Card';
import {Icon, IconName} from '../components/Icon';
import {typography, spacing, radius} from '../theme';
import {useInstallPrompt} from '../hooks/useInstallPrompt';
import {InstallHelpModal} from '../components/InstallHelpModal';
import {APP_VERSION_NAME, APP_VERSION_CODE} from '../config/version';

type ThemeMode = 'light' | 'dark' | 'system';

const ROLE_LABELS: Record<string, string> = {
  doctor: 'Doctor', staff: 'Staff', valet: 'Valet',
  parking_driver: 'Parking Driver', retrieval_driver: 'Retrieval Driver', admin: 'Admin',
};

export function SettingsScreen() {
  const {colors, mode, setMode} = useTheme();
  const {user, logout} = useAuth();

  const {canInstall, installed, promptInstall} = useInstallPrompt();
  const [showInstallHelp, setShowInstallHelp] = React.useState(false);
  const [notifTasks,   setNotifTasks]   = React.useState(true);

  const handleInstall = async () => {
    const shown = await promptInstall();
    if (!shown) setShowInstallHelp(true);
  };
  const [notifShift,   setNotifShift]   = React.useState(true);
  const [notifUpdates, setNotifUpdates] = React.useState(false);

  const modeOptions: {value: ThemeMode; label: string; icon: IconName}[] = [
    {value: 'light', label: 'Light', icon: 'sun'},
    {value: 'dark',  label: 'Dark',  icon: 'moon'},
    {value: 'system',label: 'System',icon: 'phone'},
  ];

  const initials = user?.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2) ?? '??';

  const sectionTitle: React.CSSProperties = {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.bold,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: spacing.sm, marginTop: spacing.md, color: colors.textMuted,
  };
  const cardTitle: React.CSSProperties = {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.bold,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm, color: colors.textSecondary,
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background}}>
      <div style={{padding: spacing.base, paddingBottom: spacing['3xl']}}>

        {/* Profile */}
        <Card style={{display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md}}>
          <div style={{
            width: 54, height: 54, borderRadius: radius.md, flexShrink: 0,
            border: `1px solid ${colors.primary}44`, backgroundColor: colors.primary + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{fontSize: typography.sizes.lg, fontWeight: typography.weights.black, color: colors.primary}}>{initials}</span>
          </div>
          <div style={{flex: 1}}>
            <div style={{fontSize: typography.sizes.md, fontWeight: typography.weights.black, letterSpacing: -0.3, color: colors.textPrimary}}>{user?.name ?? '—'}</div>
            <div style={{fontSize: typography.sizes.sm, marginTop: 2, color: colors.textSecondary}}>
              {user ? (ROLE_LABELS[user.role] ?? user.role) : '—'}
              {user?.department ? ` · ${user.department}` : ''}
            </div>
            <div style={{fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, marginTop: 3, color: colors.primary}}>{user?.employeeId ?? '—'}</div>
          </div>
        </Card>

        {/* Appearance */}
        <div style={sectionTitle}>APPEARANCE</div>
        <ThemeToggleRow />
        <Card>
          <div style={cardTitle}>Theme Mode</div>
          <div style={{display: 'flex', gap: spacing.sm}}>
            {modeOptions.map(opt => {
              const isActive = mode === opt.value;
              return (
                <PressableScale
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  style={{
                    flex: 1, padding: `${spacing.sm}px 0`, borderRadius: radius.md,
                    border: `1.5px solid ${isActive ? colors.primary : colors.border}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    backgroundColor: isActive ? colors.primaryLight : colors.cardAlt,
                  }}>
                  <Icon name={opt.icon} size={20} color={isActive ? colors.primary : colors.textSecondary} />
                  <span style={{
                    fontSize: typography.sizes.xs, fontWeight: typography.weights.bold,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    color: isActive ? colors.primary : colors.textSecondary,
                  }}>{opt.label}</span>
                </PressableScale>
              );
            })}
          </div>
        </Card>

        {/* Notifications */}
        <div style={sectionTitle}>NOTIFICATIONS</div>
        <Card>
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
        </Card>

        {/* App install */}
        {(canInstall || installed) && (
          <>
            <div style={sectionTitle}>APP</div>
            <Card>
              {installed ? (
                <div style={{display: 'flex', alignItems: 'center', gap: spacing.md}}>
                  <Icon name="check" size={20} color={colors.success} />
                  <span style={{fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.textPrimary}}>
                    Installed as an app on this device
                  </span>
                </div>
              ) : (
                <PressableScale
                  onClick={handleInstall}
                  style={{display: 'flex', alignItems: 'center', gap: spacing.md, width: '100%'}}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.cardAlt,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="phone" size={18} color={colors.textPrimary} />
                  </span>
                  <span style={{textAlign: 'left', flex: 1}}>
                    <span style={{display: 'block', fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.textPrimary}}>
                      Install App
                    </span>
                    <span style={{display: 'block', fontSize: typography.sizes.sm, marginTop: 2, color: colors.textSecondary}}>
                      Add KIMS Parking to your home screen
                    </span>
                  </span>
                  <Icon name="chevronRight" size={18} color={colors.textMuted} />
                </PressableScale>
              )}
            </Card>
          </>
        )}

        {/* About */}
        <div style={sectionTitle}>ABOUT</div>
        <Card>
          {[
            ['App Version', `${APP_VERSION_NAME} (${APP_VERSION_CODE})`],
            ['Build', 'Web'],
            ['Hospital', 'KIMS Hospitals'],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${spacing.sm}px 0`, borderBottom: `1px solid ${colors.divider}`,
              }}>
              <span style={{fontSize: typography.sizes.sm, color: colors.textSecondary}}>{label}</span>
              <span style={{fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.textPrimary}}>{value}</span>
            </div>
          ))}
        </Card>

        {/* Logout — solid primary-style CTA button, matching Sign In /
            Save Vehicle / Edit Vehicle Details elsewhere in the app
            (black background, white text) instead of a red accent. */}
        <PressableScale
          onClick={() => {
            if (window.confirm('Are you sure you want to logout?')) logout();
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            borderRadius: radius.lg, height: 54, width: '100%', marginTop: spacing.md,
            backgroundColor: colors.primary,
          }}>
          <Icon name="logout" size={17} color={colors.textOnPrimary} />
          <span style={{fontSize: typography.sizes.base, fontWeight: typography.weights.black, color: colors.textOnPrimary}}>Logout</span>
        </PressableScale>

      </div>
      {showInstallHelp && <InstallHelpModal onClose={() => setShowInstallHelp(false)} />}
    </div>
  );
}
