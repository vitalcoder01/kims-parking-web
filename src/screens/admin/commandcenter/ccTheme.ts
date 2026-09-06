import React, {createContext, useContext} from 'react';

/*
 * Palette for the desktop admin command center — deliberately distinct from
 * ./adminDarkTheme.tsx (the LaunchDarkly-sourced monochrome-plus-violet
 * theme used by the mobile admin screens, which stays fixed-dark by
 * design). That constraint was chosen for THIS app's mobile "ops console"
 * screens; the reference image the command center is built against uses a
 * more saturated blue/purple/green/amber palette, and matching that
 * reference's colors as closely as possible was the brief for this screen —
 * now with a real light/dark toggle, scoped to exactly the surfaces built
 * with this palette (Sidebar, TopHeader, the Dashboard panels). Every other
 * admin screen reused inside the command center's sidebar sections (Guard,
 * Map, Staff, Attendance, Intelligence) keeps its own separate theming,
 * untouched.
 */
export interface CcKpiVariant {
  bg: string; ring: string; icon: string;
  /** Text colors for THIS card specifically — a saturated dark-theme tile
   *  wants near-white text; a pastel light-theme tile wants dark text. */
  valueText: string; labelText: string;
}

export interface CcPalette {
  bg: string; sidebarBg: string; headerBg: string; card: string; cardAlt: string; border: string; divider: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  accentBlue: string; accentCyan: string; accentGreen: string; accentPurple: string;
  accentAmber: string; accentPink: string; accentRed: string; accentIndigo: string;
  success: string; warning: string; danger: string;
  deltaUp: string; deltaDown: string;
  kpi: {
    tasks: CcKpiVariant; visitors: CcKpiVariant; slots: CcKpiVariant; drivers: CcKpiVariant; users: CcKpiVariant;
  };
}

export const ccDark: CcPalette = {
  bg: '#0A0E1A',
  sidebarBg: '#080B14',
  headerBg: '#0A0E1A',
  card: '#111726',
  cardAlt: '#171E30',
  border: '#212A3D',
  divider: '#1B2233',
  textPrimary: '#F3F5F9',
  textSecondary: '#9AA4B8',
  textMuted: '#66708A',

  accentBlue: '#3B82F6',
  accentCyan: '#22D3EE',
  accentGreen: '#22C55E',
  accentPurple: '#A855F7',
  accentAmber: '#F59E0B',
  accentPink: '#EC4899',
  accentRed: '#EF4444',
  accentIndigo: '#6366F1',

  success: '#22C55E',
  warning: '#F0B247',
  danger: '#F1786F',

  deltaUp: '#8CF0B4',
  deltaDown: '#F0A8A8',

  kpi: {
    tasks: {bg: '#12294F', ring: '#2E5C9E', icon: '#5B9BF0', valueText: '#FFFFFF', labelText: 'rgba(255,255,255,0.7)'},
    visitors: {bg: '#0E3A2C', ring: '#1F6B4D', icon: '#4ADE9A', valueText: '#FFFFFF', labelText: 'rgba(255,255,255,0.7)'},
    slots: {bg: '#2A1B4D', ring: '#5B3E96', icon: '#B48CF0', valueText: '#FFFFFF', labelText: 'rgba(255,255,255,0.7)'},
    drivers: {bg: '#4A2E0E', ring: '#8A5A1F', icon: '#F0B25B', valueText: '#FFFFFF', labelText: 'rgba(255,255,255,0.7)'},
    users: {bg: '#0E3A44', ring: '#1F6B7A', icon: '#4AD8E9', valueText: '#FFFFFF', labelText: 'rgba(255,255,255,0.7)'},
  },
};

export const ccLight: CcPalette = {
  bg: '#F3F5F9',
  sidebarBg: '#FFFFFF',
  headerBg: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F1F3F8',
  border: '#E1E5EE',
  divider: '#EAEDF4',
  textPrimary: '#12172B',
  textSecondary: '#5B6478',
  textMuted: '#8891A3',

  accentBlue: '#2563EB',
  accentCyan: '#0891B2',
  accentGreen: '#16A34A',
  accentPurple: '#9333EA',
  accentAmber: '#D97706',
  accentPink: '#DB2777',
  accentRed: '#DC2626',
  accentIndigo: '#4F46E5',

  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',

  deltaUp: '#15803D',
  deltaDown: '#B91C1C',

  kpi: {
    tasks: {bg: '#DCE8FE', ring: '#2E5C9E', icon: '#1D4ED8', valueText: '#0B1E3F', labelText: 'rgba(11,30,63,0.7)'},
    visitors: {bg: '#DAF3E5', ring: '#1F6B4D', icon: '#15803D', valueText: '#052E17', labelText: 'rgba(5,46,23,0.7)'},
    slots: {bg: '#EBE1FB', ring: '#5B3E96', icon: '#7C3AED', valueText: '#241640', labelText: 'rgba(36,22,64,0.7)'},
    drivers: {bg: '#FBE9D2', ring: '#8A5A1F', icon: '#B45309', valueText: '#3A2508', labelText: 'rgba(58,37,8,0.7)'},
    users: {bg: '#D8F1F6', ring: '#1F6B7A', icon: '#0E7490', valueText: '#062A31', labelText: 'rgba(6,42,49,0.7)'},
  },
};

/** Defaults to dark — the command center's original, still-primary look —
 *  overridden per-mount by AdminCommandCenter/AdminDashboardMobile from
 *  the persisted preference (see useCcThemeMode). */
export const CcThemeContext = createContext<CcPalette>(ccDark);
export function useCc(): CcPalette {
  return useContext(CcThemeContext);
}

const STORAGE_KEY = 'kims-cc-theme-mode';
export type CcThemeMode = 'light' | 'dark';

/** Reads the persisted admin theme preference (shared by the command
 *  center AND the ops-console screens — see adminDarkTheme.tsx's
 *  useAdminOpsTheme, which reads this same key). Defaults to 'light' per
 *  explicit request — falls back to it if nothing is stored yet, or
 *  storage is unavailable (private browsing, etc.); never throws. */
export function readCcThemeMode(): CcThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function writeCcThemeMode(mode: CcThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private browsing / storage disabled — the toggle still works for
    // this session, it just won't be remembered next time.
  }
}

export function ccCard(t: CcPalette): React.CSSProperties {
  return {backgroundColor: t.card, border: `1px solid ${t.border}`, borderRadius: 14};
}

export function ccPanelTitle(t: CcPalette): React.CSSProperties {
  return {fontSize: 13.5, fontWeight: 800, color: t.textPrimary, letterSpacing: -0.1};
}

export function ccEmptyText(t: CcPalette): React.CSSProperties {
  return {fontSize: 12, fontWeight: 600, color: t.textMuted, textAlign: 'center', padding: '18px 0'};
}
