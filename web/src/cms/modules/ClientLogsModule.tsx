import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { apiBlobUrl, apiFetch } from '../../lib/api';
import { BtnGhost, BtnPrimary, Chip, EmptyState, ModuleHeader, SkeletonRows, Stat, EASE } from '../ui';
import { IconArrowDown, IconArrowUp, IconDownload, IconSearch, IconShield, IconX } from '../icons';
import { CLIENT_EVENTS, timeAgo, type ClientActivity, type ClientActivityEvent } from '../data';

/* ─────────────────────────────────────────────────────────────
   Client logs. The tamper-evident ledger of everything portal
   clients consume: report views, PDF downloads, and clicks.
   Rows are append-only on the API and sealed into an HMAC hash
   chain, so the module can prove the trail was never altered.
   Filtering, sorting, and paging all run server-side.
   ───────────────────────────────────────────────────────────── */

type EventFilter = 'all' | ClientActivityEvent;
type SortKey = 'at' | 'actor' | 'event' | 'target';

type LedgerClient = { id: string; name: string; firm: string | null };

type LedgerResponse = {
  items: ClientActivity[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
  summary: { total: number; views: number; downloads: number; clicks: number; actors: number };
  clients: LedgerClient[];
};

type ChainStatus =
  | { state: 'checking' }
  | { state: 'intact'; checked: number }
  | { state: 'broken'; checked: number; brokenAt: string }
  | { state: 'failed' };

type Filters = {
  event: EventFilter;
  clientId: string;   // '' = every client
  from: string;       // yyyy-mm-dd or ''
  to: string;
  q: string;
};

const BLANK_FILTERS: Filters = { event: 'all', clientId: '', from: '', to: '', q: '' };
const PAGE_SIZE = 10;

const EVENT_TABS: Array<{ value: EventFilter; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'view', label: 'Views' },
  { value: 'download', label: 'Downloads' },
  { value: 'click', label: 'Clicks' },
];

/** Human phrasing for the beacon contexts the portal sends. */
const CONTEXT_LABELS: Record<string, string> = {
  'viewer': 'in the viewer',
  'featured': 'from the featured card',
  'card': 'from a report card',
  'bookmarks': 'from saved reports',
  'new-tab': 'opened in a new tab',
  'bookmark-add': 'saved to bookmarks',
  'bookmark-remove': 'removed from bookmarks',
};

function buildQuery(f: Filters, sort: SortKey, dir: 'asc' | 'desc', page: number): string {
  const p = new URLSearchParams();
  if (f.event !== 'all') p.set('event', f.event);
  if (f.clientId) p.set('clientId', f.clientId);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.q.trim()) p.set('q', f.q.trim());
  if (sort !== 'at') p.set('sort', sort);
  if (dir !== 'desc') p.set('dir', dir);
  p.set('perPage', String(PAGE_SIZE));
  if (page > 1) p.set('page', String(page));
  return p.toString();
}

function fmtStamp(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/* ── Integrity strip ───────────────────────────────────────── */

function IntegrityStrip({ chain, onVerify }: { chain: ChainStatus; onVerify: () => void }) {
  const broken = chain.state === 'broken' || chain.state === 'failed';
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 border-y rule py-4 sm:flex-row sm:items-center sm:justify-between"
      style={broken ? { borderColor: 'color-mix(in oklab, var(--color-warn) 45%, transparent)' } : undefined}
    >
      <div className="flex items-center gap-4">
        <span className="shrink-0" style={{ color: broken ? 'var(--color-warn)' : 'var(--color-signal)' }}>
          <IconShield size={18} />
        </span>
        <div>
          {chain.state === 'checking' && <Chip tone="muted" pulse>Verifying ledger…</Chip>}
          {chain.state === 'intact' && <Chip tone="live">Ledger sealed</Chip>}
          {chain.state === 'broken' && <Chip tone="warn" pulse>Chain broken</Chip>}
          {chain.state === 'failed' && <Chip tone="warn">Verification unavailable</Chip>}
          <p className="mono mt-1.5 text-[10px] uppercase tracking-[0.16em] text-graphite">
            {chain.state === 'checking' && 'Recomputing the HMAC chain across every entry'}
            {chain.state === 'intact' && `${chain.checked.toLocaleString('en-PH')} entries verified · each seals the one before it`}
            {chain.state === 'broken' && `Integrity holds through ${chain.checked.toLocaleString('en-PH')} entries — entry #${chain.brokenAt} was altered or removed`}
            {chain.state === 'failed' && 'The verification endpoint did not answer'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onVerify}
        disabled={chain.state === 'checking'}
        className="mono self-start border rule px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 sm:self-auto"
      >
        Re-verify chain
      </button>
    </section>
  );
}

