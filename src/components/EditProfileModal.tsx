import React, {useEffect, useState} from 'react';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {PressableScale} from './PressableScale';
import {Icon, IconName} from './Icon';
import {typography, spacing, radius} from '../theme';
import {usersApi} from '../services/api';
import {useBackStep} from '../hooks/useBackStep';

export type EditProfileMode = 'name' | 'username' | 'password';

// Same length + character rules the backend enforces, mirrored client-side
// so a user gets a red field before they hit Save instead of a 400 after.
// The server remains the source of truth.
const NAME_MIN = 2, NAME_MAX = 64;
const USERNAME_MIN = 3, USERNAME_MAX = 40;
const PASSWORD_MIN = 8, PASSWORD_MAX = 64;

const NAME_ALLOWED = /^[\p{L}\p{M} .'\-]+$/u;
const USERNAME_ALLOWED = /^[\p{L}\p{N} .]+$/u;

function validateName(v: string): string | null {
  const t = v.trim();
  if (t.length < NAME_MIN) return `Name must be at least ${NAME_MIN} characters`;
  if (t.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer`;
  if (!NAME_ALLOWED.test(t)) return "Only letters, spaces, and . ' - are allowed";
  if (/\s{2,}/.test(t)) return 'No consecutive spaces';
  return null;
}
function validateUsername(v: string): string | null {
  const t = v.trim();
  if (t.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters`;
  if (t.length > USERNAME_MAX) return `Username must be ${USERNAME_MAX} characters or fewer`;
  if (!USERNAME_ALLOWED.test(t)) return 'Only letters, numbers, spaces, and dots';
  if (/\s{2,}/.test(t)) return 'No consecutive spaces';
  return null;
}

function passwordStrength(pw: string): {score: 0 | 1 | 2 | 3 | 4; label: string; color: 'error' | 'warning' | 'success'} {
  if (!pw) return {score: 0, label: '', color: 'error'};
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const c = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
  if (c <= 1) return {score: c, label: 'Weak', color: 'error'};
  if (c === 2) return {score: c, label: 'Fair', color: 'warning'};
  if (c === 3) return {score: c, label: 'Good', color: 'success'};
  return {score: c, label: 'Strong', color: 'success'};
}

type Props = {
  mode: EditProfileMode | null;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
};

export function EditProfileModal({mode, onClose, onSuccess}: Props) {
  const {colors, isDark} = useTheme();
  const {user, updateProfile} = useAuth();

  const [nameValue, setNameValue] = useState('');
  const [usernameValue, setUsernameValue] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset every time the modal opens with a fresh mode, so a half-typed
  // value from one flow can't leak into the next.
  useEffect(() => {
    if (!mode) return;
    setNameValue(user?.name ?? '');
    setUsernameValue(user?.username ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setServerError(null);
    setSaving(false);
    // Intentional: not depending on `user` so a mid-edit remote refresh
    // doesn't wipe what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Lock body scroll while the modal is open — the whole page shouldn't
  // scroll behind a fixed dialog.
  useEffect(() => {
    if (!mode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mode]);

  // Esc-to-close (unless saving) — expected on desktop.
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, saving, onClose]);

  // Back gesture should close this like Esc/the X button does.
  useBackStep(!!mode, onClose);

  if (!mode) return null;

  const title = mode === 'name' ? 'Edit Name' : mode === 'username' ? 'Change Username' : 'Change Password';
  const iconName: IconName = mode === 'name' ? 'user' : mode === 'username' ? 'userCard' : 'lock';

  let clientError: string | null = null;
  let canSubmit = false;
  if (mode === 'name') {
    clientError = validateName(nameValue);
    canSubmit = !clientError && nameValue.trim() !== (user?.name ?? '').trim();
  } else if (mode === 'username') {
    clientError = validateUsername(usernameValue);
    canSubmit = !clientError && usernameValue.trim() !== (user?.username ?? '').trim();
  } else {
    if (!currentPassword) clientError = 'Enter your current password';
    else if (newPassword.length < PASSWORD_MIN) clientError = `New password must be at least ${PASSWORD_MIN} characters`;
    else if (newPassword.length > PASSWORD_MAX) clientError = `New password must be ${PASSWORD_MAX} characters or fewer`;
    else if (newPassword === currentPassword) clientError = 'New password must be different from the current one';
    else if (newPassword !== confirmPassword) clientError = "Passwords don't match";
    canSubmit = !clientError;
  }

  const errorVisible = !!(serverError || (clientError && (
    (mode === 'name' && nameValue !== (user?.name ?? '')) ||
    (mode === 'username' && usernameValue !== (user?.username ?? '')) ||
    (mode === 'password' && (currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0))
  )));
  const showError = serverError ?? clientError;

  const strength = mode === 'password' ? passwordStrength(newPassword) : null;
  const strengthColor = strength ? (strength.color === 'error' ? colors.error : strength.color === 'warning' ? colors.warning : colors.success) : undefined;

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setServerError(null);
    try {
      if (mode === 'name') {
        const updated = await usersApi.updateMe({name: nameValue.trim()});
        updateProfile({name: updated.name});
        onSuccess?.('Name updated');
      } else if (mode === 'username') {
        const updated = await usersApi.updateMe({username: usernameValue.trim()});
        updateProfile({username: updated.username});
        onSuccess?.('Username updated');
      } else {
        await usersApi.changeMyPassword(currentPassword, newPassword);
        onSuccess?.('Password updated');
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Something went wrong';
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  const backdrop: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    animation: 'kims-fade-in 180ms ease-out',
  };
  const dialog: React.CSSProperties = {
    backgroundColor: colors.background, borderRadius: 20, border: `1px solid ${colors.border}`,
    width: '100%', maxWidth: 440, maxHeight: '92vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
    animation: 'kims-slide-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', borderRadius: radius.md,
    border: `1.5px solid ${colors.border}`, backgroundColor: colors.surface,
    color: colors.textPrimary, fontSize: 15, fontWeight: 600,
    outline: 'none',
  };

  return (
    <>
      <style>{`
        @keyframes kims-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kims-slide-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={backdrop} onClick={saving ? undefined : onClose}>
        <div style={dialog} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
          {/* Header */}
          <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 12px'}}>
            <span style={{
              width: 34, height: 34, borderRadius: 12,
              backgroundColor: colors.primaryLight,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={iconName} size={18} color={colors.primary} />
            </span>
            <span style={{flex: 1, fontSize: typography.sizes.md, fontWeight: typography.weights.black, color: colors.textPrimary}}>{title}</span>
            <PressableScale
              onClick={onClose}
              disabled={saving}
              style={{
                width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardAlt,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none',
              }}>
              <Icon name="close" size={16} color={colors.textPrimary} />
            </PressableScale>
          </div>

          {/* Body */}
          <div style={{padding: '4px 20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14}}>
            {mode === 'name' && (
              <Field
                label="Display name"
                helper={`${nameValue.trim().length}/${NAME_MAX}`}
                colors={colors}>
                <input
                  autoFocus
                  style={inputStyle}
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  placeholder="Your full name"
                  maxLength={NAME_MAX}
                  onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                />
              </Field>
            )}

            {mode === 'username' && (
              <>
                <Field
                  label="Login username"
                  helper={`${usernameValue.trim().length}/${USERNAME_MAX}`}
                  colors={colors}>
                  <input
                    autoFocus
                    style={inputStyle}
                    value={usernameValue}
                    onChange={e => setUsernameValue(e.target.value)}
                    placeholder="What you type to log in"
                    maxLength={USERNAME_MAX}
                    autoCapitalize="none"
                    autoCorrect="off"
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                  />
                </Field>
                <div style={{fontSize: 12, lineHeight: '17px', color: colors.textMuted}}>
                  This is what you'll type on the login screen. Must be unique.
                </div>
              </>
            )}

            {mode === 'password' && (
              <>
                <PasswordField
                  label="Current password"
                  value={currentPassword} onChange={setCurrentPassword}
                  reveal={showCurrent} onToggle={() => setShowCurrent(v => !v)}
                  autoFocus colors={colors} inputStyle={inputStyle}
                />
                <PasswordField
                  label="New password"
                  helper={`${newPassword.length}/${PASSWORD_MAX}`}
                  value={newPassword} onChange={setNewPassword}
                  reveal={showNew} onToggle={() => setShowNew(v => !v)}
                  colors={colors} inputStyle={inputStyle}
                />
                {newPassword.length > 0 && strength && strengthColor && (
                  <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: -6}}>
                    <div style={{display: 'flex', flex: 1, gap: 4}}>
                      {[1, 2, 3, 4].map(step => (
                        <div key={step} style={{
                          flex: 1, height: 4, borderRadius: 2,
                          backgroundColor: step <= strength.score ? strengthColor : colors.cardAlt,
                        }} />
                      ))}
                    </div>
                    <span style={{fontSize: 11, fontWeight: 800, minWidth: 42, textAlign: 'right', color: strengthColor}}>{strength.label}</span>
                  </div>
                )}
                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword} onChange={setConfirmPassword}
                  reveal={showConfirm} onToggle={() => setShowConfirm(v => !v)}
                  colors={colors} inputStyle={inputStyle}
                  onEnter={submit}
                />
                <div style={{
                  display: 'flex', gap: 8, padding: 10, borderRadius: 10,
                  backgroundColor: colors.cardAlt, border: `1px solid ${colors.border}`,
                  alignItems: 'flex-start',
                }}>
                  <Icon name="shield" size={14} color={colors.textSecondary} />
                  <span style={{flex: 1, fontSize: 11.5, lineHeight: '16px', color: colors.textSecondary}}>
                    Use at least 8 characters. Mixing upper and lower case, numbers, and symbols makes it stronger.
                  </span>
                </div>
              </>
            )}

            {errorVisible && showError && (
              <div style={{
                display: 'flex', gap: 8, padding: 10, borderRadius: 10,
                backgroundColor: colors.errorLight, border: `1px solid ${colors.error}55`,
                alignItems: 'flex-start',
              }}>
                <Icon name="alert" size={14} color={colors.error} />
                <span style={{flex: 1, fontSize: 12, fontWeight: 700, lineHeight: '16px', color: colors.error}}>{showError}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{display: 'flex', gap: 10, padding: 16, borderTop: `1px solid ${colors.divider}`}}>
            <PressableScale
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1, height: 46, borderRadius: 14, border: 'none',
                backgroundColor: colors.cardAlt,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <span style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>Cancel</span>
            </PressableScale>
            <PressableScale
              onClick={submit}
              disabled={!canSubmit || saving}
              style={{
                flex: 1, height: 46, borderRadius: 14, border: 'none',
                backgroundColor: canSubmit && !saving ? colors.primary : colors.cardAlt,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: canSubmit && !saving ? 'pointer' : 'default',
              }}>
              {saving ? (
                <SpinnerDot color={canSubmit ? colors.textOnPrimary : colors.textMuted} />
              ) : (
                <span style={{fontSize: 14, fontWeight: 800, color: canSubmit ? colors.textOnPrimary : colors.textMuted}}>Save</span>
              )}
            </PressableScale>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({label, helper, colors, children}: {label: string; helper?: string; colors: any; children: React.ReactNode}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.textMuted}}>{label}</span>
        {helper && <span style={{fontSize: 11, fontWeight: 600, color: colors.textMuted}}>{helper}</span>}
      </div>
      {children}
    </div>
  );
}

function PasswordField({label, helper, value, onChange, reveal, onToggle, autoFocus, colors, inputStyle, onEnter}: any) {
  return (
    <Field label={label} helper={helper} colors={colors}>
      <div style={{position: 'relative'}}>
        <input
          autoFocus={autoFocus}
          type={reveal ? 'text' : 'password'}
          style={{...inputStyle, paddingRight: 42}}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={label.toLowerCase().includes('current') ? 'current-password' : 'new-password'}
          maxLength={PASSWORD_MAX}
          onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        />
        <PressableScale
          onClick={onToggle}
          style={{
            position: 'absolute', right: 6, top: 6, bottom: 6, width: 32,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent', border: 'none',
          }}>
          <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} color={colors.textMuted} />
        </PressableScale>
      </div>
    </Field>
  );
}

function SpinnerDot({color}: {color: string}) {
  return (
    <>
      <style>{`@keyframes kims-spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{
        display: 'inline-block', width: 18, height: 18, borderRadius: '50%',
        border: `2px solid ${color}44`, borderTopColor: color,
        animation: 'kims-spin 0.8s linear infinite',
      }} />
    </>
  );
}
