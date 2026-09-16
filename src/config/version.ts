// The web portal's OWN version — entirely independent of the mobile app's
// versioning (android/app/build.gradle) and of the backend's /app/version
// endpoint (that endpoint serves the mobile APK's update-check info, apkUrl
// included, and has no meaning for a web deployment). Web ships continuously
// via Vercel on every push, so there's no "please go download the update"
// step the way there is for an APK — this only exists to (a) show a real,
// current version in Settings, and (b) let ReleaseNotesModal announce what
// changed. Bump both whenever a release worth telling users about ships.
export const APP_VERSION_CODE = 73;
export const APP_VERSION_NAME = '1.11.7';
export const RELEASE_NOTES =
  'Gate valet now sees the retrieval delivery leg. Once the lot valet dispatches a driver, the card appears on the gate dashboard with the "Car arrived at gate" button — the visitor tab also stops offering "Assign driver" for a retrieval whose driver is already on the way. Fixes the "empty dashboard while Sudheer was bringing the car" gap: the socket/REST filter was scoping the claimed retrieval to the lot valet alone, hiding it from the very valet who needs to receive the car.';
