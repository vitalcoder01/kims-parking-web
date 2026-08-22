import React, {useState, useRef, useCallback} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {Icon} from '../components/Icon';
import {APP_VERSION_NAME} from '../config/version';

// Dedicated admin sign-in — reached at /admin, entirely separate from the
// shared LoginScreen every other role uses.
//
// Design reference: Rivian's iOS sign-in (pulled via Mobbin) — warm charcoal
// ground (not pure black), a centered geometric brand mark with huge
// vertical whitespace around it rather than a boxed card, boxed-but-borderless
// input fields sitting directly on the ground, a solid high-contrast pill
// button, and a small gray legal/disclaimer line at the very bottom. That
// language reads as "a serious, singular console" on sight, which a reskin
// of the regular multi-role login card never would.
//
// login() already accepts any WEB_ROLES account — the role check below is
// what actually makes this "the admin login" rather than a re-themed general
// one; a non-admin account is signed straight back out with an explanation.
const BG = '#1C1C1A';
const ACCENT = '#E0A64B';
const BORDER = 'rgba(255,255,255,0.14)';
const BORDER_FOCUS = 'rgba(224,166,75,0.55)';
const TEXT = '#F4F3EF';
const TEXT_MUTED = 'rgba(244,243,239,0.55)';
const TEXT_DIM = 'rgba(244,243,239,0.36)';

export function AdminLoginScreen() {
  const {login, logout} = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState<'user' | 'pass' | null>(null);
  const [shaking, setShaking] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
  };

  const handleLogin = useCallback(async () => {
    if (loading) return;
    setError('');
    if (!username.trim() || !password) {
      setError('Enter your admin username and password.');
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      const loggedIn = await login(username.trim(), password);
      if (loggedIn.role !== 'admin') {
        await logout();
        setError('This console is for administrator accounts only.');
        triggerShake();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }, [login, logout, loading, username, password]);

  const fieldStyle = (key: 'user' | 'pass'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    border: `1.5px solid ${error ? '#D9707855' : focused === key ? BORDER_FOCUS : BORDER}`,
    borderRadius: 12, padding: '0 16px', height: 52,
    backgroundColor: 'rgba(255,255,255,0.02)',
    transition: 'border-color 0.15s ease',
  });

  const inputStyle: React.CSSProperties = {
    flex: 1, fontSize: 15, fontWeight: 500, border: 'none', background: 'transparent',
    color: TEXT, minWidth: 0,
  };

  return (
    <div className="phone-frame" style={{backgroundColor: BG}}>
      <div className="screen-scroll" style={{
        minHeight: '100%', display: 'flex', flexDirection: 'column',
        padding: '0 28px 28px',
      }}>
        {/* Brand mark + huge whitespace, not a boxed hero — the single
            biggest thing that makes this read as "Rivian-style", not
            "dark-mode version of the regular card". */}
        <div style={{flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '14vh', paddingBottom: '9vh'}}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, transform: 'rotate(45deg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${ACCENT}`, marginBottom: 22,
          }}>
            <div style={{transform: 'rotate(-45deg)'}}>
              <Icon name="shield" size={22} color={ACCENT} />
            </div>
          </div>
          <div style={{fontSize: 22, fontWeight: 800, color: TEXT, letterSpacing: -0.3, textAlign: 'center'}}>
            KIMS Admin Console
          </div>
          <div style={{fontSize: 13, color: TEXT_MUTED, marginTop: 8, textAlign: 'center', maxWidth: 240, lineHeight: 1.5}}>
            Operations &amp; oversight for KIMS Hospital Parking.
          </div>
        </div>

        {/* Fields — sit directly on the ground, no card boundary. */}
        <div className={shaking ? 'shake' : undefined} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
          <div style={fieldStyle('user')}>
            <input
              style={inputStyle}
              placeholder="Admin username"
              value={username}
              onFocus={() => setFocused('user')}
              onBlur={() => setFocused(null)}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') passwordRef.current?.focus(); }}
              autoComplete="username"
            />
          </div>
          <div style={fieldStyle('pass')}>
            <input
              ref={passwordRef}
              style={inputStyle}
              placeholder="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
              autoComplete="current-password"
            />
            <PressableScale onClick={() => setShowPass(p => !p)} style={{padding: 4, display: 'inline-flex'}}>
              <Icon name={showPass ? 'eyeOff' : 'eye'} size={16} color={TEXT_DIM} />
            </PressableScale>
          </div>

          {!!error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 2,
              borderRadius: 10, border: '1px solid #D9707833', padding: '10px 12px',
              backgroundColor: 'rgba(217,112,120,0.08)',
            }}>
              <Icon name="alert" size={14} color="#E38B90" style={{marginTop: 1, flexShrink: 0}} />
              <span style={{fontSize: 12.5, fontWeight: 500, color: '#E38B90', lineHeight: 1.4}}>{error}</span>
            </div>
          )}

          <PressableScale onClick={handleLogin} disabled={loading} style={{width: '100%', marginTop: 6}}>
            <span style={{
              backgroundColor: loading ? 'rgba(244,243,239,0.3)' : TEXT,
              borderRadius: 99, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 0.15s ease',
            }}>
              {loading
                ? <span className="spinner" style={{borderColor: 'rgba(0,0,0,0.2)', borderTopColor: BG}} />
                : <span style={{color: BG, fontSize: 15, fontWeight: 700}}>Sign In</span>
              }
            </span>
          </PressableScale>
        </div>

        <div style={{flex: 1, minHeight: 24}} />

        <div style={{textAlign: 'center', fontSize: 11, color: TEXT_DIM, lineHeight: 1.6, paddingTop: 12}}>
          Access to this console is logged and monitored. If you believe you've
          reached this page in error, contact KIMS IT.
          <br />
          KIMS Parking Admin · v{APP_VERSION_NAME}
        </div>
      </div>
    </div>
  );
}
