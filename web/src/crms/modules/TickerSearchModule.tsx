import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '../../lib/api';
import { Chip, EASE, EmptyState, ModuleHeader, SkeletonRows, Stat } from '../../cms/ui';
import { IconArrowRight, IconPen, IconSearch, IconX } from '../../cms/icons';
import { useCrms } from '../store';
import { SectionRule, Tabs } from '../kit/fields';
import { errorText } from '../kit/toast';
import { fmtDay, timeAgo, type ClientContact, type Corporate, type CorporateSnapshot, type Interaction, type LookupSnapshot, type Paged } from '../data';
import { RingChart } from '../../components/charts/ring-chart';
import { Ring } from '../../components/charts/ring';
import { RingCenter } from '../../components/charts/ring-center';
import type { RingData } from '../../components/charts/ring-context';

/* ─────────────────────────────────────────────────────────────
   Ticker search (§7.4). The stock view of the desk: how the
   register is covered (held, watched, quiet, unticked), the
   corporates clients hold and watch most, the client contacts
   with positions, the latest interactions and the stocks they
   named, and the corporates still missing a ticker.

   Pick a corporate — from the search box, a bar, a contact's
   holdings, or an interaction's stock — and the holder lookup
   opens above the fold: every contact who owns or watches it and
   the last interactions that discussed it.
   ───────────────────────────────────────────────────────────── */

type Holders = { corporate: Corporate; owners: ClientContact[]; watchers: ClientContact[]; lastDiscussed: Interaction[] };

type Row = Corporate & { owners: number; watchers: number; reach: number };

type ContactRow = ClientContact & { holds: number; watches: number };

type Discussed = { id: string | null; ticker: string | null; name: string | null };

const RING_TRACK = { '--border': 'color-mix(in oklab, var(--color-ink) 10%, transparent)' } as CSSProperties;
const LATEST_LIMIT = 12;

/** Mirrors Interaction::corporatesDiscussed on the API: the stock fields of a captured form. */
function discussed(i: Interaction): Discussed[] {
  const out: Discussed[] = [];
  for (const f of i.form ?? []) {
    const isCorporate = f.options?.value === 'Corporate' || /^stock[1-5]$/.test(f.internalName ?? '');
    if (!isCorporate) continue;
    const v = f.value;
    const list = v === null || v === '' ? [] : Array.isArray(v) ? v : [v];
    for (const x of list) {
      if (typeof x === 'string') { if (x.trim()) out.push({ id: null, ticker: x.trim(), name: null }); }
      else { const s = x as LookupSnapshot; out.push({ id: String(s.id), ticker: s.ticker ?? null, name: s.name ?? null }); }
    }
  }
  return out;
}

