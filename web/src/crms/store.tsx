import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import type {
  AuditEntry, Client, ClientAddress, ClientContact, Corporate, CorporateContact, EventCategoryMeta, Form, InteractionType,
  JefferiesMeta, PortalAccount, ReportSource, ReportTemplate, SectorGroup, SellsideContact,
} from './data';

/* ─────────────────────────────────────────────────────────────
   CRMS store. Master data (clients, contacts, corporates, staff,
   taxonomy, config) arrives in one bootstrap call and is mutated
   through one generic `mutate` helper: every write endpoint
   answers {item, audit}, so a module only names the collection
   it touched. Interactions and events are paged server-side and
   fetched by their modules directly.
   ───────────────────────────────────────────────────────────── */

export type CrmsCollections = {
  clients: Client[];
  addresses: ClientAddress[];
  clientContacts: ClientContact[];
  corporates: Corporate[];
  corporateContacts: CorporateContact[];
  sellsideContacts: SellsideContact[];
  interactionTypes: InteractionType[];
  forms: Form[];
  sectorGroups: SectorGroup[];
  reportTemplates: ReportTemplate[];
  portalAccounts: PortalAccount[];
};

type CrmsState = CrmsCollections & {
  audit: AuditEntry[];
  meta: {
    years: number[];
    eventCategories: EventCategoryMeta[];
    genericClientId: string | null;
    /** False when no legacy `user` row carries the signed-in email: saves then stamp no author, only the ledger names them. */
    legacyUserMatched: boolean;
    legacyUserId: string | null;
    /** Everything a column of an imported report template can be filled with. */
    reportSources: ReportSource[];
    /** The Jefferies upload: which client row binds it, which binding renders it, and the bundled workbook. */
    jefferies: JefferiesMeta;
  };
};

type CollectionKey = keyof CrmsCollections;
type Item<K extends CollectionKey> = CrmsCollections[K][number];

export type CrmsStatus = 'loading' | 'ready' | 'error';

type CrmsStore = CrmsState & {
  status: CrmsStatus;
  error: string | null;
  reload: () => Promise<void>;
  /** Prepend a returned audit entry to the local ledger. */
  appendAudit: (entry?: AuditEntry) => void;
  /** POST/PUT a payload and merge the returned item into a collection. */
  mutate: <K extends CollectionKey>(key: K, path: string, method: 'POST' | 'PUT', body: unknown) => Promise<Item<K>>;
  /** DELETE a row and drop it from a collection. */
  destroy: (key: CollectionKey, path: string, id: string) => Promise<void>;
  /** Merge an item the caller already holds (e.g. from a link response). */
  put: <K extends CollectionKey>(key: K, item: Item<K>) => void;
};

const EMPTY: CrmsState = {
  clients: [], addresses: [], clientContacts: [], corporates: [], corporateContacts: [], sellsideContacts: [],
  interactionTypes: [], forms: [], sectorGroups: [], reportTemplates: [], portalAccounts: [],
  // legacyUserMatched starts true so the interaction form never warns before the bootstrap has answered.
  audit: [], meta: { years: [new Date().getFullYear()], eventCategories: [], genericClientId: null, legacyUserMatched: true, legacyUserId: null, reportSources: [], jefferies: { clientId: null, templateId: null, bundled: null } },
};

const CrmsContext = createContext<CrmsStore | null>(null);

type ItemResponse<T> = { item: T; audit?: AuditEntry };

/** Alphabetical by the collection's natural label, so lists stay stable after a save. */
const LABEL: Record<CollectionKey, (x: { name?: string; type?: string; clientId?: string | null }) => string> = {
  clients: (x) => x.name ?? '', addresses: (x) => x.name ?? '', clientContacts: (x) => x.name ?? '',
  corporates: (x) => x.name ?? '', corporateContacts: (x) => x.name ?? '', sellsideContacts: (x) => x.name ?? '',
  interactionTypes: (x) => x.type ?? '', forms: (x) => x.clientId ?? '', sectorGroups: (x) => x.name ?? '',
  reportTemplates: (x) => x.clientId ?? '', portalAccounts: (x) => x.name ?? '',
};

export function CrmsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrmsState>(EMPTY);
  const [status, setStatus] = useState<CrmsStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const data = await apiFetch<CrmsState>('/crms/bootstrap', { audience: 'cms' });
      if (!alive.current) return;
      setState(data);
      setStatus('ready');
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load the CRMS.');
      setStatus('error');
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const appendAudit = useCallback((entry?: AuditEntry) => {
    if (!entry) return;
    setState((s) => ({ ...s, audit: [entry, ...s.audit].slice(0, 60) }));
  }, []);

  const put = useCallback(<K extends CollectionKey>(key: K, item: Item<K>) => {
    setState((s) => {
      const list = s[key] as Item<K>[];
      const next = list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
      const label = LABEL[key] as (x: Item<K>) => string;
      next.sort((a, b) => label(a).localeCompare(label(b)));
      return { ...s, [key]: next };
    });
  }, []);

  const mutate = useCallback(async <K extends CollectionKey>(key: K, path: string, method: 'POST' | 'PUT', body: unknown) => {
    const res = await apiFetch<ItemResponse<Item<K>>>(path, { method, body, audience: 'cms' });
    put(key, res.item);
    appendAudit(res.audit);
    return res.item;
  }, [put, appendAudit]);

  const destroy = useCallback(async (key: CollectionKey, path: string, id: string) => {
    const res = await apiFetch<{ audit?: AuditEntry }>(path, { method: 'DELETE', audience: 'cms' });
    setState((s) => ({ ...s, [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }));
    appendAudit(res.audit);
  }, [appendAudit]);

  const value = useMemo<CrmsStore>(
    () => ({ ...state, status, error, reload, appendAudit, mutate, destroy, put }),
    [state, status, error, reload, appendAudit, mutate, destroy, put],
  );

  return <CrmsContext.Provider value={value}>{children}</CrmsContext.Provider>;
}

export function useCrms(): CrmsStore {
  const ctx = useContext(CrmsContext);
  if (!ctx) throw new Error('useCrms must be used inside <CrmsProvider>');
  return ctx;
}

/** Lookup maps the pickers and lists lean on. Recomputed only when a collection changes. */
export function useLookups() {
  const { clients, clientContacts, corporates, sellsideContacts, sectorGroups } = useCrms();
  return useMemo(() => ({
    clientById: new Map(clients.map((c) => [c.id, c])),
    contactById: new Map(clientContacts.map((c) => [c.id, c])),
    corporateById: new Map(corporates.map((c) => [c.id, c])),
    sellsideById: new Map(sellsideContacts.map((s) => [s.id, s])),
    groupById: new Map(sectorGroups.map((g) => [g.id, g])),
  }), [clients, clientContacts, corporates, sellsideContacts, sectorGroups]);
}
