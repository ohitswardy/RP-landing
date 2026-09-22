/* ─────────────────────────────────────────────────────────────
   Thin API client for the Laravel backend (/api, proxied by Vite
   in dev). Two token scopes exist: staff (CMS) and client (portal).
   Tokens are Sanctum personal-access tokens sent as Bearer headers.

   Storage. A token lives in sessionStorage by default (closing the
   tab signs you out). A "remember me" login stores it in
   localStorage instead, beside `${key}.expires` (ISO) so a stale
   remembered token is discarded on read rather than sent.

   Session events. Both request helpers dispatch one DOM event,
   `regis:unauthorized`, on the window so each shell can react in a
   single place (cms/auth.tsx, portal/auth.tsx):

     window.addEventListener('regis:unauthorized', (e) => {
       const { audience, status, message } = (e as CustomEvent<UnauthorizedDetail>).detail;
     });

   · status 401 — the token is bad or expired. The token is already
     cleared by the time the event fires; the shell drops its session.
   · status 403 — the account itself is refused (suspended, approval
     withdrawn). The token is NOT cleared; `message` carries the
     server's copy and the shell decides what to do.
   ───────────────────────────────────────────────────────────── */

import { beginActivity, markSuccess } from './activity';

export type Audience = 'cms' | 'portal';

/** Name of the window event fired on a 401 / account-state 403. */
export const UNAUTHORIZED_EVENT = 'regis:unauthorized';

export type UnauthorizedDetail = {
  audience: Audience;
  status: 401 | 403;
  /** Server copy; present on 403, and on 401 when the body carried one. */
  message?: string;
};

const TOKEN_KEYS: Record<Audience, string> = {
  cms: 'regis.cms.token',
  portal: 'regis.portal.token',
};

const expiryKey = (aud: Audience) => `${TOKEN_KEYS[aud]}.expires`;

function expired(iso: string | null): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  return Number.isFinite(at) && at <= Date.now();
}

function clearPersisted(aud: Audience) {
  try {
    localStorage.removeItem(TOKEN_KEYS[aud]);
    localStorage.removeItem(expiryKey(aud));
  } catch {
    /* storage unavailable */
  }
}

/** The live token for an audience: this tab's first, then a remembered one
    that has not passed its expiry. */
export function getToken(aud: Audience): string | null {
  try {
    const session = sessionStorage.getItem(TOKEN_KEYS[aud]);
    if (session) return session;
  } catch {
    /* fall through to localStorage */
  }
  try {
    const remembered = localStorage.getItem(TOKEN_KEYS[aud]);
    if (!remembered) return null;
    if (expired(localStorage.getItem(expiryKey(aud)))) {
      clearPersisted(aud);
      return null;
    }
    return remembered;
  } catch {
    return null;
  }
}

/** Expiry (ISO) of a remembered token, or null when the token is per-tab or
    carries no expiry. */
export function getTokenExpiry(aud: Audience): string | null {
  try {
    if (!localStorage.getItem(TOKEN_KEYS[aud])) return null;
    return localStorage.getItem(expiryKey(aud));
  } catch {
    return null;
  }
}

/**
 * Store (or with `null`, clear) the token for an audience.
 * `persist` keeps it across tabs and restarts, until `expiresAt`.
 * Clearing always empties both stores.
 */
export function setToken(
  aud: Audience,
  token: string | null,
  opts: { persist?: boolean; expiresAt?: string | null } = {},
) {
  const key = TOKEN_KEYS[aud];
  if (!token) {
    try { sessionStorage.removeItem(key); } catch { /* noop */ }
    clearPersisted(aud);
    return;
  }
  if (opts.persist) {
    try { sessionStorage.removeItem(key); } catch { /* noop */ }
    try {
      localStorage.setItem(key, token);
      if (opts.expiresAt) localStorage.setItem(expiryKey(aud), opts.expiresAt);
      else localStorage.removeItem(expiryKey(aud));
    } catch {
      /* private-mode storage failures are non-fatal */
    }
    return;
  }
  clearPersisted(aud);
  try {
    sessionStorage.setItem(key, token);
  } catch {
    /* private-mode storage failures are non-fatal */
  }
}