export default function TickerSearchModule() {
  const [params, setParams] = useSearchParams();
  const { corporates, clientContacts, status } = useCrms();
  const reduce = useReducedMotion();
  const corporateId = params.get('corporateId');

  /* ── Holder lookup for the picked corporate ─────────────── */
  const [data, setData] = useState<Holders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!corporateId) { setData(null); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetch<Holders>(`/crms/corporates/${corporateId}/holders`, { audience: 'cms' })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(errorText(e, 'The lookup failed.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [corporateId]);

  /* ── Latest interactions ────────────────────────────────── */
  const [latest, setLatest] = useState<Interaction[] | null>(null);
  const [latestError, setLatestError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    apiFetch<Paged<Interaction>>(`/crms/interactions?perPage=${LATEST_LIMIT}`, { audience: 'cms' })
      .then((d) => { if (alive) setLatest(d.items); })
      .catch((e) => { if (alive) setLatestError(errorText(e, 'The latest interactions could not be loaded.')); });
    return () => { alive = false; };
  }, []);

  /* ── Register tallies from the contact master data ──────── */
  const rows = useMemo<Row[]>(() => {
    const owners = new Map<string, Set<string>>();
    const watchers = new Map<string, Set<string>>();
    const add = (m: Map<string, Set<string>>, k: string, v: string) => { const s = m.get(k) ?? new Set<string>(); s.add(v); m.set(k, s); };
    for (const c of clientContacts) {
      for (const o of c.own) add(owners, String(o.id), c.id);
      for (const w of c.watchlist) add(watchers, String(w.id), c.id);
    }
    return corporates.map((c) => {
      const o = owners.get(c.id) ?? new Set<string>();
      const w = watchers.get(c.id) ?? new Set<string>();
      let overlap = 0;
      for (const id of o) if (w.has(id)) overlap++;
      return { ...c, owners: o.size, watchers: w.size, reach: o.size + w.size - overlap };
    });
  }, [corporates, clientContacts]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const byTicker = useMemo(() => new Map(rows.filter((r) => r.ticker).map((r) => [r.ticker!.toLowerCase(), r])), [rows]);

  const totals = useMemo(() => {
    const ticked = rows.filter((r) => !!r.ticker?.trim());
    const held = rows.filter((r) => r.owners > 0).length;
    const watchedOnly = rows.filter((r) => r.owners === 0 && r.watchers > 0).length;
    const quiet = rows.filter((r) => r.reach === 0 && !!r.ticker?.trim()).length;
    const unticked = rows.length - ticked.length;
    const positions = clientContacts.reduce((n, c) => n + c.own.length, 0);
    const watching = clientContacts.reduce((n, c) => n + c.watchlist.length, 0);
    const investors = clientContacts.filter((c) => c.own.length > 0 || c.watchlist.length > 0).length;
    return { all: rows.length, held, watchedOnly, quiet, unticked, positions, watching, investors };
  }, [rows, clientContacts]);

  const [hovered, setHovered] = useState<number | null>(null);
  const rings = useMemo<RingData[]>(() => [
    { label: 'Held', value: totals.held, maxValue: Math.max(1, totals.all), color: 'var(--color-navy)' },
    { label: 'Watched only', value: totals.watchedOnly, maxValue: Math.max(1, totals.all), color: 'var(--color-amber)' },
    { label: 'Not yet named', value: totals.quiet, maxValue: Math.max(1, totals.all), color: 'var(--color-bronze)' },
    { label: 'No ticker', value: totals.unticked, maxValue: Math.max(1, totals.all), color: 'var(--color-silver)' },
  ], [totals]);

  const topHeld = useMemo(() => rows.filter((r) => r.reach > 0).sort((a, b) => b.owners - a.owners || b.watchers - a.watchers || a.name.localeCompare(b.name)).slice(0, 10), [rows]);
  const maxTop = Math.max(1, ...topHeld.map((r) => r.owners + r.watchers));

  const sectors = useMemo(() => {
    const m = new Map<string, { corporates: number; positions: number }>();
    for (const r of rows) {
      const k = r.sectorGeneric?.trim() || 'Sector not set';
      const e = m.get(k) ?? { corporates: 0, positions: 0 };
      e.corporates++; e.positions += r.owners + r.watchers;
      m.set(k, e);
    }
    return Array.from(m.entries()).map(([sector, v]) => ({ sector, ...v })).sort((a, b) => b.positions - a.positions || b.corporates - a.corporates).slice(0, 8);
  }, [rows]);
  const maxSector = Math.max(1, ...sectors.map((s) => s.positions));

  /* Stocks named in the latest interactions, tallied. */
  const namedLately = useMemo(() => {
    const m = new Map<string, { row: Row | null; label: string; n: number }>();
    for (const i of latest ?? []) {
      const seen = new Set<string>();
      for (const d of discussed(i)) {
        const row = (d.id && byId.get(d.id)) || (d.ticker && byTicker.get(d.ticker.toLowerCase())) || null;
        const key = row ? row.id : `#${(d.ticker ?? d.name ?? '').toLowerCase()}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const e = m.get(key) ?? { row, label: row?.ticker ?? row?.name ?? d.ticker ?? d.name ?? '?', n: 0 };
        e.n++; m.set(key, e);
      }
    }
    return Array.from(m.values()).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 8);
  }, [latest, byId, byTicker]);

  /* ── Client contacts with positions ──────────────────────── */
  const [contactQ, setContactQ] = useState('');
  const [contactTab, setContactTab] = useState<'all' | 'holds' | 'watches' | 'portal'>('all');
  const contactRows = useMemo<ContactRow[]>(() => clientContacts
    .map((c) => ({ ...c, holds: c.own.length, watches: c.watchlist.length }))
    .filter((c) => c.holds > 0 || c.watches > 0)
    .sort((a, b) => b.holds - a.holds || b.watches - a.watches || a.name.localeCompare(b.name)), [clientContacts]);
  const contactsShown = useMemo(() => {
    const s = contactQ.trim().toLowerCase();
    return contactRows.filter((c) => {
      if (contactTab === 'holds' && c.holds === 0) return false;
      if (contactTab === 'watches' && c.watches === 0) return false;
      if (contactTab === 'portal' && !c.portalUserId) return false;
      if (!s) return true;
      return [c.name, c.clientName, c.position, c.email, ...c.own.map((o) => o.ticker ?? o.name), ...c.watchlist.map((o) => o.ticker ?? o.name)].some((v) => v?.toLowerCase().includes(s));
    });
  }, [contactRows, contactQ, contactTab]);
  const [contactLimit, setContactLimit] = useState(12);
  useEffect(() => { setContactLimit(12); }, [contactQ, contactTab]);

  /* ── Corporates without a ticker ─────────────────────────── */
  const unticked = useMemo(() => rows.filter((r) => !r.ticker?.trim()).sort((a, b) => b.reach - a.reach || a.name.localeCompare(b.name)), [rows]);

  const pick = (id: string | null) => setParams(id ? { corporateId: id } : {});
  const picked = corporateId ? byId.get(corporateId) : undefined;
  const loaded = status !== 'loading';

  return (
    <div className="space-y-14">
      <ModuleHeader
        code="10 · Ticker search"
        title="Who owns, who watches"
        blurb="How the register is covered, the stocks clients hold and watch most, the contacts with positions, the latest interactions and what they named, and the corporates still missing a ticker. Pick any stock for its call list."
      />

      <CorporateSearch rows={rows} loaded={loaded} selectedId={corporateId} onPick={pick} />

      {/* ── Holder lookup (drill-in) ──────────────────────────── */}
      <AnimatePresence initial={false}>
        {corporateId && (
          <motion.section key={corporateId} initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }} className="border rule bg-bone/40 p-6 md:p-8">
            {error ? (
              <p className="border-l-2 pl-3 text-[12.5px]" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>{error}</p>
            ) : loading || !data || data.corporate.id !== corporateId ? (
              <div className="space-y-4">
                <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{picked?.ticker ?? '—'} · looking up holders…</div>
                <SkeletonRows rows={4} />
              </div>
            ) : (
              <HolderPanel data={data} onClose={() => pick(null)} />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Analytics ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-8 border-b rule pb-10 md:grid-cols-3 xl:grid-cols-6">
        <Stat value={loaded ? totals.all.toLocaleString('en-PH') : '—'} label="Corporates" />
        <Stat value={loaded ? String(totals.held) : '—'} label="Held by a client" />
        <Stat value={loaded ? String(totals.investors) : '—'} label="Contacts with positions" />
        <Stat value={loaded ? totals.positions.toLocaleString('en-PH') : '—'} label="Holdings recorded" />
        <Stat value={loaded ? totals.watching.toLocaleString('en-PH') : '—'} label="Watchlist entries" />
        <a href="#no-ticker" className="group">
          <Stat value={loaded ? String(totals.unticked) : '—'} label="Missing a ticker" />
          <span className="mono mt-1 block text-[9.5px] uppercase tracking-[0.16em] text-[color:var(--color-amber-deep)] opacity-0 transition-opacity group-hover:opacity-100">Jump to list →</span>
        </a>
      </section>

      <div className="grid gap-12 lg:grid-cols-12">
        {/* Coverage rings */}
        <section className="lg:col-span-5">
          <header className="mb-6">
            <div className="eyebrow mb-2">Register coverage</div>
            <p className="text-[13px] text-graphite">Each ring is a share of the whole register.</p>
          </header>
          {!loaded ? <SkeletonRows rows={4} /> : (
            <div className="grid items-center gap-8 sm:grid-cols-[240px_minmax(0,1fr)]">
              <div className="justify-self-center" style={RING_TRACK}>
                <RingChart data={rings} size={240} strokeWidth={13} ringGap={5} hoveredIndex={hovered} onHoverChange={setHovered} enterStaggerScale={reduce ? 0 : 1}>
                  {rings.map((r, i) => <Ring key={r.label} index={i} lineCap="butt" showGlow={false} animate={!reduce} />)}
                  <RingCenter
                    defaultLabel="corporates"
                    valueClassName="mono num font-medium leading-none tracking-[-0.02em] text-ink text-[clamp(0.85rem,20cqw,1.6rem)]"
                    labelClassName="mono mt-1.5 uppercase tracking-[0.16em] text-graphite text-[clamp(0.55rem,7cqw,0.625rem)]"
                  />
                </RingChart>
              </div>
              <ul className="border-y rule" onMouseLeave={() => setHovered(null)}>
                {rings.map((r, i) => {
                  const pct = totals.all ? Math.round((r.value / totals.all) * 100) : 0;
                  const dim = hovered !== null && hovered !== i;
                  return (
                    <li key={r.label} onMouseEnter={() => setHovered(i)} className={`flex items-center gap-3 border-b rule py-3 transition-opacity last:border-b-0 ${dim ? 'opacity-40' : ''}`}>
                      <span aria-hidden className="block h-[9px] w-[5px]" style={{ background: r.color }} />
                      <span className="flex-1 text-[13px] text-ink">{r.label}</span>
                      <span className="mono num text-[11.5px] text-slate">{r.value}</span>
                      <span className="mono num w-10 text-right text-[10.5px] text-silver">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Most held */}
        <section className="lg:col-span-7">
          <header className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-2">Most held</div>
              <p className="text-[13px] text-graphite">Corporates ranked by contacts who hold them, watchers stacked after.</p>
            </div>
            <span className="mono flex items-center gap-4 text-[9.5px] uppercase tracking-[0.16em] text-silver">
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[7px] w-[5px]" style={{ background: 'var(--color-navy)' }} /> holds</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[7px] w-[5px]" style={{ background: 'var(--color-amber)' }} /> watches</span>
            </span>
          </header>
          {!loaded ? <SkeletonRows rows={5} /> : topHeld.length === 0 ? (
            <p className="border rule border-dashed px-6 py-8 text-[13px] text-graphite">No client contact holds or watches a corporate yet.</p>
          ) : (
            <ul className="divide-y divide-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] rule border-y rule">
              {topHeld.map((r, i) => (
                <li key={r.id}>
                  <button type="button" onClick={() => pick(r.id)} className={`grid w-full grid-cols-12 items-center gap-3 py-2.5 text-left transition-colors hover:bg-bone/60 ${r.id === corporateId ? 'bg-bone' : ''}`}>
                    <span className="mono num col-span-1 text-[10.5px] text-silver">{String(i + 1).padStart(2, '0')}</span>
                    <span className="mono num col-span-2 truncate text-[11px] tracking-[0.06em] text-graphite">{r.ticker ?? '—'}</span>
                    <span className="col-span-4 text-[13.5px] leading-snug text-ink" title={r.name}>{r.name}</span>
                    <span className="col-span-3 flex h-1.5 bg-bone">
                      <motion.span initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.round((r.owners / maxTop) * 100)}%` }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.04 }} className="block h-full" style={{ background: 'var(--color-navy)' }} />
                      <motion.span initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.round((r.watchers / maxTop) * 100)}%` }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.04 + 0.1 }} className="block h-full" style={{ background: 'var(--color-amber)' }} />
                    </span>
                    <span className="mono num col-span-2 text-right text-[11.5px] text-slate"><span className="text-ink">{r.owners}</span> / {r.watchers}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-12 lg:grid-cols-12">
        {/* By sector */}
        <section className="lg:col-span-5">
          <header className="mb-6">
            <div className="eyebrow mb-2">By sector</div>
            <p className="text-[13px] text-graphite">Positions and watchlist entries by generic sector.</p>
          </header>
          {!loaded ? <SkeletonRows rows={4} /> : (
            <ul className="divide-y divide-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] rule border-y rule">
              {sectors.map((s, i) => (
                <li key={s.sector} className="grid grid-cols-12 items-center gap-3 py-2.5">
                  <span className="col-span-5 truncate text-[13px] text-ink">{s.sector}</span>
                  <span className="col-span-4 h-1.5 bg-bone">
                    <motion.span initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.round((s.positions / maxSector) * 100)}%` }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.04 }} className="block h-full" style={{ background: 'var(--color-bronze)' }} />
                  </span>
                  <span className="mono num col-span-3 text-right text-[11px] text-slate">{s.positions} · {s.corporates} co</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Named lately */}
        <section className="lg:col-span-7">
          <header className="mb-6">
            <div className="eyebrow mb-2">Named lately</div>
            <p className="text-[13px] text-graphite">Stocks captured on the {LATEST_LIMIT} most recent interaction forms.</p>
          </header>
          {!latest ? <SkeletonRows rows={3} /> : namedLately.length === 0 ? (
            <p className="border rule border-dashed px-6 py-8 text-[13px] text-graphite">None of the latest forms named a stock.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {namedLately.map((s) => (
                <button key={s.label} type="button" disabled={!s.row} onClick={() => s.row && pick(s.row.id)} className={`inline-flex items-center gap-2 border px-3 py-2 text-left transition-colors ${s.row ? 'rule hover:border-[color:var(--color-amber-deep)]' : 'rule border-dashed cursor-default'} ${s.row?.id === corporateId ? 'border-[color:var(--color-amber-deep)] bg-bone' : ''}`}>
                  <span className="mono text-[11px] tracking-[0.06em] text-ink">{s.label}</span>
                  <span aria-hidden className="flex items-center gap-[2px]">{Array.from({ length: Math.min(s.n, 8) }).map((_, k) => <i key={k} className="block h-[8px] w-[4px]" style={{ background: 'var(--color-amber)' }} />)}</span>
                  <span className="mono num text-[10px] text-graphite">{s.n}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Client contacts ───────────────────────────────────── */}
      <section className="space-y-5">
        <SectionRule code="Contacts" title="Client contacts with positions" actions={
          <label className="flex items-center gap-2 border rule bg-white px-3">
            <IconSearch size={13} className="text-silver" />
            <input value={contactQ} onChange={(e) => setContactQ(e.target.value)} placeholder="Name, client, or ticker" aria-label="Search contacts" className="w-[180px] bg-transparent py-2 text-[13px] outline-none placeholder:text-silver md:w-[220px]" />
            {contactQ && <button type="button" aria-label="Clear search" onClick={() => setContactQ('')} className="text-graphite hover:text-ink"><IconX size={12} /></button>}
          </label>
        } />
        <Tabs label="Contacts" value={contactTab} onChange={(v) => setContactTab(v as typeof contactTab)} tabs={[
          { id: 'all', label: 'All', count: contactRows.length },
          { id: 'holds', label: 'Holds', count: contactRows.filter((c) => c.holds > 0).length },
          { id: 'watches', label: 'Watches', count: contactRows.filter((c) => c.watches > 0).length },
          { id: 'portal', label: 'On portal', count: contactRows.filter((c) => c.portalUserId).length },
        ]} />
        {!loaded ? <SkeletonRows rows={6} /> : contactsShown.length === 0 ? (
          <EmptyState title={contactQ ? `No contact matches “${contactQ}”.` : 'No contact has holdings or a watchlist yet.'} hint={contactQ ? 'Try a ticker, a client name, or a surname.' : 'Record holdings on a client contact and they appear here.'} />
        ) : (
          <>
            <ul className="divide-y divide-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] rule border-y rule">
              {contactsShown.slice(0, contactLimit).map((c) => (
                <li key={c.id} className="grid grid-cols-12 items-start gap-x-4 gap-y-2 py-3.5">
                  <div className="col-span-12 min-w-0 md:col-span-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/crms/client-contacts/${c.id}`} className="truncate text-[13.5px] text-ink hover:text-[color:var(--color-amber-deep)]">{c.name}</Link>
                      {c.portalUserId && <Chip tone="live">Portal</Chip>}
                    </div>
                    <p className="truncate text-[12px] text-graphite">{c.clientName ?? 'No client'}{c.position ? ` · ${c.position}` : ''}</p>
                  </div>
                  <div className="col-span-12 md:col-span-7">
                    <TickerChips code="Holds" items={c.own} tone="navy" activeId={corporateId} onPick={pick} />
                    <TickerChips code="Watches" items={c.watchlist} tone="amber" activeId={corporateId} onPick={pick} />
                  </div>
                  <span className="mono num col-span-12 text-left text-[11px] text-slate md:col-span-1 md:text-right"><span className="text-ink">{c.holds}</span> / {c.watches}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-4">
              <span className="mono num text-[10.5px] uppercase tracking-[0.16em] text-graphite">{Math.min(contactLimit, contactsShown.length)} of {contactsShown.length} contacts</span>
              <div className="flex gap-2">
                {contactLimit < contactsShown.length && <button type="button" onClick={() => setContactLimit((n) => n + 24)} className="mono border rule px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink">Show more</button>}
                <Link to="/crms/client-contacts" className="mono inline-flex items-center gap-1 border rule px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink">All contacts <IconArrowRight size={10} /></Link>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Latest interactions ───────────────────────────────── */}
      <section className="space-y-5">
        <SectionRule code="Latest" title="Latest interactions" actions={<Link to="/crms/interactions" className="mono inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-graphite hover:text-ink">All interactions <IconArrowRight size={10} /></Link>} />
        {latestError ? (
          <p className="border-l-2 pl-3 text-[12.5px]" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>{latestError}</p>
        ) : !latest ? <SkeletonRows rows={6} /> : latest.length === 0 ? (
          <EmptyState title="No interactions logged yet." hint="Log the first one and the stocks it names show up here." />
        ) : (
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] rule border-y rule">
            {latest.map((i, idx) => {
              const stocks = discussed(i);
              return (
                <motion.li key={i.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: idx * 0.03 }} className="grid grid-cols-12 items-start gap-x-4 gap-y-2 py-3.5">
                  <div className="col-span-6 md:col-span-2">
                    <Link to={`/crms/interactions/${i.id}`} className="mono num block text-[11px] tracking-[0.06em] text-graphite hover:text-ink">{i.reference}</Link>
                    <span className="mono block text-[10.5px] text-silver" title={fmtDay(i.date)}>{timeAgo(i.date)}</span>
                  </div>
                  <div className="col-span-6 min-w-0 md:col-span-3">
                    <span className="block truncate text-[13.5px] text-ink">{i.clientName ?? 'Unknown client'}</span>
                    <span className="mono block truncate text-[10px] uppercase tracking-[0.14em] text-graphite">{i.typeName ?? 'No type'}{i.meetingType ? ` · ${i.meetingType}` : ''}</span>
                  </div>
                  <p className="col-span-12 line-clamp-2 text-[12.5px] leading-snug text-slate md:col-span-4">{i.description || <span className="text-silver">No description</span>}</p>
                  <div className="col-span-12 flex flex-wrap gap-1.5 md:col-span-3 md:justify-end">
                    {stocks.length === 0 ? <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-silver">No stock named</span> : stocks.map((d, k) => {
                      const row = (d.id && byId.get(d.id)) || (d.ticker && byTicker.get(d.ticker.toLowerCase())) || null;
                      const label = row?.ticker ?? row?.name ?? d.ticker ?? d.name ?? '?';
                      return row ? (
                        <button key={k} type="button" onClick={() => pick(row.id)} className={`mono border px-2 py-0.5 text-[10px] tracking-[0.06em] transition-colors ${row.id === corporateId ? 'border-[color:var(--color-amber-deep)] text-ink' : 'rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink'}`}>{label}</button>
                      ) : (
                        <span key={k} title="Not on the corporate register" className="mono border rule border-dashed px-2 py-0.5 text-[10px] tracking-[0.06em] text-graphite">{label}</span>
                      );
                    })}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Corporates without a ticker ───────────────────────── */}
      <section id="no-ticker" className="space-y-5 scroll-mt-6">
        <SectionRule code="Unticked" title="Corporates without a ticker" actions={<Link to="/crms/corporates" className="mono inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-graphite hover:text-ink"><IconPen size={11} /> Edit on the register</Link>} />
        <p className="max-w-[62ch] text-[13px] leading-relaxed text-graphite">A corporate without a ticker cannot be matched when an interaction form names the stock by symbol, so it drops out of the “named lately” tally and the holder lookup by ticker. Holdings recorded against it by id still count.</p>
        {!loaded ? <SkeletonRows rows={3} /> : unticked.length === 0 ? (
          <div className="flex items-center gap-3 border rule px-6 py-5">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: 'var(--color-signal, var(--color-amber))' }} />
            <p className="text-[13.5px] text-ink">Every corporate on the register has a ticker.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-px border rule bg-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] sm:grid-cols-2 xl:grid-cols-3">
            {unticked.map((r) => (
              <li key={r.id} className="min-w-0 bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] text-ink">{r.name}</p>
                    <p className="mono mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-graphite">{r.sectorGeneric ?? 'Sector not set'}{r.identifiers1 ? ` · ${r.identifiers1}` : ''}</p>
                  </div>
                  <span className="mono shrink-0 border rule border-dashed px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.14em] text-silver">No ticker</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="mono num text-[11px] text-slate"><span className="text-ink">{r.owners}</span> hold · {r.watchers} watch · {r.contactCount} contact{r.contactCount === 1 ? '' : 's'}</span>
                  {r.reach > 0 && <button type="button" onClick={() => pick(r.id)} className="mono text-[10px] uppercase tracking-[0.14em] text-graphite hover:text-ink">Holders →</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ── Corporate search ──────────────────────────────────────────
   A full-width command-style search: results open under the field
   as you type, ranked ticker-first, with the full name wrapped,
   sector, and holder / watcher marks. Arrow keys move, Enter
   opens, Escape closes, "/" focuses from anywhere on the page.
   ───────────────────────────────────────────────────────────── */

type Scope = 'all' | 'held' | 'watched' | 'unticked';
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'held', label: 'Held' },
  { id: 'watched', label: 'Watched' },
  { id: 'unticked', label: 'No ticker' },
];
const RESULT_MAX = 40;

/** Lower is better; null means no match. */
function rank(r: Row, s: string): number | null {
  const t = r.ticker?.toLowerCase() ?? '';
  const n = r.name.toLowerCase();
  if (t && t === s) return 0;
  if (t && t.startsWith(s)) return 1;
  if (n.startsWith(s)) return 2;
  if (n.split(/[\s.,&()-]+/).some((w) => w.startsWith(s))) return 3;
  if (n.includes(s) || t.includes(s)) return 4;
  if ([r.sectorGeneric, r.identifiers1, r.identifiers2].some((v) => v?.toLowerCase().includes(s))) return 5;
  return null;
}

function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const s = query.trim();
  if (!s) return text;
  const at = text.toLowerCase().indexOf(s.toLowerCase());
  if (at < 0) return text;
  return (
    <Fragment>
      {text.slice(0, at)}
      <mark className="bg-transparent text-ink underline decoration-[color:var(--color-amber)] decoration-2 underline-offset-[3px]">{text.slice(at, at + s.length)}</mark>
      {text.slice(at + s.length)}
    </Fragment>
  );
}

function CorporateSearch({ rows, loaded, selectedId, onPick }: { rows: Row[]; loaded: boolean; selectedId: string | null; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [cursor, setCursor] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  /* "/" focuses the search unless the user is already typing somewhere. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);

  const counts = useMemo(() => ({
    all: rows.length,
    held: rows.filter((r) => r.owners > 0).length,
    watched: rows.filter((r) => r.watchers > 0).length,
    unticked: rows.filter((r) => !r.ticker?.trim()).length,
  }), [rows]);

  const { results, total } = useMemo(() => {
    const s = q.trim().toLowerCase();
    const inScope = rows.filter((r) =>
      scope === 'held' ? r.owners > 0 : scope === 'watched' ? r.watchers > 0 : scope === 'unticked' ? !r.ticker?.trim() : true);
    const scored = s
      ? inScope.map((r) => ({ r, k: rank(r, s) })).filter((x): x is { r: Row; k: number } => x.k !== null)
      : inScope.map((r) => ({ r, k: 0 }));
    scored.sort((a, b) => a.k - b.k || b.r.reach - a.r.reach || a.r.name.localeCompare(b.r.name));
    return { results: scored.slice(0, RESULT_MAX).map((x) => x.r), total: scored.length };
  }, [rows, q, scope]);

  useEffect(() => { setCursor(0); listRef.current?.scrollTo({ top: 0 }); }, [q, scope]);

  const maxReach = Math.max(1, ...results.map((r) => r.owners + r.watchers));

  const choose = (r: Row) => { onPick(r.id); setOpen(false); setQ(''); inputRef.current?.blur(); };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const n = e.key === 'ArrowDown' ? Math.min(results.length - 1, cursor + 1) : Math.max(0, cursor - 1);
      setCursor(n);
      (listRef.current?.children[n] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[cursor];
      if (r) choose(r);
    } else if (e.key === 'Escape') {
      if (q) setQ(''); else { setOpen(false); inputRef.current?.blur(); }
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className={`flex items-center gap-3 border bg-white px-4 transition-colors ${open ? 'border-[color:var(--color-amber-deep)]' : 'rule'}`}>
        <IconSearch size={16} className="shrink-0 text-graphite" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open}
          aria-controls="corporate-search-results"
          aria-activedescendant={open && results[cursor] ? `corp-opt-${results[cursor].id}` : undefined}
          aria-label="Search corporates"
          placeholder={loaded ? 'Search by name, ticker or sector' : 'Loading corporates…'}
          className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] text-ink outline-none placeholder:text-silver"
        />
        {q ? (
          <button type="button" aria-label="Clear search" onClick={() => { setQ(''); inputRef.current?.focus(); }} className="shrink-0 text-graphite hover:text-ink"><IconX size={13} /></button>
        ) : (
          <kbd className="mono hidden shrink-0 border rule px-1.5 py-0.5 text-[10px] text-graphite sm:block">/</kbd>
        )}
      </div>

      {/* The current pick, when the panel is closed. */}
      {selected && !open && (
        <div className="mono mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-graphite">
          <span className="text-silver">Viewing</span>
          <span className="text-ink">{selected.ticker ?? 'No ticker'}</span>
          <span className="font-sans normal-case tracking-normal text-[12.5px] text-slate" style={{ fontFamily: 'var(--font-sans)' }}>{selected.name}</span>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inset-x-0 top-[calc(100%+6px)] z-40 border rule bg-paper shadow-[0_32px_70px_-36px_rgba(13,13,13,0.5)]"
          >
            {/* Scope */}
            <div className="flex flex-wrap items-center gap-1.5 border-b rule px-4 py-2.5">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setScope(s.id)}
                  aria-pressed={scope === s.id}
                  className={`mono inline-flex items-center gap-1.5 border px-2.5 py-1 text-[9.5px] uppercase tracking-[0.14em] transition-colors ${scope === s.id ? 'border-[color:var(--color-amber-deep)] bg-bone text-ink' : 'rule text-graphite hover:text-ink'}`}
                >
                  {s.label}<span className="num text-silver">{counts[s.id]}</span>
                </button>
              ))}
              <span className="mono num ml-auto text-[9.5px] uppercase tracking-[0.16em] text-silver">
                {q.trim() ? `${total} match${total === 1 ? '' : 'es'}` : 'By client reach'}
              </span>
            </div>

            {results.length === 0 ? (
              <div className="px-5 py-8">
                <p className="text-[14px] text-ink">No corporate matches “{q}”.</p>
                <p className="mt-1 text-[12.5px] text-graphite">{scope !== 'all' ? 'Try the All scope, or a shorter name.' : 'Try the ticker, or the first word of the name.'}</p>
              </div>
            ) : (
              <ul id="corporate-search-results" ref={listRef} role="listbox" className="max-h-[min(440px,60vh)] overflow-y-auto py-1">
                {results.map((r, i) => {
                  const active = i === cursor;
                  const isPicked = r.id === selectedId;
                  return (
                    <li key={r.id} id={`corp-opt-${r.id}`} role="option" aria-selected={isPicked}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => { if (!active) setCursor(i); }}
                        onClick={() => choose(r)}
                        className={`relative grid w-full grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2.5 text-left transition-colors sm:grid-cols-[88px_minmax(0,1fr)_auto] ${active ? 'bg-bone' : ''}`}
                      >
                        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px]" style={{ background: 'var(--color-amber)', opacity: active ? 1 : 0 }} />
                        {r.ticker?.trim() ? (
                          <span className="mono num truncate text-[12px] tracking-[0.04em] text-ink"><Highlight text={r.ticker} query={q} /></span>
                        ) : (
                          <span className="mono w-fit border rule border-dashed px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-silver">No ticker</span>
                        )}
                        <span className="min-w-0">
                          <span className="block break-words text-[14px] leading-snug text-ink">
                            <Highlight text={r.name} query={q} />
                            {isPicked && <span className="mono ml-2 align-middle text-[9px] uppercase tracking-[0.14em] text-[color:var(--color-amber-deep)]">Viewing</span>}
                          </span>
                          <span className="mono mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em] text-graphite">
                            {r.sectorGeneric ?? 'Sector not set'}{r.identifiers1 ? ` · ${r.identifiers1}` : ''}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span aria-hidden className="hidden h-1.5 w-20 bg-bone sm:flex">
                            <span className="block h-full" style={{ width: `${(r.owners / maxReach) * 100}%`, background: 'var(--color-navy)' }} />
                            <span className="block h-full" style={{ width: `${(r.watchers / maxReach) * 100}%`, background: 'var(--color-amber)' }} />
                          </span>
                          <span className="mono num w-[64px] text-right text-[11px] text-slate">
                            {r.reach === 0 ? <span className="text-silver">—</span> : <><span className="text-ink">{r.owners}</span> / {r.watchers}</>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {total > results.length && (
                  <li className="mono px-4 py-2.5 text-[9.5px] uppercase tracking-[0.16em] text-silver">
                    {total - results.length} more — keep typing to narrow
                  </li>
                )}
              </ul>
            )}

            <div className="mono flex flex-wrap items-center gap-x-4 gap-y-1 border-t rule px-4 py-2 text-[9.5px] uppercase tracking-[0.14em] text-silver">
              <span><kbd className="text-graphite">↑ ↓</kbd> move</span>
              <span><kbd className="text-graphite">Enter</kbd> open</span>
              <span><kbd className="text-graphite">Esc</kbd> close</span>
              <span className="ml-auto inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[7px] w-[5px]" style={{ background: 'var(--color-navy)' }} /> holds</span>
                <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[7px] w-[5px]" style={{ background: 'var(--color-amber)' }} /> watches</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Ticker chips on a contact row ──────────────────────────── */

function TickerChips({ code, items, tone, activeId, onPick }: { code: string; items: CorporateSnapshot[]; tone: 'navy' | 'amber'; activeId: string | null; onPick: (id: string) => void }) {
  if (items.length === 0) return null;
  const color = tone === 'navy' ? 'var(--color-navy)' : 'var(--color-amber)';
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      <span className="mono mr-1 w-[52px] text-[9.5px] uppercase tracking-[0.16em] text-silver">{code}</span>
      {items.map((o) => {
        const id = String(o.id);
        const active = id === activeId;
        return (
          <button key={id} type="button" onClick={() => onPick(id)} title={o.name} className={`mono inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] tracking-[0.06em] transition-colors ${active ? 'border-[color:var(--color-amber-deep)] text-ink' : 'rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink'}`}>
            <i aria-hidden className="block h-[7px] w-[4px]" style={{ background: color }} />
            {o.ticker ?? o.name}
          </button>
        );
      })}
    </div>
  );
}

/* ── Holder panel: the pick, its contacts, and what discussed it ── */

function HolderPanel({ data, onClose }: { data: Holders; onClose: () => void }) {
  const c = data.corporate;
  const overlap = useMemo(() => { const w = new Set(data.watchers.map((x) => x.id)); return data.owners.filter((o) => w.has(o.id)).length; }, [data]);
  const reach = data.owners.length + data.watchers.length - overlap;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{c.ticker ?? 'No ticker'} · {c.sectorGeneric ?? 'Sector not set'}</div>
          <h2 className="mt-2 text-[clamp(1.3rem,2vw,1.7rem)] tracking-[-0.02em] text-ink">{c.name}</h2>
        </div>
        <div className="flex items-end gap-7">
          <Figure value={data.owners.length} label="Holders" />
          <Figure value={data.watchers.length} label="Watching" />
          <Figure value={reach} label="Reach" hint={overlap > 0 ? `${overlap} both` : undefined} />
          <button type="button" onClick={onClose} aria-label="Close lookup" className="mb-1 border rule p-2 text-graphite transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"><IconX size={12} /></button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <ContactList code="Holds" title="Own the stock" items={data.owners} />
        <ContactList code="Watches" title="On the watchlist" items={data.watchers} />
      </div>

      <section className="space-y-3">
        <SectionRule code="Discussed" title="Recent interactions naming this stock" />
        {data.lastDiscussed.length === 0 ? <p className="text-[13px] text-graphite">No interaction form has named it yet.</p> : (
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] rule">
            {data.lastDiscussed.map((i) => (
              <li key={i.id} className="grid grid-cols-12 gap-3 py-2.5 text-[13px]">
                <Link to={`/crms/interactions/${i.id}`} className="mono num col-span-3 text-[11px] tracking-[0.06em] text-graphite hover:text-ink md:col-span-2">{i.reference}</Link>
                <span className="mono col-span-3 text-[11px] text-slate md:col-span-2">{fmtDay(i.date)}</span>
                <span className="col-span-6 truncate text-ink md:col-span-3">{i.clientName}</span>
                <span className="col-span-12 truncate text-graphite md:col-span-5">{i.description}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Figure({ value, label, hint }: { value: number; label: string; hint?: string }) {
  return (
    <span className="relative text-right">
      <span className="mono num block text-[1.6rem] leading-none text-ink">{value}</span>
      <span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">{label}</span>
      {hint && <span className="mono absolute right-0 top-full mt-0.5 whitespace-nowrap text-[9px] uppercase tracking-[0.14em]" style={{ color: 'var(--color-amber-deep)' }}>{hint}</span>}
    </span>
  );
}

function ContactList({ code, title, items }: { code: string; title: string; items: ClientContact[] }) {
  return (
    <section className="space-y-3">
      <SectionRule code={code} title={title} actions={<span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">{items.length}</span>} />
      {items.length === 0 ? <p className="text-[13px] text-graphite">No one recorded.</p> : (
        <ul className="divide-y divide-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] rule">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <Link to={`/crms/client-contacts/${c.id}`} className="block truncate text-[13.5px] text-ink hover:text-[color:var(--color-amber-deep)]">{c.name}</Link>
                <p className="truncate text-[12px] text-graphite">{c.clientName}{c.position ? ` · ${c.position}` : ''}</p>
              </div>
              {c.portalUserId && <Chip tone="live">Portal</Chip>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
