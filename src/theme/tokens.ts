// ─────────────────────────────────────────────────────────────
// KIMS Parking — elevation, motion & type tokens
//
// Additive layer on top of theme/colors.ts. Nothing here changes the
// warm-mono palette; it gives the app the things a flat palette can't:
// a believable sense of depth (layered soft shadows, tuned per theme),
// one shared motion vocabulary (so everything that moves moves the same
// way), and a typographic ramp with real line-heights and tracking so
// headings and body text sit on a consistent rhythm instead of each
// screen picking its own fontSize/weight by hand.
//
// Kept deliberately parallel to the RN app so the same names port over:
// durations are plain numbers (ms), easings are cubic-beziers, and the
// elevation levels map 1:1 to RN shadow configs when we get there.
// ─────────────────────────────────────────────────────────────

import type React from 'react';

// ── Elevation ────────────────────────────────────────────────
// Two layered shadows per level: a tight contact shadow + a softer
// ambient one, which reads far more like real light than a single blur.
// Light uses the ink colour at low alpha (warm, not a cool gray drop);
// dark leans on near-black since a dark surface shows little shadow and
// separates mostly by getting lighter as it rises.
export type ElevationLevel = 'e0' | 'e1' | 'e2' | 'e3' | 'e4';

const lightElevation: Record<ElevationLevel, string> = {
  e0: 'none',
  e1: '0 1px 2px rgba(21,22,26,0.04), 0 1px 3px rgba(21,22,26,0.06)',
  e2: '0 2px 6px rgba(21,22,26,0.05), 0 8px 20px rgba(21,22,26,0.08)',
  e3: '0 10px 28px rgba(21,22,26,0.12), 0 3px 8px rgba(21,22,26,0.08)',
  e4: '0 28px 64px rgba(21,22,26,0.22), 0 10px 24px rgba(21,22,26,0.12)',
};

const darkElevation: Record<ElevationLevel, string> = {
  e0: 'none',
  e1: '0 1px 2px rgba(0,0,0,0.40)',
  e2: '0 4px 16px rgba(0,0,0,0.50)',
  e3: '0 12px 32px rgba(0,0,0,0.55)',
  e4: '0 28px 64px rgba(0,0,0,0.70)',
};

/** Box-shadow string for a level, picked for the active theme. */
export function shadow(isDark: boolean, level: ElevationLevel): string {
  return (isDark ? darkElevation : lightElevation)[level];
}

export const elevation = {light: lightElevation, dark: darkElevation};

// ── Motion ───────────────────────────────────────────────────
// One place every transition and animation reads its timing from, so
// a press, a fade and a sheet slide all feel like the same hand.
export const duration = {
  instant: 80,
  fast: 140,
  base: 220,
  slow: 360,
  slower: 520,
} as const;

export const easing = {
  // Enters and settles — the default for almost everything.
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  // For things arriving (fade/slide in): starts fast, eases to rest.
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  // For things leaving: starts slow, accelerates away.
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  // A small, tasteful overshoot for affirmative moments (toggles, success).
  spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
} as const;

/** `transition()` → a ready-to-use CSS transition string. */
export function transition(
  props: string | string[],
  ms: number = duration.base,
  ease: string = easing.standard,
): string {
  const list = Array.isArray(props) ? props : [props];
  return list.map(p => `${p} ${ms}ms ${ease}`).join(', ');
}

// ── Type ramp ────────────────────────────────────────────────
// Presets that bundle size + weight + line-height + tracking, so a
// screen writes `...text.title` instead of re-deciding four numbers.
// Weights reuse the existing scale; sizes stay in the existing range.
export interface TypePreset {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
}

export const text = {
  // Big brand/number moments (hero figures, screen titles on marketing-y views)
  display: {fontSize: 34, fontWeight: 900, lineHeight: 1.05, letterSpacing: -0.8},
  // Section / screen titles
  title:   {fontSize: 24, fontWeight: 800, lineHeight: 1.12, letterSpacing: -0.5},
  // Card titles, prominent headings
  heading: {fontSize: 18, fontWeight: 800, lineHeight: 1.2,  letterSpacing: -0.2},
  // Sub-headings / list row titles
  subhead: {fontSize: 15.5, fontWeight: 700, lineHeight: 1.3, letterSpacing: -0.1},
  // Default reading text
  body:    {fontSize: 14.5, fontWeight: 500, lineHeight: 1.45, letterSpacing: 0},
  // Dense/secondary reading text
  bodySm:  {fontSize: 13, fontWeight: 500, lineHeight: 1.45, letterSpacing: 0},
  // Field labels, emphasised small text
  label:   {fontSize: 13, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0.1},
  // Captions, helper text
  caption: {fontSize: 12, fontWeight: 600, lineHeight: 1.35, letterSpacing: 0},
  // All-caps eyebrow labels (section eyebrows, badges)
  overline:{fontSize: 11, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0.6},
} satisfies Record<string, TypePreset>;

/** Spread a preset into an inline style, optionally overriding fields. */
export function typePreset(preset: TypePreset, over?: Partial<React.CSSProperties>): React.CSSProperties {
  return {
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
    ...over,
  };
}
