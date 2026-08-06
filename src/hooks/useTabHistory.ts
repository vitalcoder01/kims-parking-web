import {useEffect, useRef, useState} from 'react';

// Tab switches inside the app are plain useState — no URL, no history
// entry — so the PWA's back gesture had no way to undo one. It just
// exited straight to whatever was behind the app entirely, from any tab.
//
// This wraps a tab-key useState with the History API: switching tabs
// pushes an entry carrying the new tab key, and popstate restores
// whichever tab key it lands back on. Falls through to a genuine app
// exit once there's nothing left in OUR pushed entries — the browser's
// own history underneath takes over from there, exactly as it should.
export function useTabHistory<T extends string>(initial: T) {
  const [tab, setTabState] = useState<T>(initial);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    // Establish a base entry carrying the starting tab, so the very first
    // popstate (before any in-app tab switch has pushed anything) still
    // has a well-defined state to read instead of null.
    history.replaceState({tab: tabRef.current}, '');
    const handler = (e: PopStateEvent) => {
      const next = e.state?.tab as T | undefined;
      if (next) setTabState(next);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forward navigation only — a popstate-driven change goes through
  // setTabState directly above, never back through here, or it would
  // push a fresh entry on top of the one back just landed on.
  const changeTab = (next: T) => {
    if (next === tabRef.current) return;
    history.pushState({tab: next}, '');
    setTabState(next);
  };

  return [tab, changeTab] as const;
}
