import React from 'react';
import type {InsightSeverity} from '../../core/copilot/insights';

/*
 * The creature, DOM edition.
 *
 * Deliberately the same shape as the mobile one — a rounded body, two eyes,
 * one highlight — because the two apps should not have different mascots.
 * What differs is only how the motion is expressed: React Native drives its
 * animations through Animated with useNativeDriver, and here they are CSS
 * keyframes (see index.css).
 *
 * Both choices are the same decision underneath: keep the animation off the
 * main thread and out of React. transform and opacity are compositor-only,
 * so this breathes and blinks forever at no JavaScript cost and without
 * re-rendering anything. A requestAnimationFrame loop calling setState would
 * re-render a subtree sixty times a second — the exact pattern removed from
 * the valet and doctor screens this session.
 */

export type CreatureMood = 'asleep' | 'idle' | 'noticing' | 'working';

interface Props {
  mood: CreatureMood;
  severity?: InsightSeverity | null;
  size?: number;
  /** Body colour when there is nothing to report. */
  restColor: string;
  eyeColor: string;
}

const SEVERITY_TINT: Record<InsightSeverity, string> = {
  critical: '#E5484D',
  warn: '#F5A524',
  info: '#4C8DF6',
};

export function Creature({mood, severity, size = 46, restColor, eyeColor}: Props) {
  const body = severity ? SEVERITY_TINT[severity] : restColor;
  const eye = Math.round(size * 0.13);

  const classes = [
    'kp-creature',
    mood === 'asleep' ? 'kp-creature-asleep' : '',
    mood === 'noticing' ? 'kp-creature-hop' : '',
    mood === 'working' ? 'kp-creature-pulse' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: body,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: mood === 'asleep' ? 0.4 : 1,
        transition: 'opacity 400ms ease, background 300ms ease',
        flexShrink: 0,
      }}
    >
      {/* One soft highlight is what stops a flat circle reading as a button
          rather than a face. */}
      <span
        style={{
          position: 'absolute',
          top: size * 0.13,
          left: size * 0.17,
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.28)',
        }}
      />
      <span
        className="kp-creature-eyes"
        style={{display: 'flex', gap: size * 0.19, marginTop: size * 0.06}}
      >
        <span style={{width: eye, height: eye, borderRadius: '50%', background: eyeColor}} />
        <span style={{width: eye, height: eye, borderRadius: '50%', background: eyeColor}} />
      </span>
    </div>
  );
}
