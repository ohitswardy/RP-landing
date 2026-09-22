import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms, type CareerPayload } from '../store';
import {
  BtnGhost, BtnPrimary, Chip, DateField, Drawer, EmptyState, ModuleHeader,
  RowAction, SelectField, SkeletonRows, Stat, Switch, TextField, useConfirm, EASE,
} from '../ui';
import { IconCheck, IconExternal, IconEye, IconEyeOff, IconPen, IconPlus, IconSearch, IconTrash } from '../icons';
import { Field } from '../kit/parts';
import RichTextField from '../kit/RichTextField';
import {
  CAREER_STATUS, CAREER_TYPES, fmtDate,
  type Career, type CareerStatus, type CareerType,
} from '../data';

/* ─────────────────────────────────────────────────────────────
   Postings on the public /careers page. Open postings are live;
   closed ones stay on file with their applicant tally. Postings
   are created open and stamped with today's date by the API.
   ───────────────────────────────────────────────────────────── */

const FILTERS: Array<'all' | CareerStatus> = ['all', 'open', 'closed'];

type DraftForm = {
  title: string; dept: string; type: CareerType; location: string;
  summary: string; body: string; status: CareerStatus;
};

const today = () => new Date().toISOString().slice(0, 10);

const BLANK = (): DraftForm => ({
  title: '', dept: '', type: 'Full-time', location: 'Makati City', summary: '', body: '', status: 'open',
});

const LIMITS = { title: 500, dept: 60, location: 120, summary: 1000 } as const;

/** Everything the API would reject, phrased the way an editor thinks about it. */
function validate(f: DraftForm): string | null {
  if (!f.title.trim()) return 'The posting needs a title.';
  if (f.title.length > LIMITS.title) return `The title is over ${LIMITS.title} characters.`;
  if (!f.dept.trim()) return 'Name the desk or department the role sits in.';
  if (f.dept.length > LIMITS.dept) return `The department is over ${LIMITS.dept} characters.`;
  if (!f.location.trim()) return 'Give the posting a location.';
  if (f.location.length > LIMITS.location) return `The location is over ${LIMITS.location} characters.`;
  if (f.summary.length > LIMITS.summary) return `The summary is over ${LIMITS.summary.toLocaleString()} characters.`;
  return null;
}

