import React from 'react';
import {Text} from './Text';
import {Icon, IconName} from '../Icon';
import {useTheme} from '../../context/ThemeContext';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  /** A primary action (usually a <Button>), shown under the copy. */
  action?: React.ReactNode;
  /** Tighter padding for inline/in-card empties. */
  compact?: boolean;
  style?: React.CSSProperties;
}

/**
 * The shared "nothing here (yet)" state. A soft icon medallion, a clear
 * title and a calm one-liner — so an empty queue, an empty history and an
 * empty search all feel considered instead of looking like a load that
 * failed. Every list in the app falls back to one of these.
 */
export function EmptyState({icon = 'inbox', title, subtitle, action, compact, style}: EmptyStateProps) {
  const {colors} = useTheme();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      padding: compact ? '28px 20px' : '56px 28px', gap: 6, ...style,
    }}>
      <span style={{
        width: 64, height: 64, borderRadius: 20, marginBottom: 10,
        background: colors.cardAlt,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={30} color={colors.textMuted} />
      </span>
      <Text variant="heading" align="center">{title}</Text>
      {subtitle && (
        <Text variant="body" tone="muted" align="center" style={{maxWidth: 320}}>{subtitle}</Text>
      )}
      {action && <div style={{marginTop: 16}}>{action}</div>}
    </div>
  );
}
