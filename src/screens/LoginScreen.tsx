import React, {useState, useRef, useEffect, useCallback} from 'react';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {Icon} from '../components/Icon';
import {ReleaseNotesModal} from '../components/ReleaseNotesModal';
import {InstallBanner} from '../components/InstallBanner';
import {UpdateBanner} from '../components/UpdateBanner';
import {APP_VERSION_NAME} from '../config/version';

const SAVED_ACCOUNTS_KEY = '@saved_accounts';
const VISIBLE_ACCOUNTS = 3;

interface SavedAccount {
  username: string;
  password: string;
  role: string;
  name: string;
}

function loadSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function rememberAccount(account: SavedAccount) {
  const existing = loadSavedAccounts();
  const next = [account, ...existing.filter(a => a.username.toLowerCase() !== account.username.toLowerCase())].slice(0, 8);
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
}

function forgetAccount(username: string) {
  const existing = loadSavedAccounts();
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(existing.filter(a => a.username !== username)));
}

export function LoginScreen({onSignUp}: {onSignUp: () => void}) {
  const {login} = useAuth();
  const {colors, isDark} = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [focused, setFocused] = useState<'username' | 'password' | null>(null);
  const [shaking, setShaking] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedAccounts(loadSavedAccounts());
  }, []);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
  };

  const doLogin = useCallback(async (u: string, p: string) => {
    if (loading) return;
    setError('');
    if (!u.trim() || !p) {
      setError('Username and password are required');
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      const loggedIn = await login(u.trim(), p);
      rememberAccount({
        username: u.trim(),
        password: p,
        role: loggedIn?.role ?? '',
        name: loggedIn?.name ?? u.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }, [login, loading]);

  const handleLogin = () => doLogin(username, password);

  const handleQuickLogin = (account: SavedAccount) => {
    setUsername(account.username);
    setPassword(account.password);
    doLogin(account.username, account.password);
  };

  const handleForget = (account: SavedAccount) => {
    forgetAccount(account.username);
    setSavedAccounts(loadSavedAccounts());
  };

  const visibleAccounts = showAllAccounts ? savedAccounts : savedAccounts.slice(0, VISIBLE_ACCOUNTS);

  const inputWrapStyle = (isFocused: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: `1px solid ${
      error
        ? colors.error
        : isFocused
        ? isDark ? '#93C5FD' : '#0F172A'
        : isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1'
    }`,
    borderRadius: 8,
    padding: '0 13px',
    height: 42,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.75)',
    boxShadow: isFocused ? (isDark ? '0 0 0 3px rgba(147, 197, 253, 0.15)' : '0 0 0 3px rgba(15, 23, 42, 0.06)') : 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
  });

  const inputStyle: React.CSSProperties = {
    flex: 1,
    fontSize: 13.5,
    fontWeight: 500,
    border: 'none',
    background: 'transparent',
    color: colors.textPrimary,
    minWidth: 0,
    outline: 'none',
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 6,
  };

  return (
    <div
      className="auth-viewport"
      style={{
        background: isDark
          ? 'radial-gradient(circle at 50% 15%, rgba(37, 99, 235, 0.08) 0%, #0F172A 70%)'
          : 'radial-gradient(circle at 50% 15%, rgba(37, 99, 235, 0.05) 0%, #F8FAFC 70%)',
        backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
      }}
    >
      <div style={{width: '100%', maxWidth: 420, marginBottom: 12}}>
        <UpdateBanner />
        <InstallBanner />
      </div>

      <div
        className={`auth-glass-card ${shaking ? 'shake' : ''}`}
        style={{
          backgroundColor: isDark ? 'rgba(24, 27, 36, 0.78)' : 'rgba(255, 255, 255, 0.82)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.85)'}`,
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
            : '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
          padding: '30px 26px',
        }}
      >
        {/* Brand Header */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#0F172A',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="parking" size={20} color="#FFFFFF" />
            </div>
            <div>
              <div style={{fontSize: 16, fontWeight: 700, letterSpacing: -0.2, color: colors.textPrimary}}>
                KIMS Hospital
              </div>
              <div style={{fontSize: 11.5, fontWeight: 500, color: colors.textMuted}}>
                Smart Valet & Parking
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 999,
              backgroundColor: isDark ? 'rgba(74, 222, 154, 0.12)' : 'rgba(31, 138, 91, 0.1)',
              color: colors.success,
              border: `1px solid ${colors.success}33`,
            }}
          >
            Portal
          </span>
        </div>

        {/* Saved accounts ("Continue as") */}
        {savedAccounts.length > 0 && (
          <div style={{marginBottom: 20}}>
            <div style={fieldLabelStyle}>Continue As</div>
            <div
              style={{
                borderRadius: 8,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(226,232,240,0.85)'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248,250,252,0.65)',
                overflow: 'hidden',
              }}
            >
              {visibleAccounts.map((acc, i) => (
                <div
                  key={acc.username}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom:
                      i < visibleAccounts.length - 1
                        ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(226,232,240,0.6)'}`
                        : 'none',
                  }}
                >
                  <button
                    type="button"
                    className="pressable"
                    disabled={loading}
                    onClick={() => handleQuickLogin(acc)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: loading ? 'default' : 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#0F172A',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{fontSize: 12, fontWeight: 700, color: '#fff'}}>
                        {acc.name[0]?.toUpperCase()}
                      </span>
                    </span>
                    <span style={{flex: 1, minWidth: 0}}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          color: colors.textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {acc.name}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: colors.textMuted,
                          textTransform: 'capitalize',
                        }}
                      >
                        {acc.role || acc.username}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: 999,
                        backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.08)',
                        color: isDark ? '#93C5FD' : '#2563EB',
                      }}
                    >
                      {acc.role || 'Staff'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pressable"
                    onClick={() => handleForget(acc)}
                    disabled={loading}
                    aria-label={`Forget ${acc.username}`}
                    style={{
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      opacity: 0.55,
                    }}
                  >
                    <Icon name="close" size={13} color={colors.textMuted} />
                  </button>
                </div>
              ))}
            </div>
            {savedAccounts.length > VISIBLE_ACCOUNTS && (
              <button
                type="button"
                className="pressable"
                onClick={() => setShowAllAccounts(v => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 0',
                  display: 'flex',
                  cursor: 'pointer',
                }}
              >
                <span style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary}}>
                  {showAllAccounts ? 'Show fewer' : `Show all ${savedAccounts.length} accounts`}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Input Fields */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
          <div>
            <label style={fieldLabelStyle}>Username / Staff ID</label>
            <div style={inputWrapStyle(focused === 'username')}>
              <input
                style={inputStyle}
                placeholder="e.g. Dr. Aditya Sharma or valet_01"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setError('');
                }}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') passwordRef.current?.focus();
                }}
              />
            </div>
          </div>

          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <label style={fieldLabelStyle}>Password</label>
            </div>
            <div style={inputWrapStyle(focused === 'password')}>
              <input
                ref={passwordRef}
                style={inputStyle}
                placeholder="Enter password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleLogin();
                }}
              />
              <button
                type="button"
                className="pressable"
                onClick={() => setShowPass(p => !p)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                style={{padding: 2, display: 'inline-flex', background: 'transparent', border: 'none', cursor: 'pointer'}}
              >
                <Icon name={showPass ? 'eyeOff' : 'eye'} size={16} color={colors.textMuted} />
              </button>
            </div>
          </div>
        </div>

        {/* Inline Error Notice */}
        {!!error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 14,
              borderRadius: 8,
              padding: '9px 12px',
              backgroundColor: 'rgba(225, 29, 72, 0.07)',
              border: '1px solid rgba(225, 29, 72, 0.22)',
            }}
          >
            <Icon name="alert" size={14} color="#E11D48" />
            <span style={{flex: 1, fontSize: 12.5, fontWeight: 600, color: '#E11D48'}}>
              {error}
            </span>
          </div>
        )}

        {/* Keep signed in */}
        <button
          type="button"
          className="pressable"
          onClick={() => setKeepSignedIn(k => !k)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginTop: 16,
            width: '100%',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: `1.5px solid ${keepSignedIn ? (isDark ? '#93C5FD' : '#0F172A') : colors.border}`,
              backgroundColor: keepSignedIn ? (isDark ? '#93C5FD' : '#0F172A') : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {keepSignedIn && (
              <Icon name="checkBold" size={10} color={isDark ? '#0F172A' : '#FFFFFF'} />
            )}
          </span>
          <span style={{fontSize: 12.5, fontWeight: 500, color: colors.textSecondary}}>
            Keep me signed in on this workstation (12h)
          </span>
        </button>

        {/* Primary Action CTA */}
        <button
          type="button"
          className="pressable"
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            height: 42,
            borderRadius: 8,
            backgroundColor: isDark ? '#F8FAFC' : '#0F172A',
            color: isDark ? '#0F172A' : '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 20,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'background-color 0.15s ease, opacity 0.15s ease',
          }}
        >
          {loading ? (
            <span
              className="spinner"
              style={{
                width: 15,
                height: 15,
                borderColor: isDark ? 'rgba(15,23,42,0.3)' : 'rgba(255,255,255,0.3)',
                borderTopColor: isDark ? '#0F172A' : '#FFFFFF',
              }}
            />
          ) : (
            <>
              <span style={{fontSize: 13.5, fontWeight: 600}}>Sign In</span>
              <Icon name="arrowRight" size={15} color={isDark ? '#0F172A' : '#FFFFFF'} />
            </>
          )}
        </button>

        {/* Sign up prompt */}
        <div style={{display: 'flex', justifyContent: 'center', marginTop: 18}}>
          <button
            type="button"
            className="pressable"
            onClick={onSignUp}
            style={{background: 'transparent', border: 'none', cursor: 'pointer', padding: 0}}
          >
            <span style={{fontSize: 12.5, fontWeight: 500, color: colors.textMuted}}>
              New staff member?{' '}
              <span style={{color: isDark ? '#93C5FD' : '#2563EB', fontWeight: 600}}>
                Create an account
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          marginTop: 18,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
          <Icon name="shield" size={12} color={colors.textMuted} />
          <span style={{fontSize: 11, fontWeight: 500, color: colors.textMuted}}>
            KIMS Hospital Enterprise Network
          </span>
        </div>
        <div style={{fontSize: 10.5, color: colors.textMuted}}>
          System v{APP_VERSION_NAME}
        </div>
      </div>

      <ReleaseNotesModal />
    </div>
  );
}
