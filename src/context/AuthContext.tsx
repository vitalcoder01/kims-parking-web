import React, {createContext, useCallback, useContext, useState, useEffect, useRef} from 'react';
import {authApi, setAuthToken, setUnauthorizedHandler} from '../services/api';

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
  logout: () => void;
  updateProfile: (patch: Partial<CurrentUser>) => void;
}

const SESSION_KEY = '@kims_session';
const SESSION_HOURS = 12;

// This web portal serves doctors and staff only — every other role keeps
// using the mobile app. Enforced at login AND on session restore.
const WEB_ROLES: UserRole[] = ['doctor', 'staff'];

const Ctx = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => ({} as CurrentUser),
  logout: () => {},
  updateProfile: () => {},
});

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser]         = useState<CurrentUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  const logout = useCallback(() => {
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
      throw new Error('This web portal is for doctors and staff only. Please use the KIMS Parking mobile app.');
    }
    const withTime: CurrentUser = {...loggedInUser, loginTime: Date.now()};
    tokenRef.current = token;
    setAuthToken(token);
    setUser(withTime);
    localStorage.setItem(SESSION_KEY, JSON.stringify({user: withTime, token, loginTime: Date.now()}));
    return withTime;
  }, []);

  return (
    <Ctx.Provider value={{user, isLoading, login, logout, updateProfile}}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() { return useContext(Ctx); }
