import React, {useState} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {BRAND_GRADIENT, gradientCss} from '../theme/colors';
import {Icon, IconName} from '../components/Icon';
import {usersApi} from '../services/api';

// One-time screen shown immediately after self-registration. Never touches
// username or password — only sets the doctor/staff label, which an admin
// can also change later (see backend userService.updateOwnDesignation).
export function DesignationScreen() {
  const {updateProfile, clearNeedsDesignation} = useAuth();
  const {colors} = useTheme();
  const [saving, setSaving] = useState<'doctor' | 'staff' | null>(null);

  const choose = async (role: 'doctor' | 'staff') => {
    if (saving) return;
    setSaving(role);
    try {
      const user = await usersApi.updateMyDesignation(role);
      updateProfile(user);
      clearNeedsDesignation();
    } catch {
      setSaving(null);
    }
  };

  return (
    <div className="phone-frame" style={{backgroundColor: colors.background}}>
      <div style={{
        background: gradientCss(BRAND_GRADIENT),
        padding: '56px 24px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          width: 76, height: 76, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
          border: '2px solid rgba(255,255,255,0.3)',
        }}>
          <Icon name="userCard" size={40} color="#fff" />
        </div>
        <div style={{color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: -0.5}}>One Last Step</div>
        <div style={{color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6, fontWeight: 500}}>How should we set up your account?</div>
      </div>

      <div style={{padding: 20, marginTop: -20, display: 'flex', flexDirection: 'column', gap: 14}}>
        <Option
          icon="userCard"
          label="Doctor"
          sub="For consulting/visiting doctors"
          active={saving === 'doctor'}
          disabled={!!saving}
          colors={colors}
          onClick={() => choose('doctor')}
        />
        <Option
          icon="staff"
          label="Staff"
          sub="For hospital staff members"
          active={saving === 'staff'}
          disabled={!!saving}
          colors={colors}
          onClick={() => choose('staff')}
        />
        <div style={{textAlign: 'center', fontSize: 12, marginTop: 8, color: colors.textMuted}}>
          You can always ask an admin to change this later.
        </div>
      </div>
    </div>
  );
}

function Option({icon, label, sub, active, disabled, colors, onClick}: {
  icon: IconName; label: string; sub: string; active: boolean; disabled: boolean; colors: any; onClick: () => void;
}) {
  return (
    <PressableScale
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: 18, padding: 18, boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
        opacity: disabled && !active ? 0.5 : 1,
      }}>
      <span style={{
        width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary + '18',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {active ? <span className="spinner" style={{borderColor: colors.border, borderTopColor: colors.primary, width: 22, height: 22}} /> : <Icon name={icon} size={26} color={colors.primary} />}
      </span>
      <span style={{flex: 1, textAlign: 'left'}}>
        <span style={{display: 'block', fontSize: 17, fontWeight: 800, color: colors.textPrimary}}>{label}</span>
        <span style={{display: 'block', fontSize: 12, marginTop: 2, color: colors.textMuted}}>{sub}</span>
      </span>
      <Icon name="arrowRight" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}
