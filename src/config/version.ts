// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 63;
export const APP_VERSION_NAME = '1.10.7';
export const RELEASE_NOTES =
  "Fix a two-station handoff gap: once a gate valet hands off a car, or a lot valet dispatches a retrieval, that job now shows under the OTHER valet's own My Jobs — not buried in Team Jobs where it looked like someone else's background job instead of something to act on.";
