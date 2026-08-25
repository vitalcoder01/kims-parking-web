// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 44;
export const APP_VERSION_NAME = '1.8.32';
export const RELEASE_NOTES =
  'You can now cancel an arrival you already sent, if your plans change. Valets can close out a car that left without anyone requesting it, freeing the slot. Redesigned sign-in with readable saved-account rows and cleaner fields. Added search to the admin Staff and Attendance rosters, and rebuilt Attendance to list everyone at a glance with per-person calendars one tap away.';
