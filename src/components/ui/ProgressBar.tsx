import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import {transition, duration, easing} from '../../theme';

interface ProgressBarProps {
  /** 0–1. Clamped. */
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
  /** Subtle animated stripes while a job is actively moving. */
  indeterminate?: boolean;
  style?: React.CSSProperties;
}

/**
 * A slim progress track — retrieval ETA, job progress, upload. Fills from the
 * left with the theme ink, animating width changes so progress glides rather
 * than jumps.
 */
export function ProgressBar({value, height = 6, color, trackColor, style}: ProgressBarProps) {
  const {colors} = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={{
      width: '100%', height, borderRadius: height, overflow: 'hidden',
      backgroundColor: trackColor ?? colors.cardAlt, ...style,
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: height,
        backgroundColor: color ?? colors.primary,
        transition: transition('width', duration.slow, easing.standard),
      }} />
    </div>
  );
}
