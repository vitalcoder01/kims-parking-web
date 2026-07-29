// ─────────────────────────────────────────────────────────────
// KIMS Parking — Unified Design System (same palette as the app)
// One warm-mono palette across every role & screen: light gray
// backgrounds, white cards, near-black ink, black CTAs. Status
// colors (success/warning/error) stay as small, muted accents.
// ─────────────────────────────────────────────────────────────

export const lightColors = {
  background:  '#F1F0EC',
  surface:     '#FFFFFF',
  card:        '#FFFFFF',
  cardAlt:     '#E9E7E1',

  primary:      '#15161A',
  primaryLight: '#E9E7E1',
  primaryDark:  '#000000',
  accent:       '#15161A',
  accentLight:  '#E9E7E1',

  gradFrom: '#1B1C20',
  gradMid:  '#15161A',
  gradTo:   '#000000',

  success:      '#1F8A5B',
  successLight: '#DCF3E7',
  warning:      '#B5790A',
  warningLight: '#FBEBD1',
  error:        '#C23B3B',
  errorLight:   '#F8DFDF',
  info:         '#2F6FA8',
  infoLight:    '#DCEAF5',

  textPrimary:   '#15161A',
  textSecondary: '#6E7076',
  textMuted:     '#A6A8AC',
  textInverse:   '#FFFFFF',
  textOnPrimary: '#FFFFFF',

  border:       '#E4E2DC',
  borderStrong: '#CFCDC6',
  divider:      '#E4E2DC',

  tabBar:          '#FFFFFF',
  tabBarBorder:    '#E4E2DC',
  tabIconActive:   '#15161A',
  tabIconInactive: '#A6A8AC',

  switchTrackOn:  '#15161A',
  switchTrackOff: '#CFCDC6',
  switchThumb:    '#FFFFFF',

  overlay: 'rgba(21,22,26,0.5)',
  shadow:  'rgba(21,22,26,0.12)',
};

export const darkColors = {
  background:  '#121214',
  surface:     '#1C1D21',
  card:        '#1C1D21',
  cardAlt:     '#232428',

  primary:      '#F3F3F1',
  primaryLight: 'rgba(243,243,241,0.12)',
  primaryDark:  '#FFFFFF',
  accent:       '#F3F3F1',
  accentLight:  'rgba(243,243,241,0.12)',

  gradFrom: '#1C1D21',
  gradMid:  '#26272B',
  gradTo:   '#333438',

  success:      '#4ADE9A',
  successLight: 'rgba(74,222,154,0.14)',
  warning:      '#F0B247',
  warningLight: 'rgba(240,178,71,0.14)',
  error:        '#F1786F',
  errorLight:   'rgba(241,120,111,0.14)',
  info:         '#6FA8DC',
  infoLight:    'rgba(111,168,220,0.14)',

  textPrimary:   '#F3F3F1',
  textSecondary: '#A2A3A8',
  textMuted:     '#6B6C71',
  textInverse:   '#15161A',
  textOnPrimary: '#15161A',

  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  divider:      'rgba(255,255,255,0.06)',

  tabBar:          '#1C1D21',
  tabBarBorder:    'rgba(255,255,255,0.08)',
  tabIconActive:   '#F3F3F1',
  tabIconInactive: '#6B6C71',

  switchTrackOn:  '#F3F3F1',
  switchTrackOff: '#3A3B40',
  switchThumb:    '#FFFFFF',

  overlay: 'rgba(0,0,0,0.7)',
  shadow:  'rgba(0,0,0,0.5)',
};

// Shared gradient tuples so every screen uses the identical brand gradient.
export const BRAND_GRADIENT = ['#1B1C20', '#15161A', '#000000'] as [string, string, string];
export const BRAND_GRADIENT_DARK = ['#1C1D21', '#26272B', '#333438'] as [string, string, string];

// CSS helper — the RN app renders these with LinearGradient; on the web the
// identical stops become a background-image.
export const gradientCss = (stops: [string, string, string], angle = '135deg') =>
  `linear-gradient(${angle}, ${stops[0]}, ${stops[1]}, ${stops[2]})`;

export type AppColors = typeof lightColors;
