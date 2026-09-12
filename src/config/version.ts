// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 64;
export const APP_VERSION_NAME = '1.10.8';
export const RELEASE_NOTES =
  "Fix retrieval requests never reaching the lot valet after a gate handoff (stuck at '0 Pending'), and drivers no longer see a manual 'Mark parked'/'Delivered to counter' step — a valet confirms both now, so driving is the only thing left for a driver to do.";
