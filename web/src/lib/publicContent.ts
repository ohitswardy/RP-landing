import { useEffect, useState } from 'react';
import { apiFetch } from './api';

/* ─────────────────────────────────────────────────────────────
   One fetch path for the public site's CMS-authored content.

   - Session cache: a page revisited in the same SPA session renders
     instantly from memory instead of refetching and re-skeleting.
   - In-flight dedupe: two components asking for the same path share
     one request.
   - Fallback on failure: the bundled copy renders and the page is
     marked ready, so the site never collapses to an empty shell.
   - Deferred fetch: `enabled` holds the request back until the
     content is actually about to be read.
   ───────────────────────────────────────────────────────────── */

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

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
      request = apiFetch<unknown>(path).then(normalize);
      inflight.set(path, request);
      void request.finally(() => inflight.delete(path));
    }

    request
      .then((data) => {
        cache.set(path, data);
        if (alive) setState({ data, ready: true });
      })
      .catch(() => {
        // API unreachable — the bundled fallback stands in.
        if (alive) setState((s) => ({ ...s, ready: true }));
      });

    return () => { alive = false; };
    // fallback/normalize are stable module-level values at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled]);

  return state;
}
