import React from 'react';
import {Icon, IconName} from '../../../components/Icon';
import {useCc} from './ccTheme';

export type CcSection =
  | 'dashboard' | 'tasks' | 'slots' | 'visitors' | 'drivers'
  | 'staff' | 'notifications' | 'reports' | 'explorer' | 'settings';

interface NavItem {
  key: CcSection;
  label: string;
  icon: IconName;
  available: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {key: 'dashboard', label: 'Executive Dashboard', icon: 'dashboard', available: true},
  {key: 'tasks', label: 'Parking Tasks', icon: 'tasks', available: false},
  {key: 'slots', label: 'Spatial Bay Map', icon: 'parking', available: true},
  {key: 'visitors', label: 'Visitors', icon: 'people', available: false},
  {key: 'drivers', label: 'Driver Operations', icon: 'car', available: true},
  {key: 'staff', label: 'Staff & Attendance', icon: 'staff', available: true},
  {key: 'notifications', label: 'Notifications', icon: 'bell', available: false},
  {key: 'reports', label: 'Reports', icon: 'clipboard', available: false},
  {key: 'explorer', label: 'Analytics Explorer', icon: 'analytics', available: true},
  {key: 'settings', label: 'Console Settings', icon: 'settings', available: true},
];

export function Sidebar({active, onSelect, userName}: {
  active: CcSection;
  onSelect: (s: CcSection) => void;
  userName: string;
}) {
  const cc = useCc();

  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: cc.sidebarBg,
      borderRight: `1px solid ${cc.border}`,
      height: '100%',
      zIndex: 10,
    }}>
      {/* Brand & Station Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '20px 18px 16px',
        borderBottom: `1px solid ${cc.divider}`,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${cc.accentRed}1A`,
          border: `1px solid ${cc.accentRed}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="hospital" size={19} color={cc.accentRed} />
        </div>
        <div style={{minWidth: 0}}>
          <div style={{
            fontSize: 14,
            fontWeight: 900,
            color: cc.textPrimary,
            letterSpacing: -0.3,
            whiteSpace: 'nowrap',
          }}>
            KIMS HOSPITALS
          </div>
          <div style={{
            fontSize: 9,
            fontWeight: 800,
            color: cc.textMuted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}>
            COMMAND CENTER
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <div style={{
          fontSize: 9.5,
          fontWeight: 800,
          color: cc.textMuted,
          letterSpacing: 1,
          textTransform: 'uppercase',
          padding: '6px 10px',
          marginBottom: 2,
        }}>
          Workstation Navigation
        </div>

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
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: on ? `${cc.accentBlue}1C` : 'transparent',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                textAlign: 'left',
                position: 'relative',
                transition: 'all 0.15s ease',
              }}>
              {/* Active left indicator strip */}
              {on && (
                <span style={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  bottom: '20%',
                  width: 3,
                  borderRadius: '0 3px 3px 0',
                  backgroundColor: cc.accentBlue,
                }} />
              )}

              <Icon
                name={item.icon}
                size={16}
                color={on ? cc.accentBlue : cc.textSecondary}
              />

              <span style={{
                flex: 1,
                fontSize: 12.5,
                fontWeight: on ? 800 : 600,
                color: on ? cc.textPrimary : cc.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {item.label}
              </span>

              {disabled && (
                <span style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  color: cc.textMuted,
                  border: `1px solid ${cc.border}`,
                  borderRadius: 999,
                  padding: '1px 5px',
                  letterSpacing: 0.5,
                }}>
                  SOON
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Facility Metadata Footer */}
      <div style={{
        padding: '12px 18px',
        borderTop: `1px solid ${cc.divider}`,
        backgroundColor: `${cc.card}66`,
      }}>
        <div style={{fontSize: 11.5, fontWeight: 800, color: cc.textPrimary}}>
          KIMS Health City
        </div>
        <div style={{fontSize: 10, color: cc.textMuted, marginTop: 1, lineHeight: '14px'}}>
          Visakhapatnam Campus
        </div>
      </div>

      {/* Super Admin User Capsule */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 18px',
        borderTop: `1px solid ${cc.divider}`,
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: `${cc.accentBlue}22`,
          border: `1px solid ${cc.accentBlue}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{fontSize: 11.5, fontWeight: 900, color: cc.accentBlue}}>
            {userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{
            fontSize: 12,
            fontWeight: 800,
            color: cc.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {userName}
          </div>
          <div style={{fontSize: 10, fontWeight: 700, color: cc.textMuted}}>
            Executive Super Admin
          </div>
        </div>
      </div>
    </div>
  );
}
