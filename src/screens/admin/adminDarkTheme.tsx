import React from 'react';

/*
 * Shared dark "ops console" theme for the admin console's live-data
 * screens (Guard, Dashboard, Staff, Attendance, Map). One source of
 * truth so every screen uses the exact same tokens instead of five
 * copy-pasted palettes drifting apart.
 *
 * Palette is the REAL token set from LaunchDarkly's design system
 * ("Neon control room — a dark cockpit where violet signals pulse
 * through charcoal panels"), sourced via refero.design's DESIGN.md
 * extraction rather than eyeballed off a screenshot — exact hex
 * values, not guesses. One deliberate departure from their spec:
 * LaunchDarkly's own rule is "monochromatic-plus-violet, no green/
 * red/yellow" — but an ops console that can't visually distinguish
 * "free" from "needs a driver" has failed at its actual job, so
 * success/warning/danger stay as minimal, real functional color,
 * used only where they carry meaning.
 *
 * Deliberately fixed-dark regardless of the app's light/dark toggle —
 * a "security console" screen reads right in exactly one register,
 * the same reasoning a camera-monitoring tool stays dark even inside
 * an otherwise light product. Scoped to the admin role only — Analytics
 * and Settings are shared with other roles and stay in the app's normal
 * light/dark theme; restyling those would change what a valet or driver
 * sees too.
 */
export const dark = {
  bg: '#0E0E0E',        // Midnight Ink — page canvas, deepest layer
  surface: '#191919',   // Carbon — nav/surface level 1
  card: '#191919',      // Carbon — card backgrounds
  cardAlt: '#41404280',  // Graphite, translucent — nested rows
  border: '#41404266',   // Graphite — card borders
  divider: '#2C2C2C',    // Smoke — list dividers, row separators
  textPrimary: '#FFFFFF',   // Paper
  textSecondary: '#A7A9AC', // Fog
  textMuted: '#6D6E71',     // Slate
  accent: '#7084FF',    // Signal Violet — the one primary signal color
  accent2: '#3DD6F5',   // Plasma Cyan — secondary accent, used sparingly
  success: '#4ADE9A',
  warning: '#F0B247',
  danger: '#F1786F',
};

/** Card surface + border — the one recurring container style. */
export const darkCard: React.CSSProperties = {
  borderRadius: 20, border: `1px solid ${dark.border}`, backgroundColor: dark.card,
};

/** Section eyebrow label — small caps, muted, above every card. */
export const darkSectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: dark.textMuted, marginBottom: 8,
};

/** Empty-state text, centered inside a card. */
export const darkEmptyText: React.CSSProperties = {
  padding: '20px 0', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: dark.textMuted,
};

/*
 * Radial progress gauge — the one signature element shared across the
 * strongest references found in a Dribbble "parking scheme" search
 * (Kites Design's "Paragon Park", RonDesignLab's and Purrweb's parking
 * apps all use a glowing circular progress ring for the live headline
 * number rather than a plain stat). Built from scratch as inline SVG —
 * no library, no traced/copied artwork.
 */
export function RadialGauge({pct, size = 84, stroke = 8, color, trackColor}: {
  pct: number; size?: number; stroke?: number; color: string; trackColor: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div style={{position: 'relative', width: size, height: size, flexShrink: 0}}>
      <svg width={size} height={size} style={{transform: 'rotate(-90deg)'}}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{transition: 'stroke-dashoffset 0.5s ease', filter: `drop-shadow(0 0 6px ${color}99)`}}
        />
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <span style={{fontSize: size * 0.24, fontWeight: 900, color: '#fff'}}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

/** Status pill — small rounded badge in an accent tint, used for OCCUPIED/FREE/ON TASK/etc. */
export function DarkPill({label, color}: {label: string; color: string}) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
      backgroundColor: color + '22', color,
    }}>{label}</span>
  );
}
