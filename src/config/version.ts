// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 72;
export const APP_VERSION_NAME = '1.11.6';
export const RELEASE_NOTES =
  'Two-station handoff cleanup: the "Key handed over" button now only appears for the gate valet (it was rendering on both sides even though only the gate valet actually holds the key). The lot valet sees "Driver X is at the gate to collect the key" instead. New cross-station heads-up alerts: the lot valet rings when a car is on its way to be parked; the gate valet rings when a retrieval is dispatched from the lot.';
