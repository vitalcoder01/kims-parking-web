import React from 'react';
import {PressableScale} from '../PressableScale';
import {Icon, IconName} from '../Icon';
import {useTheme} from '../../context/ThemeContext';

type Variant = 'plain' | 'soft' | 'solid';

interface IconButtonProps {
  icon: IconName;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  size?: number;
  variant?: Variant;
  color?: string;
  ariaLabel: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/**
 * A circular icon-only control — back buttons, close buttons, overflow and
 * quick actions. `soft` gives it a neutral chip, `solid` an ink fill, `plain`
 * is just the glyph. Always takes an aria-label since it has no visible text.
 */
export function IconButton({
  icon, onClick, size = 40, variant = 'soft', color, ariaLabel, disabled, style,
}: IconButtonProps) {
  const {colors, isDark} = useTheme();

  const bg = variant === 'solid' ? colors.primary : variant === 'soft' ? colors.cardAlt : 'transparent';
  const fg = color ?? (variant === 'solid' ? colors.textOnPrimary : colors.textSecondary);

  return (
    <PressableScale
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="ui-focusable"
      style={{
        ['--ui-ring' as any]: isDark ? 'rgba(243,243,241,0.45)' : 'rgba(21,22,26,0.5)',
        width: size, height: size, borderRadius: size / 2,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg, border: 'none',
        opacity: disabled ? 0.45 : 1, ...style,
      }}>
      <Icon name={icon} size={Math.round(size * 0.46)} color={fg} />
    </PressableScale>
  );
}
