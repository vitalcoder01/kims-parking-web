import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {Icon, IconName} from '../Icon';
import {Text} from './Text';
import {radius as radiusTokens} from '../../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: IconName;
  count?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * A selectable filter chip (distinct from Badge, which is a read-only status
 * token). Used for list filters — "All / Drivers", status filters on records,
 * block filters on the map.
 */
export function Chip({label, selected, icon, count, onClick, style}: ChipProps) {
  const {colors} = useTheme();
  return (
    <button
      className="pressable ui-focusable"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 36, padding: '0 14px', borderRadius: radiusTokens.full, cursor: 'pointer',
        backgroundColor: selected ? colors.primary : colors.card,
        border: `1.5px solid ${selected ? colors.primary : colors.border}`,
        transition: 'background-color 160ms, border-color 160ms', ...style,
      }}>
      {icon && <Icon name={icon} size={15} color={selected ? colors.textOnPrimary : colors.textSecondary} />}
      <Text variant="label" color={selected ? colors.textOnPrimary : colors.textSecondary}>{label}</Text>
      {count != null && (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          backgroundColor: selected ? 'rgba(255,255,255,0.2)' : colors.cardAlt,
          color: selected ? colors.textOnPrimary : colors.textMuted,
          fontSize: 11, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{count}</span>
      )}
    </button>
  );
}
