// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 24;
export const APP_VERSION_NAME = '1.8.12';
export const RELEASE_NOTES =
  'Every browser popup (confirm/alert) is now a proper in-app dialog matching the rest of the design — no more bare "vercel.app says" boxes. Fixed logout asking twice, and the Active/Completed/All tabs now fill the row evenly.';
