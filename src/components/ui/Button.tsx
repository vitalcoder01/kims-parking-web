import React from 'react';
import {PressableScale} from '../PressableScale';
import {Icon, IconName} from '../Icon';
import {useTheme} from '../../context/ThemeContext';
import {radius as radiusTokens} from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  leftIcon?: IconName;
  rightIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Pill (default) vs. a softer rounded rectangle. */
  shape?: 'pill' | 'rounded';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

const SIZES: Record<Size, {height: number; fontSize: number; padding: number; icon: number; gap: number}> = {
  sm: {height: 40, fontSize: 13.5, padding: 16, icon: 17, gap: 7},
  md: {height: 50, fontSize: 15, padding: 20, icon: 19, gap: 8},
  lg: {height: 58, fontSize: 16, padding: 24, icon: 20, gap: 9},
};

/**
 * The one button. Every call-to-action in the app routes through here, so
 * the black primary pill, the bordered secondary, the quiet ghost and the
 * destructive variant all look and press the same. Built on PressableScale,
 * so it keeps the tactile scale-down and the double-submit guard for free.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  shape = 'pill',
  onClick,
  style,
  ariaLabel,
}: ButtonProps) {
  const {colors, isDark} = useTheme();
  const s = SIZES[size];

  const palette: Record<Variant, {bg: string; fg: string; border: string}> = {
    primary:   {bg: colors.primary, fg: colors.textOnPrimary, border: 'transparent'},
    secondary: {bg: colors.surface, fg: colors.textPrimary, border: colors.borderStrong},
    ghost:     {bg: 'transparent', fg: colors.textPrimary, border: 'transparent'},
    danger:    {bg: colors.error, fg: '#fff', border: 'transparent'},
  };
  const {bg, fg, border} = palette[variant];

  return (
    <PressableScale
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      className="ui-focusable"
      style={{
        ['--ui-ring' as any]: isDark ? 'rgba(243,243,241,0.45)' : 'rgba(21,22,26,0.5)',
        width: fullWidth ? '100%' : undefined,
        height: s.height,
        padding: `0 ${s.padding}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        backgroundColor: bg,
        color: fg,
        border: `1.5px solid ${border}`,
        borderRadius: shape === 'pill' ? radiusTokens.full : radiusTokens.md,
        opacity: disabled && !loading ? 0.5 : 1,
        ...style,
      }}>
      {loading ? (
        <span
          className="spinner"
          style={{
            width: s.icon, height: s.icon, borderWidth: 2.5,
            borderColor: variant === 'primary' || variant === 'danger' ? 'rgba(255,255,255,0.35)' : colors.border,
            borderTopColor: fg,
          }}
        />
      ) : (
        <>
          {leftIcon && <Icon name={leftIcon} size={s.icon} color={fg} />}
          {children != null && (
            <span style={{fontSize: s.fontSize, fontWeight: 800, letterSpacing: 0.1, color: fg}}>{children}</span>
          )}
          {rightIcon && <Icon name={rightIcon} size={s.icon} color={fg} />}
        </>
      )}
    </PressableScale>
  );
}
