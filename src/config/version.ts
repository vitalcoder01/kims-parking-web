// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 41;
export const APP_VERSION_NAME = '1.8.29';
export const RELEASE_NOTES =
  'Valet flow bug sweep: fixed a missed "car parked" alert for the valet it was addressed to, a stale stats refresh after finishing a job, a wrong/duplicated visitor pickup notice on drivers\' dashboards, a harsh error instead of a soft "reassigned" message, a driver map marker that never disappeared, and two resilience gaps (stale alarms surviving a reconnect, no refetch on returning to the tab).';
