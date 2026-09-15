// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 70;
export const APP_VERSION_NAME = '1.11.4';
export const RELEASE_NOTES =
  'Two more gaps in the retrieval handoff: the "Request retrieval" button for a VISITOR (not just staff) now also routes through the lot valet for a gate-station valet. And the driver-picker screen opened from the Retrieval Requests inbox now has a "No driver here" option — it never had one before.';
