import React, {useState, useRef, useEffect, useCallback} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {BRAND_GRADIENT, gradientCss} from '../theme/colors';
import {Icon} from '../components/Icon';
import {ReleaseNotesModal} from '../components/ReleaseNotesModal';
import {InstallBanner} from '../components/InstallBanner';
import {UpdateBanner} from '../components/UpdateBanner';
import {APP_VERSION_NAME} from '../config/version';

// Quick-login: remembers accounts you've actually signed into on THIS
// browser so switching roles while testing doesn't mean retyping a
// password every time — same convenience tradeoff as the mobile app.
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

export function LoginScreen({onSignUp}: {onSignUp: () => void}) {
  const {login} = useAuth();
  const {colors, isDark} = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
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
        username: u.trim(), password: p,
        role: loggedIn?.role ?? '', name: loggedIn?.name ?? u.trim(),
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

  const inputWrap = (hasError: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    border: `1.5px solid ${hasError ? colors.error : colors.border}`,
    borderRadius: 14, padding: '0 14px', height: 54,
    backgroundColor: isDark ? colors.card : '#F8FAFF',
  });

  const inputStyle: React.CSSProperties = {
    flex: 1, fontSize: 15, fontWeight: 600, border: 'none', background: 'transparent',
    color: colors.textPrimary, minWidth: 0,
  };

  return (
    <div className="phone-frame" style={{backgroundColor: colors.background}}>
      <UpdateBanner />
      <InstallBanner />
      <div className="screen-scroll" style={{paddingBottom: 32}}>

        {/* Hero gradient header */}
        <div style={{
          background: gradientCss(BRAND_GRADIENT),
          padding: '56px 24px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            width: 84, height: 84, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            border: '2px solid rgba(255,255,255,0.3)',
          }}>
            <Icon name="parking" size={44} color="#fff" />
          </div>
          <div style={{color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: -0.5}}>KIMS Hospital</div>
          <div style={{color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6, fontWeight: 500}}>Smart Parking Management System</div>
        </div>

        {/* Login card */}
        <div
          className={shaking ? 'shake' : undefined}
          style={{
            margin: 20, marginTop: -24, borderRadius: 24, border: `1px solid ${colors.border}`,
            padding: 24, backgroundColor: colors.surface,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}>
          <div style={{fontSize: 22, fontWeight: 900, marginBottom: 4, color: colors.textPrimary}}>Welcome Back</div>
          <div style={{fontSize: 13, marginBottom: 24, color: colors.textMuted}}>Sign in to continue your shift</div>

          {/* Quick Login */}
          {savedAccounts.length > 0 && (
            <div style={{marginBottom: 20}}>
              <div style={{fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 10, color: colors.textMuted}}>QUICK LOGIN</div>
              <div className="hscroll" style={{gap: 10, paddingRight: 4}}>
                {savedAccounts.map(acc => (
                  <div
                    key={acc.username}
                    className="pressable"
                    role="button"
                    tabIndex={loading ? -1 : 0}
                    aria-disabled={loading}
                    onClick={() => { if (!loading) handleQuickLogin(acc); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                      border: `1px solid ${colors.border}`, borderRadius: 14,
                      padding: '8px 22px 8px 10px', position: 'relative', cursor: loading ? 'default' : 'pointer',
                      backgroundColor: isDark ? colors.card : '#F8FAFF',
                      opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto',
                    }}>
                    <span style={{
                      width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{fontSize: 13, fontWeight: 800, color: colors.textOnPrimary}}>{acc.name[0]?.toUpperCase()}</span>
                    </span>
                    <span style={{textAlign: 'left'}}>
                      <span style={{
                        display: 'block', fontSize: 12, fontWeight: 700, maxWidth: 110,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: colors.textPrimary,
                      }}>{acc.name}</span>
                      <span style={{display: 'block', fontSize: 10, marginTop: 1, textTransform: 'capitalize', color: colors.textMuted}}>{acc.role}</span>
                    </span>
                    <span
                      onClick={e => { e.stopPropagation(); handleForget(acc); }}
                      style={{position: 'absolute', top: 4, right: 4, padding: 2, display: 'inline-flex'}}>
                      <Icon name="close" size={12} color={colors.textMuted} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              <label style={{fontSize: 11, fontWeight: 800, letterSpacing: 1, color: colors.textSecondary}}>USERNAME</label>
              <div style={inputWrap(!!error)}>
                <Icon name="userCard" size={18} color={colors.textMuted} style={{marginRight: 4}} />
                <input
                  style={inputStyle}
                  placeholder="e.g. Dr. Aditya Sharma"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') passwordRef.current?.focus(); }}
                />
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              <label style={{fontSize: 11, fontWeight: 800, letterSpacing: 1, color: colors.textSecondary}}>PASSWORD</label>
              <div style={inputWrap(!!error)}>
                <Icon name="lock" size={18} color={colors.textMuted} style={{marginRight: 4}} />
                <input
                  ref={passwordRef}
                  style={inputStyle}
                  placeholder="Enter your password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                />
                <PressableScale onClick={() => setShowPass(p => !p)} style={{padding: 4, display: 'inline-flex'}}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={18} color={colors.textMuted} />
                </PressableScale>
              </div>
            </div>
          </div>

          {!!error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
              borderRadius: 12, border: `1px solid ${colors.error}40`, padding: 12,
              backgroundColor: colors.errorLight,
            }}>
              <Icon name="alert" size={15} color={colors.error} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.error}}>{error}</span>
            </div>
          )}

          <PressableScale
            onClick={() => setKeepSignedIn(k => !k)}
            style={{display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 18, width: '100%'}}>
            <span style={{
              width: 20, height: 20, borderRadius: 5, border: `2px solid ${colors.primary}`,
              backgroundColor: keepSignedIn ? colors.primary : 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
            }}>
              {keepSignedIn && <Icon name="checkBold" size={13} color="#fff" />}
            </span>
            <span style={{textAlign: 'left'}}>
              <span style={{display: 'block', fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>Keep me signed in for 12 hours</span>
              <span style={{display: 'block', fontSize: 11, marginTop: 2, color: colors.textMuted}}>You will stay signed in for your full shift</span>
            </span>
          </PressableScale>

          <PressableScale onClick={handleLogin} disabled={loading} style={{width: '100%'}}>
            <span style={{
              background: loading ? '#94A3B8' : gradientCss(BRAND_GRADIENT, '90deg'),
              borderRadius: 16, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 20,
            }}>
              {loading
                ? <span className="spinner" />
                : <>
                    <span style={{color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: 0.5}}>Sign In</span>
                    <Icon name="arrowRight" size={20} color="#fff" style={{marginLeft: 8}} />
                  </>
              }
            </span>
          </PressableScale>

          <PressableScale onClick={onSignUp} style={{display: 'flex', justifyContent: 'center', marginTop: 18, width: '100%'}}>
            <span style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>
              New here? <span style={{color: colors.primary, fontWeight: 800}}>Create an account</span>
            </span>
          </PressableScale>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 8, gap: 6}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <Icon name="shield" size={13} color={colors.textMuted} />
            <span style={{fontSize: 11, fontWeight: 600, color: colors.textMuted}}>Secure Enterprise Login</span>
          </div>
          <div style={{textAlign: 'center', fontSize: 10, color: colors.textMuted}}>KIMS Parking System v{APP_VERSION_NAME} — Web</div>
        </div>
      </div>

      {/* New release published? Feature notes pop up before login. */}
      <ReleaseNotesModal />
    </div>
  );
}
