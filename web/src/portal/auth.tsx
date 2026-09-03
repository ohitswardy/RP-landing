import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiFetch, ApiError, getToken, setToken } from '../lib/api';

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
  signIn: (identity: string, password: string) => Promise<string | null>;
  signOut: () => void;
};

const PortalContext = createContext<PortalContextValue | null>(null);

const STORAGE_KEY = 'regis.portal.session';

function readSession(): PortalClient | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Without its token the session cannot reach the API, so start clean.
    if (!getToken('portal')) return null;
    return JSON.parse(raw) as PortalClient;
  } catch {
    return null;
  }
}

type LoginResponse = {
  token: string;
  client: { id: string; name: string; email: string; username: string | null; firm: string };
};

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PortalClient | null>(readSession);

  const signIn = useCallback(async (identity: string, password: string) => {
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
        body: { identity: id, password },
      });
      const next: PortalClient = { ...data.client, signedInAt: new Date().toISOString() };
      setToken('portal', data.token);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private-mode storage failures are non-fatal */
      }
      setClient(next);
      return null;
    } catch (e) {
      if (e instanceof ApiError) return e.message;
      return 'The research service is unreachable. Check that the API is running.';
    }
  }, []);

  const signOut = useCallback(() => {
    void apiFetch('/logout', { method: 'POST', audience: 'portal' }).catch(() => undefined);
    setToken('portal', null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setClient(null);
  }, []);

  const value = useMemo(() => ({ client, signIn, signOut }), [client, signIn, signOut]);
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
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
