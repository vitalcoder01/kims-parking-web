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
//   3. Paste BOTH here and in public/sw.js (FIREBASE_CONFIG + VAPID there).
// Until they're filled in, web push silently no-ops — sockets still deliver
// everything while a tab is open (exactly like the mobile app before
// google-services.json existed).
export const FIREBASE_CONFIG = {
  apiKey: '***REMOVED-FIREBASE-API-KEY***',
  projectId: 'cloud-messaging-a085d',
  messagingSenderId: '453815875444',
  storageBucket: 'cloud-messaging-a085d.firebasestorage.app',
  appId: '', // ← paste the web appId from the Firebase console
};

export const FCM_VAPID_KEY = ''; // ← paste the Web Push certificate public key
