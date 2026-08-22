import React, {useState} from 'react';
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

// The Admin console's one shell at every width: a sidebar for the six admin
// tabs plus a top bar (page title + account menu), replacing the phone-
// frame + bottom-tab shell entirely for this role. At >=900px the sidebar
// is a static column; below that it's an off-canvas drawer opened via the
// top bar's hamburger (see the .admin-sidebar/.admin-hamburger rules in
// index.css) — same nav, same content, just how it's reached.
export function AdminDesktopShell({navItems, activeKey, onSelect, title, subtitle, user, onLogout, children}: Props) {
  const {colors} = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{display: 'flex', height: '100dvh', backgroundColor: colors.background}}>
      <AdminSidebar
        items={navItems}
        activeKey={activeKey}
        onSelect={onSelect}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative'}}>
        <AdminTopBar title={title} subtitle={subtitle} user={user} onLogout={onLogout} onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="screen-scroll" style={{flex: 1, minHeight: 0}}>
          {/* Capped width so the content never stretches unreasonably on a
              very large monitor; padding is responsive (admin-content-pad). */}
          <div style={{maxWidth: 1280, margin: '0 auto'}}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
