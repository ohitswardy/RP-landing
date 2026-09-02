import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useReports } from './reports';
import {
  REPORT_CATEGORIES, REPORT_COMPANIES, fmtBytes, fmtDate, trendingMetricDef, trendingWindowLabel,
  type Company, type Report, type ReportCategory, type ReportCompany, type TrendingMetric,
} from '../cms/data';
import { usePortal } from './auth';
import { useBookmarks } from './bookmarks';
import { downloadReport } from './download';
import { trackActivity } from './track';
import ReportViewer from './ReportViewer';
import RatingTag from './RatingTag';
import BookmarksModal from './BookmarksModal';
import LineSidebar from '../components/LineSidebar';
import Highlight from '../components/Highlight';
import { SEARCH_EXAMPLES, useReportSearch } from '../lib/reportSearch';
import TextType from '../components/TextType';
import {
  IconSearch, IconDownload, IconEye, IconSignOut, IconBookmark, IconBookmarkFilled,
  IconMenu, IconX, IconArrowRight, IconCalendar,
} from '../cms/icons';

const EASE = [0.25, 1, 0.5, 1] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const companyLabel = (v: ReportCompany) => REPORT_COMPANIES.find((c) => c.value === v)?.label ?? v;

/** Active companies filter: a whole classification, one company, or nothing. */
type CompanySel = { kind: 'type'; type: ReportCompany } | { kind: 'company'; company: Company } | null;

/** Active period filter: a whole year, or one month inside it. Both halves are
    the raw ISO fragments ("2026", "08") so nothing is re-parsed into a Date. */
type DateSel = { year: string; month: string | null } | null;

function greeting(): string {
  const hour = Number(new Date().toLocaleString('en-PH', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string): string {
  const parts = name.split(' ');
  const last = parts[parts.length - 1];
  // Prefer the surname when the leading token is an initial ("K. Villaruel").
  return parts[0].endsWith('.') && parts.length > 1 ? last : parts[0];
}

function ManilaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="mono num text-[11px] tracking-[0.08em] text-graphite">
      {now.toLocaleTimeString('en-PH', { hour12: false, timeZone: 'Asia/Manila' })}
      <span className="ml-1.5 text-silver">PHT</span>
    </span>
  );
}

