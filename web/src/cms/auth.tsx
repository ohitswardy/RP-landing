import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  apiFetch, ApiError, getToken, setToken, UNAUTHORIZED_EVENT, type UnauthorizedDetail,
} from '../lib/api';

/* ─────────────────────────────────────────────────────────────
   The staff session behind the CMS and the CRMS. One Sanctum
   token (`regis.cms.token`) and one session object, kept in
   sessionStorage for a per-tab sign-in or mirrored into
   localStorage for a remembered one. On boot the shell re-reads
   GET /me so a role change lands without a fresh sign-in, and
   the API client's `regis:unauthorized` event signs the tab out
   from one place when a token dies or an account is suspended.
   ───────────────────────────────────────────────────────────── */

export type Session = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  /** The Outlook account this staff member blasts from; null when not set. */
  outlookEmail?: string | null;
  /** The CWDevs super admin: the one account that can read passwords back. */
  superAdmin?: boolean;
  signedInAt: string;
  /** Present on a remembered session: when the token lapses (ISO). */
  expiresAt?: string | null;
};

export type StaffArea = 'cms' | 'crms';

export type SignInOptions = {
  /** Which door issued the session; both hand out the same staff token. */
  area?: StaffArea;
  /** Keep the session across tabs and restarts (30 days server-side). */
  remember?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  /**
   * Sign in through /cms/login or /crms/login. Resolves to an error message,
   * or null on success. The fourth argument is optional so existing callers
   * keep working; `login` is the same call with an options object.
   */
  signIn: (identity: string, password: string, area?: StaffArea, opts?: { remember?: boolean }) => Promise<string | null>;
  /** `signIn` with an options object: `login(email, password, { area: 'crms', remember: true })`. */
  login: (identity: string, password: string, opts?: SignInOptions) => Promise<string | null>;
  signOut: () => void;
  /** Permission check against the signed-in staff account. */
  can: (permission: string) => boolean;
  /** Re-read GET /me and replace the stored session (live permissions). Resolves to an error message or null. */
  refresh: () => Promise<string | null>;
  refreshing: boolean;
  /** Whether the current session was signed in with "remember me". */
  remembered: boolean;
  /** Why the last session ended, for the login door to show. Cleared with `clearNotice`. */
  notice: string | null;
  clearNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const SESSION_KEY = 'regis.cms.session';

/** Where the login door should send a signed-out tab, given where it was. */
export function loginPathFor(pathname: string): string {
  return pathname.startsWith('/crms') ? '/login/crms' : '/login/cms';
}

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<Session>;
    // A session stored before the API landed carries no permissions; sign in again.
    if (!Array.isArray(saved.permissions)) return null;
    return saved as Session;
  } catch {
    return null;
  }
}

/** The stored session: this tab's first, then a remembered one. Only usable beside its token. */
function readSession(): { session: Session; remembered: boolean } | null {
  if (!getToken('cms')) return null;
  try {
    const own = parseSession(sessionStorage.getItem(SESSION_KEY));
    if (own) return { session: own, remembered: false };
  } catch {
    /* fall through */
  }
  try {
    const kept = parseSession(localStorage.getItem(SESSION_KEY));
    if (kept) return { session: kept, remembered: true };
  } catch {
    /* storage unavailable */
  }
  return null;
}

