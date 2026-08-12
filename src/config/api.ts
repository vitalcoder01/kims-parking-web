// Backend base URL — identical to the mobile app's config (config/api.ts).
// The web portal talks to the SAME deployed backend; nothing is duplicated.
//
// 'render' — the deployed production backend + production Supabase DB.
// 'dev'    — the SEPARATE Render service tracking the backend's `dev`
//   branch, pointed at a separate/test Supabase project — for testing
//   without touching real data. Only meaningful on THIS branch (`dev`);
//   main stays hardcoded to 'render' so a production deploy can never
//   accidentally ship pointed at the test backend.
// 'local'  — your own computer.
type Backend = 'render' | 'dev' | 'local';
const ACTIVE_BACKEND: Backend = 'dev';

const RENDER_BASE_URL = 'https://kims-parking-backend-2.onrender.com'; // production
const DEV_BASE_URL = 'https://kims-parking-backend-3.onrender.com'; // dev Render service + test Supabase DB
const LOCAL_BASE_URL = 'http://localhost:4000';

// A chained ternary here (ACTIVE_BACKEND === 'local' ? ... : ACTIVE_BACKEND
// === 'dev' ? ...) trips up tsc's literal narrowing on a const initialized
// directly with one of the union's literals — it narrows ACTIVE_BACKEND to
// that single literal for control-flow purposes and then reports the
// SECOND comparison as comparing types with "no overlap" (TS2367), which
// fails `tsc -b` in the build script even though the code is correct. A
// lookup table sidesteps the narrowing entirely.
const BASE_URLS: Record<Backend, string> = {render: RENDER_BASE_URL, dev: DEV_BASE_URL, local: LOCAL_BASE_URL};
const ROOT_URL = BASE_URLS[ACTIVE_BACKEND];

export const API_BASE_URL = `${ROOT_URL}/api`;
export const PUBLIC_BASE_URL = ROOT_URL;
