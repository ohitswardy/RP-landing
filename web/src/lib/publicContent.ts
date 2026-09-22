import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiFetch } from './api';

/* ─────────────────────────────────────────────────────────────
   One fetch path for the public site's CMS-authored content.

   - Session cache: a page revisited in the same SPA session renders
     instantly from memory instead of refetching and re-skeleting.
   - In-flight dedupe: two components asking for the same path share
     one request.
   - Fallback on failure: the bundled copy renders and the page is
     marked ready, so the site never collapses to an empty shell.
   - Visible failure: every failed fetch is logged in dev and raises
     the `apiDown` flag below, which the footer surfaces as a discreet
     "showing cached copy" line rather than pretending all is well.
   - Deferred fetch: `enabled` holds the request back until the
     content is actually about to be read.
   ───────────────────────────────────────────────────────────── */

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/* ── Health store ──────────────────────────────────────────── */

export type PublicContentHealth = {
  /** True once any public content fetch has failed this session. */
  apiDown: boolean;
  /** The paths that failed, in order of first failure. */
  failed: string[];
  /** The last failure's reason, for the dev console and the footer title. */
  lastError: string | null;
};

let health: PublicContentHealth = { apiDown: false, failed: [], lastError: null };
const healthListeners = new Set<() => void>();

function reportFailure(path: string, reason: string) {
  if (!health.failed.includes(path)) {
    health = { apiDown: true, failed: [...health.failed, path], lastError: reason };
  } else if (health.lastError !== reason) {
    health = { ...health, lastError: reason };
  } else {
    return;
  }
  healthListeners.forEach((l) => l());
}

function subscribeHealth(listener: () => void) {
  healthListeners.add(listener);
  return () => { healthListeners.delete(listener); };
}

function getHealth() {
  return health;
}

/** Whether any public content fetch has failed so far this session. */
export function usePublicContentHealth(): PublicContentHealth {
  return useSyncExternalStore(subscribeHealth, getHealth, getHealth);
}

/** Test hook: forget every cached document and clear the health flag. */
export function resetPublicContent() {
  cache.clear();
  inflight.clear();
  health = { apiDown: false, failed: [], lastError: null };
  healthListeners.forEach((l) => l());
}

/* ── Failure classification ────────────────────────────────── */

/**
 * Names the failure for the console. A `SyntaxError` out of `res.json()`
 * means the server answered 200 with something that is not JSON — the
 * classic SPA-rewrite trap where every /api/* request comes back as
 * index.html — so it gets called out as such instead of hiding behind a
 * generic "request failed".
 */
export function describeContentFailure(err: unknown): string {
  if (err instanceof SyntaxError || (err instanceof Error && /JSON/i.test(err.message))) {
    return 'The API answered with a non-JSON document (is /api being rewritten to the SPA?)';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Request failed';
}

/**
 * Fetch a public content document, recording the failure in the health
 * store on the way out. Callers that need to distinguish a 404 from an
 * outage (the article page) use this directly and inspect the error.
 */
export async function fetchPublic<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    reportContentFailure(path, err);
    throw err;
  }
}

/** Log a public content failure (dev console) and raise the `apiDown` flag. */
export function reportContentFailure(path: string, err: unknown) {
  const reason = describeContentFailure(err);
  reportFailure(path, reason);
  if (import.meta.env.DEV) {
    console.warn(`[publicContent] GET /api${path} failed — showing bundled copy. ${reason}`, err);
  }
}

/* ── The hook ──────────────────────────────────────────────── */

export function usePublicContent<T>(
  path: string,
  fallback: T,
  normalize: (raw: unknown) => T,
  enabled = true,
): { data: T; ready: boolean } {
  const [state, setState] = useState<{ data: T; ready: boolean }>(() => {
    const hit = cache.get(path) as T | undefined;
    return hit !== undefined ? { data: hit, ready: true } : { data: fallback, ready: false };
  });

  useEffect(() => {
    if (!enabled || cache.has(path)) return; // served synchronously above
    let alive = true;

    let request = inflight.get(path) as Promise<T> | undefined;
    if (!request) {
      request = fetchPublic<unknown>(path).then(normalize);
      inflight.set(path, request);
      void request.catch(() => undefined).finally(() => inflight.delete(path));
    }

    request
      .then((data) => {
        cache.set(path, data);
        if (alive) setState({ data, ready: true });
      })
      .catch(() => {
        // API unreachable — the bundled fallback stands in. The failure has
        // already been logged and flagged by fetchPublic.
        if (alive) setState((s) => ({ ...s, ready: true }));
      });

    return () => { alive = false; };
    // fallback/normalize are stable module-level values at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled]);

  return state;
}
