import {useEffect, useRef} from 'react';
import Lenis from 'lenis';

/**
 * Attach Lenis smooth scroll to any overflow container.
 * Usage:
 *   const ref = useSmoothScroll<HTMLDivElement>();
 *   return <div ref={ref} className="screen-scroll">...</div>;
 */
export function useSmoothScroll<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;
    const wrapper = ref.current;
    if (!wrapper) return;

    const content = wrapper.firstElementChild as HTMLElement | null;
    if (!content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      lerp: 0.1,
      smoothWheel: true,
      overscroll: false,
      syncTouch: false,
    } as any);

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [enabled]);

  return ref;
}
