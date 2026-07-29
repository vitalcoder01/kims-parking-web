// beforeinstallprompt often fires BEFORE React mounts (Chrome dispatches it
// as soon as PWA criteria are verified, typically during initial page load).
// A listener attached inside a useEffect misses it, and the event never
// re-fires — so it must be captured here, at module load, and handed to the
// hook afterwards. main.tsx imports this module first.

type Listener = (e: any | null) => void;

let deferredEvent: any | null = null;
const listeners = new Set<Listener>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredEvent = e;
    listeners.forEach(l => l(e));
  });
  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    listeners.forEach(l => l(null));
  });
}

export function getDeferredInstallPrompt(): any | null {
  return deferredEvent;
}

export function clearDeferredInstallPrompt() {
  deferredEvent = null;
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
