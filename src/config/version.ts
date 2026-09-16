// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 74;
export const APP_VERSION_NAME = '1.11.8';
export const RELEASE_NOTES =
  'Two fixes to the retrieval claim path: (1) tapping "Assign driver" on a gate-raised request no longer instantly errors with "Already taken" — the underlying claim query had no OR-branch for a lot valet acting on a request whose arrival owner is gate. (2) A fresh gate-raised retrieval now lands in the lot valet\'s My Jobs > Driver assign pending capsule instead of being buried under Team Jobs.';
