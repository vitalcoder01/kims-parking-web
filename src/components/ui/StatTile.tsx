import React from 'react';
import {Surface} from './Surface';
import {Text} from './Text';
import {Icon, IconName} from '../Icon';
import {useTheme} from '../../context/ThemeContext';

type Trend = {direction: 'up' | 'down' | 'flat'; label: string};

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  icon?: IconName;
  /** Small contextual note under the value. */
  hint?: string;
  trend?: Trend;
  /** Visually emphasise one tile (inverted ink fill). */
  emphasis?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * A single KPI tile — icon chip, big value, label, optional trend. The
 * dashboards (admin, valet, driver, analytics) are built from rows of these,
 * so they all share one number-forward layout instead of each hand-rolling a
 * stat card.
 */
export function StatTile({label, value, icon, hint, trend, emphasis, onClick, style}: StatTileProps) {
  const {colors} = useTheme();

  const ink = emphasis ? colors.textOnPrimary : colors.textPrimary;
  const sub = emphasis ? (colors.textOnPrimary + 'B3') : colors.textSecondary;
  const chipBg = emphasis ? 'rgba(255,255,255,0.16)' : colors.cardAlt;

  const trendColor = !trend ? undefined
    : trend.direction === 'up' ? colors.success
    : trend.direction === 'down' ? colors.error
    : sub;
  const trendIcon: IconName | undefined = !trend ? undefined
    : trend.direction === 'up' ? 'arrowUp'
    : trend.direction === 'down' ? 'arrowDown' : 'trending';

  return (
    <Surface
      elevation="e1"
      hoverElevation="e2"
      interactive={!!onClick}
      onClick={onClick}
      tone="surface"
      padding={16}
      style={{
        backgroundColor: emphasis ? colors.primary : undefined,
        border: emphasis ? '1px solid transparent' : undefined,
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, ...style,
      }}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        {icon && (
          <span style={{
            width: 34, height: 34, borderRadius: 11, backgroundColor: chipBg,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={18} color={emphasis ? colors.textOnPrimary : colors.textSecondary} />
          </span>
        )}
        {trend && (
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 3}}>
            {trendIcon && <Icon name={trendIcon} size={13} color={trendColor} />}
            <Text variant="caption" color={trendColor} style={{fontWeight: 700}}>{trend.label}</Text>
          </span>
        )}
      </div>
      <div style={{minWidth: 0}}>
        <Text variant="display" color={ink} style={{fontSize: 30, display: 'block'}} numberOfLines={1}>{value}</Text>
        <Text variant="caption" color={sub} numberOfLines={1} style={{display: 'block', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4}}>
          {label}
        </Text>
        {hint && <Text variant="caption" color={sub} numberOfLines={1} style={{display: 'block', marginTop: 4, opacity: 0.85}}>{hint}</Text>}
      </div>
    </Surface>
  );
}