/* ── Sortable column header ────────────────────────────────── */

function SortHeader({
  label, col, sort, dir, span, onSort,
}: {
  label: string; col: SortKey; sort: SortKey; dir: 'asc' | 'desc'; span: string; onSort: (c: SortKey) => void;
}) {
  const active = sort === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`mono flex items-center gap-1.5 text-left text-[9.5px] uppercase tracking-[0.2em] transition-colors ${span} ${
        active ? 'text-ink' : 'text-graphite hover:text-ink'
      }`}
    >
      {label}
      {active && (dir === 'asc' ? <IconArrowUp size={10} /> : <IconArrowDown size={10} />)}
    </button>
  );
}

/* ── Module ────────────────────────────────────────────────── */

export default function ClientLogsModule() {
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chain, setChain] = useState<ChainStatus>({ state: 'checking' });
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);

  const [filters, setFilters] = useState<Filters>(BLANK_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState<SortKey>('at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [retryTick, setRetryTick] = useState(0);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /* Search debounces; every other filter refetches immediately. */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  const queryString = buildQuery({ ...filters, q: debouncedQ }, sort, dir, page);

  useEffect(() => {
    let cancelled = false;
    setStatus((s) => (s === 'error' ? 'loading' : s));
    apiFetch<LedgerResponse>(`/cms/client-logs${queryString ? `?${queryString}` : ''}`, { audience: 'cms' })
      .then((res) => {
        if (cancelled || !alive.current) return;
        setData(res);
        setStatus('ready');
        setLoadError(null);
      })
      .catch((e) => {
        if (cancelled || !alive.current) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load the ledger.');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [queryString, retryTick]);

  const verifyChain = useCallback(() => {
    setChain({ state: 'checking' });
    apiFetch<{ intact: boolean; checked: number; brokenAt: string | null }>('/cms/client-logs/verify', { audience: 'cms' })
      .then((res) => {
        if (!alive.current) return;
        setChain(res.intact
          ? { state: 'intact', checked: res.checked }
          : { state: 'broken', checked: res.checked, brokenAt: res.brokenAt ?? '?' });
      })
      .catch(() => { if (alive.current) setChain({ state: 'failed' }); });
  }, []);

  useEffect(() => { verifyChain(); }, [verifyChain]);

  /** Apply a filter change and land back on the first page. */
  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const onSort = (col: SortKey) => {
    if (sort === col) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(col);
      setDir(col === 'at' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  async function exportLedger(format: 'csv' | 'xlsx') {
    setExporting(format);
    try {
      const base = buildQuery({ ...filters, q: debouncedQ }, 'at', 'desc', 1);
      const url = await apiBlobUrl(`/cms/client-logs/export?${base ? `${base}&` : ''}format=${format}`, 'cms');
      if (!url) throw new Error('The export did not generate. Try again.');
      const a = document.createElement('a');
      a.href = url;
      a.download = `client-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The export failed.');
    } finally {
      setExporting(null);
    }
  }

  const items = data?.items ?? [];
  const summary = data?.summary;
  const clients = data?.clients ?? [];
  const hasFilters = filters.event !== 'all' || filters.clientId !== '' || filters.from !== '' || filters.to !== '' || filters.q.trim() !== '';

  const tabCount = useMemo(() => (tab: EventFilter): number | undefined => {
    if (!summary) return undefined;
    if (tab === 'all') return summary.total;
    return tab === 'view' ? summary.views : tab === 'download' ? summary.downloads : summary.clicks;
  }, [summary]);

  const rangeStart = data && data.total > 0 ? (data.page - 1) * data.perPage + 1 : 0;
  const rangeEnd = data ? Math.min(data.page * data.perPage, data.total) : 0;

  if (status === 'error' && !data) {
    return (
      <div className="space-y-9">
        <ModuleHeader
          code="09 / Client logs"
          title="Client logs"
          blurb="A tamper-evident record of everything portal clients consume — every report viewed, downloaded, and clicked."
        />
        <EmptyState
          title="The ledger did not answer."
          hint={loadError ?? 'Check that the API is running, then retry.'}
          action={<BtnGhost onClick={() => { setStatus('loading'); setRetryTick((t) => t + 1); }}>Retry</BtnGhost>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <ModuleHeader
        code="09 / Client logs"
        title="Client logs"
        blurb="A tamper-evident record of everything portal clients consume. Each entry is sealed to the one before it, so nothing can be edited or removed without breaking the chain."
        actions={
          <>
            <BtnGhost onClick={() => void exportLedger('csv')} disabled={exporting !== null}>
              <IconDownload size={14} /> {exporting === 'csv' ? 'Preparing…' : 'CSV'}
            </BtnGhost>
            <BtnPrimary onClick={() => void exportLedger('xlsx')} disabled={exporting !== null}>
              <IconDownload size={14} /> {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
            </BtnPrimary>
          </>
        }
      />

      {/* Inline API failure note (exports, refreshes) */}
      {loadError && data && (
        <div className="flex items-center justify-between border-l-2 pl-4" style={{ borderColor: 'var(--color-warn)' }}>
          <p className="text-[12.5px]" style={{ color: 'var(--color-warn)' }}>{loadError}</p>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            className="mono text-[10px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      <IntegrityStrip chain={chain} onVerify={verifyChain} />

      {/* Stat band — figures track the active client/date/search filters */}
      <div className="grid grid-cols-2 gap-y-6 border-b rule pb-7 md:grid-cols-4">
        <div className="px-1 md:px-4"><Stat value={summary ? String(summary.views) : '—'} label="Report views" /></div>
        <div className="border-l px-4 md:px-8" style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 45%, transparent)' }}>
          <Stat value={summary ? String(summary.downloads) : '—'} label="Downloads" />
        </div>
        <div className="px-1 md:border-l md:px-8" style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 45%, transparent)' }}>
          <Stat value={summary ? String(summary.clicks) : '—'} label="Clicks" />
        </div>
        <div className="border-l px-4 md:px-8" style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 45%, transparent)' }}>
          <Stat value={summary ? String(summary.actors) : '—'} label="Active clients" />
        </div>
      </div>

      {/* ── Ledger ─────────────────────────────────────────────── */}
      <section>
        {/* Event tabs */}
        <div role="tablist" aria-label="Activity type" className="tabs-scroll flex gap-0.5 overflow-x-auto border-b rule">
          {EVENT_TABS.map((t) => {
            const on = filters.event === t.value;
            const count = tabCount(t.value);
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={on}
                onClick={() => patchFilters({ event: t.value })}
                className={`relative whitespace-nowrap px-5 py-3 text-[13px] transition-colors duration-200 ${on ? 'text-ink' : 'text-graphite hover:text-slate'}`}
              >
                {t.label}
                {count !== undefined && (
                  <span className="mono num ml-2 text-[10px] text-silver">{count}</span>
                )}
                {on && (
                  <motion.span layoutId="logs-tab" className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: 'var(--color-amber)' }} transition={{ duration: 0.3, ease: EASE }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Filter deck */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block flex-1 lg:max-w-[320px]">
            <span className="sr-only">Search the ledger</span>
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
            <input
              value={filters.q}
              onChange={(e) => patchFilters({ q: e.target.value })}
              placeholder="Client, firm, or report…"
              className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
            <label className="flex items-center gap-2">
              <span className="sr-only">Filter by client</span>
              <select
                value={filters.clientId}
                onChange={(e) => patchFilters({ clientId: e.target.value })}
                className="appearance-none border rule bg-white px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-[color:var(--color-amber-deep)]"
              >
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.firm ? ` — ${c.firm}` : ''}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">From</span>
                <input
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(e) => patchFilters({ from: e.target.value })}
                  className="mono border rule bg-white px-2.5 py-2 text-[12px] text-ink outline-none transition-colors focus:border-[color:var(--color-amber-deep)]"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">To</span>
                <input
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(e) => patchFilters({ to: e.target.value })}
                  className="mono border rule bg-white px-2.5 py-2 text-[12px] text-ink outline-none transition-colors focus:border-[color:var(--color-amber-deep)]"
                />
              </label>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={() => { setFilters({ ...BLANK_FILTERS }); setPage(1); }}
                className="mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
              >
                <IconX size={11} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Ledger table */}
        {status === 'loading' && !data ? (
          <div className="mt-6"><SkeletonRows rows={8} /></div>
        ) : items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={hasFilters ? 'Nothing matches those filters.' : 'No activity recorded yet.'}
              hint={hasFilters
                ? 'Search covers client names, emails, firms, and report titles. Widen the date range or clear the filters.'
                : 'The moment a client views, downloads, or clicks a report on the portal, it lands here — permanently.'}
              action={hasFilters ? <BtnGhost onClick={() => { setFilters({ ...BLANK_FILTERS }); setPage(1); }}>Clear filters</BtnGhost> : undefined}
            />
          </div>
        ) : (
          <div className="mt-6 border-y rule">
            {/* Header row */}
            <div className="mono hidden grid-cols-12 gap-4 border-b rule py-2.5 text-[9.5px] uppercase tracking-[0.2em] text-graphite md:grid">
              <SortHeader label="When" col="at" sort={sort} dir={dir} span="col-span-2" onSort={onSort} />
              <SortHeader label="Client" col="actor" sort={sort} dir={dir} span="col-span-3" onSort={onSort} />
              <SortHeader label="Event" col="event" sort={sort} dir={dir} span="col-span-2" onSort={onSort} />
              <SortHeader label="Report" col="target" sort={sort} dir={dir} span="col-span-3" onSort={onSort} />
              <span className="col-span-1">IP</span>
              <span className="col-span-1 text-right">Seal</span>
            </div>

            <ul className="divide-y rule">
              <AnimatePresence initial={false}>
                {items.map((a, i) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(i * 0.025, 0.25) } }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    className="grid grid-cols-12 items-baseline gap-x-4 gap-y-1.5 py-3.5"
                  >
                    <span className="mono num col-span-6 text-[11px] text-graphite md:col-span-2" title={fmtStamp(a.at)}>
                      {timeAgo(a.at)}
                      <span className="mt-0.5 hidden text-[9.5px] tracking-[0.04em] text-silver md:block">{fmtStamp(a.at)}</span>
                    </span>

                    <span className="col-span-6 min-w-0 md:col-span-3">
                      <span className="block truncate text-[13.5px] text-ink">{a.actor}</span>
                      <span className="mono block truncate text-[10.5px] tracking-[0.04em] text-graphite">
                        {a.firm ?? a.email}
                      </span>
                    </span>

                    <span className="col-span-6 md:col-span-2">
                      <Chip tone={CLIENT_EVENTS[a.event].tone}>{CLIENT_EVENTS[a.event].label}</Chip>
                      {a.context && (
                        <span className="mt-1 block text-[11px] text-graphite">{CONTEXT_LABELS[a.context] ?? a.context}</span>
                      )}
                    </span>

                    <span className="col-span-6 min-w-0 text-[13px] leading-snug text-slate md:col-span-3">
                      {a.target || <span className="text-silver">—</span>}
                    </span>

                    <span className="mono num col-span-6 text-[10.5px] text-graphite md:col-span-1">{a.ip ?? '—'}</span>

                    <span
                      className="mono col-span-6 text-[10px] tracking-[0.04em] text-silver md:col-span-1 md:text-right"
                      title={`Entry seal ${a.hash}`}
                    >
                      {a.hash.slice(0, 7)}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t rule py-3">
              <span className="mono num text-[10.5px] uppercase tracking-[0.14em] text-graphite">
                {rangeStart.toLocaleString('en-PH')}–{rangeEnd.toLocaleString('en-PH')} of {(data?.total ?? 0).toLocaleString('en-PH')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || status === 'loading'}
                  className="mono border rule px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="mono num px-1 text-[10.5px] text-graphite">
                  {data?.page ?? 1} / {data?.pages ?? 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(data?.pages ?? p, p + 1))}
                  disabled={(data ? page >= data.pages : true) || status === 'loading'}
                  className="mono border rule px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Provenance note */}
      <p className="mono border-t rule pt-4 text-[10px] uppercase tracking-[0.16em] text-graphite">
        Entries are recorded server-side with IP and timestamp · HMAC-SHA256 chained · exports carry each entry's seal
      </p>
    </div>
  );
}
