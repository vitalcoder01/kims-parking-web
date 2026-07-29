import React from 'react';
import {PressableScale} from './PressableScale';
import {useTheme} from '../context/ThemeContext';
import {Icon} from './Icon';

// Manual install instructions — shown when the browser doesn't offer the
// native install prompt (Firefox, iOS Safari, or Chrome before it has
// verified the PWA criteria / after the user dismissed the native prompt).
export function InstallHelpModal({onClose}: {onClose: () => void}) {
  const {colors} = useTheme();

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const steps = isIos
    ? [
        {icon: 'outbox' as const, text: 'Tap the Share button in Safari'},
        {icon: 'plus' as const, text: "Choose 'Add to Home Screen'"},
        {icon: 'check' as const, text: "Tap 'Add' — KIMS Parking appears like an app"},
      ]
    : [
        {icon: 'dashboard' as const, text: 'Open the browser menu (⋮ or ⋯, top right)'},
        {icon: 'plus' as const, text: "Choose 'Install KIMS Parking' / 'Add to Home screen' / 'Apps → Install this site as an app'"},
        {icon: 'check' as const, text: 'Confirm — the app gets its own icon and window'},
      ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        backdropFilter: 'blur(3px)',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, borderRadius: 22, border: `1px solid ${colors.border}`,
          padding: 24, backgroundColor: colors.card,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16}}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primaryLight,
          }}>
            <Icon name="phone" size={26} color={colors.primary} />
          </div>
          <div style={{fontSize: 19, fontWeight: 900, color: colors.textPrimary}}>Install KIMS Parking</div>
          <div style={{fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: '19px', color: colors.textSecondary}}>
            Add the app to your home screen for full-screen use and faster access.
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20}}>
          {steps.map((s, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <span style={{
                width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.cardAlt,
              }}>
                <Icon name={s.icon} size={16} color={colors.textPrimary} />
              </span>
              <span style={{fontSize: 13, fontWeight: 500, color: colors.textSecondary, lineHeight: '18px'}}>{s.text}</span>
            </div>
          ))}
        </div>

        <PressableScale
          onClick={onClose}
          style={{
            borderRadius: 14, padding: '15px 0', width: '100%',
            backgroundColor: colors.primary,
          }}>
          <span style={{color: colors.textOnPrimary, fontSize: 14, fontWeight: 900}}>Got it</span>
        </PressableScale>
      </div>
    </div>
  );
}
