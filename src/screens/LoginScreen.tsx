import React, {useState, useRef, useEffect, useCallback} from 'react';
import {useAuth} from '../context/AuthContext';
import {Icon} from '../components/Icon';
import {ReleaseNotesModal} from '../components/ReleaseNotesModal';
import {InstallBanner} from '../components/InstallBanner';
import {UpdateBanner} from '../components/UpdateBanner';
import {APP_VERSION_NAME} from '../config/version';

const SAVED_ACCOUNTS_KEY = '@saved_accounts';

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

type AuthMode = 'quick' | 'credentials' | 'accounts';

export function LoginScreen({onSignUp}: {onSignUp: () => void}) {
  const {login} = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [mode, setMode] = useState<AuthMode>('quick');
  const [focused, setFocused] = useState<'username' | 'password' | null>(null);
  const [shaking, setShaking] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const accounts = loadSavedAccounts();
    setSavedAccounts(accounts);
    if (accounts.length === 0) {
      setMode('credentials');
    } else {
      setMode('quick');
    }
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
    const updated = loadSavedAccounts();
    setSavedAccounts(updated);
    if (updated.length === 0) {
      setMode('credentials');
    }
  };

  const lastAccount = savedAccounts[0];

  return (
    <div className="hinge-auth-viewport">
      <div className="hinge-auth-content">
        {/* Top Header / Brand Section */}
        <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          {/* System banners (Update / PWA Install) */}
          <div style={{width: '100%', marginBottom: 16}}>
            <UpdateBanner />
            <InstallBanner />
          </div>

          {/* Hospital Emblem */}
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 100%)',
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <Icon name="parking" size={28} color="#FFFFFF" />
          </div>

          {/* Hinge-style Bold Brand Title */}
          <h1
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
              margin: 0,
              textAlign: 'center',
              lineHeight: 1.15,
            }}
          >
            KIMS Parking
          </h1>

          {/* Tagline / Subtitle */}
          <p
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.72)',
              margin: '8px 0 0 0',
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}
          >
            Hospital Operations &amp; Valet Dispatch
          </p>
        </div>

        {/* Dynamic Mid & Bottom Controls */}
        <div style={{width: '100%', display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: 28}}>
          {/* Policy & Terms Notice */}
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.52)',
              textAlign: 'center',
              margin: '0 0 16px 0',
              padding: '0 8px',
            }}
          >
            By signing in, you agree to our{' '}
            <span style={{textDecoration: 'underline', color: 'rgba(255, 255, 255, 0.75)'}}>
              Security Policy
            </span>
            . Workstation activity is monitored for patient safety.
          </p>

          {/* Dynamic Context Hint (Hinge: "You signed in last time with...") */}
          {mode === 'quick' && lastAccount && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.92)',
                textAlign: 'center',
                marginBottom: 20,
                letterSpacing: '-0.01em',
              }}
            >
              You signed in last time as{' '}
              <span style={{color: '#93C5FD', fontWeight: 700}}>{lastAccount.name}</span>
              {lastAccount.role ? ` (${lastAccount.role})` : ''}.
            </div>
          )}

          {/* Inline Error Notice */}
          {!!error && (
            <div
              className={shaking ? 'shake' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 9999,
                padding: '10px 16px',
                marginBottom: 16,
                backgroundColor: 'rgba(244, 63, 94, 0.16)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                color: '#FECDD3',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              <Icon name="alert" size={15} color="#FB7185" />
              <span style={{flex: 1}}>{error}</span>
            </div>
          )}

          {/* MODE 1: QUICK SIGN-IN (Hinge Stacked Pills) */}
          {mode === 'quick' && lastAccount && (
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              {/* Primary White Pill Button */}
              <button
                type="button"
                className="hinge-pill-btn hinge-pill-white"
                onClick={() => handleQuickLogin(lastAccount)}
                disabled={loading}
              >
                {loading ? (
                  <span
                    className="spinner"
                    style={{
                      width: 18,
                      height: 18,
                      borderColor: 'rgba(15, 23, 42, 0.25)',
                      borderTopColor: '#0F172A',
                    }}
                  />
                ) : (
                  <>
                    <Icon name="user" size={17} color="#0F172A" />
                    <span>Continue as {lastAccount.name}</span>
                    <Icon name="arrowRight" size={16} color="#0F172A" />
                  </>
                )}
              </button>

              {/* Secondary Blue Pill Button */}
              <button
                type="button"
                className="hinge-pill-btn hinge-pill-blue"
                onClick={() => {
                  setError('');
                  setMode('credentials');
                }}
                disabled={loading}
              >
                <Icon name="key" size={16} color="#FFFFFF" />
                <span>Sign in with Username &amp; Password</span>
              </button>

              {/* Tertiary Frosted Glass Pill (if multiple accounts) */}
              {savedAccounts.length > 1 && (
                <button
                  type="button"
                  className="hinge-pill-btn hinge-pill-glass"
                  onClick={() => {
                    setError('');
                    setMode('accounts');
                  }}
                  disabled={loading}
                >
                  <Icon name="people" size={16} color="#FFFFFF" />
                  <span>Switch Account ({savedAccounts.length} saved)</span>
                </button>
              )}
            </div>
          )}

          {/* MODE 2: CREDENTIALS ENTRY (Frosted Inputs + White Action Pill) */}
          {mode === 'credentials' && (
            <div
              className={shaking ? 'shake' : undefined}
              style={{display: 'flex', flexDirection: 'column', gap: 12}}
            >
              {/* Username Input */}
              <div className={`hinge-input-wrap ${focused === 'username' ? 'focused' : ''} ${error ? 'error' : ''}`}>
                <Icon name="user" size={16} color={focused === 'username' ? '#93C5FD' : 'rgba(255,255,255,0.45)'} />
                <input
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 500,
                    border: 'none',
                    background: 'transparent',
                    color: '#FFFFFF',
                    outline: 'none',
                    minWidth: 0,
                  }}
                  placeholder="Username / Staff ID"
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
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Password Input */}
              <div className={`hinge-input-wrap ${focused === 'password' ? 'focused' : ''} ${error ? 'error' : ''}`}>
                <Icon name="lock" size={16} color={focused === 'password' ? '#93C5FD' : 'rgba(255,255,255,0.45)'} />
                <input
                  ref={passwordRef}
                  type={showPass ? 'text' : 'password'}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 500,
                    border: 'none',
                    background: 'transparent',
                    color: '#FFFFFF',
                    outline: 'none',
                    minWidth: 0,
                  }}
                  placeholder="Password"
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
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="pressable"
                  onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={16} color="rgba(255,255,255,0.6)" />
                </button>
              </div>

              {/* Shift retention toggle */}
              <button
                type="button"
                className="pressable"
                onClick={() => setKeepSignedIn(k => !k)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 2px',
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 4,
                    border: `1.5px solid ${keepSignedIn ? '#93C5FD' : 'rgba(255,255,255,0.3)'}`,
                    backgroundColor: keepSignedIn ? '#93C5FD' : 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {keepSignedIn && <Icon name="checkBold" size={10} color="#0F172A" />}
                </span>
                <span style={{fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.72)'}}>
                  Keep me signed in on this workstation (12h)
                </span>
              </button>

              {/* Primary White Sign In Pill */}
              <button
                type="button"
                className="hinge-pill-btn hinge-pill-white"
                onClick={handleLogin}
                disabled={loading}
                style={{marginTop: 6}}
              >
                {loading ? (
                  <span
                    className="spinner"
                    style={{
                      width: 18,
                      height: 18,
                      borderColor: 'rgba(15, 23, 42, 0.25)',
                      borderTopColor: '#0F172A',
                    }}
                  />
                ) : (
                  <>
                    <span>Sign In</span>
                    <Icon name="arrowRight" size={16} color="#0F172A" />
                  </>
                )}
              </button>

              {/* Back to Quick Sign-in link (if saved accounts exist) */}
              {savedAccounts.length > 0 && (
                <button
                  type="button"
                  className="pressable"
                  onClick={() => {
                    setError('');
                    setMode('quick');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px 0',
                    textAlign: 'center',
                  }}
                >
                  <span style={{fontSize: 13, fontWeight: 600, color: '#93C5FD'}}>
                    &larr; Back to quick sign-in
                  </span>
                </button>
              )}
            </div>
          )}

          {/* MODE 3: ACCOUNTS LIST DRAWER/VIEW */}
          {mode === 'accounts' && (
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div
                style={{
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  overflow: 'hidden',
                }}
              >
                {savedAccounts.map((acc, i) => (
                  <div
                    key={acc.username}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom:
                        i < savedAccounts.length - 1
                          ? '1px solid rgba(255, 255, 255, 0.08)'
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
                        gap: 12,
                        padding: '12px 16px',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        cursor: loading ? 'default' : 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: 'rgba(255, 255, 255, 0.15)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#FFFFFF',
                          flexShrink: 0,
                        }}
                      >
                        {acc.name[0]?.toUpperCase()}
                      </span>
                      <span style={{flex: 1, minWidth: 0}}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: '#FFFFFF',
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
                            color: 'rgba(255, 255, 255, 0.55)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {acc.role || acc.username}
                        </span>
                      </span>
                      <Icon name="arrowRight" size={15} color="rgba(255,255,255,0.4)" />
                    </button>
                    <button
                      type="button"
                      className="pressable"
                      onClick={() => handleForget(acc)}
                      disabled={loading}
                      aria-label={`Forget ${acc.username}`}
                      style={{
                        padding: '12px 14px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        opacity: 0.6,
                      }}
                    >
                      <Icon name="close" size={14} color="#FFFFFF" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Back to quick options */}
              <button
                type="button"
                className="hinge-pill-btn hinge-pill-glass"
                onClick={() => setMode('quick')}
              >
                <span>&larr; Back</span>
              </button>
            </div>
          )}

          {/* New Staff Registration Link */}
          <div style={{display: 'flex', justifyContent: 'center', marginTop: 18}}>
            <button
              type="button"
              className="pressable"
              onClick={onSignUp}
              style={{background: 'transparent', border: 'none', cursor: 'pointer', padding: 4}}
            >
              <span style={{fontSize: 13, fontWeight: 500, color: 'rgba(255, 255, 255, 0.6)'}}>
                New staff member?{' '}
                <span style={{color: '#93C5FD', fontWeight: 600}}>Create an account</span>
              </span>
            </button>
          </div>

          {/* Footer Metadata */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 14,
            }}
          >
            <Icon name="shield" size={11} color="rgba(255, 255, 255, 0.4)" />
            <span style={{fontSize: 10.5, color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500}}>
              KIMS Hospital Network &bull; v{APP_VERSION_NAME}
            </span>
          </div>
        </div>
      </div>

      {/* Release Notes Modal */}
      <ReleaseNotesModal />
    </div>
  );
}
