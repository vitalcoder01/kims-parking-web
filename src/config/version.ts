// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 71;
export const APP_VERSION_NAME = '1.11.5';
export const RELEASE_NOTES =
  'Fixed station-routed alerts (a retrieval request reaching the lot valet, or "No driver here" reaching the gate valet) never actually ringing — the server was sending them correctly, but the app\'s own filter for "is this alert for me" never learned the station-addressed format, so it silently dropped every one of them.';
