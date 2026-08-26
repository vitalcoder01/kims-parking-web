import React from 'react';
import './icons.css';

// Semantic icon name -> the Material Design Icons glyph, as the raw
// codepoint rather than an `mdi-*` class name. Same names and same glyphs
// as the mobile app's components/Icon.tsx, so the two stay in step.
//
// Codepoints are generated from @mdi/font's own stylesheet (the comment on
// each line records which icon it came from), which is why we can drop that
// 326 kB stylesheet entirely -- see icons.css.
export const ICONS = {
  home: '\u{F02DE}', // mdi-home-variant
  card: '\u{F0DAB}', // mdi-card-account-details-outline
  parking: '\u{F03E3}', // mdi-parking
  map: '\u{F0352}', // mdi-map-marker-radius
  calendar: '\u{F00EF}', // mdi-calendar-check
  settings: '\u{F0493}', // mdi-cog
  tasks: '\u{F10D4}', // mdi-clipboard-list
  track: '\u{F01A4}', // mdi-crosshairs-gps
  dashboard: '\u{F056E}', // mdi-view-dashboard
  staff: '\u{F0849}', // mdi-account-group
  analytics: '\u{F07AF}', // mdi-chart-donut
  trophy: '\u{F053B}', // mdi-trophy-variant
  trending: '\u{F0535}', // mdi-trending-up
  speedometer: '\u{F04C5}', // mdi-speedometer
  crown: '\u{F01A5}', // mdi-crown
  share: '\u{F0497}', // mdi-share-variant
  chevronDown: '\u{F0140}', // mdi-chevron-down
  key: '\u{F030B}', // mdi-key-variant
  car: '\u{F010B}', // mdi-car
  carSide: '\u{F07AB}', // mdi-car-side
  ticket: '\u{F0518}', // mdi-ticket-confirmation
  bell: '\u{F009E}', // mdi-bell-ring
  bellAlert: '\u{F0D59}', // mdi-bell-alert
  hospital: '\u{F02E1}', // mdi-hospital-building
  phone: '\u{F011C}', // mdi-cellphone
  user: '\u{F0004}', // mdi-account
  userCard: '\u{F0E0D}', // mdi-badge-account-horizontal
  lock: '\u{F033E}', // mdi-lock
  eye: '\u{F0208}', // mdi-eye
  eyeOff: '\u{F0209}', // mdi-eye-off
  check: '\u{F05E0}', // mdi-check-circle
  checkBold: '\u{F0E1E}', // mdi-check-bold
  arrowRight: '\u{F0054}', // mdi-arrow-right
  arrowUp: '\u{F005D}', // mdi-arrow-up
  arrowDown: '\u{F0045}', // mdi-arrow-down
  back: '\u{F004D}', // mdi-arrow-left
  clock: '\u{F0150}', // mdi-clock-outline
  timer: '\u{F051F}', // mdi-timer-sand
  logout: '\u{F0343}', // mdi-logout
  route: '\u{F0462}', // mdi-road-variant
  whatsapp: '\u{F05A3}', // mdi-whatsapp
  shield: '\u{F0565}', // mdi-shield-check
  live: '\u{F0003}', // mdi-access-point
  slot: '\u{F03E3}', // mdi-parking
  wrench: '\u{F05B7}', // mdi-wrench
  bolt: '\u{F140B}', // mdi-lightning-bolt
  sun: '\u{F0599}', // mdi-weather-sunny
  sunset: '\u{F059A}', // mdi-weather-sunset
  moon: '\u{F0594}', // mdi-weather-night
  flag: '\u{F023C}', // mdi-flag-checkered
  history: '\u{F02DA}', // mdi-history
  navigate: '\u{F18F1}', // mdi-navigation-variant-outline
  inbox: '\u{F1270}', // mdi-inbox-arrow-down-outline
  outbox: '\u{F1271}', // mdi-inbox-arrow-up-outline
  close: '\u{F0156}', // mdi-close
  chevronRight: '\u{F0142}', // mdi-chevron-right
  chevronLeft: '\u{F0141}', // mdi-chevron-left
  carKey: '\u{F0B6D}', // mdi-car-key
  target: '\u{F04FE}', // mdi-target
  sparkle: '\u{F0674}', // mdi-creation
  pin: '\u{F034E}', // mdi-map-marker
  alert: '\u{F05D6}', // mdi-alert-circle-outline
  refresh: '\u{F0450}', // mdi-refresh
  people: '\u{F000E}', // mdi-account-multiple
  bike: '\u{F037C}', // mdi-motorbike
  clipboard: '\u{F0A38}', // mdi-clipboard-text-outline
  briefcase: '\u{F0814}', // mdi-briefcase-outline
  stethoscope: '\u{F04D9}', // mdi-stethoscope
  rocket: '\u{F14DF}', // mdi-rocket-launch-outline
  chat: '\u{F0EDE}', // mdi-chat-outline
  info: '\u{F02FD}', // mdi-information-outline
  search: '\u{F0349}', // mdi-magnify
  palette: '\u{F0E0C}', // mdi-palette-outline
  plus: '\u{F0415}', // mdi-plus
  help: '\u{F02D6}', // mdi-help
  edit: '\u{F0CB6}', // mdi-pencil-outline
  save: '\u{F0818}', // mdi-content-save-outline
} as const;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function Icon({name, size = 22, color = '#000', style}: Props) {
  return (
    <span
      style={{
        fontFamily: 'Material Design Icons',
        // The face is a 1:1 icon font: any synthesis or ligature work the
        // browser might attempt on it is wasted and can shift the glyph.
        fontWeight: 'normal',
        fontStyle: 'normal',
        fontVariant: 'normal',
        textTransform: 'none',
        lineHeight: 1,
        display: 'inline-flex',
        fontSize: size,
        color,
        ...style,
      }}
      aria-hidden
    >
      {ICONS[name]}
    </span>
  );
}
