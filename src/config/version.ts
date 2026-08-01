// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 3;
export const APP_VERSION_NAME = '1.2.0';
export const RELEASE_NOTES =
  'New: let the valet know you\'re on your way with the Arrival card, and cancel a ' +
  'departure request straight from Home. Departure timing now supports Now/15/30 or a ' +
  'custom clock pick, and the live countdown while your car is en route now shows real ' +
  'GPS-based time away instead of a fixed timer. Home and My Parking are combined into a ' +
  'single screen, matching the mobile app.';
