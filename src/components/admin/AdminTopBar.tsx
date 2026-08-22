import React, {useState} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {PressableScale} from '../PressableScale';
import {Icon} from '../Icon';
import {spacing, radius, typography} from '../../theme';
import type {CurrentUser} from '../../context/AuthContext';

interface Props {
  title: string;
  subtitle?: string;
  user: CurrentUser | null;
  onLogout: () => void;
  onMenuClick: () => void;
}

const roleLabel: Record<string, string> = {
  admin: 'Administrator', doctor: 'Doctor', staff: 'Staff', valet: 'Valet', driver: 'Driver',
};

// Top bar for the Admin console: page title on the left (plus a hamburger
// below 900px to open the sidebar drawer — see .admin-hamburger in
// index.css), the account menu (name, role, Logout) on the right, matching
// where every other role's Settings screen already puts Logout.
export function AdminTopBar({title, subtitle, user, onLogout, onMenuClick}: Props) {
  const {colors} = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (user?.name ?? 'Admin').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, height: 64, padding: '0 16px', gap: spacing.sm,
      borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.surface,
    }}>
      <div style={{display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0}}>
        <PressableScale onClick={onMenuClick} className="admin-hamburger" style={{padding: 6, borderRadius: radius.sm, flexShrink: 0}}>
          <Icon name="menu" size={22} color={colors.textPrimary} />
        </PressableScale>
        <div style={{minWidth: 0}}>
          <div style={{fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{title}</div>
          {subtitle && <div style={{fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{subtitle}</div>}
        </div>
      </div>

      <div style={{position: 'relative', flexShrink: 0}}>
        <PressableScale
          onClick={() => setMenuOpen(o => !o)}
          style={{display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '6px 10px 6px 6px', borderRadius: radius.md, border: `1px solid ${colors.border}`}}>
          <span style={{
            width: 26, height: 26, borderRadius: radius.sm, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.cardAlt,
          }}>
            <span style={{fontSize: 11, fontWeight: typography.weights.bold, color: colors.textPrimary}}>{initials}</span>
          </span>
          <span className="admin-account-name" style={{fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textPrimary}}>{user?.name ?? 'Admin'}</span>
          <Icon name="chevronDown" size={16} color={colors.textMuted} />
        </PressableScale>

        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{position: 'fixed', inset: 0, zIndex: 40}} />
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, width: 200,
              borderRadius: radius.md, border: `1px solid ${colors.border}`, backgroundColor: colors.card,
              boxShadow: `0 4px 16px ${colors.shadow}`, overflow: 'hidden',
            }}>
              <div style={{padding: '10px 14px', borderBottom: `1px solid ${colors.divider}`}}>
                <div style={{fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textPrimary}}>{user?.name}</div>
                <div style={{fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 1}}>{roleLabel[user?.role ?? ''] ?? user?.role}</div>
              </div>
              <PressableScale
                onClick={() => { setMenuOpen(false); onLogout(); }}
                style={{display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', textAlign: 'left'}}>
                <Icon name="logout" size={16} color={colors.error} />
                <span style={{fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.error}}>Log out</span>
              </PressableScale>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
