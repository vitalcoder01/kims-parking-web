import React, {createContext, useCallback, useContext, useState, useEffect, useRef} from 'react';
import {authApi, setAuthToken, setUnauthorizedHandler} from '../services/api';
import {unregisterCurrentWebPush} from '../services/webPush';
import {stopAlarm} from '../services/alarm';

export type UserRole = 'doctor' | 'staff' | 'valet' | 'driver' | 'admin';

export interface CurrentUser {
  id: number;
  name: string;
  role: UserRole;
  employeeId: string;
  username: string;
  department?: string;
  cardCode?: string;       // 3-digit virtual card code
  carNumber?: string;
  phone?: string;
  profileComplete?: boolean;
  loginTime?: number;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<CurrentUser>;
  register: (name: string, phone: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<CurrentUser>) => void;
  // True for the single moment between a fresh self-registration and the
  // user picking Doctor/Staff on the one-time designation screen. Deliberately
  // in-memory only (not persisted) — matches the mobile app's AuthContext.
  needsDesignation: boolean;
  clearNeedsDesignation: () => void;
}

const SESSION_KEY = '@kims_session';
const SESSION_HOURS = 12;

// This web portal serves doctors, staff, and admins — valet/driver keep
// using the mobile app (their flows are inherently on-the-move/dispatch,
// not desk work). Enforced at login AND on session restore.
const WEB_ROLES: UserRole[] = ['doctor', 'staff', 'admin'];

const Ctx = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => ({} as CurrentUser),
  register: async () => ({} as CurrentUser),
  logout: async () => {},
  updateProfile: () => {},
  needsDesignation: false,
  clearNeedsDesignation: () => {},
});

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser]         = useState<CurrentUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [needsDesignation, setNeedsDesignation] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const logout = useCallback(async () => {
    // A still-ringing assignment alarm (siren + red banner) otherwise
    // keeps going after logout — AppStateContext also clears it on `!user`,
    // but stopping it here too means it's silenced immediately rather than
    // waiting on that effect to run.
    stopAlarm();
    // Must run before the token is cleared below — it needs a valid
    // Authorization header to tell the backend to drop this browser's
    // registration, otherwise it keeps receiving the signed-out account's
    // pushes until someone else logs in here. Capped so a slow/unreachable
    // network never delays the logout button itself.
    await Promise.race([
      unregisterCurrentWebPush().catch(() => {}),
      new Promise<void>(resolve => setTimeout(() => resolve(), 3000)),
    ]);
    setUser(null);
    tokenRef.current = null;
    setAuthToken(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // Any request that comes back 401 (expired/invalid token) forces logout.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const updateProfile = useCallback((patch: Partial<CurrentUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = {...prev, ...patch};
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({user: updated, token: tokenRef.current, loginTime: updated.loginTime ?? Date.now()}),
      );
      return updated;
    });
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const saved: {user: CurrentUser; token: string; loginTime: number} = JSON.parse(raw);
        const age = (Date.now() - saved.loginTime) / (1000 * 60 * 60);
        if (age < SESSION_HOURS && saved.token && WEB_ROLES.includes(saved.user.role)) {
          tokenRef.current = saved.token;
          setAuthToken(saved.token);
          setUser(saved.user);
          // Refresh from the server in the background — an expired/revoked
          // token 401s and the interceptor above logs the user out.
          authApi.me().then(fresh => {
            if (!WEB_ROLES.includes(fresh.role)) { logout(); return; }
            updateProfile(fresh);
          }).catch(() => {});
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username: string, password: string) => {
    const {token, user: loggedInUser} = await authApi.login(username, password);
    if (!WEB_ROLES.includes(loggedInUser.role)) {
      throw new Error('This web portal is for doctors, staff, and admins only. Please use the KIMS Parking mobile app.');
    }
    const withTime: CurrentUser = {...loggedInUser, loginTime: Date.now()};
    tokenRef.current = token;
    setAuthToken(token);
    setUser(withTime);
    localStorage.setItem(SESSION_KEY, JSON.stringify({user: withTime, token, loginTime: Date.now()}));
    return withTime;
  }, []);

  const register = useCallback(async (name: string, phone: string, password: string) => {
    const {token, user: newUser} = await authApi.register(name, phone, password);
    // WEB_ROLES already includes 'doctor', the always-on default for a
    // freshly self-registered account, so no role gate is needed here.
    const withTime: CurrentUser = {...newUser, loginTime: Date.now()};
    tokenRef.current = token;
    setAuthToken(token);
    setUser(withTime);
    localStorage.setItem(SESSION_KEY, JSON.stringify({user: withTime, token, loginTime: Date.now()}));
    setNeedsDesignation(true);
    return withTime;
  }, []);

  const clearNeedsDesignation = useCallback(() => setNeedsDesignation(false), []);

  return (
    <Ctx.Provider value={{user, isLoading, login, register, logout, updateProfile, needsDesignation, clearNeedsDesignation}}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() { return useContext(Ctx); }
