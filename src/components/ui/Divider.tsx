import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {Text} from './Text';

interface DividerProps {
  /** Optional centered label ("or", "today"). */
  label?: string;
  spacing?: number;
  style?: React.CSSProperties;
}

/** A hairline rule, optionally with a centered label. */
export function Divider({label, spacing = 16, style}: DividerProps) {
  const {colors} = useTheme();
  if (!label) {
    return <div style={{height: 1, backgroundColor: colors.divider, margin: `${spacing}px 0`, ...style}} />;
  }
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 12, margin: `${spacing}px 0`, ...style}}>
      <div style={{flex: 1, height: 1, backgroundColor: colors.divider}} />
      <Text variant="overline" tone="muted" uppercase>{label}</Text>
      <div style={{flex: 1, height: 1, backgroundColor: colors.divider}} />
    </div>
  );
}
