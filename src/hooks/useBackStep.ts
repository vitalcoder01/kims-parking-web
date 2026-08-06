import {useEffect, useRef} from 'react';

// Web equivalent of mobile's BackHandler pattern (see ValetHomeScreen.tsx's
// hardware-back wiring) for a screen's own internal sub-view — a plain
// conditional full-screen replace (not a real route), so the browser/PWA's
// back gesture has no idea it exists and skips straight past it to
// whatever's behind the whole app.
//
// While `active` is true, pushes one history entry and listens for
// popstate; when back fires, calls onBack (which should flip `active`
// back to false) instead of letting the gesture exit the app/tab.
//
// If the sub-view is instead closed via an in-app control (its own back
// button), the pushed entry is deliberately left unconsumed rather than
// popped programmatically — popping it here would itself fire another
// popstate and risk racing the very effect cleanup that's about to run.
// The cost is one harmless extra back press that lands on the same
// already-closed view before back starts doing anything else — never a
// stuck or broken state, just one no-op press in that specific order of
// operations.
export function useBackStep(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    history.pushState({__backStep: true}, '');
    const handler = () => onBackRef.current();
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [active]);
}
