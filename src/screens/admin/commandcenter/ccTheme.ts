import type React from 'react';

/*
 * Palette for the desktop admin command center — deliberately distinct from
 * ./adminDarkTheme.tsx (the LaunchDarkly-sourced monochrome-plus-violet
 * theme used by the mobile admin screens). That constraint was chosen for
 * THIS app's mobile "ops console" screens; the reference image the desktop
 * dashboard is built against uses a more saturated blue/purple/green/amber
 * palette on a near-black navy ground, and matching that reference's colors
 * as closely as possible is the explicit brief for this screen. Hand-picked
 * to approximate the reference (no image color-picker tool was available),
 * refined during the visual comparison pass against a live screenshot.
 */
export const cc = {
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

  kpi: {
    tasks: {bg: '#12294F', ring: '#2E5C9E', icon: '#5B9BF0'},
    visitors: {bg: '#0E3A2C', ring: '#1F6B4D', icon: '#4ADE9A'},
    slots: {bg: '#2A1B4D', ring: '#5B3E96', icon: '#B48CF0'},
    drivers: {bg: '#4A2E0E', ring: '#8A5A1F', icon: '#F0B25B'},
    users: {bg: '#0E3A44', ring: '#1F6B7A', icon: '#4AD8E9'},
    health: {bg: '#111726', ring: '#212A3D', icon: '#8CF0B4'},
  },
} as const;

export const ccCard: React.CSSProperties = {
  backgroundColor: cc.card,
  border: `1px solid ${cc.border}`,
  borderRadius: 14,
};

export const ccPanelTitle: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 800, color: cc.textPrimary, letterSpacing: -0.1,
};

export const ccEmptyText: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: cc.textMuted, textAlign: 'center', padding: '18px 0',
};
