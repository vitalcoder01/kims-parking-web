import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {radius as radiusTokens, spacing, shadow, type ElevationLevel} from '../../theme';

type Tone = 'surface' | 'alt' | 'primary';

interface SurfaceProps {
  children?: React.ReactNode;
  /** Resting elevation. Default e1. */
  elevation?: ElevationLevel;
  /** Elevation on hover when interactive. Default e2. */
  hoverElevation?: ElevationLevel;
  /** Adds hover-lift, pointer cursor, keyboard focusability. */
  interactive?: boolean;
  tone?: Tone;
  radius?: number;
  padding?: number | string;
  bordered?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

/**
 * The elevated card primitive. Every raised panel in the app is a Surface:
 * one place decides depth (layered shadows, tuned per theme), the warm-mono
 * fills, the hover lift and the focus ring, so screens stop re-deriving a
 * card border + shadow by hand each time.
 */
export function Surface({
  children,
  elevation = 'e1',
  hoverElevation = 'e2',
  interactive = false,
  tone = 'surface',
  radius = radiusTokens.lg,
  padding = spacing.base,
  bordered = true,
  onClick,
  className,
  style,
  ariaLabel,
}: SurfaceProps) {
  const {colors, isDark} = useTheme();

  const bg =
    tone === 'primary' ? colors.primaryLight
    : tone === 'alt'   ? colors.cardAlt
    : colors.card;
  const borderColor = tone === 'primary' ? colors.primary + '33' : colors.border;

  const clickable = interactive || !!onClick;

  const vars = {
    ['--ui-shadow' as any]: shadow(isDark, elevation),
    ['--ui-shadow-hover' as any]: shadow(isDark, hoverElevation),
    ['--ui-ring' as any]: isDark ? 'rgba(243,243,241,0.45)' : 'rgba(21,22,26,0.5)',
  } as React.CSSProperties;

  return (
    <div
      className={`ui-surface${clickable ? ' ui-surface--interactive' : ''}${className ? ' ' + className : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={clickable && onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as any); } } : undefined}
      style={{
        backgroundColor: bg,
        border: bordered ? `1px solid ${borderColor}` : 'none',
        borderRadius: radius,
        padding,
        ...vars,
        ...style,
      }}>
      {children}
    </div>
  );
}
