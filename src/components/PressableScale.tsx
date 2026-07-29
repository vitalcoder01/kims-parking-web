import React from 'react';

interface Props extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  scaleTo?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

// Web equivalent of the app's PressableScale — same tactile press feedback
// (scale-down + fade on press) via CSS :active, rendered as an unstyled
// button so it's a structural drop-in wherever the app used one.
export function PressableScale({scaleTo = 0.96, style, children, className, ...rest}: Props) {
  return (
    <button
      type="button"
      className={`pressable ${className ?? ''}`}
      style={{['--press-scale' as any]: scaleTo, ...style}}
      {...rest}>
      {children}
    </button>
  );
}
