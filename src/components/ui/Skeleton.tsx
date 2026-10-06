import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {radius as radiusTokens} from '../../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  circle?: boolean;
  style?: React.CSSProperties;
}

/**
 * A shimmering loading placeholder. Shaped like the content it stands in for
 * so nothing jumps when real data lands. Uses the travelling-highlight
 * shimmer (index.css .ui-shimmer), tuned to the active theme.
 */
export function Skeleton({width = '100%', height = 14, radius, circle, style}: SkeletonProps) {
  const {isDark} = useTheme();
  const base = isDark ? 'rgba(243,243,241,0.06)' : 'rgba(21,22,26,0.05)';
  const glint = isDark ? 'rgba(243,243,241,0.13)' : 'rgba(21,22,26,0.11)';
  return (
    <span
      className="ui-shimmer"
      style={{
        ['--ui-skel-base' as any]: base,
        ['--ui-skel-glint' as any]: glint,
        display: 'block', width,
        height: circle ? width : height,
        borderRadius: circle ? '50%' : radius ?? radiusTokens.sm,
        ...style,
      }}
    />
  );
}

/** A few stacked skeleton lines — the common "loading a text block" case. */
export function SkeletonText({lines = 3, style}: {lines?: number; style?: React.CSSProperties}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 8, ...style}}>
      {Array.from({length: lines}).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
