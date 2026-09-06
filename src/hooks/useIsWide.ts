import {useEffect, useState} from 'react';

/**
 * True once the viewport is at least `minWidth` px wide. Used to switch the
 * admin console from its normal phone-frame chrome (see .phone-frame in
 * index.css — every screen in this app is a mobile design, capped at
 * 480px) to the desktop command-center dashboard, which needs real screen
 * real estate and cannot be meaningfully rendered inside that column.
 *
 * matchMedia + a change listener rather than a resize listener: cheaper
 * (only fires at the breakpoint crossing, not on every pixel of a drag)
 * and matches how the CSS itself would express the same breakpoint.
 */
export function useIsWide(minWidth: number): boolean {
  const query = `(min-width: ${minWidth}px)`;
  const [isWide, setIsWide] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsWide(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minWidth]);

  return isWide;
}
