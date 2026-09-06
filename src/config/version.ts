// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 46;
export const APP_VERSION_NAME = '1.9.0';
export const RELEASE_NOTES =
  'Admin console: Dashboard, Staff, Attendance, Map and Guard restyled with a new dark ops-console look, plus a new AI Insights tab with real, data-driven operational insights. On a wide desktop browser, admin now gets a full command-center dashboard with live charts, slot intelligence, and an "Ask Your Parking System" panel.';
