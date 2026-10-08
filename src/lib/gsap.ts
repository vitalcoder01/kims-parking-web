import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** Stagger a set of elements up from y=24 with fade. */
export function staggerFadeUp(
  targets: string | Element | NodeListOf<Element> | Element[],
  opts: { delay?: number; stagger?: number; duration?: number } = {},
) {
  return gsap.fromTo(
    targets,
    {opacity: 0, y: 22, scale: 0.98},
    {
      opacity: 1, y: 0, scale: 1,
      duration: opts.duration ?? 0.48,
      ease: 'power2.out',
      stagger: opts.stagger ?? 0.055,
      delay: opts.delay ?? 0,
      clearProps: 'transform,opacity',
    },
  );
}

/** Pop a single element in with a spring scale. */
export function scaleIn(target: string | Element, delay = 0) {
  return gsap.fromTo(
    target,
    {opacity: 0, scale: 0.94},
    {opacity: 1, scale: 1, duration: 0.38, ease: 'back.out(1.6)', delay, clearProps: 'transform,opacity'},
  );
}

/** Fade-slide a header or hero section down from y=-16. */
export function fadeDown(target: string | Element, delay = 0) {
  return gsap.fromTo(
    target,
    {opacity: 0, y: -16},
    {opacity: 1, y: 0, duration: 0.42, ease: 'power2.out', delay, clearProps: 'transform,opacity'},
  );
}
