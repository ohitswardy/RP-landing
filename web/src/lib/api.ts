/* ─────────────────────────────────────────────────────────────
   Thin API client for the Laravel backend (/api, proxied by Vite
   in dev). Two token scopes exist: staff (CMS) and client (portal).
   Tokens are Sanctum personal-access tokens sent as Bearer headers.
   ───────────────────────────────────────────────────────────── */

export type Audience = 'cms' | 'portal';

const TOKEN_KEYS: Record<Audience, string> = {
  cms: 'regis.cms.token',
  portal: 'regis.portal.token',
};

export function getToken(aud: Audience): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEYS[aud]);
  } catch {
    return null;
  }
}

export function setToken(aud: Audience, token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEYS[aud], token);
    else sessionStorage.removeItem(TOKEN_KEYS[aud]);
  } catch {
    /* private-mode storage failures are non-fatal */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Multipart payload — wins over `body` when provided. */
  formData?: FormData;
  audience?: Audience;
  signal?: AbortSignal;
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.message === 'string' && data.message) return data.message;
    const first = data?.errors && Object.values(data.errors as Record<string, string[]>)[0]?.[0];
    if (first) return first;
  } catch {
    /* non-JSON body */
  }
  return res.status === 401 ? 'Your session has expired. Sign in again.' : `Request failed (${res.status}).`;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, audience, signal } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (audience) {
    const token = getToken(audience);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (!formData && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    signal,
  });

  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetch a protected binary (report PDFs) as an object URL. Caller revokes. */
export async function apiBlobUrl(path: string, audience: Audience): Promise<string | null> {
  const token = getToken(audience);
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
