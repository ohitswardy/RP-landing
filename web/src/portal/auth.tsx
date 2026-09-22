import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError, getToken, setToken, UNAUTHORIZED_EVENT, type UnauthorizedDetail } from '../lib/api';
import { clearNotices, NoticeHost, notify } from './notice';

export type PortalClient = {
  id: string;
  name: string;
  email: string;
  /** Regis-issued user id shown in the welcome email. */
  username: string | null;
  firm: string;
  signedInAt: string;
};

type PortalContextValue = {
  client: PortalClient | null;
  /** Verify credentials; resolves to an error message, or null on success.
      `remember` keeps the session across tabs and restarts (30 days server-side). */
  signIn: (identity: string, password: string, remember?: boolean) => Promise<string | null>;
  signOut: () => void;
};

const PortalContext = createContext<PortalContextValue | null>(null);

const STORAGE_KEY = 'regis.portal.session';

/** Copy shown at the door when the session ends underneath the client. */
export const SESSION_ENDED = 'Your session ended. Sign in again.';

function readSession(): PortalClient | null {
  // Without its token the session cannot reach the API, so start clean.
  if (!getToken('portal')) return null;
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as PortalClient;
    } catch {
      /* unreadable store — try the next */
    }
  }
  return null;
}

function writeSession(next: PortalClient | null, persist: boolean) {
  for (const store of [sessionStorage, localStorage]) {
    try { store.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
  if (!next) return;
  try {
    (persist ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private-mode storage failures are non-fatal */
  }
}

/** True when the live session came from a "remember me" sign-in. */
function remembered(): boolean {
  try {
    return !sessionStorage.getItem(STORAGE_KEY) && Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

type SessionClient = { id: string; name: string; email: string; username: string | null; firm: string };
type LoginResponse = { token: string; expiresAt: string | null; client: SessionClient };
type MeResponse = { kind: 'staff' } | { kind: 'client'; client: SessionClient };

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PortalClient | null>(readSession);
  const navigate = useNavigate();
  const clientRef = useRef(client);
  clientRef.current = client;

  const dropSession = useCallback((message: string | null) => {
    setToken('portal', null);
    writeSession(null, false);
    setClient(null);
    clearNotices();
    if (message) notify(message, { tone: 'warn', ttl: 12000 });
  }, []);

  /* A 401 anywhere in the portal means the token is dead; a 403 with copy
     means the account is no longer allowed on. Either way, back to the door
     with the reason on screen. */
  useEffect(() => {
    const onUnauthorized = (e: Event) => {
      const detail = (e as CustomEvent<UnauthorizedDetail>).detail;
      if (!detail || detail.audience !== 'portal') return;
      if (!clientRef.current && !getToken('portal')) return;
      const message = detail.status === 403 && detail.message ? detail.message : SESSION_ENDED;
      const from = `${window.location.pathname}${window.location.search}`;
      // Inside the portal: back to the door with the reason on screen. On a
      // public page (a stale remembered token found on boot) drop quietly.
      const inPortal = from.startsWith('/portal') && !/^\/portal\/(register|reset)\//.test(from);
      dropSession(inPortal ? message : null);
      if (inPortal) navigate('/login', { replace: true, state: { from, notice: message } });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [dropSession, navigate]);

  /* Boot: a stored session is a hint, not proof. Ask the API who the token
     belongs to and refresh the record; a refusal signs out with the reason.
     An unreachable API keeps the local session — the catalog load will say
     so on its own. */
  useEffect(() => {
    if (!getToken('portal')) return;
    let alive = true;
    apiFetch<MeResponse>('/me', { audience: 'portal' })
      .then((me) => {
        if (!alive) return;
        if (me.kind !== 'client') {
          dropSession('This token belongs to a staff account. Sign in to the portal with your client credentials.');
          return;
        }
        setClient((prev) => {
          const next: PortalClient = { ...me.client, signedInAt: prev?.signedInAt ?? new Date().toISOString() };
          writeSession(next, remembered());
          return next;
        });
      })
      .catch(() => {
        // 401/403 have already been handled by the event listener above;
        // anything else (API down, network) keeps the local session as-is.
      });
    return () => { alive = false; };
    // Runs once per mount — sign-ins after boot set the client from the login response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (identity: string, password: string, remember = false) => {
    // Clients sign in with the Regis-issued user id or the email on the mandate.
    const id = identity.trim().toLowerCase();
    if (id.length < 3) {
      return 'Enter your user id or the email address on your mandate.';
    }
    if (password.length < 8) {
      return 'Credentials not recognized. Passwords are at least 8 characters.';
    }

    try {
      const data = await apiFetch<LoginResponse>('/portal/login', {
        method: 'POST',
        body: { identity: id, password, remember },
      });
      const next: PortalClient = { ...data.client, signedInAt: new Date().toISOString() };
      setToken('portal', data.token, { persist: remember, expiresAt: data.expiresAt ?? null });
      writeSession(next, remember);
      clearNotices();
      setClient(next);
      return null;
    } catch (e) {
      if (e instanceof ApiError) return e.message;
      return 'The research service is unreachable. Check that the API is running.';
    }
  }, []);

  const signOut = useCallback(() => {
    const hadToken = Boolean(getToken('portal'));
    if (hadToken) {
      // Revoke server-side, but never keep the client waiting on it.
      apiFetch('/logout', { method: 'POST', audience: 'portal', keepalive: true }).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) return; // already dead server-side
        notify('You are signed out here, but the server could not be reached to close the session.', { tone: 'warn' });
      });
    }
    setToken('portal', null);
    writeSession(null, false);
    setClient(null);
  }, []);

  const value = useMemo(() => ({ client, signIn, signOut }), [client, signIn, signOut]);
  return (
    <PortalContext.Provider value={value}>
      {children}
      <NoticeHost />
    </PortalContext.Provider>
  );
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside <PortalAuthProvider>');
  return ctx;
}

/** The signed-in client as a plain record, for code that runs outside the
    React tree — the download stamper needs a name without prop-drilling. */
export function portalIdentity(): { name: string; email: string } | null {
  const session = readSession();
  return session ? { name: session.name, email: session.email } : null;
}

export function RequirePortal({ children }: { children: ReactNode }) {
  const { client } = usePortal();
  const location = useLocation();
  if (!client) {
    // Keep the query string so blast deep links (/portal?report=…) survive the login gate.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