export class ApiError extends Error {
  status: number;
  /** Laravel's per-field validation messages, when the body carried them. */
  errors?: Record<string, string[]>;
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Multipart payload — wins over `body` when provided. */
  formData?: FormData;
  audience?: Audience;
  signal?: AbortSignal;
  /** Let the request outlive the page (unload-time beacons). */
  keepalive?: boolean;
};

type ParsedError = { message: string; errors?: Record<string, string[]>; hadMessage: boolean };

async function parseError(res: Response): Promise<ParsedError> {
  try {
    const data = await res.json();
    const errors = data?.errors && typeof data.errors === 'object' ? (data.errors as Record<string, string[]>) : undefined;
    if (typeof data?.message === 'string' && data.message) return { message: data.message, errors, hadMessage: true };
    const first = errors && Object.values(errors)[0]?.[0];
    if (first) return { message: first, errors, hadMessage: true };
  } catch {
    /* non-JSON body */
  }
  return {
    message: res.status === 401 ? 'Your session has expired. Sign in again.' : `Request failed (${res.status}).`,
    hadMessage: false,
  };
}

/** Sanctum's own refusal when a bearer token is missing or dead. Any other
    403 with a message is the account gate (suspended, not approved). */
const SANCTUM_FORBIDDEN = /^(this action is unauthorized|unauthenticated)\.?$/i;

function dispatchUnauthorized(detail: UnauthorizedDetail) {
  try {
    window.dispatchEvent(new CustomEvent<UnauthorizedDetail>(UNAUTHORIZED_EVENT, { detail }));
  } catch {
    /* no window (tests, workers) */
  }
}

/** Turn a failed response into the ApiError to throw, signalling the shell
    first when the failure is about the session rather than the request. */
async function failure(res: Response, audience: Audience | undefined, sentToken: boolean): Promise<ApiError> {
  const parsed = await parseError(res);
  if (audience && sentToken) {
    if (res.status === 401) {
      setToken(audience, null);
      dispatchUnauthorized({ audience, status: 401, message: parsed.hadMessage ? parsed.message : undefined });
    } else if (res.status === 403 && parsed.hadMessage && !SANCTUM_FORBIDDEN.test(parsed.message)) {
      dispatchUnauthorized({ audience, status: 403, message: parsed.message });
    }
  }
  return new ApiError(res.status, parsed.message, parsed.errors);
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, audience, signal, keepalive } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  let sentToken = false;
  if (audience) {
    const token = getToken(audience);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      sentToken = true;
    }
  }
  if (!formData && body !== undefined) headers['Content-Type'] = 'application/json';

  // The rail orb: multipart is an upload, everything else is a task in flight,
  // and a mutation that lands is a success worth a beat.
  const end = beginActivity(formData ? 'upload' : 'task');
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
      keepalive,
    });

    if (!res.ok) throw await failure(res, audience, sentToken);
    if (method !== 'GET') markSuccess();
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    end();
  }
}

/**
 * Raw bytes from an authenticated endpoint, for callers that transform the
 * file before handing it over (see portal/watermark.ts).
 *
 * Resolves `null` on 404 (nothing stored) and throws an ApiError on any
 * other failure, so a session that has ended is never mistaken for a
 * missing file.
 */
export async function apiBlob(path: string, audience: Audience): Promise<Blob | null> {
  const token = getToken(audience);
  const end = beginActivity('download');
  try {
    const res = await fetch(`/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/pdf, application/json' } : { Accept: 'application/pdf, application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw await failure(res, audience, Boolean(token));
    const blob = await res.blob();
    markSuccess();
    return blob;
  } finally {
    end();
  }
}

/** Fetch a protected binary (report PDFs) as an object URL. Caller revokes.
    Resolves `null` on any failure (the session event still fires on 401). */
export async function apiBlobUrl(path: string, audience: Audience): Promise<string | null> {
  try {
    const blob = await apiBlob(path, audience);
    return blob ? URL.createObjectURL(blob) : null;
  } catch (e) {
    if (e instanceof ApiError) return null;
    throw e;
  }
}
