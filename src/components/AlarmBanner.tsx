import React from 'react';
import {useAppState} from '../context/AppStateContext';
import {useTheme} from '../context/ThemeContext';
import {PressableScale} from './PressableScale';
import {Icon} from './Icon';

// Full-width in-app alert raised whenever the alarm rings (task initiated /
// alarm-grade notification) — the visible half of the siren, dismissing it
// also silences the sound.
export function AlarmBanner() {
  const {activeAlert, dismissAlert} = useAppState();
  const {colors} = useTheme();

  if (!activeAlert) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90,
      padding: 12,
    }}>
      <div className="pulse" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        borderRadius: 16, padding: '14px 16px',
        backgroundColor: colors.error,
        boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
      }}>
        <span style={{
          width: 40, height: 40, borderRadius: 20, flexShrink: 0,
          backgroundColor: 'rgba(255,255,255,0.2)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="bellAlert" size={20} color="#fff" />
        </span>
        <span style={{flex: 1, minWidth: 0}}>
          <span style={{display: 'block', color: '#fff', fontSize: 14, fontWeight: 900}}>{activeAlert.title}</span>
          <span style={{display: 'block', color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2}}>{activeAlert.body}</span>
        </span>
        <PressableScale
          onClick={dismissAlert}
          style={{
            flexShrink: 0, borderRadius: 12, padding: '8px 14px',
            backgroundColor: 'rgba(255,255,255,0.22)',
            border: '1px solid rgba(255,255,255,0.35)',
          }}>
          <span style={{color: '#fff', fontSize: 12, fontWeight: 800}}>Dismiss</span>
        </PressableScale>
      </div>
    </div>
  );
}
