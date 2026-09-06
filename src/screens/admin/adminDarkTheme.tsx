import React, {useState} from 'react';
import {CcThemeMode, readCcThemeMode} from './commandcenter/ccTheme';

/*
 * Shared "ops console" theme for the admin console's live-data screens
 * (Staff, Attendance, Map — Guard and Intelligence were removed from
 * navigation entirely, see App.tsx/Sidebar.tsx). One source of truth so
 * every screen uses the exact same tokens instead of copy-pasted palettes
 * drifting apart.
 *
 * Dark palette is the REAL token set from LaunchDarkly's design system
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
 * Originally fixed-dark by design; now offers a light variant too (same
 * request as the command-center dashboard's toggle) and shares that
 * dashboard's persisted preference (see ccTheme.ts's readCcThemeMode) —
 * one light/dark choice for the whole admin console, not a separate
 * toggle per screen. Still scoped to the admin role only — Analytics and
 * Settings are shared with other roles and stay in the app's normal
 * light/dark theme; restyling those would change what a valet or driver
 * sees too.
 */
export interface AdminOpsPalette {
  bg: string; surface: string; card: string; cardAlt: string; border: string; divider: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  accent: string; accent2: string; success: string; warning: string; danger: string;
}

const darkPalette: AdminOpsPalette = {
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

const lightPalette: AdminOpsPalette = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#EEF0F4',
  border: '#DEE2E9',
  divider: '#E7EAF0',
  textPrimary: '#15171C',
  textSecondary: '#565C6B',
  textMuted: '#8A8F9C',
  accent: '#4F5FDB',
  accent2: '#0891B2',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
};

/** Reads the shared admin theme-mode preference and returns the matching
 *  palette. Re-read on mount only (like AdminDashboardMobile's own theme
 *  state) — switching tabs remounts the screen, which is enough to pick
 *  up a change made elsewhere; it doesn't need to update live while two
 *  screens are mounted simultaneously, since only one is ever visible. */
export function useAdminOpsTheme(): AdminOpsPalette {
  const [mode] = useState<CcThemeMode>(() => readCcThemeMode());
  return mode === 'light' ? lightPalette : darkPalette;
}

/** Card surface + border — the one recurring container style. */
export function darkCard(t: AdminOpsPalette): React.CSSProperties {
  return {borderRadius: 20, border: `1px solid ${t.border}`, backgroundColor: t.card};
}

/** Section eyebrow label — small caps, muted, above every card. */
export function darkSectionLabel(t: AdminOpsPalette): React.CSSProperties {
  return {fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: t.textMuted, marginBottom: 8};
}

/** Empty-state text, centered inside a card. */
export function darkEmptyText(t: AdminOpsPalette): React.CSSProperties {
  return {padding: '20px 0', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: t.textMuted};
}

/*
 * Radial progress gauge — the one signature element shared across the
 * strongest references found in a Dribbble "parking scheme" search
 * (Kites Design's "Paragon Park", RonDesignLab's and Purrweb's parking
 * apps all use a glowing circular progress ring for the live headline
 * number rather than a plain stat). Built from scratch as inline SVG —
 * no library, no traced/copied artwork. `textColor` defaults to white
 * (the original dark-only look) — callers on a light background should
 * pass their palette's textPrimary explicitly.
 */
export function RadialGauge({pct, size = 84, stroke = 8, color, trackColor, textColor = '#fff'}: {
  pct: number; size?: number; stroke?: number; color: string; trackColor: string; textColor?: string;
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
        <span style={{fontSize: size * 0.24, fontWeight: 900, color: textColor}}>{Math.round(pct)}%</span>
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
