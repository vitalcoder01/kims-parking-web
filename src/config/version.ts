// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 69;
export const APP_VERSION_NAME = '1.11.3';
export const RELEASE_NOTES =
  'Fixed a gap in the last release: a gate valet could still assign a driver to a retrieval they had just raised, via the Retrieval Requests inbox. That inbox row is now read-only ("Waiting for the lot valet") until the lot side acts or hands it back with "No driver here".';
