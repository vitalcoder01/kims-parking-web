import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {Icon, IconName} from '../Icon';
import {Text} from './Text';
import {radius as radiusTokens, transition, duration, easing} from '../../theme';

export interface Segment<T extends string> {
  key: T;
  label: string;
  icon?: IconName;
  /** Optional count badge on the segment. */
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
  style?: React.CSSProperties;
}

/**
 * In-screen view switcher — a track of segments with a single sliding ink
 * pill behind the active one. The valet desk (scan / assign / visitor /
 * retrievals) and record filters use this instead of a row of ad-hoc
 * toggle buttons, so the selected state animates the same everywhere.
 */
export function SegmentedControl<T extends string>({segments, value, onChange, style}: SegmentedControlProps<T>) {
  const {colors} = useTheme();
  const activeIndex = Math.max(0, segments.findIndex(s => s.key === value));
  const pct = 100 / segments.length;

  return (
    <div style={{
      position: 'relative', display: 'flex', padding: 4,
      backgroundColor: colors.cardAlt, borderRadius: radiusTokens.full, ...style,
    }}>
      {/* Sliding indicator */}
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 4, bottom: 4, left: 4,
          width: `calc(${pct}% - 8px)`,
          transform: `translateX(calc(${activeIndex} * (100% + 8px)))`,
          backgroundColor: colors.surface,
          borderRadius: radiusTokens.full,
          boxShadow: '0 1px 3px rgba(21,22,26,0.12)',
          transition: transition(['transform'], duration.base, easing.spring),
        }}
      />
      {segments.map(seg => {
        const active = seg.key === value;
        return (
          <button
            key={seg.key}
            className="pressable ui-focusable"
            onClick={() => onChange(seg.key)}
            style={{
              position: 'relative', zIndex: 1, flex: 1, border: 'none', background: 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 36, borderRadius: radiusTokens.full, cursor: 'pointer',
            }}>
            {seg.icon && <Icon name={seg.icon} size={16} color={active ? colors.textPrimary : colors.textMuted} />}
            <Text variant="label" color={active ? colors.textPrimary : colors.textMuted}>{seg.label}</Text>
            {seg.count != null && seg.count > 0 && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                backgroundColor: active ? colors.primary : colors.borderStrong,
                color: active ? colors.textOnPrimary : colors.textSecondary,
                fontSize: 11, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{seg.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