export default function PortalDashboard() {
  const { reports, companies, trending, status } = useReports();
  const { client, signOut } = usePortal();
  const saved = useBookmarks();
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [view, setView] = useState<'latest' | 'all' | ReportCategory>('latest');
  const [companySel, setCompanySel] = useState<CompanySel>(null);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [dateSel, setDateSel] = useState<DateSel>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [active, setActive] = useState<Report | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  const loading = status === 'loading';

  const greetingLine = `${greeting()}, ${client ? firstName(client.name) : 'there'}.`;

  /** The most-read ladder, resolved against the live catalog. The API ranks
      under whatever rules the desk set in the CMS; a deleted report simply
      drops off its rung. */
  const trendingRows = useMemo(() => {
    const byId = new Map(reports.map((r) => [r.id, r]));
    return trending.entries
      .map((t) => ({ count: t.count, report: byId.get(t.reportId) }))
      .filter((t): t is { count: number; report: Report } => Boolean(t.report));
  }, [reports, trending]);

  /** The one report the desk flagged for the Spotlight card in the CMS. */
  const spotlightReport = useMemo(() => reports.find((r) => r.spotlight) ?? null, [reports]);

  const sorted = useMemo(
    () => reports.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [reports],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports) {
      if (r.category) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    }
    return m;
  }, [reports]);

  const companyGroups = useMemo(() => {
    const g: Record<ReportCompany, Company[]> = { Local: [], Foreign: [] };
    for (const c of companies) g[c.type].push(c);
    return g;
  }, [companies]);

  /** company id → published report count, for the panel rows. */
  const reportsPerCompany = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports) {
      if (r.companyId) m.set(r.companyId, (m.get(r.companyId) ?? 0) + 1);
    }
    return m;
  }, [reports]);

  /** The published years, newest first, each carrying its month tallies. Read
      straight off the ISO string — parsing to a Date would shunt a Jan 1 report
      into the previous year for anyone west of Manila. */
  const dateIndex = useMemo(() => {
    const years = new Map<string, { total: number; months: Map<string, number> }>();
    for (const r of reports) {
      const year = r.date?.slice(0, 4);
      const month = r.date?.slice(5, 7);
      if (!year || year.length !== 4 || !month) continue;
      let entry = years.get(year);
      if (!entry) years.set(year, (entry = { total: 0, months: new Map() }));
      entry.total += 1;
      entry.months.set(month, (entry.months.get(month) ?? 0) + 1);
    }
    return [...years.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, e]) => ({ year, total: e.total, months: e.months }));
  }, [reports]);

  /** month → count for the year on screen; empty until a year is picked. */
  const monthsInYear = useMemo(
    () => dateIndex.find((y) => y.year === dateSel?.year)?.months ?? new Map<string, number>(),
    [dateIndex, dateSel],
  );

  /** One box over every column a report carries — title, description,
      analyst, sector, company, ticker, type, rating and the date. */
  const search = useReportSearch(reports, query);

  const filtered = useMemo(() => {
    const list = sorted
      .filter((r) => view === 'latest' || view === 'all' || r.category === view)
      .filter((r) => {
        if (!companySel) return true;
        if (companySel.kind === 'type') return r.company === companySel.type;
        return r.companyId === companySel.company.id;
      })
      .filter((r) => {
        if (!dateSel) return true;
        if (r.date.slice(0, 4) !== dateSel.year) return false;
        return !dateSel.month || r.date.slice(5, 7) === dateSel.month;
      })
      .filter(search.match);
    // Newest first while browsing; best match first once something is typed.
    return search.rank(list);
  }, [sorted, view, companySel, dateSel, search]);

  const companySelLabel = companySel
    ? companySel.kind === 'type' ? companyLabel(companySel.type) : companySel.company.name
    : null;
  const dateSelLabel = dateSel
    ? dateSel.month ? `${MONTHS[Number(dateSel.month) - 1]} ${dateSel.year}` : dateSel.year
    : null;
  const heading = query.trim() || dateSel
    ? 'Results'
    : companySelLabel ?? (view === 'latest' ? 'Latest reports' : view === 'all' ? 'All reports' : 'Results');
  const showHero = view === 'latest' && query.trim() === '' && companySel === null && dateSel === null;
  const featured = showHero ? filtered[0] : null;
  const grid = showHero ? filtered.slice(1, 7) : filtered;

  return (
    <div className="min-h-[100dvh] bg-bone text-ink">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b rule bg-white">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-5 h-16 md:px-8">
          <Link to="/" className="flex items-center shrink-0">
            <img src="/Banner.png" alt="Regis Partners" style={{ height: '56px', width: 'auto' }} draggable={false} />
          </Link>

          <div className="ml-auto flex items-center gap-5">
            <span className="hidden md:block"><ManilaClock /></span>

            <button
              type="button"
              onClick={() => setBookmarksOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={bookmarksOpen}
              title="Saved reports"
              className={`mono inline-flex h-9 shrink-0 items-center gap-2 border px-2.5 text-[10.5px] uppercase tracking-[0.16em] transition-colors duration-300 active:scale-[0.97] lg:px-3.5 ${
                saved.count
                  ? 'border-[color:var(--color-amber-deep)] text-ink'
                  : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
              }`}
            >
              <span style={saved.count ? { color: 'var(--color-amber-deep)' } : undefined}>
                {saved.count ? <IconBookmarkFilled size={13} /> : <IconBookmark size={13} />}
              </span>
              <span className="hidden lg:inline">Saved</span>
              {/* Re-keyed on the count so a fresh save registers as a small pop */}
              <motion.span
                key={saved.count}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="num"
                style={{ color: saved.count ? 'var(--color-amber-deep)' : 'var(--color-silver)' }}
              >
                {saved.count}
              </motion.span>
            </button>

            <div className="hidden text-right sm:block">
              <div className="text-[13px] leading-tight text-ink">{client?.name}</div>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">{client?.firm}</div>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 shrink-0 place-items-center border rule text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:scale-[0.94]"
            >
              <IconSignOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-10 md:px-8 md:pt-14">
        {/* ── Greeting ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="border-b rule pb-9"
        >
          <div>
            <div className="eyebrow mb-4">
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <h1 className="text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] tracking-[-0.03em]">
              {/* Keyed on the line so it retypes when the client record resolves, not on every render */}
              <TextType
                key={greetingLine}
                as="span"
                text={greetingLine}
                typingSpeed={55}
                initialDelay={220}
                pauseDuration={1500}
                deletingSpeed={30}
                loop={false}
                showCursor
                cursorCharacter="_"
                cursorBlinkDuration={0.5}
                cursorClassName="text-[color:var(--color-amber-deep)]"
                style={{ letterSpacing: 'inherit' }}
              />
            </h1>
          </div>
        </motion.section>

        {/* ── Trending + Spotlight ──────────────────────────── */}
        {(trendingRows.length > 0 || spotlightReport) && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            className={`mt-9 grid grid-cols-1 gap-9 ${
              trendingRows.length > 0 && spotlightReport ? 'xl:grid-cols-[2.05fr_1fr] xl:gap-12' : ''
            }`}
          >
            {trendingRows.length > 0 && (
              <div className="flex min-w-0 flex-col">
                <div className="mb-5 flex items-baseline justify-between gap-4">
                  <h2 className="text-[18px] font-medium tracking-[-0.01em] text-ink">Trending Content</h2>
                  <span className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-graphite">
                    <LiveDot />
                    {trendingMetricDef(trending.metric).heading} · {trendingWindowLabel(trending.windowMonths)}
                  </span>
                </div>
                <div
                  className={`grid flex-1 grid-cols-1 gap-5 ${
                    trendingRows.length >= 3 ? 'sm:grid-cols-3' : trendingRows.length === 2 ? 'sm:grid-cols-2' : ''
                  }`}
                >
                  {trendingRows.map((t, i) => (
                    <TrendingCard
                      key={t.report.id}
                      report={t.report}
                      rank={i + 1}
                      count={t.count}
                      maxCount={trendingRows[0].count}
                      metric={trending.metric}
                      index={i}
                      onView={() => setActive(t.report)}
                    />
                  ))}
                </div>
              </div>
            )}
            {spotlightReport && (
              <div className="flex min-w-0 flex-col">
                <div className="mb-5 flex items-baseline justify-between gap-4">
                  <h2 className="text-[18px] font-medium tracking-[-0.01em] text-ink">Spotlight</h2>
                  <span className="mono text-[10px] uppercase tracking-[0.16em] text-graphite">From the desk</span>
                </div>
                <SpotlightCard report={spotlightReport} onView={() => setActive(spotlightReport)} />
              </div>
            )}
          </motion.section>
        )}

        {/* ── Search ────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
          className="mt-9"
        >
          <div className="flex items-stretch gap-3">
            {/* Companies panel toggle */}
            <button
              type="button"
              onClick={() => { setCompaniesOpen((o) => !o); setDateOpen(false); }}
              aria-expanded={companiesOpen}
              aria-controls="companies-panel"
              aria-label="Browse local and foreign companies"
              title="Browse companies"
              className={`grid w-[54px] shrink-0 place-items-center border transition-colors duration-300 active:scale-[0.96] ${
                companiesOpen || companySel !== null
                  ? 'border-[color:var(--color-amber-deep)] bg-white text-[color:var(--color-amber-deep)]'
                  : 'rule bg-white text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={companiesOpen ? 'close' : 'open'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="grid place-items-center"
                >
                  {companiesOpen ? <IconX size={18} /> : <IconMenu size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>

            {/* Period panel toggle — carries the active period as its label on wider screens */}
            <button
              type="button"
              onClick={() => { setDateOpen((o) => !o); setCompaniesOpen(false); }}
              aria-expanded={dateOpen}
              aria-controls="calendar-panel"
              aria-label="Filter reports by year and month"
              title="Filter by period"
              className={`mono flex shrink-0 items-center justify-center border text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 active:scale-[0.96] ${
                dateSelLabel ? 'w-[54px] sm:w-auto sm:gap-2.5 sm:px-4' : 'w-[54px]'
              } ${
                dateOpen || dateSel !== null
                  ? 'border-[color:var(--color-amber-deep)] bg-white text-[color:var(--color-amber-deep)]'
                  : 'rule bg-white text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={dateOpen ? 'close' : 'open'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="grid place-items-center"
                >
                  {dateOpen ? <IconX size={18} /> : <IconCalendar size={18} />}
                </motion.span>
              </AnimatePresence>
              {dateSelLabel && <span className="num hidden sm:inline">{dateSelLabel}</span>}
            </button>

            <label className="relative block flex-1">
              <span className="sr-only">Search reports</span>
              <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-graphite" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                placeholder="Search title, ticker, company, analyst, sector, type, rating or date…"
                className="w-full border rule bg-white py-4 pl-12 pr-20 text-[15px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="mono absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
                >
                  Clear
                </button>
              )}
            </label>
          </div>

          {/* What the box understands — shown while it is empty and focused */}
          <AnimatePresence initial={false}>
            {searchFocus && !query && (
              <motion.div
                key="search-hint"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-2 pt-3">
                  <span className="mono text-[10px] uppercase tracking-[0.2em] text-silver">Try</span>
                  {SEARCH_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setQuery(example)}
                      className="mono border rule bg-white px-2.5 py-1 text-[10px] tracking-[0.08em] text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
                    >
                      {example}
                    </button>
                  ))}
                  <span className="text-[12.5px] leading-relaxed text-graphite">
                    Words in any order, quotes for a phrase, minus to exclude.
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Companies panel — local vs foreign coverage */}
          <AnimatePresence initial={false}>
            {companiesOpen && (
              <motion.div
                id="companies-panel"
                key="companies-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-1 divide-y rule border rule bg-white md:grid-cols-2 md:divide-x md:divide-y-0">
                  {REPORT_COMPANIES.map((g, gi) => {
                    const group = companyGroups[g.value];
                    const typeActive = companySel?.kind === 'type' && companySel.type === g.value;
                    return (
                      <motion.div
                        key={g.value}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: EASE, delay: 0.1 + gi * 0.08 }}
                        className="flex min-w-0 flex-col p-6"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3 border-b rule pb-4">
                          <span className="mono flex items-center gap-2.5 text-[10.5px] uppercase tracking-[0.2em] text-graphite">
                            <span aria-hidden className="block h-[2px] w-5" style={{ background: typeActive ? 'var(--color-amber)' : 'var(--color-silver)' }} />
                            {g.label}
                            <span className="num text-silver">{group.length}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => { setCompanySel(typeActive ? null : { kind: 'type', type: g.value }); setCompaniesOpen(false); }}
                            className={`mono border px-3 py-1.5 text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
                              typeActive
                                ? 'border-navy bg-navy text-paper'
                                : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
                            }`}
                          >
                            {typeActive ? 'Showing · Clear' : 'Show all'}
                          </button>
                        </div>
                        {group.length === 0 ? (
                          <p className="text-[13px] leading-relaxed text-graphite">No {g.label.toLowerCase()} covered yet.</p>
                        ) : (
                          <ul className="max-h-[280px] divide-y rule overflow-y-auto">
                            {group.map((c) => {
                              const active = companySel?.kind === 'company' && companySel.company.id === c.id;
                              const count = reportsPerCompany.get(c.id) ?? 0;
                              return (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    onClick={() => { setCompanySel(active ? null : { kind: 'company', company: c }); setCompaniesOpen(false); }}
                                    className="group/item flex w-full items-baseline justify-between gap-4 py-3 text-left transition-colors duration-200"
                                  >
                                    <span className="flex min-w-0 items-baseline gap-2.5">
                                      <span
                                        className="mono shrink-0 text-[10.5px] uppercase tracking-[0.1em]"
                                        style={{ color: active ? 'var(--color-amber-deep)' : c.symbol ? 'var(--color-slate)' : 'var(--color-silver)' }}
                                      >
                                        {c.symbol ?? '—'}
                                      </span>
                                      <span
                                        className={`block truncate text-[13.5px] leading-snug transition-colors group-hover/item:text-[color:var(--color-amber-deep)] ${active ? '' : 'text-ink'}`}
                                        style={active ? { color: 'var(--color-amber-deep)' } : undefined}
                                      >
                                        {c.name}
                                      </span>
                                    </span>
                                    <span className="mono num shrink-0 text-[10.5px] text-silver">
                                      {count} {count === 1 ? 'report' : 'reports'}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Calendar panel — pick a year, then optionally a month inside it */}
          <AnimatePresence initial={false}>
            {dateOpen && (
              <motion.div
                id="calendar-panel"
                key="calendar-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-1 divide-y rule border rule bg-white md:grid-cols-[0.8fr_1.6fr] md:divide-x md:divide-y-0">
                  {/* Years */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
                    className="flex min-w-0 flex-col p-6"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3 border-b rule pb-4">
                      <span className="mono flex items-center gap-2.5 text-[10.5px] uppercase tracking-[0.2em] text-graphite">
                        <span aria-hidden className="block h-[2px] w-5" style={{ background: dateSel ? 'var(--color-amber)' : 'var(--color-silver)' }} />
                        Year
                        <span className="num text-silver">{dateIndex.length}</span>
                      </span>
                      {dateSel && (
                        <button
                          type="button"
                          onClick={() => setDateSel(null)}
                          className="mono border rule px-3 py-1.5 text-[9.5px] uppercase tracking-[0.14em] text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:translate-y-px"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {dateIndex.length === 0 ? (
                      <p className="text-[13px] leading-relaxed text-graphite">No dated reports yet.</p>
                    ) : (
                      <ul className="max-h-[280px] divide-y rule overflow-y-auto">
                        {dateIndex.map((y) => {
                          const active = dateSel?.year === y.year;
                          return (
                            <li key={y.year}>
                              <button
                                type="button"
                                onClick={() => setDateSel(active ? null : { year: y.year, month: null })}
                                className="group/item flex w-full items-baseline justify-between gap-4 py-3 text-left transition-colors duration-200"
                              >
                                <span
                                  className={`mono num block text-[14px] leading-snug transition-colors group-hover/item:text-[color:var(--color-amber-deep)] ${active ? '' : 'text-ink'}`}
                                  style={active ? { color: 'var(--color-amber-deep)' } : undefined}
                                >
                                  {y.year}
                                </span>
                                <span className="mono num shrink-0 text-[10.5px] text-silver">
                                  {y.total} {y.total === 1 ? 'report' : 'reports'}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </motion.div>

                  {/* Months of the selected year */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.18 }}
                    className="flex min-w-0 flex-col p-6"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3 border-b rule pb-4">
                      <span className="mono flex items-center gap-2.5 text-[10.5px] uppercase tracking-[0.2em] text-graphite">
                        <span aria-hidden className="block h-[2px] w-5" style={{ background: dateSel?.month ? 'var(--color-amber)' : 'var(--color-silver)' }} />
                        Month
                        {dateSel && <span className="num text-silver">{dateSel.year}</span>}
                      </span>
                      {dateSel?.month && (
                        <button
                          type="button"
                          onClick={() => setDateSel({ year: dateSel.year, month: null })}
                          className="mono border rule px-3 py-1.5 text-[9.5px] uppercase tracking-[0.14em] text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:translate-y-px"
                        >
                          Whole year
                        </button>
                      )}
                    </div>
                    {!dateSel ? (
                      <p className="text-[13px] leading-relaxed text-graphite">Pick a year to narrow down to a month.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                        {MONTHS.map((label, i) => {
                          const key = String(i + 1).padStart(2, '0');
                          const count = monthsInYear.get(key) ?? 0;
                          const active = dateSel.month === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={count === 0}
                              onClick={() => { setDateSel({ year: dateSel.year, month: active ? null : key }); if (!active) setDateOpen(false); }}
                              title={count === 0 ? `No reports in ${label} ${dateSel.year}` : `${count} ${count === 1 ? 'report' : 'reports'} in ${label} ${dateSel.year}`}
                              className={`mono flex flex-col items-start gap-1 border px-3 py-2.5 text-[10.5px] uppercase tracking-[0.12em] transition-colors duration-300 ${
                                active
                                  ? 'border-navy bg-navy text-paper'
                                  : count === 0
                                    ? 'rule text-silver opacity-55'
                                    : 'rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink active:translate-y-px'
                              }`}
                            >
                              {label}
                              <span className={`num text-[10px] ${active ? 'opacity-60' : 'text-silver'}`}>
                                {count || '—'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── Sidebar + Reports ─────────────────────────────── */}
        <div className="mt-11 flex gap-10 lg:gap-14">

          {/* Category sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
            className="hidden lg:block"
          >
            <div className="sticky top-[72px]">
              <div className="mono mb-4 text-[9.5px] uppercase tracking-[0.22em] text-graphite">Sectors</div>
              <LineSidebar
                key={sidebarKey}
                items={['Latest reports', ...REPORT_CATEGORIES, 'All reports']}
                accentColor="var(--color-amber-deep)"
                textColor="var(--color-slate)"
                markerColor="var(--color-graphite)"
                showIndex={false}
                showMarker
                proximityRadius={100}
                maxShift={18}
                falloff="smooth"
                markerLength={32}
                markerGap={8}
                tickScale={0.5}
                scaleTick
                itemGap={14}
                fontSize={0.72}
                smoothing={100}
                defaultActive={0}
                onItemClick={(index) => {
                  if (index === 0) setView('latest');
                  else if (index === REPORT_CATEGORIES.length + 1) setView('all');
                  else setView(REPORT_CATEGORIES[index - 1] as ReportCategory);
                }}
              />
            </div>
          </motion.aside>

          {/* Reports column */}
          <section className="min-w-0 flex-1">
            <div className="mb-6 flex items-baseline justify-between">
              <div className="flex items-baseline gap-3">
                <h2 className="text-[18px] font-medium tracking-[-0.01em] text-ink">
                  {heading}
                </h2>
                {companySelLabel && (
                  <button
                    type="button"
                    onClick={() => setCompanySel(null)}
                    className="mono inline-flex items-center gap-1.5 border px-2.5 py-1 text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-300 hover:text-ink"
                    style={{ borderColor: 'color-mix(in oklab, var(--color-amber-deep) 55%, transparent)', color: 'var(--color-amber-deep)' }}
                  >
                    {companySelLabel}
                    <IconX size={11} />
                  </button>
                )}
                {dateSelLabel && (
                  <button
                    type="button"
                    onClick={() => setDateSel(null)}
                    className="mono inline-flex items-center gap-1.5 border px-2.5 py-1 text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-300 hover:text-ink"
                    style={{ borderColor: 'color-mix(in oklab, var(--color-amber-deep) 55%, transparent)', color: 'var(--color-amber-deep)' }}
                  >
                    <span className="num">{dateSelLabel}</span>
                    <IconX size={11} />
                  </button>
                )}
              </div>
              <span className="mono text-[11px] uppercase tracking-[0.16em] text-graphite">
                {filtered.length} {filtered.length === 1 ? 'report' : 'reports'}
                {search.active && <span className="text-silver"> · by relevance</span>}
              </span>
            </div>

            {/* Mobile category pills — hidden on lg+ where sidebar shows */}
            <div className="mb-5 flex flex-wrap gap-1.5 lg:hidden">
              <FilterBtn active={view === 'latest'} label="Latest" count={reports.length} onClick={() => setView('latest')} />
              {REPORT_CATEGORIES.map((c) => (
                <FilterBtn key={c} active={view === c} label={c} count={counts.get(c) ?? 0} onClick={() => setView(c)} />
              ))}
              <FilterBtn active={view === 'all'} label="All" count={reports.length} onClick={() => setView('all')} />
            </div>

            {loading ? (
              <ReportsSkeleton />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-start gap-3 border border-dashed rule px-8 py-16">
                <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
                <p className="text-[15px] font-medium text-ink">Nothing matches that search.</p>
                <p className="max-w-[52ch] text-[13.5px] leading-relaxed text-graphite">
                  Every word has to land somewhere — on a title, ticker, company, analyst,
                  sector, type, rating or date. Drop a term, or clear the filters to see the
                  full archive.
                </p>
                <button
                  type="button"
                  onClick={() => { setQuery(''); setView('latest'); setCompanySel(null); setDateSel(null); setSidebarKey(k => k + 1); }}
                  className="mono mt-2 border rule px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {featured && (
                  <FeaturedCard report={featured} words={search.words} onView={() => setActive(featured)} />
                )}
                <motion.div
                  layout
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                >
                  <AnimatePresence mode="popLayout">
                    {grid.map((r, i) => (
                      <ReportCard key={r.id} report={r} index={i} words={search.words} onView={() => setActive(r)} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}
          </section>

        </div>
      </main>

      <footer className="mono border-t rule bg-paper px-5 py-5 text-[10px] uppercase tracking-[0.18em] text-graphite md:px-8">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Regis Partners · Institutional research, provisioned by mandate</span>
          <span>Redistribution outside your firm is prohibited</span>
        </div>
      </footer>

      <BookmarksModal
        open={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        onView={(r) => { setBookmarksOpen(false); setActive(r); }}
      />
      <ReportViewer report={active} onClose={() => setActive(null)} />
    </div>
  );
}

/* ── Download control ────────────────────────────────────────── */

/** Download toggle. Stamping the client's name and the timestamp into every
    page takes a beat, so the button holds a busy state until the file lands. */
function DownloadButton({ report, context, className, size = 15 }: {
  report: Report; context: string; className: string; size?: number;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void downloadReport(report, context).finally(() => setBusy(false));
      }}
      aria-label={busy ? `Watermarking ${report.title}` : `Download ${report.title}`}
      title={busy ? 'Watermarking your copy…' : 'Download watermarked PDF'}
      className={`grid shrink-0 place-items-center border rule text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:translate-y-px disabled:cursor-wait ${className}`}
    >
      {/* Pulses amber while the stamp is applied — the same beat as the save tick */}
      <motion.span
        animate={busy ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
        transition={busy ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        className="grid place-items-center"
        style={busy ? { color: 'var(--color-amber-deep)' } : undefined}
      >
        <IconDownload size={size} />
      </motion.span>
    </button>
  );
}

/* ── Bookmark control ────────────────────────────────────────── */

/** Save toggle. Sits beside download on every card, so the geometry is caller-set. */
function BookmarkButton({ report, className }: { report: Report; className: string }) {
  const { has, toggle } = useBookmarks();
  const isSaved = has(report.id);

  return (
    <button
      type="button"
      onClick={() => {
        trackActivity('click', report, isSaved ? 'bookmark-remove' : 'bookmark-add');
        toggle(report.id);
      }}
      aria-pressed={isSaved}
      aria-label={isSaved ? `Remove ${report.title} from bookmarks` : `Bookmark ${report.title}`}
      title={isSaved ? 'Remove from bookmarks' : 'Bookmark this report'}
      className={`grid shrink-0 place-items-center border transition-colors duration-300 active:translate-y-px ${
        isSaved ? '' : 'rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      } ${className}`}
      style={
        isSaved
          ? {
              borderColor: 'color-mix(in oklab, var(--color-amber-deep) 55%, transparent)',
              background: 'color-mix(in oklab, var(--color-amber) 10%, white)',
              color: 'var(--color-amber-deep)',
            }
          : undefined
      }
    >
      {/* One-shot scale keyframe on state change — confirms the click landed */}
      <motion.span
        animate={{ scale: isSaved ? [1, 1.28, 1] : 1 }}
        transition={{ duration: 0.34, ease: EASE }}
        className="grid place-items-center"
      >
        {isSaved ? <IconBookmarkFilled size={15} /> : <IconBookmark size={15} />}
      </motion.span>
    </button>
  );
}

/** The 2px amber marker the portal uses to mean "this one is flagged". */
function SavedTick({ shown }: { shown: boolean }) {
  return (
    <AnimatePresence>
      {shown && (
        <motion.span
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="absolute left-0 top-0 h-[2px] w-8 origin-left"
          style={{ background: 'var(--color-amber)' }}
        />
      )}
    </AnimatePresence>
  );
}

/* ── Trending + Spotlight ────────────────────────────────────── */

/** The pulsing amber marker the portal uses to mean "this is live data". */
function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: 'var(--color-amber)' }} />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-amber)' }} />
    </span>
  );
}

/** One rung of the most-read ladder. The whole card opens the viewer; the
    2px bar underneath plots this rung's reads against the chart-topper's. */
function TrendingCard({ report, rank, count, maxCount, metric, index, onView }: {
  report: Report; rank: number; count: number; maxCount: number; metric: TrendingMetric; index: number; onView: () => void;
}) {
  const top = rank === 1;
  const share = Math.max(count / Math.max(maxCount, 1), 0.08);
  const unit = trendingMetricDef(metric).unit[count === 1 ? 0 : 1];
  const CountIcon = metric === 'downloads' ? IconDownload : IconEye;
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.14 + index * 0.09 }}
      className="group relative flex flex-col border rule bg-white transition-colors duration-300 hover:border-[color:var(--color-amber-deep)]"
    >
      <button
        type="button"
        onClick={onView}
        aria-label={`Open ${report.title}`}
        className="flex flex-1 flex-col p-5 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="mono num text-[26px] leading-none tracking-[-0.03em]"
            style={{ color: top ? 'var(--color-amber-deep)' : 'var(--color-silver)' }}
          >
            {String(rank).padStart(2, '0')}
          </span>
          <span className="mono num flex items-center gap-1.5 pt-1 text-[10.5px] tracking-[0.06em] text-graphite">
            <CountIcon size={12} className="text-silver" />
            {count.toLocaleString('en-PH')} {unit}
          </span>
        </div>
        <div className="mono mt-4 flex items-baseline justify-between gap-3 text-[9.5px] uppercase tracking-[0.16em] text-graphite">
          <span className="truncate">
            {[report.companySymbol, report.reportType ?? report.category ?? 'General'].filter(Boolean).join(' · ')}
          </span>
          <RatingTag rating={report.rating} />
        </div>
        <h3 className="mt-2 line-clamp-2 text-[14.5px] font-medium leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-[color:var(--color-amber-deep)]">
          {report.title}
        </h3>
        <div className="mono mt-auto flex items-center justify-between gap-3 pt-4 text-[10.5px] tracking-[0.04em] text-graphite">
          <span className="truncate">
            {report.analyst}
            <span className="text-silver"> · </span>
            <span className="num">{fmtDate(report.date)}</span>
          </span>
          <IconArrowRight
            size={13}
            className="shrink-0 text-silver transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[color:var(--color-amber-deep)]"
          />
        </div>
      </button>
      <div aria-hidden className="h-[2px] w-full">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.35 + index * 0.09 }}
          className="h-full origin-left"
          style={{ width: `${share * 100}%`, background: top ? 'var(--color-amber)' : 'var(--color-silver)' }}
        />
      </div>
    </motion.article>
  );
}

/** The desk's showcase, flagged in the CMS Reports module. Drenched navy so
    it reads as an editorial choice, not another ranking. */
function SpotlightCard({ report, onView }: { report: Report; onView: () => void }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.22 }}
      className="group relative flex-1 overflow-hidden bg-blueprint"
    >
      <span aria-hidden className="absolute left-0 top-0 z-10 block h-[2px] w-10" style={{ background: 'var(--color-amber)' }} />
      <button
        type="button"
        onClick={onView}
        aria-label={`Open ${report.title}`}
        className="flex h-full w-full flex-col p-6 text-left md:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="mono flex items-center gap-2.5 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--color-amber)' }}>
            <LiveDot />
            Spotlight
          </span>
          <RatingTag rating={report.rating} dark />
        </div>
        <h3 className="mt-4 text-[clamp(1.15rem,1.8vw,1.45rem)] font-medium leading-[1.15] tracking-[-0.015em] text-paper transition-colors duration-300 group-hover:text-[color:var(--color-amber)]">
          {report.title}
        </h3>
        {report.summary && (
          <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed" style={{ color: 'color-mix(in oklab, var(--color-paper) 66%, transparent)' }}>
            {report.summary}
          </p>
        )}
        <div
          className="mono mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t rule-paper pt-4 text-[10.5px] tracking-[0.05em]"
          style={{ color: 'color-mix(in oklab, var(--color-paper) 60%, transparent)' }}
        >
          {report.companySymbol && <><span>{report.companySymbol}</span><span>·</span></>}
          {report.reportType && <><span>{report.reportType}</span><span>·</span></>}
          <span>{report.analyst}</span>
          <span>·</span>
          <span className="num">{fmtDate(report.date)}</span>
          {report.pages ? <><span>·</span><span className="num">{report.pages} pages</span></> : null}
          <span>·</span>
          <span className="num">{fmtBytes(report.fileSize)}</span>
        </div>
        <span className="mono mt-5 inline-flex items-center gap-3 text-[10.5px] uppercase tracking-[0.16em] text-paper">
          <span className="grid h-8 w-8 place-items-center border rule-paper transition-colors duration-300 group-hover:border-[color:var(--color-amber)] group-hover:text-[color:var(--color-amber)]">
            <IconArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
          View report
        </span>
      </button>
    </motion.article>
  );
}

/* ── Featured (latest) ───────────────────────────────────────── */

function FeaturedCard({ report, words, onView }: { report: Report; words: string[]; onView: () => void }) {
  const { has } = useBookmarks();
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
      className="group relative overflow-hidden border rule bg-white transition-colors duration-300 hover:border-[color:var(--color-amber-deep)]"
    >
      <SavedTick shown={has(report.id)} />
      <div className="grid gap-6 p-7 md:grid-cols-[1.6fr_1fr] md:p-9">
        <div className="min-w-0">
          <div className="mono mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em]">
            <span className="inline-flex items-center gap-2" style={{ color: 'var(--color-amber-deep)' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-amber)' }} />
              Latest
            </span>
            <span className="text-silver">/</span>
            <span className="text-graphite">{report.category ?? 'General'}</span>
            {report.companyName && (
              <>
                <span className="text-silver">/</span>
                <span className="text-graphite">
                  {[report.companySymbol, report.companyName].filter(Boolean).join(' · ')}
                </span>
              </>
            )}
            {report.reportType && (
              <>
                <span className="text-silver">/</span>
                <span className="text-graphite">{report.reportType}</span>
              </>
            )}
            <RatingTag rating={report.rating} />
          </div>
          <button type="button" onClick={onView} className="block text-left">
            <h3 className="text-[clamp(1.4rem,2.4vw,2rem)] font-medium leading-[1.08] tracking-[-0.02em] text-ink">
              <Highlight text={report.title} words={words} />
            </h3>
          </button>
          <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-slate">
            <Highlight text={report.summary} words={words} />
          </p>
          <div className="mono mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tracking-[0.04em] text-graphite">
            <span className="text-slate"><Highlight text={report.analyst} words={words} /></span>
            <span className="text-silver">·</span>
            <span className="num">{fmtDate(report.date)}</span>
            {report.pages ? <><span className="text-silver">·</span><span className="num">{report.pages} pages</span></> : null}
            <span className="text-silver">·</span>
            <span className="num">{fmtBytes(report.fileSize)}</span>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 border-t rule pt-6 md:border-l md:border-t-0 md:pl-9 md:pt-0">
          <div className="hidden md:block">
            <div className="flex aspect-[3/4] max-h-[190px] w-full items-center justify-center bg-white">
              <img src="/RegisSquare.png" alt="Regis Partners" className="h-full w-full object-contain" draggable={false} />
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onView}
              className="group/btn inline-flex flex-1 items-center justify-center gap-2 bg-navy px-4 py-3 text-[13px] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)] active:translate-y-px"
            >
              <IconEye size={15} /> View report
            </button>
            <BookmarkButton report={report} className="w-12" />
            <DownloadButton report={report} context="featured" className="w-12" size={16} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ── Report card ─────────────────────────────────────────────── */

const ReportCard = memo(function ReportCard({ report, index, words, onView }: {
  report: Report; index: number; words: string[]; onView: () => void;
}) {
  const { has } = useBookmarks();
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(index * 0.035, 0.28) } }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      className="group relative flex flex-col border rule bg-white p-6 transition-colors duration-300 hover:border-[color:var(--color-amber-deep)]"
    >
      <SavedTick shown={has(report.id)} />
      <div className="mono mb-4 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-graphite">
        <span className="truncate pr-3">
          {[report.companySymbol, report.reportType ?? report.category ?? 'General'].filter(Boolean).join(' · ')}
        </span>
        <span className="num shrink-0">{fmtDate(report.date)}</span>
      </div>

      <button type="button" onClick={onView} className="block flex-1 text-left">
        <h3 className="text-[15.5px] font-medium leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-[color:var(--color-amber-deep)]">
          <Highlight text={report.title} words={words} />
        </h3>
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-graphite">
          <Highlight text={report.summary} words={words} />
        </p>
      </button>

      <div className="mono mt-5 flex items-center gap-2 text-[11px] tracking-[0.04em] text-graphite">
        <span className="truncate text-slate"><Highlight text={report.analyst} words={words} /></span>
        {report.pages ? <><span className="text-silver">·</span><span className="num shrink-0">{report.pages}p</span></> : null}
        <span className="text-silver">·</span>
        <span className="num shrink-0">{fmtBytes(report.fileSize)}</span>
        {report.rating && <span className="ml-auto"><RatingTag rating={report.rating} /></span>}
      </div>

      <div className="mt-5 flex items-center gap-2 border-t rule pt-4">
        <button
          type="button"
          onClick={onView}
          className="inline-flex flex-1 items-center justify-center gap-2 border rule px-3 py-2.5 text-[12.5px] text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:translate-y-px"
        >
          <IconEye size={14} /> View
        </button>
        <BookmarkButton report={report} className="h-[38px] w-[38px]" />
        <DownloadButton report={report} context="card" className="h-[38px] w-[38px]" />
      </div>
    </motion.article>
  );
});

/* ── Bits ────────────────────────────────────────────────────── */

function FilterBtn({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mono inline-flex items-center gap-2 border px-3.5 py-2 text-[10.5px] uppercase tracking-[0.1em] transition-colors duration-300 active:translate-y-px ${
        active ? 'border-navy bg-navy text-paper' : 'rule bg-white text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
    >
      {label}
      <span className={active ? 'opacity-60' : 'text-silver'}>{count}</span>
    </button>
  );
}

function ReportsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 border rule bg-white p-6">
          <div className="flex justify-between">
            <div className="h-3 w-24 skeleton-bar" style={{ animationDelay: `${i * 80}ms` }} />
            <div className="h-3 w-14 skeleton-bar" style={{ animationDelay: `${i * 80 + 40}ms` }} />
          </div>
          <div className="h-4 skeleton-bar" style={{ width: '92%', animationDelay: `${i * 80 + 60}ms` }} />
          <div className="h-4 skeleton-bar" style={{ width: '70%', animationDelay: `${i * 80 + 90}ms` }} />
          <div className="mt-2 h-3 skeleton-bar" style={{ width: '100%', animationDelay: `${i * 80 + 120}ms` }} />
          <div className="mt-6 h-9 skeleton-bar" style={{ animationDelay: `${i * 80 + 160}ms` }} />
        </div>
      ))}
    </div>
  );
}
