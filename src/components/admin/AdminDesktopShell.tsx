import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {AdminSidebar, AdminNavItem} from './AdminSidebar';
import {AdminTopBar} from './AdminTopBar';
import type {CurrentUser} from '../../context/AuthContext';

interface Props {
  navItems: AdminNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  title: string;
  subtitle?: string;
  user: CurrentUser | null;
  onLogout: () => void;
  children: React.ReactNode;
}

// Desktop layout for the Admin console: a fixed left sidebar for the six
// admin tabs plus a top bar (page title + account menu), replacing the
// phone-frame + bottom-tab shell every other role/viewport keeps using.
// Only ever mounted when role === 'admin' AND the viewport clears the
// desktop breakpoint (see useIsDesktop) — nothing else changes.
export function AdminDesktopShell({navItems, activeKey, onSelect, title, subtitle, user, onLogout, children}: Props) {
  const {colors} = useTheme();

  return (
    <div style={{display: 'flex', height: '100dvh', backgroundColor: colors.background}}>
      <AdminSidebar items={navItems} activeKey={activeKey} onSelect={onSelect} />
      <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative'}}>
        <AdminTopBar title={title} subtitle={subtitle} user={user} onLogout={onLogout} />
        <div className="screen-scroll" style={{flex: 1, minHeight: 0}}>
          {/* Capped width so screens not yet redesigned for wide viewports
              (Staff/Attendance/Map/Analytics/Settings) don't stretch
              edge-to-edge on a large monitor. */}
          <div style={{maxWidth: 1280, margin: '0 auto'}}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
