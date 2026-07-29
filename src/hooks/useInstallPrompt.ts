import {useEffect, useState, useCallback} from 'react';
import {
  getDeferredInstallPrompt,
  clearDeferredInstallPrompt,
  subscribeInstallPrompt,
} from '../services/installPrompt';

// The raw beforeinstallprompt event is captured at module load by
// services/installPrompt.ts (it usually fires before React mounts); this
// hook just mirrors it into state. `canInstall` is true whenever the app
// isn't already installed — if the browser gave us the native prompt we use
// it, otherwise promptInstall() returns false so the caller can show manual
// "how to install" instructions instead.
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(getDeferredInstallPrompt);
  const [installed, setInstalled] = useState(
    () => window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as any).standalone === true, // iOS Safari
  );

  useEffect(() => {
    const unsub = subscribeInstallPrompt(e => {
      setDeferred(e);
      if (e === null) setInstalled(true);
    });
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const onMq = (e: MediaQueryListEvent) => setInstalled(e.matches);
    mq?.addEventListener?.('change', onMq);
    return () => {
      unsub();
      mq?.removeEventListener?.('change', onMq);
    };
  }, []);

  /** Returns true if the native prompt was shown, false if the caller
   *  should present manual install instructions. */
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferred) return false;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    clearDeferredInstallPrompt();
    setDeferred(null);
    return true;
  }, [deferred]);

  return {
    canInstall: !installed,        // show the button whenever not installed
    hasNativePrompt: !!deferred,   // native browser dialog available
    installed,
    promptInstall,
  };
}
