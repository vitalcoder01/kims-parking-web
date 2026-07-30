# KIMS Parking — Web Portal (Doctors & Staff)

React + TypeScript (Vite) web version of the KIMS Parking mobile app, for
**doctor and staff logins only**. It talks to the exact same deployed backend
(`https://kims-parking-backend-2.onrender.com`) over the same REST endpoints
and the same socket.io real-time sync — no backend changes, no data changes.
Any other role (valet / driver / admin) is rejected at login and directed to
the mobile app.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

## What's ported (1:1 with the mobile app)

- **Theme** — the identical warm-mono palette (light + dark + system mode),
  brand gradient, spacing/typography scales (`src/theme/`).
- **Icons** — the same MaterialCommunityIcons glyph map, rendered from
  `@mdi/font` (the same font family the RN vector-icons package uses).
- **Login** — hero gradient, Quick Login chips, keep-me-signed-in (12 h
  session), error shake. Doctor/staff role gate added for the web.
- **Home** — valet-code chip, Vehicle Status card, slot banner, "Ready to
  Leave?" ETA picker (10/20/30/40 min), live retrieval countdown card.
- **Valet Card** — the 3-digit virtual card with glow + instructions.
- **My Parking** (doctor only) — session strip, slot hero, vehicle info,
  retrieval status with countdown.
- **Vehicle Setup** — the same three.js 3D car preview (in an iframe instead
  of a WebView), colour swatches + More picker, number/phone saved via
  `PATCH /users/me`.
- **Live Tracking** — the same Leaflet/OSM map, driver GPS marker updated
  from `task:upsert` socket deltas, trip progress/ETA from `computeTrip`.
- **Settings** — profile card, theme mode chips, notification toggles,
  about, logout.

## PWA — installable app

- `public/manifest.webmanifest` + generated icons + `public/sw.js` (app-shell
  caching, offline fallback). An **Install App** button appears on the login
  footer and in Settings whenever the browser allows installing.
- Serve over **https** (or localhost) — PWA install and push both require it.

## Alarm + notifications (Google/Firebase — same project as the mobile app)

- **Tab open:** socket events drive everything. A task *initiated* for the
  logged-in user (valet takes the keys / retrieval starts) rings a looping
  two-tone siren + vibration + a red in-app alert banner; status changes
  chime; alarm-grade `notification:new` events ring the same siren. Browser
  tray notifications fire too.
- **App closed:** `public/sw.js` doubles as the FCM background worker — the
  backend already pushes data-only FCM messages to every token registered
  via `/notifications/register-device`, and web tokens land in the same
  table. One-time setup in the Firebase console (project
  `cloud-messaging-a085d`, the same one in google-services.json):
  1. Project settings → General → **Add app → Web**, copy the `appId`.
  2. Project settings → Cloud Messaging → **Web Push certificates →
     Generate key pair**, copy the public key (VAPID).
  3. Copy `.env.example` to `.env` and fill in `VITE_FIREBASE_APP_ID` +
     `VITE_FCM_VAPID_KEY` (plus the other `VITE_FIREBASE_*` values from the
     Firebase console). `.env` is gitignored — never commit real values or
     hardcode them in source. `public/sw.js` can't read Vite env vars (it's a
     static file), so `swRegistration.ts` passes the same config to it via
     the service-worker registration URL's query string.
  Until then push init silently no-ops (exactly like the mobile app before
  google-services.json existed) — sockets still cover every open-tab case.
  The backend needs `FIREBASE_SERVICE_ACCOUNT` set (already how mobile push
  works) — no backend code changes.

## Release popup on the login screen

`ReleaseNotesModal` reads the same `/app/version` endpoint as the mobile
UpdateModal. Bump `latestVersionCode` + `notes` in
`kims-parking-backend/src/config/appVersion.js` when releasing features, and
every web user sees a "What's New" popup on the login screen before they log
in (dismissed once per version, remembered in localStorage).

## Sync model

Same as mobile: one WebSocket per session (`socket.io`, websocket transport
only), full fetch on connect/reconnect, then per-entity deltas
(`task:upsert`, `slot:patch`, `notification:new`) patch state in place.
Conditional-GET ETag caching on REST polls is ported too. Browser
notifications stand in for the mobile tray notifications.
