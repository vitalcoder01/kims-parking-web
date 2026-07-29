import React from 'react';
import {useTheme} from '../context/ThemeContext';
import {radius, spacing} from '../theme';

interface CardProps {
  style?: React.CSSProperties;
  variant?: 'default' | 'alt' | 'primary';
  children?: React.ReactNode;
}

export function Card({style, variant = 'default', children}: CardProps) {
  const {colors} = useTheme();

  const bg =
    variant === 'primary' ? colors.primaryLight
    : variant === 'alt'   ? colors.cardAlt
    : colors.card;

  const borderColor = variant === 'primary' ? colors.primary + '44' : colors.border;

  return (
    <div style={{
      borderRadius: radius.lg,
      border: `1px solid ${borderColor}`,
      padding: spacing.base,
      marginBottom: spacing.sm,
      backgroundColor: bg,
      ...style,
    }}>
      {children}
    </div>
  );
}
