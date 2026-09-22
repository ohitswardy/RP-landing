import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { usePortal } from './auth';
import { notify } from './notice';

/* ─────────────────────────────────────────────────────────────
   Per-client bookmark shelf, persisted server-side per account.
   Mutations are optimistic; the server response settles the
   canonical timestamp, and a rejection rolls the flip back and
   says so — quietly, never in the way of the reading.
   ───────────────────────────────────────────────────────────── */

/** report id → ISO timestamp the client saved it. */
type Marks = Record<string, string>;

type BookmarksValue = {
  /** Report ids, most recently saved first. */
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  savedAt: (id: string) => string | null;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** The shelf could not be read from the account; `reload` tries again. */
  loadError: string | null;
  reload: () => void;
};

const BookmarksContext = createContext<BookmarksValue | null>(null);

/** Session failures reach the door through the auth listener; everything
    else is worth one line to the client. */
function isSessionFailure(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

export function PortalBookmarksProvider({ children }: { children: ReactNode }) {
  const { client } = usePortal();
  const [marks, setMarks] = useState<Marks>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(() => {
    setLoadError(null);
    apiFetch<{ marks: Marks }>('/portal/bookmarks', { audience: 'portal' })
      .then((data) => { if (alive.current) setMarks(data.marks); })
      .catch((e: unknown) => {
        if (!alive.current || isSessionFailure(e)) return;
        const message = 'Your saved reports could not be loaded.';
        setLoadError(message);
        notify(message, { tone: 'warn', action: { label: 'Retry', onClick: load } });
      });
  }, []);

  useEffect(() => {
    if (!client) { setMarks({}); setLoadError(null); return; }
    load();
  }, [client, load]);

  const toggle = useCallback((id: string) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = new Date().toISOString();
      return next;
    });
    apiFetch<{ saved: boolean; savedAt: string | null }>(`/portal/bookmarks/${id}`, {
      method: 'PUT', audience: 'portal',
    })
      .then((res) => {
        if (!alive.current) return;
        setMarks((prev) => {
          const next = { ...prev };
          if (res.saved && res.savedAt) next[id] = res.savedAt;
          else delete next[id];
          return next;
        });
      })
      .catch((e: unknown) => {
        // Roll the optimistic flip back if the server rejected it.
        if (!alive.current) return;
        setMarks((prev) => {
          const next = { ...prev };
          if (next[id]) delete next[id];
          else next[id] = new Date().toISOString();
          return next;
        });
        if (!isSessionFailure(e)) notify('That bookmark could not be saved to your account. Try again.', { tone: 'warn' });
      });
  }, []);

  const remove = useCallback((id: string) => {
    let removedAt: string | null = null;
    setMarks((prev) => {
      if (!prev[id]) return prev;
      removedAt = prev[id];
      const next = { ...prev };
      delete next[id];
      return next;
    });
    apiFetch(`/portal/bookmarks/${id}`, { method: 'DELETE', audience: 'portal' }).catch((e: unknown) => {
      if (!alive.current) return;
      // Put it back where it was; the server still has it.
      setMarks((prev) => (prev[id] ? prev : { ...prev, [id]: removedAt ?? new Date().toISOString() }));
      if (!isSessionFailure(e)) notify('That bookmark could not be removed. It is still on your account.', { tone: 'warn' });
    });
  }, []);

  const clear = useCallback(() => {
    let before: Marks = {};
    setMarks((prev) => { before = prev; return {}; });
    apiFetch('/portal/bookmarks', { method: 'DELETE', audience: 'portal' }).catch((e: unknown) => {
      if (!alive.current) return;
      setMarks((prev) => (Object.keys(prev).length ? prev : before));
      if (!isSessionFailure(e)) notify('Your saved reports could not be cleared. They are still on your account.', { tone: 'warn' });
    });
  }, []);

  const ids = useMemo(
    () => Object.keys(marks).sort((a, b) => marks[b].localeCompare(marks[a])),
    [marks],
  );

  const has = useCallback((id: string) => Boolean(marks[id]), [marks]);
  const savedAt = useCallback((id: string) => marks[id] ?? null, [marks]);

  const value = useMemo<BookmarksValue>(
    () => ({ ids, count: ids.length, has, savedAt, toggle, remove, clear, loadError, reload: load }),
    [ids, has, savedAt, toggle, remove, clear, loadError, load],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks(): BookmarksValue {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error('useBookmarks must be used inside <PortalBookmarksProvider>');
  return ctx;
}
