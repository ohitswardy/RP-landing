import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import { BtnGhost, BtnPrimary, Chip, EmptyState, ModuleHeader, RowAction, SkeletonRows, Stat, useConfirm, EASE } from '../ui';
import { IconCheck, IconCopy, IconDownload, IconEye, IconMail, IconPen, IconPlus, IconSearch, IconTrash } from '../icons';
import {
  NEWSLETTER_CADENCES, fmtDate, timeAgo,
  type NewsletterCadence, type NewsletterIssue, type NewsletterIssueSummary, type Subscriber,
} from '../data';
import IssueComposer from './newsletter/IssueComposer';
import IssueViewer from './newsletter/IssueViewer';
import BlastPanel from './newsletter/BlastPanel';

type Tab = NewsletterCadence | 'recipients';

/** What the desk does with an issue once its body has loaded. */
type OpenAs = 'view' | 'edit' | 'duplicate' | 'blast';

/** Rows rendered before the list asks for more — the daily archive
    alone runs to well over a thousand issues. */
const PAGE = 60;

export default function NewsletterModule() {
  const { newsletters, subscribers, status, deleteNewsletter, fetchNewsletter } = useCms();
  const [tab, setTab] = useState<Tab>('daily');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState<string>('all');
  const [shown, setShown] = useState(PAGE);
  const [composer, setComposer] = useState<{ editingId: string | null; base: NewsletterIssue | null } | null>(null);
  const [viewing, setViewing] = useState<NewsletterIssue | null>(null);
  const [blasting, setBlasting] = useState<NewsletterIssue | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();

  const loading = status === 'loading';

  const counts = useMemo(() => {
    const m = new Map<NewsletterCadence, number>();
    for (const n of newsletters) m.set(n.cadence, (m.get(n.cadence) ?? 0) + 1);
    return m;
  }, [newsletters]);

  /** Years this cadence has issues in, newest first. */
  const years = useMemo(() => {
    if (tab === 'recipients') return [];
    const set = new Set<string>();
    for (const n of newsletters) if (n.cadence === tab) set.add(n.date.slice(0, 4));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [newsletters, tab]);

  const rows = useMemo(() => {
    if (tab === 'recipients') return [];
    const q = query.trim().toLowerCase();
    return newsletters
      .filter((n) => n.cadence === tab)
      .filter((n) => year === 'all' || n.date.startsWith(year))
      .filter((n) => !q || n.subject.toLowerCase().includes(q) || n.date.includes(q));
  }, [newsletters, tab, year, query]);

  // A new filter starts the page count over.
  useEffect(() => { setShown(PAGE); }, [tab, year, query]);

  function switchTab(next: Tab) {
    setTab(next);
    setQuery('');
    setYear('all');
    setOpenError(null);
  }

  /** Fetch the body, then hand the full issue to the viewer, composer, or blast panel. */
  async function open(n: NewsletterIssueSummary, as: OpenAs) {
    setOpening(n.id);
    setOpenError(null);
    try {
      const full = await fetchNewsletter(n.id);
      if (as === 'view') setViewing(full);
      else if (as === 'edit') setComposer({ editingId: full.id, base: full });
      else if (as === 'duplicate') setComposer({ editingId: null, base: full });
      else setBlasting(full);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : 'Could not load the issue.');
    } finally {
      setOpening(null);
    }
  }

  const cadenceLabel = tab === 'recipients' ? '' : NEWSLETTER_CADENCES.find((c) => c.value === tab)!.label.toLowerCase();
  const visible = rows.slice(0, shown);

  /* Composing replaces the list entirely — the editor needs the room. */
  if (composer && tab !== 'recipients') {
    return (
      <IssueComposer
        cadence={tab}
        editingId={composer.editingId}
        base={composer.base}
        onClose={() => setComposer(null)}
      />
    );
  }

  return (
    <div className="space-y-9">
      <ModuleHeader
        code="07 / Newsletter"
        title="Newsletter desk"
        blurb="The daily, weekly, and monthly REGIS mailers, back to the first issues filed in 2020. Each issue is composed against the client's exact template and previewed live before it is filed."
        actions={
          tab !== 'recipients' && (
            <BtnPrimary onClick={() => setComposer({ editingId: null, base: null })}>
              <IconPlus size={14} /> New {cadenceLabel} issue
            </BtnPrimary>
          )
        }
      />

      {/* Cadence tabs */}
      <div className="flex items-end gap-7 border-b rule" role="tablist" aria-label="Newsletter cadence">
        {NEWSLETTER_CADENCES.map((c) => (
          <TabBtn key={c.value} active={tab === c.value} label={c.label} count={counts.get(c.value) ?? 0} onClick={() => switchTab(c.value)} />
        ))}
        <span className="ml-auto">
          <TabBtn active={tab === 'recipients'} label="Recipients" count={subscribers.length} onClick={() => switchTab('recipients')} />
        </span>
      </div>

      {tab === 'recipients' ? (
        <RecipientsPanel />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <label className="relative block w-full max-w-[320px]">
              <span className="sr-only">Search issues</span>
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Subject or date…"
                className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
              />
            </label>

            {years.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by year">
                <YearBtn active={year === 'all'} label="All" onClick={() => setYear('all')} />
                {years.map((y) => (
                  <YearBtn key={y} active={year === y} label={y} onClick={() => setYear(y)} />
                ))}
              </div>
            )}
          </div>

          {openError && (
            <p className="mono border-l-2 pl-3 text-[11.5px] text-[color:var(--color-amber-deep)]" style={{ borderColor: 'var(--color-amber)' }}>
              {openError}
            </p>
          )}

          {loading ? (
            <SkeletonRows rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={query ? 'No issues match.' : year !== 'all' ? `No ${cadenceLabel} issues in ${year}.` : `No ${cadenceLabel} issues yet.`}
              hint={query
                ? 'Search covers the subject line and the ISO date.'
                : 'Compose the first one. Duplicating a filed issue is the fastest way to start the next.'}
              action={query
                ? <BtnGhost onClick={() => setQuery('')}>Clear search</BtnGhost>
                : <BtnPrimary onClick={() => setComposer({ editingId: null, base: null })}><IconPlus size={14} /> New {cadenceLabel} issue</BtnPrimary>}
            />
          ) : (
            <div className="border-y rule">
              <div className="mono grid grid-cols-12 gap-4 border-b rule py-2.5 text-[9.5px] uppercase tracking-[0.2em] text-graphite">
                <span className="col-span-3 md:col-span-2">Date</span>
                <span className="col-span-9 md:col-span-6 lg:col-span-5">Subject</span>
                <span className="hidden lg:block lg:col-span-2">Last edited</span>
                <span className="hidden md:block md:col-span-4 lg:col-span-3" />
              </div>
              <ul className="divide-y rule">
                <AnimatePresence initial={false}>
                  {visible.map((n, i) => {
                    const busy = opening === n.id;
                    return (
                      <motion.li
                        key={n.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: busy ? 0.55 : 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(i * 0.03, 0.2) } }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
                        className="group grid grid-cols-12 items-center gap-4 py-4"
                        aria-busy={busy}
                      >
                        <span className="mono num col-span-3 text-[12px] text-graphite md:col-span-2">{fmtDate(n.date)}</span>
                        <div className="col-span-9 min-w-0 md:col-span-6 lg:col-span-5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { void open(n, 'view'); }}
                            className="block max-w-full truncate text-left text-[14.5px] text-ink transition-colors hover:text-[color:var(--color-amber-deep)]"
                          >
                            {n.subject}
                          </button>
                          <p className="mono mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-silver">
                            {n.sectionCount === 1 ? '1 section' : `${n.sectionCount} sections`}
                            {n.badges.slice(0, 3).map((b) => ` · ${b}`).join('')}
                          </p>
                        </div>
                        <span className="mono hidden text-[11.5px] text-graphite lg:block lg:col-span-2">{timeAgo(n.updated)}</span>
                        <div className="col-span-12 flex items-center justify-end gap-1.5 md:col-span-4 lg:col-span-3">
                          <RowAction label="View issue" onClick={() => { void open(n, 'view'); }}><IconEye /></RowAction>
                          <RowAction label="Email blast" onClick={() => { void open(n, 'blast'); }}><IconMail size={14} /></RowAction>
                          <RowAction label="Edit issue" onClick={() => { void open(n, 'edit'); }}><IconPen /></RowAction>
                          <RowAction label="Duplicate into a new issue" onClick={() => { void open(n, 'duplicate'); }}><IconCopy /></RowAction>
                          <RowAction label={armed === n.id ? 'Confirm delete' : 'Delete issue'} danger onClick={() => confirm(n.id, () => { void deleteNewsletter(n.id); })}>
                            {armed === n.id ? <IconCheck /> : <IconTrash />}
                          </RowAction>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              {rows.length > shown && (
                <div className="flex items-center justify-between gap-4 border-t rule py-3.5">
                  <span className="mono num text-[10.5px] uppercase tracking-[0.16em] text-silver">
                    {shown} of {rows.length}
                  </span>
                  <BtnGhost onClick={() => setShown((s) => s + PAGE)}>
                    Show {Math.min(PAGE, rows.length - shown)} more
                  </BtnGhost>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {viewing && (
        <IssueViewer
          issue={viewing}
          onEdit={() => { setComposer({ editingId: viewing.id, base: viewing }); setViewing(null); }}
          onBlast={() => { setBlasting(viewing); setViewing(null); }}
          onClose={() => setViewing(null)}
        />
      )}

      {blasting && <BlastPanel issue={blasting} onClose={() => setBlasting(null)} />}
    </div>
  );
}

function TabBtn({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`mono -mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-[11px] uppercase tracking-[0.16em] transition-colors duration-300 ${
        active ? 'border-navy text-ink' : 'border-transparent text-graphite hover:text-ink'
      }`}
    >
      {label}
      <span className={`num text-[10px] ${active ? 'text-[color:var(--color-amber-deep)]' : 'text-silver'}`}>{count}</span>
    </button>
  );
}

/** One year in the archive filter — a hairline chip, mono like the tabs. */
function YearBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`mono num border px-2.5 py-1 text-[10.5px] tracking-[0.14em] transition-colors duration-300 ${
        active ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/* ── Recipients (the distribution list, unchanged behavior) ──── */

function RecipientsPanel() {
  const { subscribers, removeSubscriber } = useCms();
  const [query, setQuery] = useState('');
  const [armed, confirm] = useConfirm();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subscribers.filter((s) => !q || s.email.toLowerCase().includes(q) || s.firm.toLowerCase().includes(q));
  }, [subscribers, query]);

  const verified = subscribers.filter((s) => s.verified).length;
  const last30 = subscribers.filter((s) => new Date(s.joined) > new Date(Date.now() - 30 * 86400000)).length;

  function remove(s: Subscriber) {
    void removeSubscriber(s.id);
  }

  function exportCsv() {
    const head = 'email,firm,joined,source,verified';
    const body = subscribers.map((s) => [s.email, `"${s.firm}"`, s.joined, s.source, s.verified].join(',')).join('\n');
    const blob = new Blob([`${head}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'regis-newsletter-subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-6 border-b rule pb-7">
        <div className="px-1 md:px-4"><Stat value={String(subscribers.length)} label="Subscribers" /></div>
        <div className="border-l px-4 md:px-8" style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 45%, transparent)' }}>
          <Stat value={String(verified)} label="Verified" />
        </div>
        <div className="border-l px-4 md:px-8" style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 45%, transparent)' }}>
          <Stat value={`+${last30}`} label="Last 30 days" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="relative block w-full max-w-[320px]">
          <span className="sr-only">Search subscribers</span>
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Email or firm…"
            className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
        </label>
        <BtnGhost onClick={exportCsv}><IconDownload size={14} /> Export CSV</BtnGhost>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={query ? 'No subscriber matches.' : 'The list is empty.'}
          hint={query ? 'Search covers the email address and the firm name.' : 'Sign-ups from the site footer and the Insights page land here after double opt-in.'}
          action={query ? <BtnGhost onClick={() => setQuery('')}>Clear search</BtnGhost> : undefined}
        />
      ) : (
        <div className="border-y rule">
          <div className="mono grid grid-cols-12 gap-4 border-b rule py-2.5 text-[9.5px] uppercase tracking-[0.2em] text-graphite">
            <span className="col-span-5 md:col-span-4">Address</span>
            <span className="col-span-3 hidden md:block">Firm</span>
            <span className="col-span-2">Joined</span>
            <span className="col-span-2 hidden md:block">Source</span>
            <span className="col-span-2 md:col-span-1" />
          </div>
          <ul className="divide-y rule">
            <AnimatePresence initial={false}>
              {rows.map((s, i) => (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(i * 0.03, 0.2) } }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
                  className="grid grid-cols-12 items-center gap-4 py-3.5"
                >
                  <div className="col-span-5 min-w-0 md:col-span-4">
                    <p className="mono truncate text-[12.5px] text-ink">{s.email}</p>
                  </div>
                  <span className="col-span-3 hidden truncate text-[13px] text-slate md:block">{s.firm}</span>
                  <span className="mono num col-span-2 text-[12px] text-graphite">{fmtDate(s.joined)}</span>
                  <span className="col-span-2 hidden md:block">
                    <Chip tone={s.verified ? 'live' : 'amber'}>{s.verified ? 'Verified' : 'Pending'}</Chip>
                  </span>
                  <div className="col-span-2 flex justify-end md:col-span-1">
                    <RowAction label={armed === s.id ? 'Confirm remove' : `Remove ${s.email}`} danger onClick={() => confirm(s.id, () => remove(s))}>
                      {armed === s.id ? <IconCheck /> : <IconTrash />}
                    </RowAction>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <p className="max-w-[68ch] text-[12.5px] leading-relaxed text-graphite">
        Removal is immediate and honored permanently. Removed addresses join the suppression list and cannot be re-subscribed without a fresh double opt-in.
      </p>
    </div>
  );
}
