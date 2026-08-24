import React, {useState, useRef} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {BRAND_GRADIENT, gradientCss} from '../theme/colors';
import {Icon} from '../components/Icon';

export function SignUpScreen({onBackToLogin}: {onBackToLogin: () => void}) {
  const {register} = useAuth();
  const {colors, isDark} = useTheme();
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [shaking, setShaking]   = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
  };

  const handleSignUp = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (!name.trim()) {
      setError('Enter your name');
      triggerShake();
      return;
    }
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit phone number');
      triggerShake();
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), digits, password);
      // AppInner picks up `needsDesignation` and swaps to the designation
      // screen automatically — nothing to navigate to here.
    } catch (err: any) {
      setError(err.message || 'Could not create account');
      triggerShake();
    } finally {
      setLoading(false);
    }
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
      <div className="screen-scroll" style={{paddingBottom: 32}}>

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
          <div style={{color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6, fontWeight: 500}}>Create your account</div>
        </div>

        <div
          className={shaking ? 'shake' : undefined}
          style={{
            margin: 20, marginTop: -24, borderRadius: 24, border: `1px solid ${colors.border}`,
            padding: 24, backgroundColor: colors.surface,
            boxShadow: '0 3px 8px rgba(0,0,0,0.05)',
          }}>
          <div style={{fontSize: 22, fontWeight: 900, marginBottom: 4, color: colors.textPrimary}}>Create Your Login</div>
          <div style={{fontSize: 13, marginBottom: 24, color: colors.textMuted}}>Just your name, phone, and a password</div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              <label style={{fontSize: 11, fontWeight: 800, letterSpacing: 1, color: colors.textSecondary}}>YOUR NAME</label>
              <div style={inputWrap(!!error)}>
                <Icon name="userCard" size={18} color={colors.textMuted} style={{marginRight: 4}} />
                <input
                  style={inputStyle}
                  placeholder="This is exactly what you'll log in as"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') phoneRef.current?.focus(); }}
                />
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              <label style={{fontSize: 11, fontWeight: 800, letterSpacing: 1, color: colors.textSecondary}}>PHONE NUMBER</label>
              <div style={inputWrap(!!error)}>
                <Icon name="lock" size={18} color={colors.textMuted} style={{marginRight: 4}} />
                <input
                  ref={phoneRef}
                  style={inputStyle}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(''); }}
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
                  placeholder="At least 8 characters"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSignUp(); }}
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

          <PressableScale onClick={handleSignUp} disabled={loading} style={{width: '100%'}}>
            <span style={{
              background: loading ? '#94A3B8' : gradientCss(BRAND_GRADIENT, '90deg'),
              borderRadius: 16, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 20,
            }}>
              {loading
                ? <span className="spinner" />
                : <>
                    <span style={{color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: 0.5}}>Create Account</span>
                    <Icon name="arrowRight" size={20} color="#fff" style={{marginLeft: 8}} />
                  </>
              }
            </span>
          </PressableScale>

          <PressableScale onClick={onBackToLogin} style={{display: 'flex', justifyContent: 'center', marginTop: 18, width: '100%'}}>
            <span style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>
              Already have an account? <span style={{color: colors.primary, fontWeight: 800}}>Sign In</span>
            </span>
          </PressableScale>
        </div>
      </div>
    </div>
  );
}
