import React, {useEffect, useState} from 'react';
import {PressableScale} from './PressableScale';
import {InstallHelpModal} from './InstallHelpModal';
import {useTheme} from '../context/ThemeContext';
import {useInstallPrompt} from '../hooks/useInstallPrompt';
import {Icon} from './Icon';

// Pinned to the very top of the screen — the earlier footer button sat below
// the login form and was easy to miss on first load; this can't be. Shown on
// both the login screen and inside the app until installed or dismissed for
// the session (sessionStorage, so it reappears next visit if still not
// installed — it isn't gone forever from one dismiss).
const DISMISS_KEY = '@kims_install_banner_dismissed';

export function InstallBanner() {
  const {colors} = useTheme();
  const {canInstall, promptInstall} = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const [showHelp, setShowHelp] = useState(false);

  // Installing later in the same tab (via Settings) should hide this too.
  useEffect(() => {
    if (!canInstall) setDismissed(true);
  }, [canInstall]);

  if (!canInstall || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleInstall = async () => {
    const shown = await promptInstall();
    if (!shown) setShowHelp(true);
    else dismiss();
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', flexShrink: 0,
        backgroundColor: colors.primary,
      }}>
        <span style={{
          width: 30, height: 30, borderRadius: 15, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.16)',
        }}>
          <Icon name="rocket" size={16} color="#fff" />
        </span>
        <span style={{flex: 1, minWidth: 0, color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: '15px'}}>
          Install KIMS Parking for quick, full-screen access
        </span>
        <PressableScale
          onClick={handleInstall}
          style={{
            flexShrink: 0, borderRadius: 10, padding: '7px 12px',
            backgroundColor: '#fff',
          }}>
          <span style={{color: colors.primary, fontSize: 12, fontWeight: 900}}>Install</span>
        </PressableScale>
        <PressableScale onClick={dismiss} style={{flexShrink: 0, padding: 4, display: 'inline-flex'}}>
          <Icon name="close" size={16} color="rgba(255,255,255,0.75)" />
        </PressableScale>
      </div>
      {showHelp && <InstallHelpModal onClose={() => { setShowHelp(false); dismiss(); }} />}
    </>
  );
}
