// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 43;
export const APP_VERSION_NAME = '1.8.31';
export const RELEASE_NOTES =
  'Redesigned sign-in: saved accounts are now full-width rows you can actually read (instead of cramped chips), cleaner fields, and a clearer layout throughout. Added search to the admin Staff and Attendance rosters, and rebuilt Attendance so it lists everyone at a glance with per-person calendars one tap away.';
