import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import {
  BtnGhost, BtnPrimary, Chip, Drawer, EmptyState, ModuleHeader,
  RowAction, SelectField, SkeletonRows, TextField, useConfirm, EASE,
} from '../ui';
import { IconPen, IconPlus, IconSearch, IconTrash, IconCheck, IconUpload, IconEye, IconMenu, IconX } from '../icons';
import { REPORT_CATEGORIES, REPORT_COMPANIES, fmtBytes, fmtDate, type Company, type Report, type ReportCategory, type ReportCompany } from '../data';
import { apiBlobUrl } from '../../lib/api';

type Form = { title: string; category: '' | ReportCategory; companyId: string; analyst: string; pages: string; summary: string };

const BLANK: Form = { title: '', category: '', companyId: '', analyst: '', pages: '', summary: '' };

const companyLabel = (v: ReportCompany) => REPORT_COMPANIES.find((c) => c.value === v)?.label ?? v;

/** Active companies filter: a whole classification, one company, or nothing. */
type CompanySel = { kind: 'type'; type: ReportCompany } | { kind: 'company'; company: Company } | null;

export default function ReportsModule() {
  const { reports, companies, status, createReport, updateReport, deleteReport, createCompany, updateCompany, deleteCompany } = useCms();
  const [category, setCategory] = useState<'all' | 'none' | ReportCategory>('all');
  const [companySel, setCompanySel] = useState<CompanySel>(null);
  const [companiesFilterOpen, setCompaniesFilterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Report | 'new' | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [armed, confirm] = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);

  // Companies manager drawer
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<ReportCompany>('Local');
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyArmed, confirmCompany] = useConfirm();

  const loading = status === 'loading';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter((r) => category === 'all' || (category === 'none' ? r.category === null : r.category === category))
      .filter((r) => {
        if (!companySel) return true;
        if (companySel.kind === 'type') return r.company === companySel.type;
        return r.companyId === companySel.company.id;
      })
      .filter((r) => !q || r.title.toLowerCase().includes(q) || r.analyst.toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q) || (r.companyName ?? '').toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [reports, category, companySel, query]);

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

  const companySelLabel = companySel
    ? companySel.kind === 'type' ? companyLabel(companySel.type) : companySel.company.name
    : null;

  function openEditor(target: Report | 'new') {
    setFormError(null);
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
    if (target === 'new') setForm(BLANK);
    else setForm({ title: target.title, category: target.category ?? '', companyId: target.companyId ?? '', analyst: target.analyst, pages: target.pages ? String(target.pages) : '', summary: target.summary });
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
    if (editing === 'new' && !file) { setFormError('Attach the PDF before publishing.'); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(), category: form.category || null, companyId: form.companyId || null, analyst: form.analyst.trim(),
        pages: Number.parseInt(form.pages, 10) || 0, summary: form.summary.trim(),
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

  async function addCompany() {
    const name = companyName.trim();
    if (!name) { setCompanyError('A company name is required.'); return; }
    setCompanyBusy(true);
    setCompanyError(null);
    try {
      await createCompany({ name, type: companyType });
      setCompanyName('');
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : 'Adding the company failed. Try again.');
    } finally {
      setCompanyBusy(false);
    }
  }

  async function reclassify(c: Company) {
    setCompanyError(null);
    try {
      await updateCompany(c.id, { name: c.name, type: c.type === 'Local' ? 'Foreign' : 'Local' });
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : 'Reclassifying failed. Try again.');
    }
  }

  return (
    <div className="space-y-9">
      <ModuleHeader
        code="02 / Reports"
        title="Research reports"
        blurb="Post PDF research to the client portal. Every report is uploaded as a PDF, filed under a sector, and optionally linked to a covered company — clients filter by local and foreign companies in the portal."
        actions={
          <>
            <BtnGhost onClick={() => { setCompanyError(null); setCompaniesOpen(true); }}>Companies</BtnGhost>
            <BtnPrimary onClick={() => openEditor('new')}><IconPlus size={14} /> Post report</BtnPrimary>
          </>
        }
      />

      {/* Category rail */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          <CategoryBtn active={category === 'all'} label="All" count={reports.length} onClick={() => setCategory('all')} />
          {REPORT_CATEGORIES.map((c) => (
            <CategoryBtn key={c} active={category === c} label={c} count={counts.get(c) ?? 0} onClick={() => setCategory(c)} />
          ))}
          <CategoryBtn active={category === 'none'} label="No sector" count={counts.get('none') ?? 0} onClick={() => setCategory('none')} />
        </div>
        <div className="flex items-stretch gap-3">
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

          <label className="relative block w-full md:w-[320px]">
            <span className="sr-only">Search reports</span>
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, analyst, sector, company…"
              className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
            />
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
                                  <span
                                    className={`block truncate text-[13px] leading-snug transition-colors group-hover/item:text-[color:var(--color-amber-deep)] ${active ? '' : 'text-ink'}`}
                                    style={active ? { color: 'var(--color-amber-deep)' } : undefined}
                                  >
                                    {c.name}
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
          title={query || category !== 'all' || companySel ? 'No reports match those filters.' : 'No reports posted yet.'}
          hint={query || category !== 'all' || companySel ? 'Try a shorter fragment, or clear the sector and companies filters.' : 'Post a PDF and it will appear here and in the client portal immediately.'}
          action={
            query || category !== 'all' || companySel
              ? <BtnGhost onClick={() => { setQuery(''); setCategory('all'); setCompanySel(null); }}>Clear filters</BtnGhost>
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
                  <span className="col-span-6 order-1 min-w-0 md:col-span-2">
                    <span className="mono block truncate text-[10.5px] uppercase tracking-[0.14em] text-graphite">{r.category ?? 'No sector'}</span>
                    <span className="mono mt-1 block truncate text-[9.5px] uppercase tracking-[0.14em] text-silver">
                      {r.companyName ? `${r.companyName} · ${r.company}` : 'No company'}
                    </span>
                  </span>
                  <div className="col-span-12 order-3 md:col-span-5 md:order-2 lg:col-span-4">
                    <p className="text-[15px] leading-snug text-ink">{r.title}</p>
                    <p className="mono mt-1 text-[11px] tracking-[0.04em] text-graphite">
                      {r.fileName} · {fmtBytes(r.fileSize)}{r.pages ? ` · ${r.pages}p` : ''}
                    </p>
                  </div>
                  <span className="col-span-6 order-4 hidden text-[13px] text-slate lg:col-span-2 lg:block">{r.analyst}</span>
                  <span className="mono num col-span-3 order-5 hidden whitespace-nowrap text-[12px] text-graphite lg:col-span-1 lg:block">{fmtDate(r.date)}</span>
                  <span className="col-span-6 order-2 md:col-span-2 md:order-6 md:justify-self-end lg:col-span-1">
                    <Chip tone="amber">PDF</Chip>
                  </span>
                  <div className="col-span-12 order-8 flex items-center gap-2 md:col-span-3 md:justify-end md:justify-self-end lg:col-span-2">
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
        <div className="space-y-6">
          <TextField label="Report title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="The thesis in one declarative sentence." />
          <div className="grid grid-cols-2 gap-4">
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
            <TextField label="Pages" value={form.pages} onChange={(v) => setForm((f) => ({ ...f, pages: v.replace(/\D/g, '') }))} placeholder="14" helper="Optional." />
          </div>

          {/* Company link — grouped by local / foreign classification */}
          <div className="flex flex-col gap-2">
            <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Companies</label>
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
                    {group.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
            <p className="text-[12px] leading-relaxed text-graphite">
              Filed under the company's local / foreign classification in the portal. Add or reclassify names via the Companies button above.
            </p>
          </div>

          <TextField label="Analyst" value={form.analyst} onChange={(v) => setForm((f) => ({ ...f, analyst: v }))} placeholder="C. Sy, CFA" helper="Shown as the byline in the client portal." />
          <TextField label="Summary" value={form.summary} onChange={(v) => setForm((f) => ({ ...f, summary: v }))} multiline placeholder="Two sentences a PM reads before opening the PDF." />

          {/* PDF dropzone */}
          <div className="flex flex-col gap-2">
            <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">PDF file</label>
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

          {formError && (
            <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
              {formError}
            </p>
          )}
        </div>
      </Drawer>

      {/* ── Companies registry ─────────────────────────────────── */}
      <Drawer
        open={companiesOpen}
        title="Companies"
        onClose={() => setCompaniesOpen(false)}
        footer={<BtnGhost onClick={() => setCompaniesOpen(false)}>Done</BtnGhost>}
      >
        <div className="space-y-8">
          {/* Add one company, classified local or foreign */}
          <div className="space-y-4 border rule bg-white p-4">
            <TextField
              label="Company name"
              value={companyName}
              onChange={setCompanyName}
              placeholder="e.g. Ayala Land"
            />
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
            {companyError && (
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
                    {group.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-ink">{c.name}</span>
                          <span className="mono text-[10px] tracking-[0.06em] text-graphite">
                            {(usage.get(c.id) ?? 0)} {usage.get(c.id) === 1 ? 'report' : 'reports'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void reclassify(c)}
                          title={`Reclassify as ${c.type === 'Local' ? 'foreign' : 'local'}`}
                          className="mono shrink-0 border rule px-2.5 py-1.5 text-[9.5px] uppercase tracking-[0.12em] text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:translate-y-px"
                        >
                          → {c.type === 'Local' ? 'Foreign' : 'Local'}
                        </button>
                        <RowAction
                          label={companyArmed === c.id ? 'Confirm delete' : 'Delete company'}
                          danger
                          onClick={() => confirmCompany(c.id, () => { void deleteCompany(c.id); })}
                        >
                          {companyArmed === c.id ? <IconCheck /> : <IconTrash />}
                        </RowAction>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <p className="text-[12px] leading-relaxed text-graphite">
            Deleting a company keeps its reports and unlinks them — they stay published without a companies filter.
          </p>
        </div>
      </Drawer>
    </div>
  );
}

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
