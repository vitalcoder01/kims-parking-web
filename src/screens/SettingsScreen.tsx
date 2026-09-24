import React from 'react';
import {PressableScale} from '../components/PressableScale';
import {useDialog} from '../components/AppDialog';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemeToggleRow, AppSwitch} from '../components/AppSwitch';
import {Icon, IconName} from '../components/Icon';
import {useInstallPrompt} from '../hooks/useInstallPrompt';
import {InstallHelpModal} from '../components/InstallHelpModal';
import {APP_VERSION_NAME, APP_VERSION_CODE} from '../config/version';
import {EditProfileModal, EditProfileMode} from '../components/EditProfileModal';

type ThemeMode = 'light' | 'dark' | 'system';

const ROLE_LABELS: Record<string, string> = {
  doctor: 'Doctor',
  staff: 'Hospital Staff',
  valet: 'Valet Operator',
  parking_driver: 'Parking Driver',
  retrieval_driver: 'Retrieval Driver',
  admin: 'System Administrator',
};

export function SettingsScreen() {
  const {colors, isDark, mode, setMode} = useTheme();
  const {user, logout} = useAuth();
  const dialog = useDialog();

  const {canInstall, installed, promptInstall} = useInstallPrompt();
  const [showInstallHelp, setShowInstallHelp] = React.useState(false);
  const [notifTasks, setNotifTasks] = React.useState(true);
  const [notifShift, setNotifShift] = React.useState(true);
  const [notifUpdates, setNotifUpdates] = React.useState(false);

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
    const confirmed = await dialog.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to end your workstation session?',
      destructive: true,
    });
    if (!confirmed) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  };

  const modeOptions: {value: ThemeMode; label: string; icon: IconName}[] = [
    {value: 'light', label: 'Light', icon: 'sun'},
    {value: 'dark', label: 'Dark', icon: 'moon'},
    {value: 'system', label: 'System', icon: 'phone'},
  ];

  const initials = user?.name
    ? user.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '??';

  const glassCardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 2px 10px rgba(0, 0, 0, 0.03)',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };

  return (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.background, minHeight: 0}}>
      {/* Restrained Workstation Header */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontSize: 16, fontWeight: 900, color: colors.textPrimary, letterSpacing: -0.2}}>
              Workstation Settings
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 6,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
              color: colors.primary,
              letterSpacing: 0.4,
            }}>
              KIMS OPERATIONS
            </span>
          </div>
          <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, marginTop: 2}}>
            Profile, appearance, notifications & device preferences
          </div>
        </div>
      </div>

      <div className="screen-scroll" style={{padding: 16, paddingBottom: 40}}>
        {/* 1. User Profile Hero Card */}
        <div style={{
          ...glassCardStyle,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          position: 'relative',
        }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.18)' : '#EFF6FF',
            border: `1.5px solid ${colors.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{fontSize: 20, fontWeight: 900, color: colors.primary, letterSpacing: -0.5}}>
              {initials}
            </span>
          </div>

          <div style={{flex: 1, minWidth: 0}}>
            <div style={{
              fontSize: 16,
              fontWeight: 900,
              color: colors.textPrimary,
              letterSpacing: -0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user?.name ?? '—'}
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 3}}>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 5,
                backgroundColor: colors.cardAlt,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}>
                {user ? (ROLE_LABELS[user.role] ?? user.role) : '—'}
              </span>
              {user?.department && (
                <span style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary}}>
                  · {user.department}
                </span>
              )}
            </div>
            {user?.employeeId && (
              <div style={{fontSize: 11, fontWeight: 700, color: colors.primary, marginTop: 4, fontVariantNumeric: 'tabular-nums'}}>
                ID: {user.employeeId}
              </div>
            )}
          </div>
        </div>

        {/* 2. Account Credentials & Self-Service */}
        <div style={sectionHeaderStyle}>
          <Icon name="user" size={13} color={colors.textSecondary} />
          <span>Account & Security</span>
        </div>
        <div style={glassCardStyle}>
          {([
            {mode: 'name' as const, label: 'Display Name', value: user?.name ?? '—', icon: 'user' as IconName},
            {mode: 'username' as const, label: 'Login Username', value: user?.username ?? '—', icon: 'userCard' as IconName},
            {mode: 'password' as const, label: 'Password', value: '••••••••', icon: 'lock' as IconName},
          ]).map((row, i, arr) => (
            <PressableScale
              key={row.mode}
              onClick={() => setEditMode(row.mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 16px',
                width: '100%',
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.border}` : 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: colors.cardAlt,
                border: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={row.icon} size={15} color={colors.textPrimary} />
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted}}>
                  {row.label}
                </div>
                <div style={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  marginTop: 2,
                  color: colors.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {row.value}
                </div>
              </div>
              <Icon name="chevronRight" size={15} color={colors.textMuted} />
            </PressableScale>
          ))}
        </div>

        {/* 3. Appearance & Theme Configuration */}
        <div style={sectionHeaderStyle}>
          <Icon name="sun" size={13} color={colors.textSecondary} />
          <span>Workstation Appearance</span>
        </div>
        <div style={{marginBottom: 10}}>
          <ThemeToggleRow />
        </div>
        <div style={{...glassCardStyle, padding: 14}}>
          <div style={{fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.textSecondary, marginBottom: 10}}>
            Theme Mode Preference
          </div>
          <div style={{display: 'flex', gap: 8}}>
            {modeOptions.map(opt => {
              const isActive = mode === opt.value;
              return (
                <PressableScale
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 12,
                    border: `1.5px solid ${isActive ? colors.primary : colors.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: isActive ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF') : colors.cardAlt,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}>
                  <Icon name={opt.icon} size={18} color={isActive ? colors.primary : colors.textSecondary} />
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: isActive ? colors.primary : colors.textSecondary,
                  }}>
                    {opt.label}
                  </span>
                </PressableScale>
              );
            })}
          </div>
        </div>

        {/* 4. Operational Notifications */}
        <div style={sectionHeaderStyle}>
          <Icon name="bell" size={13} color={colors.textSecondary} />
          <span>Alerts & Notifications</span>
        </div>
        <div style={{...glassCardStyle, padding: '10px 14px'}}>
          <AppSwitch
            label="Task Assignments"
            description="When a new park or retrieval mission is dispatched"
            value={notifTasks}
            onValueChange={setNotifTasks}
          />
          <div style={{height: 1, margin: '8px 0', backgroundColor: colors.border}} />
          <AppSwitch
            label="Shift Reminders"
            description="Check-in, break, and end of shift attendance alerts"
            value={notifShift}
            onValueChange={setNotifShift}
          />
          <div style={{height: 1, margin: '8px 0', backgroundColor: colors.border}} />
          <AppSwitch
            label="System Announcements"
            description="Operational updates, gate changes, and system alerts"
            value={notifUpdates}
            onValueChange={setNotifUpdates}
          />
        </div>

        {/* 5. Progressive Web App Installation */}
        {(canInstall || installed) && (
          <>
            <div style={sectionHeaderStyle}>
              <Icon name="phone" size={13} color={colors.textSecondary} />
              <span>Mobile & Desktop App</span>
            </div>
            <div style={{...glassCardStyle, padding: 14}}>
              {installed ? (
                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon name="check" size={18} color={colors.success} />
                  </div>
                  <div>
                    <div style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>
                      Installed Workstation App
                    </div>
                    <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, marginTop: 1}}>
                      Running natively on this device with offline caching
                    </div>
                  </div>
                </div>
              ) : (
                <PressableScale
                  onClick={handleInstall}
                  disabled={installing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    opacity: installing ? 0.6 : 1,
                    cursor: 'pointer',
                  }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.cardAlt,
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {installing ? (
                      <span className="spinner" style={{width: 16, height: 16, borderColor: colors.border, borderTopColor: colors.primary}} />
                    ) : (
                      <Icon name="phone" size={17} color={colors.textPrimary} />
                    )}
                  </div>
                  <div style={{textAlign: 'left', flex: 1, minWidth: 0}}>
                    <div style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>
                      Install App to Device
                    </div>
                    <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, marginTop: 2}}>
                      Add KIMS Parking to home screen for full-screen view
                    </div>
                  </div>
                  <Icon name="chevronRight" size={16} color={colors.textMuted} />
                </PressableScale>
              )}
            </div>
          </>
        )}

        {/* 6. System Information & Build */}
        <div style={sectionHeaderStyle}>
          <Icon name="info" size={13} color={colors.textSecondary} />
          <span>System Information</span>
        </div>
        <div style={{...glassCardStyle, padding: '4px 14px'}}>
          {[
            ['Software Version', `${APP_VERSION_NAME} (Build ${APP_VERSION_CODE})`],
            ['Platform Environment', 'Enterprise Web Workstation'],
            ['Hospital Network', 'KIMS Hospitals Central Campus'],
          ].map(([label, value], i, arr) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '11px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.border}` : 'none',
              }}>
              <span style={{fontSize: 12, fontWeight: 600, color: colors.textSecondary}}>{label}</span>
              <span style={{fontSize: 12, fontWeight: 800, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>{value}</span>
            </div>
          ))}
        </div>

        {/* 7. Sign Out Decisive Button */}
        <div style={{marginTop: 24}}>
          <PressableScale
            disabled={loggingOut}
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 14,
              height: 48,
              width: '100%',
              backgroundColor: colors.primary,
              opacity: loggingOut ? 0.6 : 1,
              cursor: 'pointer',
              boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
            }}>
            {loggingOut ? (
              <span className="spinner" style={{borderColor: 'rgba(255,255,255,0.4)', borderTopColor: colors.textOnPrimary}} />
            ) : (
              <Icon name="logout" size={16} color={colors.textOnPrimary} />
            )}
            <span style={{fontSize: 13.5, fontWeight: 900, color: colors.textOnPrimary, letterSpacing: 0.2}}>
              {loggingOut ? 'Signing out…' : 'Sign Out of Workstation'}
            </span>
          </PressableScale>
        </div>
      </div>

      {showInstallHelp && <InstallHelpModal onClose={() => setShowInstallHelp(false)} />}
      <EditProfileModal
        mode={editMode}
        onClose={() => setEditMode(null)}
        onSuccess={(m) => setFlashMessage(m)}
      />
      {flashMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: colors.success,
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 12,
          fontSize: 12.5,
          fontWeight: 800,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 10000,
        }}>
          {flashMessage}
        </div>
      )}
    </div>
  );
}