function writeSession(session: Session, remember: boolean) {
  try {
    if (remember) {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    /* private-mode storage failures are non-fatal */
  }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
  try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

type StaffUser = {
  id: string; name: string; email: string; role: string; permissions: string[];
  outlookEmail?: string | null; superAdmin?: boolean;
};

type LoginResponse = { token: string; expiresAt?: string | null; user: StaffUser };
type MeResponse = { kind: 'staff' | 'client'; user?: StaffUser };

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(readSession, []);
  const [session, setSession] = useState<Session | null>(initial?.session ?? null);
  const [remembered, setRemembered] = useState<boolean>(initial?.remembered ?? false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const rememberedRef = useRef(remembered);
  rememberedRef.current = remembered;

  /** Drop the session locally, without telling the API (the token may already be dead). */
  const dropSession = useCallback((why: string | null) => {
    setToken('cms', null);
    clearSession();
    setSession(null);
    setRemembered(false);
    setNotice(why);
  }, []);

  const login = useCallback(async (identity: string, password: string, opts: SignInOptions = {}) => {
    const area: StaffArea = opts.area ?? 'cms';
    const remember = Boolean(opts.remember);
    const email = identity.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Enter a valid staff email address.';
    }
    if (password.length < 8) {
      return 'Credentials not recognized. Passwords are at least 8 characters.';
    }

    try {
      const data = await apiFetch<LoginResponse>(`/${area}/login`, {
        method: 'POST',
        body: { email, password, remember },
      });
      const next: Session = {
        ...data.user,
        signedInAt: new Date().toISOString(),
        expiresAt: remember ? data.expiresAt ?? null : null,
      };
      setToken('cms', data.token, { persist: remember, expiresAt: remember ? data.expiresAt ?? null : null });
      writeSession(next, remember);
      setSession(next);
      setRemembered(remember);
      setNotice(null);
      return null;
    } catch (e) {
      if (e instanceof ApiError) return e.message;
      return 'The publishing service is unreachable. Check that the API is running.';
    }
  }, []);

  const signIn = useCallback(
    (identity: string, password: string, area: StaffArea = 'cms', opts: { remember?: boolean } = {}) =>
      login(identity, password, { area, remember: opts.remember }),
    [login],
  );

  const signOut = useCallback(() => {
    void apiFetch('/logout', { method: 'POST', audience: 'cms' }).catch(() => undefined);
    dropSession(null);
  }, [dropSession]);

  /** GET /me: replace the stored profile and permissions; a refused account signs out. */
  const refresh = useCallback(async (): Promise<string | null> => {
    if (!getToken('cms')) return 'Not signed in.';
    setRefreshing(true);
    try {
      const data = await apiFetch<MeResponse>('/me', { audience: 'cms' });
      if (data.kind !== 'staff' || !data.user) {
        dropSession('That account is not a staff account.');
        return 'That account is not a staff account.';
      }
      setSession((prev) => {
        const next: Session = {
          ...data.user!,
          signedInAt: prev?.signedInAt ?? new Date().toISOString(),
          expiresAt: prev?.expiresAt ?? null,
        };
        writeSession(next, rememberedRef.current);
        return next;
      });
      return null;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        // The api client already fired regis:unauthorized for these; the
        // listener below signs the tab out, but do it here too so a caller
        // awaiting `refresh` sees a consistent state either way.
        dropSession(e.message);
        return e.message;
      }
      // Network trouble: keep the session, the next request will tell.
      return e instanceof Error ? e.message : 'The API could not be reached.';
    } finally {
      setRefreshing(false);
    }
  }, [dropSession]);

  /* On boot, with a stored session, re-read the profile so permissions are live. */
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (initial) void refresh();
  }, [initial, refresh]);

  /* The API client's session signal: a dead token (401) or a refused account (403). */
  useEffect(() => {
    const onUnauthorized = (e: Event) => {
      const detail = (e as CustomEvent<UnauthorizedDetail>).detail;
      if (!detail || detail.audience !== 'cms') return;
      const why = detail.message
        ?? (detail.status === 401 ? 'Your session has expired. Sign in again.' : 'This account can no longer sign in.');
      dropSession(why);
      const path = pathRef.current;
      if (path.startsWith('/cms') || path.startsWith('/crms')) {
        navigate(loginPathFor(path), { replace: true, state: { from: path, notice: why } });
      }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [dropSession, navigate]);

  const can = useCallback(
    (permission: string) => session?.permissions?.includes(permission) ?? false,
    [session],
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    session, signIn, login, signOut, can, refresh, refreshing, remembered, notice, clearNotice,
  }), [session, signIn, login, signOut, can, refresh, refreshing, remembered, notice, clearNotice]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Route guard: module pages bounce to the area's landing when the role lacks the permission. */
export function RequirePermission({ permission, children, fallback = '/cms' }: {
  permission: string; children: ReactNode; fallback?: string;
}) {
  const { can } = useAuth();
  if (!can(permission)) {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

export function RequireAuth({ children, loginPath = '/login/cms' }: { children: ReactNode; loginPath?: string }) {
  const { session, notice } = useAuth();
  const location = useLocation();
  if (!session) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname, notice }} />;
  }
  return <>{children}</>;
}
