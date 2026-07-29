import React from 'react';
import {PressableScale} from './PressableScale';
import {useTheme} from '../context/ThemeContext';
import {useServiceWorkerUpdate} from '../hooks/useServiceWorkerUpdate';
import {Icon} from './Icon';

// Tells an already-open tab a new deploy has shipped — without this, a
// single-page app just keeps running whatever JS was loaded at open time
// forever, with no visible sign a fix even landed. Takes priority over
// InstallBanner (rendered above it) since "you're on stale code" matters
// more than "you could install this."
export function UpdateBanner() {
  const {colors} = useTheme();
  const {available, applyUpdate} = useServiceWorkerUpdate();

  if (!available) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', flexShrink: 0,
      backgroundColor: colors.success,
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: 15, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
      }}>
        <Icon name="refresh" size={16} color="#fff" />
      </span>
      <span style={{flex: 1, minWidth: 0, color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: '15px'}}>
        A new version is ready
      </span>
      <PressableScale
        onClick={applyUpdate}
        style={{
          flexShrink: 0, borderRadius: 10, padding: '7px 12px',
          backgroundColor: '#fff',
        }}>
        <span style={{color: colors.success, fontSize: 12, fontWeight: 900}}>Refresh</span>
      </PressableScale>
    </div>
  );
}
