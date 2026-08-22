import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {PressableScale} from '../PressableScale';
import {Icon, IconName} from '../Icon';
import {spacing, radius, typography} from '../../theme';

export interface AdminNavItem {
  key: string;
  label: string;
  icon: IconName;
}

interface Props {
  items: AdminNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  open: boolean;
  onClose: () => void;
}

// Left nav for the Admin console — a static column at >=900px, an
// off-canvas drawer below that (see .admin-sidebar in index.css). `open`
// only matters in the drawer state; it's harmless at the static width.
export function AdminSidebar({items, activeKey, onSelect, open, onClose}: Props) {
  const {colors} = useTheme();

  return (
    <>
      <div
        className={`admin-sidebar-backdrop${open ? ' is-open' : ''}`}
        onClick={onClose}
      />
      <nav
        className={`admin-sidebar${open ? ' is-open' : ''}`}
        style={{
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${colors.border}`, backgroundColor: colors.surface,
          height: '100%',
        }}>
        <div style={{display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '20px 18px', borderBottom: `1px solid ${colors.border}`}}>
          <div style={{
            width: 30, height: 30, borderRadius: radius.md, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary,
          }}>
            <Icon name="parking" size={16} color={colors.textOnPrimary} />
          </div>
          <div style={{minWidth: 0}}>
            <div style={{fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.textPrimary, whiteSpace: 'nowrap'}}>KIMS Parking</div>
            <div style={{fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 1}}>Admin console</div>
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: 2, padding: spacing.sm, flex: 1, overflowY: 'auto'}}>
          {items.map(item => {
            const active = item.key === activeKey;
            return (
              <PressableScale
                key={item.key}
                onClick={() => { onSelect(item.key); onClose(); }}
                scaleTo={0.99}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing.sm,
                  padding: '9px 12px', borderRadius: radius.md,
                  textAlign: 'left', width: '100%',
                  backgroundColor: active ? colors.cardAlt : 'transparent',
                  borderLeft: `3px solid ${active ? colors.primary : 'transparent'}`,
                }}>
                <Icon name={item.icon} size={18} color={active ? colors.textPrimary : colors.textMuted} />
                <span style={{
                  fontSize: typography.sizes.sm, fontWeight: active ? typography.weights.semibold : typography.weights.medium,
                  color: active ? colors.textPrimary : colors.textSecondary,
                }}>{item.label}</span>
              </PressableScale>
            );
          })}
        </div>
      </nav>
    </>
  );
}
