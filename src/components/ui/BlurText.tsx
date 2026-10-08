/**
 * BlurText — React Bits (reactbits.dev)
 * Text that blurs in unit-by-unit (words or letters) on mount.
 * Each unit fades from blur:10px → sharp with a stagger so it reads
 * like the text is crystallising out of the background.
 */
import React, {useEffect, useRef} from 'react';
import {gsap} from '../../lib/gsap';

interface BlurTextProps {
  text: string;
  animateBy?: 'words' | 'letters';
  /** Initial delay before the animation starts (seconds). */
  delay?: number;
  /** Per-unit stagger (seconds). Default 0.045. */
  stagger?: number;
  className?: string;
  style?: React.CSSProperties;
  onAnimationComplete?: () => void;
}

export function BlurText({
  text,
  animateBy = 'words',
  delay = 0,
  stagger = 0.045,
  className,
  style,
  onAnimationComplete,
}: BlurTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = el.querySelectorAll<HTMLSpanElement>('.bt-unit');

    const tl = gsap.fromTo(
      spans,
      {opacity: 0, filter: 'blur(12px)', y: 8},
      {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        duration: 0.55,
        ease: 'power2.out',
        stagger,
        delay,
        onComplete: onAnimationComplete,
      },
    );
    return () => { tl.kill(); };
  }, [text, delay, stagger, onAnimationComplete]);

  const units = animateBy === 'words' ? text.split(' ') : text.split('');

  return (
    <span ref={ref} className={className} style={{display: 'inline', ...style}}>
      {units.map((unit, i) => (
        <span
          key={i}
          className="bt-unit"
          style={{display: 'inline-block', willChange: 'transform, opacity, filter'}}
        >
          {unit}
          {animateBy === 'words' && i < units.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}
