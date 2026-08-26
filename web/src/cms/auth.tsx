import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiFetch, ApiError, getToken, setToken } from '../lib/api';

export type Session = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  signedInAt: string;
};

type AuthContextValue = {
  session: Session | null;
  signIn: (identity: string, password: string) => Promise<string | null>;
  signOut: () => void;
  /** Permission check against the signed-in staff account. */
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'regis.cms.session';

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Session>;
    // A session is only usable alongside its token, and a session stored before
    // the API landed carries no permissions. Either way, sign in again.
    if (!Array.isArray(saved.permissions) || !getToken('cms')) return null;
    return saved as Session;
  } catch {
    return null;
  }
}

type LoginResponse = {
  token: string;
  user: { id: string; name: string; email: string; role: string; permissions: string[] };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  const signIn = useCallback(async (identity: string, password: string) => {
    const email = identity.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Enter a valid staff email address.';
    }
    if (password.length < 8) {
      return 'Credentials not recognized. Passwords are at least 8 characters.';
    }

    try {
      const data = await apiFetch<LoginResponse>('/cms/login', {
        method: 'POST',
        body: { email, password },
      });
      const next: Session = { ...data.user, signedInAt: new Date().toISOString() };
      setToken('cms', data.token);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private-mode storage failures are non-fatal */
      }
      setSession(next);
      return null;
    } catch (e) {
      if (e instanceof ApiError) return e.message;
      return 'The publishing service is unreachable. Check that the API is running.';
    }
  }, []);

  const signOut = useCallback(() => {
    void apiFetch('/logout', { method: 'POST', audience: 'cms' }).catch(() => undefined);
    setToken('cms', null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setSession(null);
  }, []);

  const can = useCallback(
    (permission: string) => session?.permissions?.includes(permission) ?? false,
    [session],
  );

  const value = useMemo(() => ({ session, signIn, signOut, can }), [session, signIn, signOut, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Route guard: module pages bounce to the Overview when the role lacks the permission. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return <Navigate to="/cms" replace />;
  }
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login/cms" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
