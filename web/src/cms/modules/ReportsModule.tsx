import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import {
  BtnGhost, BtnPrimary, Chip, DateField, Drawer, EmptyState, ModuleHeader,
  RowAction, SelectField, SkeletonRows, Switch, TextField, useConfirm, EASE,
} from '../ui';
import {
  IconPen, IconPlus, IconSearch, IconTrash, IconCheck, IconUpload, IconEye, IconMenu, IconX,
  IconStar, IconStarFilled, IconChart, IconArrowDown, IconCopy,
} from '../icons';
import {
  REPORT_CATEGORIES, REPORT_COMPANIES, REPORT_RATINGS, TRENDING_METRICS, TRENDING_WINDOWS,
  companyLine, fmtBytes, fmtDate, ratingDef, trendingMetricDef,
  type Company, type Report, type ReportCategory, type ReportCompany, type ReportRating,
  type ReportType, type TrendingEntry, type TrendingMetric,
} from '../data';
import { apiBlobUrl, apiFetch } from '../../lib/api';
import { writeClipboard } from '../../lib/clipboard';
import { SEARCH_EXAMPLES, useReportSearch } from '../../lib/reportSearch';
import Highlight from '../../components/Highlight';

type Form = {
  title: string;
  summary: string;
  category: '' | ReportCategory;
  reportTypeId: string;
  companyId: string;
  rating: '' | ReportRating;
  /** Publication date, ISO yyyy-mm-dd. */
  date: string;
  analyst: string;
  pages: string;
};

/** Local calendar date as yyyy-mm-dd — the desk publishes on Manila time. */
function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const blankForm = (): Form => ({
  title: '', summary: '', category: '', reportTypeId: '', companyId: '',
  rating: '', date: todayISO(), analyst: '', pages: '',
});

/** Drawer copy of the trending rules; minEvents stays a string while typed. */
type TrendForm = { enabled: boolean; metric: TrendingMetric; windowMonths: number; limit: number; minEvents: string };

/** A company row opened for editing in the registry drawer. */
type CompanyEdit = { id: string; name: string; symbol: string; type: ReportCompany };

const companyLabel = (v: ReportCompany) => REPORT_COMPANIES.find((c) => c.value === v)?.label ?? v;

const windowLabel = (months: number) =>
  TRENDING_WINDOWS.find((w) => w.value === months)?.label ?? `Trailing ${months} months`;

/** Active companies filter: a whole classification, one company, or nothing. */
type CompanySel = { kind: 'type'; type: ReportCompany } | { kind: 'company'; company: Company } | null;