export default function CareersModule() {
  const { careers, status, addCareer, updateCareer, deleteCareer } = useCms();

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Career | 'new' | null>(null);
  const [form, setForm] = useState<DraftForm>(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();

  const loading = status === 'loading';

  const open = useMemo(() => careers.filter((c) => c.status === 'open'), [careers]);
  const applicants = useMemo(() => careers.reduce((n, c) => n + c.applicants, 0), [careers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return careers
      .filter((c) => filter === 'all' || c.status === filter)
      .filter((c) => !q
        || c.title.toLowerCase().includes(q)
        || c.dept.toLowerCase().includes(q)
        || c.location.toLowerCase().includes(q)
        || c.type.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.posted.localeCompare(a.posted) || Number(b.id) - Number(a.id));
  }, [careers, filter, query]);

  function openEditor(target: Career | 'new') {
    setFormError(null);
    if (target === 'new') setForm(BLANK());
    else setForm({
      title: target.title, dept: target.dept, type: target.type, location: target.location,
      summary: target.summary, body: target.body, status: target.status,
    });
    setEditing(target);
  }

  async function save() {
    const problem = validate(form);
    if (problem) { setFormError(problem); return; }

    const payload: CareerPayload = {
      title: form.title.trim(), dept: form.dept.trim(), type: form.type, location: form.location.trim(),
      summary: form.summary.trim(), body: form.body,
    };
    setSaving(true);
    try {
      if (editing === 'new') await addCareer(payload);
      else if (editing) await updateCareer(editing.id, { ...payload, status: form.status });
      setEditing(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleStatus(c: Career) {
    setRowError(null);
    void updateCareer(c.id, { status: c.status === 'open' ? 'closed' : 'open' }).catch((e: unknown) => {
      setRowError(e instanceof Error ? e.message : 'The posting could not be changed.');
    });
  }

  function remove(c: Career) {
    setRowError(null);
    void deleteCareer(c.id).catch((e: unknown) => {
      setRowError(e instanceof Error ? e.message : 'The posting could not be deleted.');
    });
  }

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="11 / Careers"
        title="Careers"
        blurb="Every role on the public /careers page. Open postings are live the moment they are saved; closing one keeps it on file with its applicant tally, off the page."
        actions={
          <>
            <a
              href="/careers"
              target="_blank"
              rel="noreferrer"
              className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
            >
              View on site <IconExternal size={12} />
            </a>
            <BtnPrimary onClick={() => openEditor('new')}><IconPlus size={14} /> New posting</BtnPrimary>
          </>
        }
      />

      {!loading && careers.length > 0 && (
        <div className="grid grid-cols-3 gap-6 border-b rule pb-8">
          <Stat value={String(open.length)} label="Open" />
          <Stat value={String(careers.length - open.length)} label="Closed" />
          <Stat value={applicants.toLocaleString('en-PH')} label="Applicants" />
        </div>
      )}

      {/* Filter rail */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`mono border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
                filter === f ? 'border-navy bg-navy text-paper' : 'rule bg-transparent text-graphite hover:text-ink'
              }`}
            >
              {f}
              <span className="ml-2 opacity-50">
                {f === 'all' ? careers.length : careers.filter((c) => c.status === f).length}
              </span>
            </button>
          ))}
        </div>
        <label className="relative block w-full md:w-[260px]">
          <span className="sr-only">Search postings</span>
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, desk, location…"
            className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
        </label>
      </div>

      {rowError && (
        <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
          {rowError}
        </p>
      )}

      {/* Ledger */}
      {loading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={query ? 'Nothing matches that search.' : careers.length === 0 ? 'No postings yet.' : 'No postings in this state.'}
          hint={query
            ? 'Search covers the title, department, location, and contract type.'
            : 'A posting goes live on /careers the moment it is saved open. Close it to take it down without losing the record.'}
          action={query || filter !== 'all'
            ? <BtnGhost onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</BtnGhost>
            : <BtnPrimary onClick={() => openEditor('new')}><IconPlus size={14} /> New posting</BtnPrimary>}
        />
      ) : (
        <ul className="divide-y rule border-y rule">
          <AnimatePresence initial={false}>
            {rows.map((c, i) => {
              const st = CAREER_STATUS[c.status];
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: Math.min(i * 0.04, 0.3) } }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
                >
                  <div className="grid grid-cols-12 items-center gap-x-4 gap-y-2 py-5">
                    <span className="mono col-span-6 order-1 truncate text-[10.5px] uppercase tracking-[0.16em] text-graphite md:col-span-2 lg:col-span-1">{c.dept}</span>
                    <div className="col-span-12 order-3 md:col-span-5 md:order-2 lg:col-span-4">
                      <p className="text-[15px] leading-snug text-ink">{c.title}</p>
                      {c.summary && <p className="mt-1 line-clamp-1 text-[12.5px] text-graphite">{c.summary}</p>}
                    </div>
                    <span className="col-span-6 order-4 hidden text-[13px] text-slate lg:col-span-2 lg:block">
                      {c.type}
                      <span className="mono mt-0.5 block truncate text-[10.5px] uppercase tracking-[0.12em] text-graphite">{c.location}</span>
                    </span>
                    <span className="mono num col-span-3 order-5 hidden whitespace-nowrap text-[12px] text-graphite lg:col-span-1 lg:block">{fmtDate(c.posted)}</span>
                    <span className="mono num col-span-2 order-6 hidden text-right text-[12px] text-graphite xl:col-span-1 xl:block" title="Applicants">
                      {c.applicants.toLocaleString('en-PH')}
                    </span>
                    <span className="col-span-6 order-2 md:col-span-2 md:order-7 md:justify-self-end lg:col-span-1">
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </span>
                    <div className="col-span-12 order-8 flex items-center gap-1.5 md:col-span-3 md:justify-end md:justify-self-end xl:col-span-2">
                      <RowAction label={c.status === 'open' ? 'Close posting' : 'Reopen posting'} onClick={() => toggleStatus(c)}>
                        {c.status === 'open' ? <IconEyeOff /> : <IconEye />}
                      </RowAction>
                      <RowAction label="Edit posting" onClick={() => openEditor(c)}><IconPen /></RowAction>
                      <RowAction label={armed === c.id ? 'Confirm delete' : 'Delete posting'} danger onClick={() => confirm(c.id, () => remove(c))}>
                        {armed === c.id ? <IconCheck /> : <IconTrash />}
                      </RowAction>
                      {armed === c.id && (
                        <span className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--color-warn)' }}>sure?</span>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Editor */}
      <Drawer
        open={editing !== null}
        title={editing === 'new' ? 'New posting' : 'Edit posting'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <BtnGhost onClick={() => setEditing(null)}>Discard</BtnGhost>
            <BtnPrimary onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editing === 'new' ? 'Publish posting' : 'Save changes'}
            </BtnPrimary>
          </>
        }
      >
        <div className="space-y-6">
          <TextField
            label="Title"
            value={form.title}
            onChange={(v) => { setFormError(null); setForm((f) => ({ ...f, title: v })); }}
            placeholder="Equity Research Associate"
            error={formError ?? undefined}
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Department" value={form.dept} onChange={(v) => { setFormError(null); setForm((f) => ({ ...f, dept: v })); }} placeholder="Research" />
            <SelectField label="Contract" value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v as CareerType }))} options={CAREER_TYPES} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Location" value={form.location} onChange={(v) => { setFormError(null); setForm((f) => ({ ...f, location: v })); }} placeholder="Makati City" />
            <DateField
              label="Posted"
              value={editing && editing !== 'new' ? editing.posted : today()}
              onChange={() => undefined}
              disabled
              clearable={false}
              hint={editing === 'new' ? 'Stamped today by the API' : 'Set when the posting was created'}
            />
          </div>

          <Field
            label="Summary"
            value={form.summary}
            max={LIMITS.summary}
            multiline
            rows={3}
            onChange={(v) => { setFormError(null); setForm((f) => ({ ...f, summary: v })); }}
            placeholder="One paragraph on the card: the desk, the seat, what a strong first year looks like."
            hint="Shown on the /careers card and above the full posting."
          />

          <RichTextField
            label="Posting"
            value={form.body}
            onChange={(html) => setForm((f) => ({ ...f, body: html }))}
            rows={10}
            hint="The full role description: responsibilities, what we look for, how to apply."
          />

          {editing !== 'new' && (
            <div className="flex items-start justify-between gap-4 border-t rule pt-6">
              <div className="min-w-0">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Open on the site</div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate">
                  Closed postings leave /careers but keep their record and applicant count here.
                </p>
              </div>
              <div className="pt-0.5">
                <Switch
                  on={form.status === 'open'}
                  onToggle={() => setForm((f) => ({ ...f, status: f.status === 'open' ? 'closed' : 'open' }))}
                  label="Open on the site"
                />
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
