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

// How many saved accounts show before "Show all" — X's login shows two
// rows then a divider; more than a few full-width rows pushes the actual
// username/password fields off-screen, which is the opposite of helpful.
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
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
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

  // Warm neutral, from the palette — the old hardcoded '#F8FAFF' was a cool
  // blue-white, the one cool tone in an otherwise entirely warm-mono app.
  const fieldFill = isDark ? colors.card : colors.cardAlt;
  const visibleAccounts = showAllAccounts ? savedAccounts : savedAccounts.slice(0, VISIBLE_ACCOUNTS);

  // Fill-first, border only on focus/error — a resting field is a calm
  // surface, and the border appears exactly when it means something.
  const inputWrap = (isFocused: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    border: `1.5px solid ${error ? colors.error : isFocused ? colors.primary : 'transparent'}`,
    borderRadius: 16, padding: '0 16px', height: 56,
    backgroundColor: fieldFill,
  });

  const inputStyle: React.CSSProperties = {
    flex: 1, fontSize: 15.5, fontWeight: 600, border: 'none', background: 'transparent',
    color: colors.textPrimary, minWidth: 0, outline: 'none',
  };

  const fieldLabel: React.CSSProperties = {fontSize: 13, fontWeight: 700, color: colors.textSecondary};

  return (
    <div className="phone-frame" style={{backgroundColor: colors.background}}>
      <UpdateBanner />
      <InstallBanner />
      <div className="screen-scroll" style={{paddingBottom: 32}}>

        {/* Hero — the mark is a solid light tile rather than the old
            translucent ring: a confident app-icon-like shape reads as a
            real brand, a 20%-white box with a 30%-white border reads as a
            placeholder. */}
        <div style={{
          background: gradientCss(BRAND_GRADIENT),
          padding: '72px 24px 52px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            width: 76, height: 76, borderRadius: 22, backgroundColor: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
          }}>
            <Icon name="parking" size={38} color="#15161A" />
          </div>
          <div style={{color: '#fff', fontSize: 30, fontWeight: 900, letterSpacing: -0.8}}>KIMS Hospital</div>
          <div style={{color: 'rgba(255,255,255,0.62)', fontSize: 13.5, marginTop: 7, fontWeight: 500}}>Smart Parking Management</div>
        </div>

        {/* Login card */}
        <div
          className={shaking ? 'shake' : undefined}
          style={{
            margin: 16, marginTop: -28, borderRadius: 28, border: `1px solid ${colors.border}`,
            padding: 24, paddingTop: 28, backgroundColor: colors.surface,
            boxShadow: '0 3px 8px rgba(0,0,0,0.05)',
          }}>
          <div style={{fontSize: 27, fontWeight: 900, letterSpacing: -0.6, color: colors.textPrimary}}>Welcome back</div>
          <div style={{fontSize: 14, marginTop: 5, marginBottom: 26, color: colors.textMuted}}>Sign in to continue your shift</div>

          {/* Saved accounts — full-width rows, not cramped horizontal chips
              with an × overlapping the corner. Mobbin reference: X's
              "Continue with your existing accounts" and Duolingo's
              device-account picker both use exactly this shape (avatar,
              name + secondary line, remove action on the right). */}
          {savedAccounts.length > 0 && (
            <div style={{marginBottom: 26}}>
              <div style={{fontSize: 13, fontWeight: 700, marginBottom: 10, color: colors.textSecondary}}>Continue as</div>
              <div style={{borderRadius: 18, border: `1px solid ${colors.border}`, overflow: 'hidden'}}>
                {visibleAccounts.map((acc, i) => (
                  <div
                    key={acc.username}
                    style={{
                      display: 'flex', alignItems: 'center',
                      borderBottom: i < visibleAccounts.length - 1 ? `1px solid ${colors.divider}` : 'none',
                    }}>
                    <div
                      className="pressable"
                      role="button"
                      tabIndex={loading ? -1 : 0}
                      aria-disabled={loading}
                      onClick={() => { if (!loading) handleQuickLogin(acc); }}
                      style={{
                        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 0 12px 14px', cursor: loading ? 'default' : 'pointer',
                        opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto',
                      }}>
                      <span style={{
                        width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{fontSize: 15, fontWeight: 800, color: colors.textOnPrimary}}>{acc.name[0]?.toUpperCase()}</span>
                      </span>
                      <span style={{flex: 1, minWidth: 0, textAlign: 'left'}}>
                        <span style={{
                          display: 'block', fontSize: 14.5, fontWeight: 700, color: colors.textPrimary,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{acc.name}</span>
                        <span style={{
                          display: 'block', fontSize: 12, marginTop: 2, textTransform: 'capitalize', color: colors.textMuted,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{acc.role || acc.username}</span>
                      </span>
                    </div>
                    <PressableScale
                      onClick={() => handleForget(acc)}
                      disabled={loading}
                      style={{padding: '18px 16px', background: 'transparent', border: 'none', display: 'inline-flex'}}>
                      <Icon name="close" size={16} color={colors.textMuted} />
                    </PressableScale>
                  </div>
                ))}
              </div>
              {savedAccounts.length > VISIBLE_ACCOUNTS && (
                <PressableScale
                  onClick={() => setShowAllAccounts(v => !v)}
                  style={{background: 'transparent', border: 'none', padding: '10px 0', display: 'flex'}}>
                  <span style={{fontSize: 13, fontWeight: 700, color: colors.textSecondary}}>
                    {showAllAccounts ? 'Show fewer' : `Show all ${savedAccounts.length} accounts`}
                  </span>
                </PressableScale>
              )}
            </div>
          )}

          {/* Fields — no leading icon inside the input. Every premium
              reference (Gymshark, Peacock, Grill'd) uses a clean field; an
              icon in a box on the left is 2015-era chrome that adds nothing
              a label above the field doesn't already say. */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 9}}>
              <label style={fieldLabel}>Username</label>
              <div style={inputWrap(focused === 'username')}>
                <input
                  style={inputStyle}
                  placeholder="e.g. Dr. Aditya Sharma"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  onFocus={() => setFocused('username')}
                  onBlur={() => setFocused(null)}
                  onKeyDown={e => { if (e.key === 'Enter') passwordRef.current?.focus(); }}
                />
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 9}}>
              <label style={fieldLabel}>Password</label>
              <div style={inputWrap(focused === 'password')}>
                <input
                  ref={passwordRef}
                  style={inputStyle}
                  placeholder="Enter your password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                />
                <PressableScale onClick={() => setShowPass(p => !p)} style={{padding: 2, display: 'inline-flex', background: 'transparent', border: 'none'}}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={19} color={colors.textMuted} />
                </PressableScale>
              </div>
            </div>
          </div>

          {!!error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
              borderRadius: 14, padding: 13, backgroundColor: colors.errorLight,
            }}>
              <Icon name="alert" size={15} color={colors.error} />
              <span style={{flex: 1, fontSize: 13, fontWeight: 600, color: colors.error}}>{error}</span>
            </div>
          )}

          <PressableScale
            onClick={() => setKeepSignedIn(k => !k)}
            style={{display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 22, width: '100%', background: 'transparent', border: 'none', padding: 0}}>
            <span style={{
              width: 22, height: 22, borderRadius: 7,
              border: `1.5px solid ${keepSignedIn ? colors.primary : colors.border}`,
              backgroundColor: keepSignedIn ? colors.primary : 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
            }}>
              {keepSignedIn && <Icon name="checkBold" size={12} color={colors.textOnPrimary} />}
            </span>
            <span style={{flex: 1, textAlign: 'left'}}>
              <span style={{display: 'block', fontSize: 13.5, fontWeight: 700, color: colors.textPrimary}}>Keep me signed in for 12 hours</span>
              <span style={{display: 'block', fontSize: 12, marginTop: 2, color: colors.textMuted}}>Covers a full shift without signing in again</span>
            </span>
          </PressableScale>

          {/* Solid, not a gradient — matches every other primary CTA in the
              app and reads more decisive than a near-black-to-black ramp
              nobody can actually see. */}
          <PressableScale
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', backgroundColor: colors.primary, border: 'none',
              borderRadius: 999, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 26, opacity: loading ? 0.65 : 1,
            }}>
            {loading
              ? <span className="spinner" style={{borderColor: 'rgba(255,255,255,0.35)', borderTopColor: '#fff'}} />
              : <>
                  <span style={{color: colors.textOnPrimary, fontSize: 16, fontWeight: 800}}>Sign In</span>
                  <Icon name="arrowRight" size={19} color={colors.textOnPrimary} />
                </>
            }
          </PressableScale>

          <PressableScale onClick={onSignUp} style={{display: 'flex', justifyContent: 'center', marginTop: 20, width: '100%', background: 'transparent', border: 'none'}}>
            <span style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>
              New here? <span style={{color: colors.primary, fontWeight: 800}}>Create an account</span>
            </span>
          </PressableScale>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 8, gap: 6}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <Icon name="shield" size={13} color={colors.textMuted} />
            <span style={{fontSize: 11, fontWeight: 600, color: colors.textMuted}}>Secure enterprise login</span>
          </div>
          <div style={{textAlign: 'center', fontSize: 10, color: colors.textMuted}}>KIMS Parking System v{APP_VERSION_NAME} — Web</div>
        </div>
      </div>

      {/* New release published? Feature notes pop up before login. */}
      <ReleaseNotesModal />
    </div>
  );
}
