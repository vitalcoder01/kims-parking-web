import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {Icon, IconName} from '../Icon';

interface AvatarProps {
  /** Name — the first letter becomes the fallback initial. */
  name?: string;
  icon?: IconName;
  size?: number;
  /** Inverted ink fill (default) vs. a quiet neutral chip. */
  tone?: 'ink' | 'neutral';
  /** A small status dot in the corner. */
  status?: 'online' | 'busy' | 'off';
  style?: React.CSSProperties;
}

/**
 * Initials / icon avatar. One component for every person chip — the saved
 * accounts on login, staff rows, the driver picker — so the ring, the fill
 * and the optional presence dot are identical wherever a person appears.
 */
export function Avatar({name, icon, size = 40, tone = 'ink', status, style}: AvatarProps) {
  const {colors} = useTheme();
  const bg = tone === 'ink' ? colors.primary : colors.cardAlt;
  const fg = tone === 'ink' ? colors.textOnPrimary : colors.textSecondary;
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '';

  const statusColor =
    status === 'online' ? colors.success
    : status === 'busy' ? colors.warning
    : status === 'off'  ? colors.textMuted
    : undefined;

  return (
    <span style={{position: 'relative', display: 'inline-flex', flexShrink: 0, ...style}}>
      <span style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: bg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon
          ? <Icon name={icon} size={size * 0.46} color={fg} />
          : <span style={{fontSize: size * 0.4, fontWeight: 800, color: fg}}>{initial}</span>}
      </span>
      {statusColor && (
        <span style={{
          position: 'absolute', right: -1, bottom: -1,
          width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28),
          borderRadius: '50%', backgroundColor: statusColor,
          border: `2px solid ${colors.surface}`,
        }} />
      )}
    </span>
  );
}
