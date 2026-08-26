import React from 'react';
import ReactDOM from 'react-dom/client';
// The icon font's @font-face now lives in components/icons.css, pulled in by
// Icon.tsx itself — @mdi/font's full stylesheet is no longer imported.
import './index.css';
import App from './App';
import {registerServiceWorker} from './services/swRegistration';
import {unlockOnFirstGesture} from './services/alarm';
// Must be imported before anything renders — captures beforeinstallprompt,
// which Chrome can fire before React mounts.
import './services/installPrompt';

// PWA + FCM background push both live in /sw.js — register it up front so
// install prompts and pushes work from the first visit.
registerServiceWorker();

// Primes the alarm's AudioContext on the page's first tap/click/keydown —
// alarms ring later from an async socket event, which Chrome's autoplay
// policy would otherwise mute (see services/alarm.ts).
unlockOnFirstGesture();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
