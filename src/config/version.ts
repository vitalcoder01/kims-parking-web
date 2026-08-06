// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 14;
export const APP_VERSION_NAME = '1.8.2';
export const RELEASE_NOTES =
  'Valet Dashboard\'s action grid is back to 4 cards — Staff / Visitor / Retrieval Requests / Expected Arrivals — with Retrieval Requests reopened as its own screen (Now/Soon/Later urgency tabs, colour-graded cards).';
