import React, {useState, useRef, useEffect, useCallback} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {BRAND_GRADIENT, gradientCss} from '../theme/colors';
import {shadow} from '../theme';
import {Icon} from '../components/Icon';
import {Surface, Text, Button, Field, Avatar, IconButton, Aurora, BlurText} from '../components/ui';
import {ReleaseNotesModal} from '../components/ReleaseNotesModal';
import {InstallBanner} from '../components/InstallBanner';
import {UpdateBanner} from '../components/UpdateBanner';
import {APP_VERSION_NAME} from '../config/version';
import {scaleIn, staggerFadeUp} from '../lib/gsap';
import {useSmoothScroll} from '../hooks/useSmoothScroll';

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

  const visibleAccounts = showAllAccounts ? savedAccounts : savedAccounts.slice(0, VISIBLE_ACCOUNTS);
  const scrollRef = useSmoothScroll<HTMLDivElement>();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    scaleIn(card, 0.15);
    const fields = card.querySelectorAll<HTMLElement>('.field-root, button');
    if (fields.length) staggerFadeUp(fields, {delay: 0.35, stagger: 0.06});
  }, []);

  return (
    <div className="phone-frame" style={{backgroundColor: colors.background}}>
      <UpdateBanner />
      <InstallBanner />
      <div ref={scrollRef} className="screen-scroll" style={{paddingBottom: 32}}>

        {/* Hero — Aurora lives here as a soft animated backdrop. The mark
            is a solid light tile: a confident app-icon-like brand shape.
            The gradient band bleeds under the card, which floats over it. */}
        <div style={{
          background: gradientCss(BRAND_GRADIENT),
          padding: '76px 24px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <Aurora colorStops={['#3b4fd4', '#6d28d9', '#1d4ed8']} blend={0.3} speed={0.7} />
          <div style={{
            width: 78, height: 78, borderRadius: 23, backgroundColor: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)', position: 'relative', zIndex: 1,
          }}>
            <Icon name="parking" size={39} color="#15161A" />
          </div>
          <Text variant="display" color="#fff" style={{fontSize: 30, position: 'relative', zIndex: 1}}>
            <BlurText text="KIMS Hospital" delay={0.05} stagger={0.07} style={{fontSize: 30, color: '#fff', fontWeight: 900}} />
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.64)" style={{marginTop: 7, fontWeight: 500, position: 'relative', zIndex: 1}}>
            Smart Parking Management
          </Text>
        </div>

        {/* Login card — floats over the hero on real elevation (e4). */}
        <div ref={cardRef}>
        <Surface
          elevation="e4"
          radius={28}
          padding={24}
          className={shaking ? 'shake' : undefined}
          style={{margin: 16, marginTop: -32, paddingTop: 28}}>
          <Text variant="title" as="div">Welcome back</Text>
          <Text variant="body" tone="muted" as="div" style={{marginTop: 5, marginBottom: 24}}>
            Sign in to continue your shift
          </Text>

          {/* Saved accounts — full-width rows (avatar, name + role, remove).
              Mobbin reference: X's "Continue with your existing accounts"
              and Duolingo's device-account picker use exactly this shape. */}
          {savedAccounts.length > 0 && (
            <div style={{marginBottom: 24}}>
              <Text variant="label" tone="secondary" as="div" style={{marginBottom: 10}}>Continue as</Text>
              <div style={{borderRadius: 18, border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: colors.card}}>
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
                      onKeyDown={e => { if (!loading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleQuickLogin(acc); } }}
                      style={{
                        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 0 12px 14px', cursor: loading ? 'default' : 'pointer',
                        opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto',
                      }}>
                      <Avatar name={acc.name} size={38} />
                      <span style={{flex: 1, minWidth: 0, textAlign: 'left'}}>
                        <Text variant="subhead" numberOfLines={1} as="div">{acc.name}</Text>
                        <Text variant="caption" tone="muted" numberOfLines={1} as="div" style={{marginTop: 2, textTransform: 'capitalize'}}>
                          {acc.role || acc.username}
                        </Text>
                      </span>
                    </div>
                    <IconButton
                      icon="close"
                      ariaLabel={`Remove ${acc.name}`}
                      variant="plain"
                      size={44}
                      color={colors.textMuted}
                      onClick={() => handleForget(acc)}
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>
              {savedAccounts.length > VISIBLE_ACCOUNTS && (
                <PressableScale
                  onClick={() => setShowAllAccounts(v => !v)}
                  style={{background: 'transparent', border: 'none', padding: '10px 0', display: 'flex'}}>
                  <Text variant="label" tone="secondary">
                    {showAllAccounts ? 'Show fewer' : `Show all ${savedAccounts.length} accounts`}
                  </Text>
                </PressableScale>
              )}
            </div>
          )}

          {/* Fields — clean, no leading icon inside the input. A label above
              each field says what it is; chrome in the field adds nothing. */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <Field
              label="Username"
              value={username}
              onChange={v => { setUsername(v); setError(''); }}
              placeholder="e.g. Dr. Aditya Sharma"
              invalid={!!error}
              onEnter={() => passwordRef.current?.focus()}
            />
            <Field
              ref={passwordRef}
              label="Password"
              value={password}
              onChange={v => { setPassword(v); setError(''); }}
              placeholder="Enter your password"
              type={showPass ? 'text' : 'password'}
              invalid={!!error}
              onEnter={handleLogin}
              trailing={
                <IconButton
                  icon={showPass ? 'eyeOff' : 'eye'}
                  ariaLabel={showPass ? 'Hide password' : 'Show password'}
                  variant="plain"
                  size={30}
                  color={colors.textMuted}
                  onClick={() => setShowPass(p => !p)}
                />
              }
            />
          </div>

          {!!error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
              borderRadius: 14, padding: 13, backgroundColor: colors.errorLight,
            }}>
              <Icon name="alert" size={15} color={colors.error} />
              <Text variant="caption" tone="error" style={{flex: 1, fontWeight: 600}}>{error}</Text>
            </div>
          )}

          <PressableScale
            onClick={() => setKeepSignedIn(k => !k)}
            style={{display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 22, width: '100%', background: 'transparent', border: 'none', padding: 0}}>
            <span style={{
              width: 22, height: 22, borderRadius: 7,
              border: `1.5px solid ${keepSignedIn ? colors.primary : colors.borderStrong}`,
              backgroundColor: keepSignedIn ? colors.primary : 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
              boxShadow: keepSignedIn ? shadow(isDark, 'e1') : undefined,
            }}>
              {keepSignedIn && <Icon name="checkBold" size={12} color={colors.textOnPrimary} />}
            </span>
            <span style={{flex: 1, textAlign: 'left'}}>
              <Text variant="subhead" as="div">Keep me signed in for 12 hours</Text>
              <Text variant="caption" tone="muted" as="div" style={{marginTop: 2}}>Covers a full shift without signing in again</Text>
            </span>
          </PressableScale>

          <Button
            onClick={handleLogin}
            loading={loading}
            size="lg"
            fullWidth
            rightIcon="arrowRight"
            style={{marginTop: 24}}>
            Sign In
          </Button>

          <PressableScale onClick={onSignUp} style={{display: 'flex', justifyContent: 'center', marginTop: 18, width: '100%', background: 'transparent', border: 'none'}}>
            <Text variant="caption" tone="muted">
              New here? <span style={{color: colors.primary, fontWeight: 800}}>Create an account</span>
            </Text>
          </PressableScale>
        </Surface>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 8, gap: 6}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <Icon name="shield" size={13} color={colors.textMuted} />
            <Text variant="caption" tone="muted" style={{fontWeight: 600}}>Secure enterprise login</Text>
          </div>
          <Text variant="overline" tone="muted" style={{fontSize: 10, letterSpacing: 0.2}}>
            KIMS Parking System v{APP_VERSION_NAME} — Web
          </Text>
        </div>
      </div>

      {/* New release published? Feature notes pop up before login. */}
      <ReleaseNotesModal />
    </div>
  );
}
