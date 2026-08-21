import {useEffect, useState} from 'react';

// Breakpoint above which the Admin console gets a real desktop layout
// (sidebar + top bar) instead of the phone-frame shell every other role
// uses. 900px clears a tablet portrait width so an iPad in portrait still
// gets the mobile layout, which is the one actually designed for touch.
const QUERY = '(min-width: 900px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
