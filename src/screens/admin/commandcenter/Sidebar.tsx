import React from 'react';
import {Icon, IconName} from '../../../components/Icon';
import {useCc} from './ccTheme';

// 'liveview' (Guard) and 'insights' (AI Insights/Intelligence) were removed
// entirely by request — not just hidden, dropped from the type so nothing
// can accidentally navigate there again.
export type CcSection =
  | 'dashboard' | 'tasks' | 'slots' | 'visitors' | 'drivers'
  | 'staff' | 'notifications' | 'reports' | 'explorer' | 'settings';

interface NavItem {
  key: CcSection;
  label: string;
  icon: IconName;
  /** false = no existing screen backs this yet; shown disabled with a "Soon" tag rather than a fake link. */
  available: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {key: 'dashboard', label: 'Dashboard', icon: 'dashboard', available: true},
  {key: 'tasks', label: 'Parking Tasks', icon: 'tasks', available: false},
  {key: 'slots', label: 'Parking Slots', icon: 'parking', available: true},
  {key: 'visitors', label: 'Visitors', icon: 'people', available: false},
  {key: 'drivers', label: 'Drivers', icon: 'car', available: true},
  {key: 'staff', label: 'Staff & Attendance', icon: 'staff', available: true},
  {key: 'notifications', label: 'Notifications', icon: 'bell', available: false},
  {key: 'reports', label: 'Reports', icon: 'clipboard', available: false},
  {key: 'explorer', label: 'Analytics Explorer', icon: 'analytics', available: true},
  {key: 'settings', label: 'Settings', icon: 'settings', available: true},
];

export function Sidebar({active, onSelect, userName}: {active: CcSection; onSelect: (s: CcSection) => void; userName: string}) {
  const cc = useCc();
  return (
    <div style={{
      width: 232, flexShrink: 0, display: 'flex', flexDirection: 'column',
      backgroundColor: cc.sidebarBg, borderRight: `1px solid ${cc.border}`, height: '100%',
    }}>
      {/* Brand */}
      <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 16px'}}>
        <div style={{width: 34, height: 34, borderRadius: 9, backgroundColor: cc.accentRed + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <Icon name="hospital" size={18} color={cc.accentRed} />
        </div>
        <div style={{minWidth: 0}}>
          <div style={{fontSize: 14, fontWeight: 900, color: cc.textPrimary, letterSpacing: -0.2, whiteSpace: 'nowrap'}}>KIMS</div>
          <div style={{fontSize: 9, fontWeight: 700, color: cc.textMuted, letterSpacing: 1.2}}>HOSPITALS</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 10px'}}>
        {NAV_ITEMS.map(item => {
          const on = item.key === active;
          const disabled = !item.available;
          return (
            <button
              key={item.key}
              type="button"
              disabled={disabled}
              onClick={() => item.available && onSelect(item.key)}
              className="pressable"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 12px', borderRadius: 9, marginBottom: 2, border: 'none',
                backgroundColor: on ? cc.accentBlue + '20' : 'transparent',
                cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
                textAlign: 'left',
              }}>
              <Icon name={item.icon} size={16} color={on ? cc.accentBlue : cc.textSecondary} />
              <span style={{flex: 1, fontSize: 12.5, fontWeight: on ? 800 : 600, color: on ? cc.textPrimary : cc.textSecondary}}>{item.label}</span>
              {disabled && (
                <span style={{fontSize: 8.5, fontWeight: 800, color: cc.textMuted, border: `1px solid ${cc.border}`, borderRadius: 999, padding: '2px 6px'}}>SOON</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hospital footer + account */}
      <div style={{padding: '14px 18px', borderTop: `1px solid ${cc.divider}`}}>
        <div style={{fontSize: 12, fontWeight: 800, color: cc.textPrimary}}>KIMS Hospitals</div>
        <div style={{fontSize: 10.5, color: cc.textMuted, marginTop: 2, lineHeight: '14px'}}>Seethammadara<br />Visakhapatnam</div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderTop: `1px solid ${cc.divider}`}}>
        <div style={{width: 30, height: 30, borderRadius: 15, backgroundColor: cc.accentBlue + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <span style={{fontSize: 11, fontWeight: 800, color: cc.accentBlue}}>{userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: 11.5, fontWeight: 700, color: cc.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{userName}</div>
          <div style={{fontSize: 10, color: cc.textMuted}}>Super Admin</div>
        </div>
      </div>
    </div>
  );
}
