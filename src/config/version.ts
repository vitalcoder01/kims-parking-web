// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 38;
export const APP_VERSION_NAME = '1.8.26';
export const RELEASE_NOTES =
  'Fixed Live Operations on the admin Dashboard showing empty almost all the time (it was excluding completed jobs entirely, which is exactly what "just parked/just retrieved" means) — now shows in-progress and recently-finished jobs together, with a live pulse on the ones still moving and a relative timestamp on each. Analytics\' Park vs Retrieve chart got real hour/day/month labels, a tap-to-inspect readout, and a caption explaining what it shows.';
