import React, {useState, useRef} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {BRAND_GRADIENT, gradientCss} from '../theme/colors';
import {Icon} from '../components/Icon';
import {Surface, Text, Button, Field} from '../components/ui';

export function SignUpScreen({onBackToLogin}: {onBackToLogin: () => void}) {
  const {register} = useAuth();
  const {colors} = useTheme();
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

  return (
    <div className="phone-frame" style={{backgroundColor: colors.background}}>
      <div className="screen-scroll" style={{paddingBottom: 32}}>

        <div style={{
          background: gradientCss(BRAND_GRADIENT),
          padding: '64px 24px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            width: 78, height: 78, borderRadius: 23, backgroundColor: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}>
            <Icon name="parking" size={39} color="#15161A" />
          </div>
          <Text variant="title" color="#fff">KIMS Hospital</Text>
          <Text variant="body" color="rgba(255,255,255,0.64)" style={{marginTop: 6, fontWeight: 500}}>
            Create your account
          </Text>
        </div>

        <Surface
          elevation="e4"
          radius={28}
          padding={24}
          className={shaking ? 'shake' : undefined}
          style={{margin: 16, marginTop: -32, paddingTop: 28}}>
          <Text variant="title" as="div">Create your login</Text>
          <Text variant="body" tone="muted" as="div" style={{marginTop: 4, marginBottom: 24}}>
            Just your name, phone and a password
          </Text>

          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <Field
              label="Your name"
              value={name}
              onChange={v => { setName(v); setError(''); }}
              placeholder="This is exactly what you'll log in as"
              leftIcon="userCard"
              invalid={!!error}
              onEnter={() => phoneRef.current?.focus()}
            />
            <Field
              ref={phoneRef}
              label="Phone number"
              value={phone}
              onChange={v => { setPhone(v); setError(''); }}
              placeholder="10-digit mobile number"
              leftIcon="phone"
              inputMode="numeric"
              maxLength={10}
              invalid={!!error}
              onEnter={() => passwordRef.current?.focus()}
            />
            <Field
              ref={passwordRef}
              label="Password"
              value={password}
              onChange={v => { setPassword(v); setError(''); }}
              placeholder="At least 8 characters"
              type={showPass ? 'text' : 'password'}
              leftIcon="lock"
              invalid={!!error}
              onEnter={handleSignUp}
              trailing={
                <PressableScale onClick={() => setShowPass(p => !p)} style={{padding: 4, display: 'inline-flex', background: 'transparent', border: 'none'}}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={18} color={colors.textMuted} />
                </PressableScale>
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

          <Button
            onClick={handleSignUp}
            loading={loading}
            size="lg"
            fullWidth
            rightIcon="arrowRight"
            style={{marginTop: 22}}>
            Create account
          </Button>

          <PressableScale onClick={onBackToLogin} style={{display: 'flex', justifyContent: 'center', marginTop: 18, width: '100%', background: 'transparent', border: 'none'}}>
            <Text variant="caption" tone="muted">
              Already have an account? <span style={{color: colors.primary, fontWeight: 800}}>Sign In</span>
            </Text>
          </PressableScale>
        </Surface>
      </div>
    </div>
  );
}
