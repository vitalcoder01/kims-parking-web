// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 66;
export const APP_VERSION_NAME = '1.11.0';
export const RELEASE_NOTES =
  'Drivers no longer have an app at all — no GPS, no login. They\'re now just a name in the valet\'s assign-driver picker, and a valet confirms both ends of every job. The tracking page shows real status timestamps instead of a live map, and admin can now toggle a driver\'s shift status directly.';
