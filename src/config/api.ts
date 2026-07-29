// Backend base URL — identical to the mobile app's config (config/api.ts).
// The web portal talks to the SAME deployed backend; nothing is duplicated.
const ACTIVE_BACKEND = 'render' as 'render' | 'local';

const RENDER_BASE_URL = 'https://kims-parking-backend-2.onrender.com'; // backend
const LOCAL_BASE_URL = 'http://localhost:4000';

const ROOT_URL = ACTIVE_BACKEND === 'local' ? LOCAL_BASE_URL : RENDER_BASE_URL;

export const API_BASE_URL = `${ROOT_URL}/api`;
export const PUBLIC_BASE_URL = ROOT_URL;
