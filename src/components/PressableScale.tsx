import React, {useRef, useState, useCallback} from 'react';

interface Props extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  scaleTo?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

// Web equivalent of the app's PressableScale — same tactile press feedback
// (scale-down + fade on press) via CSS :active, rendered as an unstyled
// button so it's a structural drop-in wherever the app used one.
//
// Also the same re-entrancy guard as the mobile component: a click landing
// while the previous onClick's returned promise hasn't settled is swallowed
// (via a ref, so it's live before the next render) and the button disables
// itself for the same window — protects every action button in the web
// portal from duplicate-submit double-clicks without each screen needing
// its own isSubmitting-style guard.
export function PressableScale({scaleTo = 0.96, style, onClick, disabled, children, className, ...rest}: Props) {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (pendingRef.current) return;
    const result = onClick?.(e);
    if (result && typeof (result as unknown as PromiseLike<unknown>)?.then === 'function') {
      pendingRef.current = true;
      setPending(true);
      (result as unknown as Promise<unknown>).finally(() => {
        pendingRef.current = false;
        setPending(false);
      });
    }
  }, [onClick]);

  return (
    <button
      type="button"
      className={`pressable ${className ?? ''}`}
      style={{['--press-scale' as any]: scaleTo, ...style}}
      disabled={disabled || pending}
      onClick={handleClick}
      {...rest}>
      {children}
    </button>
  );
}
