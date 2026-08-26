import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import { usePortal } from './auth';

/* ─────────────────────────────────────────────────────────────
   Per-client bookmark shelf, persisted server-side per account.
   Mutations are optimistic; the server response settles the
   canonical timestamp.
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
};

const BookmarksContext = createContext<BookmarksValue | null>(null);

export function PortalBookmarksProvider({ children }: { children: ReactNode }) {
  const { client } = usePortal();
  const [marks, setMarks] = useState<Marks>({});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!client) { setMarks({}); return; }
    apiFetch<{ marks: Marks }>('/portal/bookmarks', { audience: 'portal' })
      .then((data) => { if (alive.current) setMarks(data.marks); })
      .catch(() => undefined);
  }, [client]);

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
      .catch(() => {
        // Roll the optimistic flip back if the server rejected it.
        if (!alive.current) return;
        setMarks((prev) => {
          const next = { ...prev };
          if (next[id]) delete next[id];
          else next[id] = new Date().toISOString();
          return next;
        });
      });
  }, []);

  const remove = useCallback((id: string) => {
    setMarks((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void apiFetch(`/portal/bookmarks/${id}`, { method: 'DELETE', audience: 'portal' }).catch(() => undefined);
  }, []);

  const clear = useCallback(() => {
    setMarks({});
    void apiFetch('/portal/bookmarks', { method: 'DELETE', audience: 'portal' }).catch(() => undefined);
  }, []);

  const ids = useMemo(
    () => Object.keys(marks).sort((a, b) => marks[b].localeCompare(marks[a])),
    [marks],
  );

  const has = useCallback((id: string) => Boolean(marks[id]), [marks]);
  const savedAt = useCallback((id: string) => marks[id] ?? null, [marks]);

  const value = useMemo<BookmarksValue>(
    () => ({ ids, count: ids.length, has, savedAt, toggle, remove, clear }),
    [ids, has, savedAt, toggle, remove, clear],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks(): BookmarksValue {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error('useBookmarks must be used inside <PortalBookmarksProvider>');
  return ctx;
}