export default function ReportsModule() {
  const {
    reports, companies, reportTypes, trendingRules, status,
    createReport, updateReport, deleteReport, setReportSpotlight, updateTrendingRules,
    createCompany, updateCompany, deleteCompany,
    createReportType, renameReportType, deleteReportType,
  } = useCms();
  const [category, setCategory] = useState<'all' | 'none' | ReportCategory>('all');
  /** 'all', 'none' (unclassified), or a report-type id. */
  const [typeSel, setTypeSel] = useState<string>('all');
  const [companySel, setCompanySel] = useState<CompanySel>(null);
  const [companiesFilterOpen, setCompaniesFilterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [editing, setEditing] = useState<Report | 'new' | null>(null);
  const [form, setForm] = useState<Form>(blankForm);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [armed, confirm] = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);

  // Spotlight — the one report showcased on the portal dashboard.
  const [spotBusy, setSpotBusy] = useState<string | null>(null);

  // Blast link — the login-gated portal deep link pasted into blast emails.
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const copiedTimer = useRef<number | null>(null);
  useEffect(() => () => { if (copiedTimer.current) window.clearTimeout(copiedTimer.current); }, []);

  async function copyBlastLink(r: Report) {
    const ok = await writeClipboard(`${window.location.origin}/portal?report=${r.id}`);
    setCopiedLink(ok ? r.id : null);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopiedLink(null), 2200);
  }

  // Trending rules drawer, with a live dry-run against the activity ledger.
  const [trendOpen, setTrendOpen] = useState(false);
  const [trendForm, setTrendForm] = useState<TrendForm>({ ...trendingRules, minEvents: String(trendingRules.minEvents) });
  const [trendSaving, setTrendSaving] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [trendPreview, setTrendPreview] = useState<TrendingEntry[] | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewSeq = useRef(0);

  // Companies manager drawer
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companySymbol, setCompanySymbol] = useState('');
  const [companyType, setCompanyType] = useState<ReportCompany>('Local');
  const [companyEdit, setCompanyEdit] = useState<CompanyEdit | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyArmed, confirmCompany] = useConfirm();

  // Report-type manager drawer
  const [typesOpen, setTypesOpen] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeEdit, setTypeEdit] = useState<{ id: string; name: string } | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeBusy, setTypeBusy] = useState(false);
  const [typeArmed, confirmType] = useConfirm();

  const loading = status === 'loading';

  /** Every column a report carries, searchable from the one box. */
  const search = useReportSearch(reports, query);

  const rows = useMemo(() => {
    const list = reports
      .filter((r) => category === 'all' || (category === 'none' ? r.category === null : r.category === category))
      .filter((r) => typeSel === 'all' || (typeSel === 'none' ? r.reportTypeId === null : r.reportTypeId === typeSel))
      .filter((r) => {
        if (!companySel) return true;
        if (companySel.kind === 'type') return r.company === companySel.type;
        return r.companyId === companySel.company.id;
      })
      .filter(search.match)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
    // Newest first while browsing; best match first once something is typed.
    return search.rank(list);
  }, [reports, category, typeSel, companySel, search]);

  const filtered = query !== '' || category !== 'all' || typeSel !== 'all' || companySel !== null;

  function clearFilters() {
    setQuery('');
    setCategory('all');
    setTypeSel('all');
    setCompanySel(null);
  }

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports) m.set(r.category ?? 'none', (m.get(r.category ?? 'none') ?? 0) + 1);
    return m;
  }, [reports]);

  /** company id → number of reports filed under it. */
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports) {
      if (r.companyId) m.set(r.companyId, (m.get(r.companyId) ?? 0) + 1);
    }
    return m;
  }, [reports]);

  /** report-type id → number of reports classified under it. */
  const typeUsage = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports) {
      if (r.reportTypeId) m.set(r.reportTypeId, (m.get(r.reportTypeId) ?? 0) + 1);
    }
    return m;
  }, [reports]);

  const companySelLabel = companySel
    ? companySel.kind === 'type' ? companyLabel(companySel.type) : companySel.company.name
    : null;

  const spotlight = useMemo(() => reports.find((r) => r.spotlight) ?? null, [reports]);

  async function toggleSpotlight(r: Report) {
    setSpotBusy(r.id);
    try {
      await setReportSpotlight(r.id, !r.spotlight);
    } finally {
      setSpotBusy(null);
    }
  }

  function openTrending() {
    setTrendForm({ ...trendingRules, minEvents: String(trendingRules.minEvents) });
    setTrendError(null);
    setTrendPreview(null);
    setTrendOpen(true);
  }

  /** Debounced dry-run of the drawer's rules against the live ledger, so the
      desk sees exactly which reports would take the cards before saving. */
  useEffect(() => {
    if (!trendOpen) return;
    setPreviewBusy(true);
    const seq = ++previewSeq.current;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({
        metric: trendForm.metric,
        windowMonths: String(trendForm.windowMonths),
        limit: String(trendForm.limit),
        minEvents: String(Math.max(1, Number.parseInt(trendForm.minEvents, 10) || 1)),
      });
      apiFetch<{ entries: TrendingEntry[] }>(`/cms/trending/preview?${qs}`, { audience: 'cms' })
        .then((res) => { if (previewSeq.current === seq) setTrendPreview(res.entries); })
        .catch(() => { if (previewSeq.current === seq) setTrendPreview(null); })
        .finally(() => { if (previewSeq.current === seq) setPreviewBusy(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [trendOpen, trendForm.metric, trendForm.windowMonths, trendForm.limit, trendForm.minEvents]);

  async function saveTrending() {
    setTrendSaving(true);
    setTrendError(null);
    try {
      await updateTrendingRules({
        enabled: trendForm.enabled,
        metric: trendForm.metric,
        windowMonths: trendForm.windowMonths,
        limit: trendForm.limit,
        minEvents: Math.max(1, Number.parseInt(trendForm.minEvents, 10) || 1),
      });
      setTrendOpen(false);
    } catch (e) {
      setTrendError(e instanceof Error ? e.message : 'Saving the rules failed. Try again.');
    } finally {
      setTrendSaving(false);
    }
  }

  function openEditor(target: Report | 'new') {
    setFormError(null);
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
    if (target === 'new') setForm(blankForm());
    else setForm({
      title: target.title,
      summary: target.summary,
      category: target.category ?? '',
      reportTypeId: target.reportTypeId ?? '',
      companyId: target.companyId ?? '',
      rating: target.rating ?? '',
      date: target.date,
      analyst: target.analyst,
      pages: target.pages ? String(target.pages) : '',
    });
    setEditing(target);
  }

  function pickFile(f: File | null) {
    setFormError(null);
    if (!f) { setFile(null); return; }
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setFormError('Reports must be uploaded as a PDF.');
      return;
    }
    setFile(f);
  }

  async function save() {
    if (!form.title.trim()) { setFormError('A report title is required.'); return; }
    if (!form.analyst.trim()) { setFormError('Attribute the report to an analyst.'); return; }
    if (!form.date) { setFormError('Set the publication date.'); return; }
    if (editing === 'new' && !file) { setFormError('Attach the PDF before publishing.'); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category || null,
        reportTypeId: form.reportTypeId || null,
        companyId: form.companyId || null,
        analyst: form.analyst.trim(),
        rating: form.rating || null,
        date: form.date,
        pages: Number.parseInt(form.pages, 10) || 0,
        summary: form.summary.trim(),
      };
      if (editing === 'new') await createReport(payload, file!);
      else if (editing) await updateReport(editing.id, payload, file);
      setEditing(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Publishing failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Report) {
    await deleteReport(r.id);
  }

  async function preview(r: Report) {
    let url = r.fileUrl ?? null;
    let revoke = false;
    if (!url) {
      url = await apiBlobUrl(`/reports/${r.id}/file`, 'cms');
      revoke = Boolean(url);
    }
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (revoke) setTimeout(() => URL.revokeObjectURL(url!), 60_000);
  }

  /* ── Companies registry ───────────────────────────────────── */

  async function addCompany() {
    const name = companyName.trim();
    if (!name) { setCompanyError('A company name is required.'); return; }
    setCompanyBusy(true);
    setCompanyError(null);
    try {
      await createCompany({ name, symbol: companySymbol.trim().toUpperCase() || null, type: companyType });
      setCompanyName('');
      setCompanySymbol('');
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : 'Adding the company failed. Try again.');
    } finally {
      setCompanyBusy(false);
    }
  }

  async function saveCompanyEdit() {
    if (!companyEdit) return;
    const name = companyEdit.name.trim();
    if (!name) { setCompanyError('A company name is required.'); return; }
    setCompanyBusy(true);
    setCompanyError(null);
    try {
      await updateCompany(companyEdit.id, {
        name,
        symbol: companyEdit.symbol.trim().toUpperCase() || null,
        type: companyEdit.type,
      });
      setCompanyEdit(null);
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : 'Saving the company failed. Try again.');
    } finally {
      setCompanyBusy(false);
    }
  }

  /* ── Report-type registry ─────────────────────────────────── */

  async function addType() {
    const name = typeName.trim();
    if (!name) { setTypeError('Name the report type.'); return; }
    setTypeBusy(true);
    setTypeError(null);
    try {
      await createReportType(name);
      setTypeName('');
    } catch (e) {
      setTypeError(e instanceof Error ? e.message : 'Adding the type failed. Try again.');
    } finally {
      setTypeBusy(false);
    }
  }

  async function saveTypeEdit() {
    if (!typeEdit) return;
    const name = typeEdit.name.trim();
    if (!name) { setTypeError('Name the report type.'); return; }
    setTypeBusy(true);
    setTypeError(null);
    try {
      await renameReportType(typeEdit.id, name);
      setTypeEdit(null);
    } catch (e) {
      setTypeError(e instanceof Error ? e.message : 'Renaming the type failed. Try again.');
    } finally {
      setTypeBusy(false);
    }
  }

  return (
    <div className="space-y-9">
      <ModuleHeader
        code="02 / Reports"
        title="Research reports"
        blurb="Post PDF research to the client portal. Every report carries a publication date, a covered name and its ticker, a type, a rating and an analyst byline — clients filter and read on exactly those."
        actions={
          <>
            <BtnGhost onClick={() => { setTypeError(null); setTypeEdit(null); setTypesOpen(true); }}>Report types</BtnGhost>
            <BtnGhost onClick={() => { setCompanyError(null); setCompanyEdit(null); setCompaniesOpen(true); }}>Companies</BtnGhost>
            <BtnPrimary onClick={() => openEditor('new')}><IconPlus size={14} /> Post report</BtnPrimary>
          </>
        }
      />

      {/* Portal dashboard band — the Spotlight card and the Trending rules */}
      <section className="divide-y rule border rule bg-white">

      {/* Spotlight slot — what the portal dashboard's showcase card runs */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] md:items-stretch">
        <div className={`flex items-center gap-3 border-b rule px-5 py-4 md:w-[168px] md:border-b-0 md:border-r ${spotlight ? 'bg-paper-grid' : ''}`}>
          <span
            className="grid h-9 w-9 shrink-0 place-items-center border"
            style={
              spotlight
                ? { borderColor: 'color-mix(in oklab, var(--color-amber-deep) 55%, transparent)', color: 'var(--color-amber-deep)', background: 'color-mix(in oklab, var(--color-amber) 10%, white)' }
                : { borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)', color: 'var(--color-silver)' }
            }
          >
            {spotlight ? <IconStarFilled size={15} /> : <IconStar size={15} />}
          </span>
          <span className="mono text-[9.5px] uppercase leading-[1.5] tracking-[0.2em] text-graphite">
            Spot<br />light
          </span>
        </div>
        <div className="min-w-0 px-5 py-4">
          {spotlight ? (
            <>
              <div className="flex items-center gap-3">
                <p className="truncate text-[14.5px] leading-snug text-ink">{spotlight.title}</p>
                <Chip tone="amber" pulse>Live</Chip>
              </div>
              <p className="mono mt-1.5 truncate text-[10.5px] tracking-[0.05em] text-graphite">
                Showcased on the portal dashboard · {spotlight.analyst} · <span className="num">{fmtDate(spotlight.date)}</span>
                {spotlight.reportType ? ` · ${spotlight.reportType}` : ''}
                {spotlight.rating ? ` · ${spotlight.rating}` : ''}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13.5px] text-slate">No report in the spotlight.</p>
              <p className="mono mt-1.5 text-[10.5px] tracking-[0.05em] text-graphite">
                Star a report below to showcase it beside Trending Content on the portal dashboard.
              </p>
            </>
          )}
        </div>
        {spotlight && (
          <div className="flex items-center gap-2 border-t rule px-5 py-4 md:border-t-0 md:pl-0">
            <BtnGhost onClick={() => openEditor(spotlight)}>Edit</BtnGhost>
            <BtnGhost onClick={() => void toggleSpotlight(spotlight)} disabled={spotBusy !== null}>
              {spotBusy === spotlight.id ? 'Clearing…' : 'Clear'}
            </BtnGhost>
          </div>
        )}
      </div>

      {/* Trending rules — how the portal ranks its most-read cards */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] md:items-stretch">
        <div className={`flex items-center gap-3 border-b rule px-5 py-4 md:w-[168px] md:border-b-0 md:border-r ${trendingRules.enabled ? 'bg-paper-grid' : ''}`}>
          <span
            className="grid h-9 w-9 shrink-0 place-items-center border"
            style={
              trendingRules.enabled
                ? { borderColor: 'color-mix(in oklab, var(--color-amber-deep) 55%, transparent)', color: 'var(--color-amber-deep)', background: 'color-mix(in oklab, var(--color-amber) 10%, white)' }
                : { borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)', color: 'var(--color-silver)' }
            }
          >
            <IconChart size={15} />
          </span>
          <span className="mono text-[9.5px] uppercase leading-[1.5] tracking-[0.2em] text-graphite">
            Trend<br />ing
          </span>
        </div>
        <div className="min-w-0 px-5 py-4">
          {trendingRules.enabled ? (
            <>
              <div className="flex items-center gap-3">
                <p className="truncate text-[14.5px] leading-snug text-ink">
                  Top {trendingRules.limit} · {trendingMetricDef(trendingRules.metric).label.toLowerCase()} · {windowLabel(trendingRules.windowMonths).toLowerCase()}
                  {trendingRules.minEvents > 1 ? ` · ${trendingRules.minEvents}+ to qualify` : ''}
                </p>
                <Chip tone="live" pulse>On</Chip>
              </div>
              <p className="mono mt-1.5 truncate text-[10.5px] tracking-[0.05em] text-graphite">
                Ranked live from the client activity ledger, beside Spotlight on the portal dashboard.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <p className="text-[13.5px] text-slate">Trending Content is hidden from the portal.</p>
                <Chip tone="muted">Off</Chip>
              </div>
              <p className="mono mt-1.5 text-[10.5px] tracking-[0.05em] text-graphite">
                Configure to turn the most-read ladder back on.
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 border-t rule px-5 py-4 md:border-t-0 md:pl-0">
          <BtnGhost onClick={openTrending}>Configure</BtnGhost>
        </div>
      </div>

      </section>

      {/* Sector rail */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          <CategoryBtn active={category === 'all'} label="All" count={reports.length} onClick={() => setCategory('all')} />
          {REPORT_CATEGORIES.map((c) => (
            <CategoryBtn key={c} active={category === c} label={c} count={counts.get(c) ?? 0} onClick={() => setCategory(c)} />
          ))}
          <CategoryBtn active={category === 'none'} label="No sector" count={counts.get('none') ?? 0} onClick={() => setCategory('none')} />
        </div>
        <div className="flex flex-wrap items-stretch gap-3">
          {/* Companies filter toggle — mirrors the portal's burger control */}
          <button
            type="button"
            onClick={() => setCompaniesFilterOpen((o) => !o)}
            aria-expanded={companiesFilterOpen}
            aria-controls="reports-companies-filter"
            aria-label="Filter by company"
            title="Filter by company"
            className={`grid w-[46px] shrink-0 place-items-center border transition-colors duration-300 active:scale-[0.96] ${
              companiesFilterOpen || companySel !== null
                ? 'border-[color:var(--color-amber-deep)] bg-white text-[color:var(--color-amber-deep)]'
                : 'rule bg-white text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={companiesFilterOpen ? 'close' : 'open'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="grid place-items-center"
              >
                {companiesFilterOpen ? <IconX size={16} /> : <IconMenu size={16} />}
              </motion.span>
            </AnimatePresence>
          </button>

          <label className="relative block w-full md:w-[340px]">
            <span className="sr-only">Search reports</span>
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search title, ticker, company, analyst, date…"
              className="w-full border rule bg-white py-2.5 pl-9 pr-16 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mono absolute right-3 top-1/2 -translate-y-1/2 text-[9.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
              >
                Clear
              </button>
            )}
          </label>

          {/* Report-type filter — the desk's editable classifications */}
          <label className="relative flex shrink-0">
            <span className="sr-only">Filter by report type</span>
            <select
              value={typeSel}
              onChange={(e) => setTypeSel(e.target.value)}
              className={`mono h-full w-full appearance-none border bg-white py-2.5 pl-3.5 pr-9 text-[10.5px] uppercase tracking-[0.12em] outline-none transition-colors duration-300 ${
                typeSel === 'all'
                  ? 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
                  : 'border-[color:var(--color-amber-deep)] text-[color:var(--color-amber-deep)]'
              }`}
            >
              <option value="all">All types</option>
              {reportTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="none">Unclassified</option>
            </select>
            <IconArrowDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-silver" />
          </label>

          {companySelLabel && (
            <button
              type="button"
              onClick={() => setCompanySel(null)}
              className="mono inline-flex shrink-0 items-center gap-1.5 border px-2.5 text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-300 hover:text-ink"
              style={{ borderColor: 'color-mix(in oklab, var(--color-amber-deep) 55%, transparent)', color: 'var(--color-amber-deep)' }}
            >
              {companySelLabel}
              <IconX size={11} />
            </button>
          )}
        </div>

        {/* What the box understands — shown while it is empty and focused */}
        <AnimatePresence initial={false}>
          {searchFocus && !query && (
            <motion.div
              key="reports-search-hint"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[9.5px] uppercase tracking-[0.2em] text-silver">Try</span>
                {SEARCH_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setQuery(example)}
                    className="mono border rule px-2 py-1 text-[9.5px] tracking-[0.08em] text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
                  >
                    {example}
                  </button>
                ))}
                <span className="text-[11.5px] leading-relaxed text-graphite">
                  Words in any order, quotes for a phrase, minus to exclude.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Companies panel — local vs foreign coverage, same pattern as the portal */}
        <AnimatePresence initial={false}>
          {companiesFilterOpen && (
            <motion.div
              id="reports-companies-filter"
              key="reports-companies-filter"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 divide-y rule border rule bg-white md:grid-cols-2 md:divide-x md:divide-y-0">
                {REPORT_COMPANIES.map((g) => {
                  const group = companies.filter((c) => c.type === g.value);
                  const typeActive = companySel?.kind === 'type' && companySel.type === g.value;
                  return (
                    <div key={g.value} className="flex min-w-0 flex-col p-5">
                      <div className="mb-3 flex items-center justify-between gap-3 border-b rule pb-3">
                        <span className="mono flex items-center gap-2.5 text-[10px] uppercase tracking-[0.18em] text-graphite">
                          <span aria-hidden className="block h-[2px] w-5" style={{ background: typeActive ? 'var(--color-amber)' : 'var(--color-silver)' }} />
                          {g.label}
                          <span className="num text-silver">{group.length}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setCompanySel(typeActive ? null : { kind: 'type', type: g.value })}
                          className={`mono border px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] transition-colors duration-300 active:translate-y-px ${
                            typeActive ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
                          }`}
                        >
                          {typeActive ? 'Showing · Clear' : 'Show all'}
                        </button>
                      </div>
                      {group.length === 0 ? (
                        <p className="text-[12.5px] leading-relaxed text-graphite">No {g.label.toLowerCase()} covered yet.</p>
                      ) : (
                        <ul className="max-h-[240px] divide-y rule overflow-y-auto">
                          {group.map((c) => {
                            const active = companySel?.kind === 'company' && companySel.company.id === c.id;
                            const count = usage.get(c.id) ?? 0;
                            return (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onClick={() => setCompanySel(active ? null : { kind: 'company', company: c })}
                                  className="group/item flex w-full items-baseline justify-between gap-4 py-2.5 text-left transition-colors duration-200"
                                >
                                  <span className="flex min-w-0 items-baseline gap-2.5">
                                    <span
                                      className="mono shrink-0 text-[10px] uppercase tracking-[0.1em]"
                                      style={{ color: active ? 'var(--color-amber-deep)' : c.symbol ? 'var(--color-slate)' : 'var(--color-silver)' }}
                                    >
                                      {c.symbol ?? '—'}
                                    </span>
                                    <span
                                      className={`block truncate text-[13px] leading-snug transition-colors group-hover/item:text-[color:var(--color-amber-deep)] ${active ? '' : 'text-ink'}`}
                                      style={active ? { color: 'var(--color-amber-deep)' } : undefined}
                                    >
                                      {c.name}
                                    </span>
                                  </span>
                                  <span className="mono num shrink-0 text-[10px] text-silver">
                                    {count} {count === 1 ? 'report' : 'reports'}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filtered ? 'No reports match those filters.' : 'No reports posted yet.'}
          hint={filtered
            ? 'Every word has to land somewhere. Drop a term, or clear the sector, type and companies filters.'
            : 'Post a PDF and it will appear here and in the client portal immediately.'}
          action={
            filtered
              ? <BtnGhost onClick={clearFilters}>Clear filters</BtnGhost>
              : <BtnPrimary onClick={() => openEditor('new')}><IconPlus size={14} /> Post report</BtnPrimary>
          }
        />
      ) : (
        <ul className="divide-y rule border-y rule">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: Math.min(i * 0.04, 0.3) } }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
                className="group"
              >
                <div className="grid grid-cols-12 items-center gap-x-4 gap-y-2 py-5">
                  {/* Covered name — ticker, company, sector */}
                  <span className="col-span-7 order-1 min-w-0 md:col-span-2">
                    {r.companyName ? (
                      <span className="mono flex items-baseline gap-2 text-[11px] uppercase tracking-[0.1em]">
                        {r.companySymbol && (
                          <span className="shrink-0 text-ink">
                            <Highlight text={r.companySymbol} words={search.words} />
                          </span>
                        )}
                        <span className="truncate text-graphite">
                          <Highlight text={r.companyName} words={search.words} />
                        </span>
                      </span>
                    ) : (
                      <span className="mono block truncate text-[11px] uppercase tracking-[0.1em] text-graphite">Macro · multi-name</span>
                    )}
                    <span className="mono mt-1 block truncate text-[9.5px] uppercase tracking-[0.14em] text-silver">
                      {[r.category ?? 'No sector', r.company].filter(Boolean).join(' · ')}
                    </span>
                  </span>

                  {/* The house call */}
                  <span className="col-span-5 order-2 justify-self-end md:col-span-2 md:order-4 md:justify-self-start lg:col-span-1">
                    <RatingMark rating={r.rating} />
                  </span>

                  {/* Title, type and file */}
                  <div className="col-span-12 order-3 min-w-0 md:col-span-5 md:order-2 lg:col-span-4">
                    <div className="flex items-center gap-3">
                      <p className="min-w-0 text-[15px] leading-snug text-ink">
                        <Highlight text={r.title} words={search.words} />
                      </p>
                      {r.spotlight && <Chip tone="amber" pulse>Spotlight</Chip>}
                    </div>
                    <p className="mono mt-1 truncate text-[11px] tracking-[0.04em] text-graphite">
                      <span className="num lg:hidden">{fmtDate(r.date)} · </span>
                      {r.reportType && <><span className="text-slate">{r.reportType}</span>{' · '}</>}
                      {r.fileName} · {fmtBytes(r.fileSize)}{r.pages ? ` · ${r.pages}p` : ''}
                    </p>
                  </div>

                  <span className="order-5 hidden text-[13px] text-slate lg:col-span-2 lg:block">
                    <Highlight text={r.analyst} words={search.words} />
                  </span>
                  <span className="mono num order-6 hidden whitespace-nowrap text-[12px] text-graphite lg:col-span-1 lg:block">{fmtDate(r.date)}</span>

                  <div className="col-span-12 order-7 flex items-center gap-2 md:col-span-3 md:order-8 md:justify-end md:justify-self-end lg:col-span-2">
                    <RowAction
                      label={r.spotlight ? 'Remove from spotlight' : 'Set as spotlight'}
                      onClick={() => void toggleSpotlight(r)}
                      disabled={spotBusy !== null}
                    >
                      {r.spotlight
                        ? <span className="grid place-items-center" style={{ color: 'var(--color-amber-deep)' }}><IconStarFilled size={15} /></span>
                        : <IconStar size={15} />}
                    </RowAction>
                    <RowAction
                      label={copiedLink === r.id ? 'Blast link copied' : 'Copy blast link'}
                      onClick={() => void copyBlastLink(r)}
                    >
                      {copiedLink === r.id
                        ? <span className="grid place-items-center" style={{ color: 'var(--color-amber-deep)' }}><IconCheck /></span>
                        : <IconCopy />}
                    </RowAction>
                    <RowAction label="Preview PDF" onClick={() => preview(r)}><IconEye /></RowAction>
                    <RowAction label="Edit report" onClick={() => openEditor(r)}><IconPen /></RowAction>
                    <RowAction label={armed === r.id ? 'Confirm delete' : 'Delete report'} danger onClick={() => confirm(r.id, () => { void remove(r); })}>
                      {armed === r.id ? <IconCheck /> : <IconTrash />}
                    </RowAction>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* ── Post / edit report ─────────────────────────────────── */}
      <Drawer
        open={editing !== null}
        title={editing === 'new' ? 'Post research report' : 'Edit report'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <BtnGhost onClick={() => setEditing(null)}>Discard</BtnGhost>
            <BtnPrimary onClick={() => void save()} disabled={saving}>
              {saving ? 'Publishing…' : editing === 'new' ? 'Publish report' : 'Save changes'}
            </BtnPrimary>
          </>
        }
      >
        <div className="space-y-9">
          <FieldGroup label="The report">
            <TextField
              label="Title"
              value={form.title}
              onChange={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="The thesis in one declarative sentence."
            />
            <TextField
              label="Description"
              value={form.summary}
              onChange={(v) => setForm((f) => ({ ...f, summary: v }))}
              multiline
              placeholder="Two sentences a PM reads before opening the PDF."
              helper="Runs under the title on every portal card."
            />
          </FieldGroup>

          <FieldGroup label="Coverage">
            {/* Company link — grouped by local / foreign classification */}
            <div className="flex flex-col gap-2">
              <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Stock symbol / company</label>
              <select
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                className="w-full appearance-none border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
              >
                <option value="">No company — macro / multi-name</option>
                {REPORT_COMPANIES.map((g) => {
                  const group = companies.filter((c) => c.type === g.value);
                  return group.length ? (
                    <optgroup key={g.value} label={g.label}>
                      {group.map((c) => <option key={c.id} value={c.id}>{companyLine(c.symbol, c.name)}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </select>
              <p className="text-[12px] leading-relaxed text-graphite">
                Add a name, change its ticker, or reclassify it under Companies in the module header.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Report type</label>
                <select
                  value={form.reportTypeId}
                  onChange={(e) => setForm((f) => ({ ...f, reportTypeId: e.target.value }))}
                  className="w-full appearance-none border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
                >
                  <option value="">Unclassified</option>
                  {reportTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Sector</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as '' | ReportCategory }))}
                  className="w-full appearance-none border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
                >
                  <option value="">No sector — general</option>
                  {REPORT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <RatingPicker value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
          </FieldGroup>

          <FieldGroup label="Publication">
            <div className="grid grid-cols-2 gap-4">
              <DateField
                label="Publication date"
                value={form.date}
                onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                helper="Dates the report in the portal and orders the catalog."
              />
              <TextField
                label="Pages"
                value={form.pages}
                onChange={(v) => setForm((f) => ({ ...f, pages: v.replace(/\D/g, '') }))}
                placeholder="14"
                helper="Optional."
              />
            </div>
            <TextField
              label="Analyst"
              value={form.analyst}
              onChange={(v) => setForm((f) => ({ ...f, analyst: v }))}
              placeholder="C. Sy, CFA"
              helper="Shown as the byline in the client portal."
            />
          </FieldGroup>

          <FieldGroup label="PDF file">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="group flex items-center gap-3 border border-dashed rule bg-white px-4 py-4 text-left transition-colors duration-300 hover:border-[color:var(--color-amber-deep)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center border rule text-graphite group-hover:text-ink">
                  <IconUpload />
                </span>
                <span className="min-w-0">
                  {file ? (
                    <>
                      <span className="block truncate text-[13.5px] text-ink">{file.name}</span>
                      <span className="mono text-[11px] text-graphite">{fmtBytes(file.size)} · click to replace</span>
                    </>
                  ) : editing !== 'new' && editing ? (
                    <>
                      <span className="block truncate text-[13.5px] text-ink">{editing.fileName}</span>
                      <span className="mono text-[11px] text-graphite">Current file · click to replace</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-[13.5px] text-ink">Choose a PDF</span>
                      <span className="mono text-[11px] text-graphite">PDF only · up to ~25 MB</span>
                    </>
                  )}
                </span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </FieldGroup>

          {formError && (
            <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
              {formError}
            </p>
          )}
        </div>
      </Drawer>

      {/* ── Trending Content rules ─────────────────────────────── */}
      <Drawer
        open={trendOpen}
        title="Trending Content rules"
        onClose={() => setTrendOpen(false)}
        footer={
          <>
            <BtnGhost onClick={() => setTrendOpen(false)}>Discard</BtnGhost>
            <BtnPrimary onClick={() => void saveTrending()} disabled={trendSaving}>
              {trendSaving ? 'Saving…' : 'Save rules'}
            </BtnPrimary>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 border rule bg-white p-4">
            <div>
              <p className="text-[13.5px] text-ink">Show Trending Content</p>
              <p className="mt-1 text-[12px] leading-relaxed text-graphite">
                The ranked most-read cards beside Spotlight on the portal dashboard.
              </p>
            </div>
            <Switch
              on={trendForm.enabled}
              onToggle={() => setTrendForm((f) => ({ ...f, enabled: !f.enabled }))}
              label="Show Trending Content"
            />
          </div>

          <SelectField
            label="Ranked by"
            value={trendingMetricDef(trendForm.metric).label}
            onChange={(v) => setTrendForm((f) => ({ ...f, metric: TRENDING_METRICS.find((m) => m.label === v)?.value ?? 'views' }))}
            options={TRENDING_METRICS.map((m) => m.label)}
          />
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Window"
              value={windowLabel(trendForm.windowMonths)}
              onChange={(v) => setTrendForm((f) => ({ ...f, windowMonths: TRENDING_WINDOWS.find((w) => w.label === v)?.value ?? 3 }))}
              options={TRENDING_WINDOWS.map((w) => w.label)}
            />
            <SelectField
              label="Cards"
              value={`Top ${trendForm.limit}`}
              onChange={(v) => setTrendForm((f) => ({ ...f, limit: Number.parseInt(v.replace(/\D/g, ''), 10) || 3 }))}
              options={[3, 4, 5, 6].map((n) => `Top ${n}`)}
            />
          </div>
          <TextField
            label="Minimum to qualify"
            value={trendForm.minEvents}
            onChange={(v) => setTrendForm((f) => ({ ...f, minEvents: v.replace(/\D/g, '') }))}
            placeholder="1"
            helper="A report needs at least this many reads inside the window to take a card — keeps one stray open off the board."
          />

          {/* Dry-run of these rules against the real ledger */}
          <div className="flex flex-col gap-2">
            <div className="mono flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-graphite">
              <span>Preview · live ledger</span>
              {previewBusy && <span className="text-silver">Ranking…</span>}
            </div>
            <div className={`border rule bg-white transition-opacity duration-300 ${previewBusy ? 'opacity-60' : ''}`}>
              {trendPreview === null ? (
                <div className="space-y-3 p-4" aria-hidden>
                  {Array.from({ length: Math.min(trendForm.limit, 3) }).map((_, i) => (
                    <div key={i} className="h-4 skeleton-bar" style={{ width: `${88 - i * 14}%`, animationDelay: `${i * 90}ms` }} />
                  ))}
                </div>
              ) : trendPreview.length === 0 ? (
                <p className="px-4 py-6 text-[12.5px] leading-relaxed text-graphite">
                  Nothing qualifies under these rules yet — widen the window or lower the minimum.
                </p>
              ) : (
                <ul className="divide-y rule">
                  {trendPreview.map((e, i) => {
                    const report = reports.find((r) => r.id === e.reportId);
                    const unit = trendingMetricDef(trendForm.metric).unit[e.count === 1 ? 0 : 1];
                    return (
                      <li key={e.reportId} className="flex items-baseline gap-3 px-4 py-3">
                        <span
                          className="mono num w-7 shrink-0 text-[15px] leading-none"
                          style={{ color: i === 0 ? 'var(--color-amber-deep)' : 'var(--color-silver)' }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                          {report?.title ?? `Report #${e.reportId}`}
                        </span>
                        <span className="mono num shrink-0 text-[10.5px] text-graphite">
                          {e.count} {unit}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-[12px] leading-relaxed text-graphite">
              Exactly what clients would see right now under these rules. Deleted reports drop off on their own.
            </p>
          </div>

          {trendError && (
            <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
              {trendError}
            </p>
          )}
        </div>
      </Drawer>

      {/* ── Companies registry ─────────────────────────────────── */}
      <Drawer
        open={companiesOpen}
        title="Companies"
        onClose={() => { setCompaniesOpen(false); setCompanyEdit(null); }}
        footer={<BtnGhost onClick={() => { setCompaniesOpen(false); setCompanyEdit(null); }}>Done</BtnGhost>}
      >
        <div className="space-y-8">
          {/* Add one name: ticker, company, classification */}
          <div className="space-y-4 border rule bg-white p-4">
            <div className="grid grid-cols-[112px_1fr] gap-3">
              <TextField
                label="Symbol"
                value={companySymbol}
                onChange={(v) => setCompanySymbol(v.toUpperCase())}
                placeholder="ALI"
              />
              <TextField
                label="Company name"
                value={companyName}
                onChange={setCompanyName}
                placeholder="Ayala Land"
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <SelectField
                label="Classification"
                value={companyLabel(companyType)}
                onChange={(v) => setCompanyType(REPORT_COMPANIES.find((c) => c.label === v)?.value ?? 'Local')}
                options={REPORT_COMPANIES.map((c) => c.label)}
              />
              <BtnPrimary onClick={() => void addCompany()} disabled={companyBusy}>
                <IconPlus size={14} /> {companyBusy ? 'Adding…' : 'Add'}
              </BtnPrimary>
            </div>
            {companyError && !companyEdit && (
              <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
                {companyError}
              </p>
            )}
          </div>

          {REPORT_COMPANIES.map((g) => {
            const group = companies.filter((c) => c.type === g.value);
            return (
              <section key={g.value}>
                <header className="mono mb-3 flex items-center gap-2.5 border-b rule pb-3 text-[10px] uppercase tracking-[0.2em] text-graphite">
                  <span aria-hidden className="block h-[2px] w-5" style={{ background: 'var(--color-amber)' }} />
                  {g.label}
                  <span className="num text-silver">{group.length}</span>
                </header>
                {group.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-graphite">None yet — add one above.</p>
                ) : (
                  <ul className="divide-y rule">
                    {group.map((c) => {
                      const count = usage.get(c.id) ?? 0;
                      const open = companyEdit?.id === c.id;
                      return (
                        <li key={c.id} className="py-3">
                          {open && companyEdit ? (
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-[112px_1fr] gap-2">
                                <input
                                  value={companyEdit.symbol}
                                  onChange={(e) => setCompanyEdit({ ...companyEdit, symbol: e.target.value.toUpperCase() })}
                                  placeholder="TICKER"
                                  aria-label="Stock symbol"
                                  className="mono w-full border rule bg-white px-2.5 py-2 text-[12px] uppercase tracking-[0.1em] text-ink outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
                                />
                                <input
                                  value={companyEdit.name}
                                  onChange={(e) => setCompanyEdit({ ...companyEdit, name: e.target.value })}
                                  placeholder="Company name"
                                  aria-label="Company name"
                                  className="w-full border rule bg-white px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={companyEdit.type}
                                  onChange={(e) => setCompanyEdit({ ...companyEdit, type: e.target.value as ReportCompany })}
                                  aria-label="Classification"
                                  className="mono flex-1 appearance-none border rule bg-white px-2.5 py-2 text-[10.5px] uppercase tracking-[0.12em] text-graphite outline-none transition-colors focus:border-[color:var(--color-amber-deep)]"
                                >
                                  {REPORT_COMPANIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <RowAction label="Save company" onClick={() => void saveCompanyEdit()} disabled={companyBusy}>
                                  <IconCheck />
                                </RowAction>
                                <RowAction label="Cancel" onClick={() => { setCompanyEdit(null); setCompanyError(null); }}>
                                  <IconX size={14} />
                                </RowAction>
                              </div>
                              {companyError && (
                                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-warn)' }}>{companyError}</p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2.5">
                                  <span
                                    className="mono shrink-0 text-[11px] uppercase tracking-[0.1em]"
                                    style={{ color: c.symbol ? 'var(--color-ink)' : 'var(--color-silver)' }}
                                  >
                                    {c.symbol ?? '—'}
                                  </span>
                                  <span className="block truncate text-[13.5px] text-ink">{c.name}</span>
                                </span>
                                <span className="mono mt-0.5 block text-[10px] tracking-[0.06em] text-graphite">
                                  {count} {count === 1 ? 'report' : 'reports'}
                                </span>
                              </span>
                              <RowAction
                                label="Edit company"
                                onClick={() => { setCompanyError(null); setCompanyEdit({ id: c.id, name: c.name, symbol: c.symbol ?? '', type: c.type }); }}
                              >
                                <IconPen />
                              </RowAction>
                              <RowAction
                                label={companyArmed === c.id ? 'Confirm delete' : 'Delete company'}
                                danger
                                onClick={() => confirmCompany(c.id, () => { void deleteCompany(c.id); })}
                              >
                                {companyArmed === c.id ? <IconCheck /> : <IconTrash />}
                              </RowAction>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}

          <p className="text-[12px] leading-relaxed text-graphite">
            Editing a name or ticker updates every report already filed under it. Deleting a company keeps its reports and unlinks them — they stay published without a companies filter.
          </p>
        </div>
      </Drawer>

      {/* ── Report-type registry ───────────────────────────────── */}
      <Drawer
        open={typesOpen}
        title="Report types"
        onClose={() => { setTypesOpen(false); setTypeEdit(null); }}
        footer={<BtnGhost onClick={() => { setTypesOpen(false); setTypeEdit(null); }}>Done</BtnGhost>}
      >
        <div className="space-y-8">
          <div className="space-y-4 border rule bg-white p-4">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <TextField
                label="New type"
                value={typeName}
                onChange={setTypeName}
                placeholder="Initiation of Coverage"
              />
              <BtnPrimary onClick={() => void addType()} disabled={typeBusy}>
                <IconPlus size={14} /> {typeBusy ? 'Adding…' : 'Add'}
              </BtnPrimary>
            </div>
            {typeError && !typeEdit && (
              <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
                {typeError}
              </p>
            )}
          </div>

          <section>
            <header className="mono mb-3 flex items-center gap-2.5 border-b rule pb-3 text-[10px] uppercase tracking-[0.2em] text-graphite">
              <span aria-hidden className="block h-[2px] w-5" style={{ background: 'var(--color-amber)' }} />
              Classifications
              <span className="num text-silver">{reportTypes.length}</span>
            </header>
            {reportTypes.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-graphite">None yet — add one above.</p>
            ) : (
              <ul className="divide-y rule">
                {reportTypes.map((t: ReportType) => {
                  const count = typeUsage.get(t.id) ?? 0;
                  const open = typeEdit?.id === t.id;
                  return (
                    <li key={t.id} className="py-3">
                      {open && typeEdit ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <input
                              value={typeEdit.name}
                              onChange={(e) => setTypeEdit({ ...typeEdit, name: e.target.value })}
                              aria-label="Report type name"
                              className="w-full border rule bg-white px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-[color:var(--color-amber-deep)]"
                            />
                            <RowAction label="Save type" onClick={() => void saveTypeEdit()} disabled={typeBusy}>
                              <IconCheck />
                            </RowAction>
                            <RowAction label="Cancel" onClick={() => { setTypeEdit(null); setTypeError(null); }}>
                              <IconX size={14} />
                            </RowAction>
                          </div>
                          {typeError && (
                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-warn)' }}>{typeError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] text-ink">{t.name}</span>
                            <span className="mono mt-0.5 block text-[10px] tracking-[0.06em] text-graphite">
                              {count} {count === 1 ? 'report' : 'reports'}
                            </span>
                          </span>
                          <RowAction
                            label="Rename type"
                            onClick={() => { setTypeError(null); setTypeEdit({ id: t.id, name: t.name }); }}
                          >
                            <IconPen />
                          </RowAction>
                          <RowAction
                            label={typeArmed === t.id ? 'Confirm delete' : 'Delete type'}
                            danger
                            onClick={() => confirmType(t.id, () => { void deleteReportType(t.id); })}
                          >
                            {typeArmed === t.id ? <IconCheck /> : <IconTrash />}
                          </RowAction>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="text-[12px] leading-relaxed text-graphite">
            Renaming a type updates every report filed under it. Deleting one keeps its reports and leaves them unclassified.
          </p>
        </div>
      </Drawer>
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────── */

function CategoryBtn({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mono border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.12em] transition-colors duration-300 active:translate-y-px ${
        active ? 'border-navy bg-navy text-paper' : 'rule bg-transparent text-graphite hover:text-ink'
      }`}
    >
      {label}
      <span className="ml-2 opacity-50">{count}</span>
    </button>
  );
}

/** A titled band of fields inside the editor drawer. */
function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <header className="mono flex items-center gap-2.5 border-b rule pb-3 text-[10px] uppercase tracking-[0.2em] text-graphite">
        <span aria-hidden className="block h-[2px] w-5" style={{ background: 'var(--color-amber)' }} />
        {label}
      </header>
      {children}
    </section>
  );
}

/** The house call as a list mark: a unit square in the rating's colour. */
function RatingMark({ rating }: { rating: ReportRating | null }) {
  if (!rating) return <span className="mono text-[11px] text-silver" title="No rating">—</span>;
  const def = ratingDef(rating);
  return (
    <span
      className="mono inline-flex items-center gap-2 whitespace-nowrap text-[10.5px] uppercase tracking-[0.16em]"
      style={{ color: def.color }}
    >
      <span aria-hidden className="block h-[6px] w-[6px]" style={{ background: def.color }} />
      {def.label}
    </span>
  );
}

/** Buy / Hold / Sell as one segmented control, unrated by default. */
function RatingPicker({ value, onChange }: { value: '' | ReportRating; onChange: (v: '' | ReportRating) => void }) {
  const options: Array<{ value: '' | ReportRating; label: string; color: string | null }> = [
    { value: '', label: 'Not rated', color: null },
    ...REPORT_RATINGS.map((r) => ({ value: r.value as '' | ReportRating, label: r.label, color: r.color })),
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Rating</span>
      <div className="flex" role="group" aria-label="Rating">
        {options.map((o, i) => {
          const on = value === o.value;
          const accent = o.color ?? 'var(--color-navy)';
          return (
            <button
              key={o.value || 'none'}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`mono flex-1 border px-2 py-2.5 text-[10px] uppercase tracking-[0.12em] transition-colors duration-200 active:translate-y-px ${i > 0 ? '-ml-px' : ''} ${
                on ? 'relative z-10' : 'rule bg-white text-graphite hover:text-ink'
              }`}
              style={on ? {
                borderColor: accent,
                color: o.color ?? 'var(--color-ink)',
                background: `color-mix(in oklab, ${accent} 8%, white)`,
              } : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-[12px] leading-relaxed text-graphite">
        Macro and strategy work usually runs unrated.
      </p>
    </div>
  );
}
