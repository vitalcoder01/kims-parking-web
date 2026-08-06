import React, {useEffect, useRef, useState} from 'react';

interface Props {
  // The screen's background colour the row sits on — the fade has to match
  // it exactly (transparent -> this colour) or the edge reads as a visible
  // seam instead of a soft cutoff.
  fadeColor: string;
  // Applied to the WRAPPING div — this is what carries any full-bleed
  // negative margin (e.g. margin: '0 -20px') so the fade lines up with the
  // real screen edge rather than the un-bled content box.
  wrapStyle?: React.CSSProperties;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

// Mirrors mobile's components/HScrollHint.tsx. Every horizontal scroll row
// in this app hides the native scrollbar (the .hscroll CSS class), which
// left rows with no visual cue there was more content off-screen. This adds
// a soft right-edge fade whenever the row actually overflows its width, and
// hides it again once scrolled to the end.
export function HScrollHint({fadeColor, wrapStyle, style, className, children}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setScrollable(el.scrollWidth > el.clientWidth + 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  return (
    <div style={{position: 'relative', overflow: 'hidden', ...wrapStyle}}>
      <div ref={ref} className={className} style={style} onScroll={check}>
        {children}
      </div>
      {scrollable && !atEnd && (
        <div
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 32, pointerEvents: 'none',
            background: `linear-gradient(to right, transparent, ${fadeColor})`,
          }}
        />
      )}
    </div>
  );
}
