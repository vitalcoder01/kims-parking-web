// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 42;
export const APP_VERSION_NAME = '1.8.30';
export const RELEASE_NOTES =
  'Fixed 5 narrow race conditions in valet/driver dispatch: a reassignment prompt could silently overwrite another job\'s still-unhandled prompt (now queued instead), two spots could wipe a driver\'s live job status if they\'d already moved on to a new job in a timing gap, and a driver\'s linked task lookup could miss a job created moments earlier.';
