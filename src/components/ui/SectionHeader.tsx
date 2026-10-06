import React from 'react';
import {Text} from './Text';
import {Icon, IconName} from '../Icon';
import {useTheme} from '../../context/ThemeContext';

interface SectionHeaderProps {
  title: string;
  /** Small all-caps eyebrow above the title. */
  eyebrow?: string;
  icon?: IconName;
  /** Right-aligned action (a link-styled button, a count, etc.). */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Consistent section heading — optional eyebrow + title on the left, an
 * optional action on the right. Replaces the one-off "bold 15px + a link"
 * rows scattered through the screens so every section reads the same.
 */
export function SectionHeader({title, eyebrow, icon, action, style}: SectionHeaderProps) {
  const {colors} = useTheme();
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 12, marginBottom: 12, ...style,
    }}>
      <div style={{display: 'flex', alignItems: 'center', gap: 9, minWidth: 0}}>
        {icon && (
          <span style={{
            width: 28, height: 28, borderRadius: 9, flexShrink: 0,
            backgroundColor: colors.cardAlt,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={16} color={colors.textSecondary} />
          </span>
        )}
        <div style={{minWidth: 0}}>
          {eyebrow && <Text variant="overline" tone="muted" uppercase style={{display: 'block', marginBottom: 2}}>{eyebrow}</Text>}
          <Text variant="heading" numberOfLines={1}>{title}</Text>
        </div>
      </div>
      {action && <div style={{flexShrink: 0}}>{action}</div>}
    </div>
  );
}
