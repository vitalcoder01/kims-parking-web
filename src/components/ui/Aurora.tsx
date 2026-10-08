/**
 * Aurora — React Bits (reactbits.dev)
 * Animated soft-light aurora canvas. Fills its absolutely-positioned
 * parent — wrap in position:relative with overflow:hidden.
 *
 * The canvas blends overlapping radial gradients that drift on
 * sinusoidal paths, giving a natural light-shimmer without any
 * external shader dependency.
 */
import React, {useEffect, useRef} from 'react';

interface AuroraProps {
  /** Hex or CSS color strings for each aurora "band". */
  colorStops?: string[];
  /** Opacity multiplier for each band (0–1). */
  blend?: number;
  /** Vertical oscillation amplitude multiplier. */
  amplitude?: number;
  /** Animation speed multiplier. */
  speed?: number;
  style?: React.CSSProperties;
}

export function Aurora({
  colorStops = ['#5B4DDA', '#7C3AED', '#2563EB'],
  blend = 0.45,
  amplitude = 1,
  speed = 1,
  style,
}: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;
    let w = 0, h = 0;

    function resize() {
      if (!canvas) return;
      w = canvas.offsetWidth || 1;
      h = canvas.offsetHeight || 1;
      canvas.width = w * (window.devicePixelRatio || 1);
      canvas.height = h * (window.devicePixelRatio || 1);
      ctx!.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function hexAlpha(hex: string, a: number): string {
      const alpha = Math.round(a * 255).toString(16).padStart(2, '0');
      if (hex.startsWith('#') && hex.length === 7) return hex + alpha;
      return hex;
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, w, h);
      t += 0.004 * speed;

      for (let i = 0; i < colorStops.length; i++) {
        const phase = (i / colorStops.length) * Math.PI * 2;
        const cx = w * (0.25 + 0.5 * Math.sin(t * 0.8 + phase));
        const cy = h * (0.35 + 0.3 * Math.cos(t * 0.6 + phase * 1.3) * amplitude);
        const r = Math.max(w, h) * (0.6 + 0.2 * Math.sin(t * 0.4 + i * 1.1));

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, hexAlpha(colorStops[i], blend * 1.4));
        grad.addColorStop(0.5, hexAlpha(colorStops[i], blend * 0.6));
        grad.addColorStop(1, hexAlpha(colorStops[i], 0));

        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [colorStops, blend, amplitude, speed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
