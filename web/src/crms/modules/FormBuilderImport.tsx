import { useMemo, useRef, useState, type DragEvent } from 'react';
import { BtnGhost, BtnPrimary, Chip, SelectField, Switch, TextField } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconUpload } from '../../cms/icons';
import { FormError, Tabs } from '../kit/fields';
import { fieldFromColumn, inferColumns, readWorkbook, SHEET_ACCEPT, slugName, type Column, type Workbook } from '../kit/sheet';
import type { FieldSchema, FieldType } from '../data';

/* ─────────────────────────────────────────────────────────────
   "Import columns" for the form builder: drop a CSV/XLSX the
   client already uses, tick the columns that should become
   fields (from any of its tabs), adjust label / name / type,
   and add them to the form. Everything is read in the browser;
   the file never leaves it.
   ───────────────────────────────────────────────────────────── */

const TYPE_LABEL: Record<FieldType, string> = { textBox: 'Text', textArea: 'Long text', select: 'Select', date: 'Date', number: 'Number' };
const TYPE_BY_LABEL = Object.fromEntries(Object.entries(TYPE_LABEL).map(([k, v]) => [v, k as FieldType])) as Record<string, FieldType>;

type Draft = Column & { picked: boolean; label: string; fieldType: FieldType };

export default function FormBuilderImport({ onClose, onAdd, existing, known, hasFields }: {
  /** The parent mounts this only while it should be open; closing unmounts it. */
  onClose: () => void;
  /** Append (or, when `replace`, swap in) the chosen fields. */
  onAdd: (fields: FieldSchema[], replace: boolean) => void;
  /** Internal names already on the form: their columns start unticked and are flagged. */
  existing: string[];
  /** Internal names the consumption reports read. */
  known: string[];
  hasFields: boolean;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<Workbook | null>(null);
  /** One draft list per tab, in workbook order. */
  const [drafts, setDrafts] = useState<Draft[][]>([]);
  const [tab, setTab] = useState(0);
  const [replace, setReplace] = useState(false);

  async function accept(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const wb = await readWorkbook(file);
      setBook(wb);
      setTab(0);
      // Nothing is pre-ticked on a multi-tab workbook: the user says which tabs matter. Formula columns never are.
      const pre = wb.sheets.length === 1;
      setDrafts(wb.sheets.map((s) => inferColumns(s).map((c) => ({ ...c, picked: pre && s.kind === 'table' && !c.formula && !existing.includes(c.internalName), label: c.header, fieldType: c.suggested }))));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.');
    } finally { setBusy(false); }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setHover(false);
    void accept(e.dataTransfer.files?.[0]);
  }

  const patch = (i: number, p: Partial<Draft>) => setDrafts((all) => all.map((ds, t) => (t === tab ? ds.map((d, k) => (k === i ? { ...d, ...p } : d)) : ds)));
  /** "All" leaves empty and formula columns alone; they can still be ticked one by one. */
  const setAll = (picked: boolean) => setDrafts((all) => all.map((ds, t) => (t === tab ? ds.map((d) => ({ ...d, picked: picked && d.filled > 0 && !d.formula })) : ds)));

  const current = drafts[tab] ?? [];
  const sheet = book?.sheets[tab];
  const notes = sheet?.kind === 'notes';

  /* Internal names must be unique on the saved form (the reports read by name). The same
     header on two tabs is normal — "Meeting Type" on Data and on Lookup — so a name chosen
     on more than one tab is prefixed with its tab, and only a repeat within one tab blocks. */
  const effective = useMemo<string[][]>(() => {
    const tabsByName = new Map<string, Set<number>>();
    drafts.forEach((ds, t) => ds.forEach((d) => {
      if (!d.picked || !d.internalName) return;
      const tabsUsing = tabsByName.get(d.internalName) ?? new Set<number>();
      tabsUsing.add(t);
      tabsByName.set(d.internalName, tabsUsing);
    }));
    const tabSlug = (t: number) => slugName(book?.sheets[t]?.name ?? '') || `tab${t + 1}`;
    return drafts.map((ds, t) => ds.map((d) => ((tabsByName.get(d.internalName)?.size ?? 0) > 1 ? `${tabSlug(t)}_${d.internalName}` : d.internalName)));
  }, [drafts, book]);

  /** Chosen columns across every tab, in tab order, so the form reads top to bottom the way the workbook does. */
  const picked = useMemo(() => drafts.flatMap((ds, t) => ds.map((d, i) => ({ ...d, internalName: effective[t]?.[i] ?? d.internalName })).filter((d) => d.picked)), [drafts, effective]);
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const d of picked) seen.set(d.internalName, (seen.get(d.internalName) ?? 0) + 1);
    return new Set(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k));
  }, [picked]);
  const clashes = replace ? new Set<string>() : new Set(picked.map((d) => d.internalName).filter((n) => existing.includes(n)));

  /* What stops the add, per tab, so a problem on a tab that is not on screen is still explained. */
  type Problem = { tab: number; index: number; name: string; why: 'clash' | 'dupe' | 'blank' };
  const problems = useMemo<Problem[]>(() => {
    const out: Problem[] = [];
    drafts.forEach((ds, t) => ds.forEach((d, i) => {
      if (!d.picked) return;
      const name = effective[t]?.[i] ?? d.internalName;
      if (!d.label.trim() || !name) out.push({ tab: t, index: i, name: name || d.header, why: 'blank' });
      else if (clashes.has(name)) out.push({ tab: t, index: i, name, why: 'clash' });
      else if (duplicates.has(name)) out.push({ tab: t, index: i, name, why: 'dupe' });
    }));
    return out;
  }, [drafts, effective, clashes, duplicates]);
  const blocked = picked.length === 0 || problems.length > 0;
  const tabs = (book?.sheets ?? []).map((s, i) => ({ id: String(i), label: s.kind === 'notes' ? `${s.name} · notes` : s.name, count: (drafts[i] ?? []).filter((d) => d.picked).length || undefined }));
  const untickProblems = () => setDrafts((all) => all.map((ds, t) => ds.map((d, i) => (problems.some((p) => p.tab === t && p.index === i) ? { ...d, picked: false } : d))));

  function reset() { setBook(null); setDrafts([]); setTab(0); setError(null); setReplace(false); }
  const close = onClose;
  function add() {
    // The button stays clickable: a click with problems jumps to the first one instead of doing nothing.
    if (problems.length > 0) { setTab(problems[0].tab); return; }
    if (blocked) return;
    onAdd(picked.map((d, i) => fieldFromColumn(d, d.fieldType, i + 1)), replace);
    close();
  }

  return (
    <Modal
      open
      wide
      title={book ? `Import columns · ${book.file}` : 'Import columns from a spreadsheet'}
      onClose={close}
      footer={book ? (
        <>
          <BtnGhost onClick={reset}>Choose another file</BtnGhost>
          <BtnPrimary onClick={add} disabled={picked.length === 0}>{picked.length === 0 ? 'Add fields' : `Add ${picked.length} field${picked.length === 1 ? '' : 's'}`}</BtnPrimary>
        </>
      ) : <BtnGhost onClick={close}>Cancel</BtnGhost>}
    >
      {!book || !sheet ? (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setHover(true); }}
            onDragLeave={() => setHover(false)}
            onDrop={onDrop}
            className="grid place-items-center border border-dashed px-8 py-14 text-center transition-colors duration-300"
            style={{
              borderColor: hover ? 'var(--color-amber-deep)' : 'color-mix(in oklab, var(--color-ink) 18%, transparent)',
              background: hover ? 'color-mix(in oklab, var(--color-amber) 7%, transparent)' : 'var(--color-bone)',
            }}
          >
            <input ref={input} type="file" accept={SHEET_ACCEPT} className="hidden" onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="flex flex-col items-center gap-4">
              <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
              <p className="text-[14.5px] text-ink">{busy ? 'Reading…' : 'Drop the client’s spreadsheet here'}</p>
              <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-graphite">
                CSV or Excel (.xlsx) up to 5 MB; every tab of a workbook is read. The first row of each tab becomes the field labels and the values underneath suggest each field’s type. Nothing is uploaded; the file is read in your browser.
              </p>
              <BtnPrimary onClick={() => input.current?.click()} disabled={busy}><IconUpload size={13} /> Choose file</BtnPrimary>
            </div>
          </div>
          <FormError message={error} />
        </div>
      ) : (
        <div className="space-y-5">
          {book.sheets.length > 1 && <Tabs tabs={tabs} value={String(tab)} onChange={(id) => setTab(Number(id))} label="Workbook tabs" />}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="mono text-[10.5px] uppercase tracking-[0.16em] text-graphite">
              {book.sheets.length > 1 && <><span className="text-ink">{sheet.name}</span> · </>}
              {current.length} columns · {sheet.rows.length} rows read · <span className="text-ink">{picked.length} selected{book.sheets.length > 1 ? ' across tabs' : ''}</span>
            </p>
            <span className="flex items-center gap-2">
              <BtnGhost onClick={() => setAll(true)} disabled={notes}>All</BtnGhost>
              <BtnGhost onClick={() => setAll(false)}>None</BtnGhost>
            </span>
          </div>

          {notes && (
            <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed text-graphite" style={{ borderColor: 'var(--color-silver)' }}>
              This tab reads as instructions rather than a table, so nothing on it is ticked by default. Tick a column yourself if it really is a field.
            </p>
          )}

          {problems.length > 0 && (
            <div className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)' }}>
              <p className="text-ink">
                {problems.length === 1 ? 'One column' : `${problems.length} columns`} can’t be added as chosen:
              </p>
              <ul className="mt-1 space-y-0.5 text-graphite">
                {problems.slice(0, 6).map((p) => (
                  <li key={`${p.tab}-${p.index}`}>
                    <button type="button" className="mono text-[11px] text-ink underline-offset-2 hover:underline" onClick={() => setTab(p.tab)}>{p.name}</button>
                    {' '}on <span className="text-ink">{book.sheets[p.tab]?.name}</span>
                    {p.why === 'clash' ? ' is already on the form' : p.why === 'dupe' ? ' is chosen twice on that tab' : ' needs a label and an internal name'}
                  </li>
                ))}
                {problems.length > 6 && <li>…and {problems.length - 6} more.</li>}
              </ul>
              <p className="mt-1.5 text-graphite">Rename them on their tab, or <button type="button" className="text-ink underline underline-offset-2" onClick={untickProblems}>leave those columns out</button>.</p>
            </div>
          )}

          {hasFields && (
            <label className="flex items-center gap-2.5 text-[12.5px] text-slate">
              <Switch on={replace} onToggle={() => setReplace(!replace)} label="Replace the current fields" />
              Replace the current fields instead of adding to them
            </label>
          )}

          <ul className="divide-y rule border-y rule">
            {current.map((d, i) => {
              const name = effective[tab]?.[i] ?? d.internalName;
              const prefixed = d.picked && name !== d.internalName;
              const clash = !replace && d.picked && existing.includes(name);
              const dupe = d.picked && duplicates.has(name);
              return (
                <li key={d.index} className={`py-4 transition-opacity duration-300 ${d.picked ? '' : 'opacity-55'}`}>
                  <div className="flex items-start gap-4">
                    <div className="pt-1"><Switch on={d.picked} onToggle={() => patch(i, { picked: !d.picked })} label={`Include ${d.header}`} /></div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="mono text-[10px] uppercase tracking-[0.16em] text-graphite">Column {String(d.index + 1).padStart(2, '0')} · <span className="text-ink">{d.header}</span></span>
                        {known.includes(name) && <Chip tone="live">Read by reports</Chip>}
                        {d.source === 'dropdown' && <Chip tone="live">Dropdown in the sheet</Chip>}
                        {d.formula && <Chip tone="muted">Formula column</Chip>}
                        {prefixed && <Chip tone="muted">Also on another tab</Chip>}
                        {clash && <Chip tone="amber">Already on the form</Chip>}
                        {dupe && <Chip tone="warn">Duplicate on this tab</Chip>}
                        {d.filled === 0 && <Chip tone="muted">Empty column</Chip>}
                      </div>
                      {d.picked && (
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_150px]">
                          <TextField label="Label" value={d.label} onChange={(v) => patch(i, { label: v, header: v, internalName: d.internalName && d.internalName !== slugName(d.label) ? d.internalName : slugName(v) })} />
                          <TextField label="Internal name" value={d.internalName} onChange={(v) => patch(i, { internalName: slugName(v) })}
                            helper={prefixed && !clash && !dupe ? `Added as ${name}, since another tab uses this name too.` : undefined}
                            error={clash ? `A field named ${name} is already on the form.` : dupe ? 'Two chosen columns on this tab share this name.' : undefined} />
                          <SelectField label="Type" value={TYPE_LABEL[d.fieldType]} onChange={(v) => patch(i, { fieldType: TYPE_BY_LABEL[v] ?? 'textBox' })} options={Object.values(TYPE_LABEL)} />
                        </div>
                      )}
                      <p className="mono truncate text-[11px] text-graphite">
                        {d.formula
                          ? 'a formula in every row · not captured data'
                          : d.picked && d.fieldType === 'select' && d.choices.length > 0
                            ? `${d.choices.length} choice${d.choices.length === 1 ? '' : 's'}${d.source === 'dropdown' ? ' from the dropdown' : ''}: ${d.choices.join(' · ')}`
                            : d.filled === 0
                              ? 'no values'
                              : `${d.samples.join(' · ')}${d.distinct > d.samples.length ? ` · +${d.distinct - d.samples.length} more` : ''}`}
                        {!d.formula && d.blank > 0 && d.filled > 0 && <span className="text-silver"> · {d.blank} blank</span>}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[12px] leading-relaxed text-graphite">
            A column with a dropdown in the sheet becomes a select with exactly those choices; otherwise a column whose values repeat becomes a select listing those values, numbers and dates get their own types, and long prose becomes long text. Change any of it before adding, and again on the form afterwards.
            {book.sheets.length > 1 && ' Columns ticked on other tabs are kept and added together, in tab order; a name used on more than one tab is prefixed with its tab so every field stays distinct.'}
          </p>
        </div>
      )}
    </Modal>
  );
}
