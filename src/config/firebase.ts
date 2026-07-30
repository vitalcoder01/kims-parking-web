// Firebase web config for the SAME Firebase project the mobile app's FCM
// pushes come from (android/app/google-services.json → cloud-messaging-a085d).
// The backend (push.service.js) sends data-only messages to every token
// registered via /notifications/register-device — including web tokens.
//
// appId + vapidKey are the two values only the Firebase console can mint for
// a *web* app:
//   1. Firebase console → Project settings → General → "Add app" → Web.
//      Copy the appId (looks like 1:453815875444:web:xxxxxxxx).
//   2. Project settings → Cloud Messaging → Web Push certificates →
//      "Generate key pair". Copy the public key into vapidKey.
//   3. Put all values in .env (see .env.example) — never hardcode them here.
//      public/sw.js can't read Vite env vars (it's a static file, not
//      bundled), so swRegistration.ts passes this same config to it via the
//      registration URL's query string instead.
// Until appId/vapidKey are filled in, web push silently no-ops — sockets
// still deliver everything while a tab is open (exactly like the mobile app
// before google-services.json existed).
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const FCM_VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;
