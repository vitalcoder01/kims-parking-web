import React, {useEffect, useState} from 'react';
import {PressableScale} from './PressableScale';
import {useTheme} from '../context/ThemeContext';
import {APP_VERSION_CODE, APP_VERSION_NAME, RELEASE_NOTES} from '../config/version';
import {Icon} from './Icon';

// "What's New" popup on the login screen. Entirely local/static — NOT the
// mobile app's /api/app/version endpoint (that serves the mobile APK's
// update-check info and previously leaked mobile's version/notes into this
// web-only popup, which is the exact bug this was rewritten to fix). Web
// ships continuously via Vercel, so this just needs to compare its own
// bundled version against what this browser last saw.
const SEEN_KEY = '@kims_seen_release_code';

export function ReleaseNotesModal() {
  const {colors} = useTheme();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    if (APP_VERSION_CODE > seen) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, String(APP_VERSION_CODE));
    setShow(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 360, borderRadius: 22, border: `1px solid ${colors.border}`,
        padding: 24, backgroundColor: colors.card,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 28, marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.primaryLight,
        }}>
          <Icon name="rocket" size={26} color={colors.primary} />
        </div>
        <div style={{fontSize: 19, fontWeight: 900, color: colors.textPrimary}}>What's New</div>
        <div style={{fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: '19px', color: colors.textSecondary}}>
          KIMS Parking Web v{APP_VERSION_NAME} has been released.
        </div>
        {RELEASE_NOTES ? (
          <div style={{
            fontSize: 12, borderRadius: 12, padding: 12, marginTop: 14, lineHeight: '17px',
            alignSelf: 'stretch', color: colors.textMuted, backgroundColor: colors.cardAlt,
          }}>{RELEASE_NOTES}</div>
        ) : null}
        <PressableScale
          onClick={dismiss}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 20, borderRadius: 14, padding: '15px 0', alignSelf: 'stretch',
            backgroundColor: colors.primary, boxShadow: `0 6px 12px ${colors.shadow}`,
          }}>
          <span style={{color: colors.textOnPrimary, fontSize: 14, fontWeight: 900}}>Got it</span>
        </PressableScale>
      </div>
    </div>
  );
}
