import { useCallback, useSyncExternalStore } from 'react';
import { REPORT_CATEGORIES, type ReportCategory, type ReportCompany } from '../cms/data';

/* ─────────────────────────────────────────────────────────────
   Per-viewer portal preferences. These live in this browser only
   (localStorage) — they are conveniences for the person at the
   keyboard, not part of the account, so nothing here reaches the
   API. The dashboard reads them once on load to seed its filters.
   ───────────────────────────────────────────────────────────── */

export const PREFERENCES_KEY = 'regis.portal.preferences';

/** The sector rail's entries plus the two catch-all views. */
export type DefaultView = 'latest' | 'all' | ReportCategory;

export type PortalPreferences = {
  /** Which view the dashboard opens on. */
  defaultView: DefaultView;
  /** Pre-applied Local / Foreign filter, or none. */
  defaultCompany: ReportCompany | null;
};

export const DEFAULT_PREFERENCES: PortalPreferences = { defaultView: 'latest', defaultCompany: null };

function isView(v: unknown): v is DefaultView {
  return v === 'latest' || v === 'all' || (typeof v === 'string' && (REPORT_CATEGORIES as string[]).includes(v));
}

function isCompany(v: unknown): v is ReportCompany | null {
  return v === null || v === 'Local' || v === 'Foreign';
}

/** Parse whatever is stored, dropping any field that no longer makes sense
    (a sector renamed in the CMS, a hand-edited value). */
export function parsePreferences(raw: string | null): PortalPreferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof PortalPreferences, unknown>>;
    return {
      defaultView: isView(data.defaultView) ? data.defaultView : DEFAULT_PREFERENCES.defaultView,
      defaultCompany: isCompany(data.defaultCompany) ? data.defaultCompany : DEFAULT_PREFERENCES.defaultCompany,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function readPreferences(): PortalPreferences {
  try {
    return parsePreferences(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

const listeners = new Set<() => void>();
let snapshot: PortalPreferences | null = null;

function current(): PortalPreferences {
  if (!snapshot) snapshot = readPreferences();
  return snapshot;
}

/** Merge and store. Returns what is now in effect. */
export function writePreferences(patch: Partial<PortalPreferences>): PortalPreferences {
  const next = { ...current(), ...patch };
  // Round-trip through the parser so a bad patch cannot poison the store.
  const clean = parsePreferences(JSON.stringify(next));
  try {
    if (clean.defaultView === DEFAULT_PREFERENCES.defaultView && clean.defaultCompany === DEFAULT_PREFERENCES.defaultCompany) {
      localStorage.removeItem(PREFERENCES_KEY);
    } else {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(clean));
    }
  } catch {
    /* private mode — the choice still applies for this session */
  }
  snapshot = clean;
  listeners.forEach((l) => l());
  return clean;
}

export function resetPreferences(): PortalPreferences {
  return writePreferences({ ...DEFAULT_PREFERENCES });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PREFERENCES_KEY || e.key === null) { snapshot = readPreferences(); l(); }
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
};

/** The live preferences and a setter, for the account page. */
export function usePreferences(): [PortalPreferences, (patch: Partial<PortalPreferences>) => void] {
  const prefs = useSyncExternalStore(subscribe, current, current);
  const set = useCallback((patch: Partial<PortalPreferences>) => { writePreferences(patch); }, []);
  return [prefs, set];
}
