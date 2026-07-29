import React from 'react';
import {PressableScale} from './PressableScale';
import {useTheme} from '../context/ThemeContext';
import {typography, spacing, radius} from '../theme';
import {Icon} from './Icon';

// ── Toggle switch (web port of the RN Switch, same track/thumb colors) ──
function Switch({value, onValueChange}: {value: boolean; onValueChange: (v: boolean) => void}) {
  const {colors} = useTheme();
  return (
    <span
      role="switch"
      aria-checked={value}
      onClick={e => { e.stopPropagation(); onValueChange(!value); }}
      style={{
        width: 46, height: 26, borderRadius: 13, flexShrink: 0,
        backgroundColor: value ? colors.switchTrackOn : colors.switchTrackOff,
        position: 'relative', cursor: 'pointer', display: 'inline-block',
        transition: 'background-color 0.15s ease',
      }}>
      <span style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: colors.switchThumb,
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'left 0.15s ease',
      }} />
    </span>
  );
}

interface AppSwitchProps {
  label?: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}

export function AppSwitch({label, description, value, onValueChange}: AppSwitchProps) {
  const {colors} = useTheme();

  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing.sm}px 0`}}>
      {(label || description) && (
        <div style={{flex: 1, marginRight: spacing.md, textAlign: 'left'}}>
          {label && (
            <div style={{fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.textPrimary}}>
              {label}
            </div>
          )}
          {description && (
            <div style={{fontSize: typography.sizes.sm, marginTop: 2, color: colors.textSecondary}}>
              {description}
            </div>
          )}
        </div>
      )}
      <Switch value={value} onValueChange={onValueChange} />
    </div>
  );
}

// ── Theme toggle row (the main light/dark switch) ──────────────────
export function ThemeToggleRow() {
  const {isDark, toggle, colors} = useTheme();

  return (
    <PressableScale
      onClick={toggle}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: spacing.base, borderRadius: radius.lg,
        border: `1px solid ${colors.border}`, marginBottom: spacing.sm,
        backgroundColor: colors.card, width: '100%',
      }}>
      <span style={{display: 'flex', alignItems: 'center', gap: spacing.md, flex: 1}}>
        <span style={{
          width: 36, height: 36, borderRadius: 12, backgroundColor: colors.cardAlt,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={isDark ? 'moon' : 'sun'} size={18} color={colors.textPrimary} />
        </span>
        <span style={{textAlign: 'left'}}>
          <span style={{display: 'block', fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.textPrimary}}>
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
          <span style={{display: 'block', fontSize: typography.sizes.sm, marginTop: 2, color: colors.textSecondary}}>
            {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          </span>
        </span>
      </span>
      <Switch value={isDark} onValueChange={toggle} />
    </PressableScale>
  );
}
