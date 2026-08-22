// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 35;
export const APP_VERSION_NAME = '1.8.23';
export const RELEASE_NOTES =
  'Admin Dashboard and Map redesigned around "understand the operation in 5 seconds": compact occupancy overview with tappable block chips, Park/Retrieve quick actions, live operations (top 3 + view all), a compact driver strip. Parking Map now shows one block at a time with a real slot-detail sheet (including a working Retrieve Vehicle + driver picker) instead of every block stacked in one long scroll.';
