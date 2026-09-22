import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { BtnGhost, BtnPrimary, Chip, SelectField, TextField } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconUpload } from '../../cms/icons';
import { apiFetch } from '../../lib/api';
import { FormError, Picker, Tabs } from '../kit/fields';
import { errorText, useToast } from '../kit/toast';
import { parseXlsx, type Grid } from '../kit/sheet';
import {
  colLetters, detectDataSheet, detectFlavor, detectHeaderRow, fieldsForClient, formatOptions, normalizeHeader, SCOPE_LABELS, seedColumns,
  sourceOptions, suggestCells, titleFromFilename, type ColumnSeed, type Flavor, type LayoutCell, type LayoutColumn, type LayoutScope,
} from '../kit/layout';
import { useCrms } from '../store';
import type { AuditEntry, ReportLayout, ReportSource, ReportTemplate } from '../data';

/* ─────────────────────────────────────────────────────────────
   Import a client's own Excel report template. The workbook is
   read in the browser to find the data tab, the header row and
   the columns; each column is matched to a CRMS data source the
   operator can change, with live values from the client's latest
   interactions to check against. On save the original workbook
   and the map go to the API; at report time the workbook is
   filled in place, so every other tab, style and rule the client
   put in the file comes back exactly as uploaded.
   ───────────────────────────────────────────────────────────── */

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Step = 'file' | 'layout' | 'columns';
type Book = { file: File; grids: Grid[]; flavor: Flavor };
type Preview = { rows: string[][]; total: number };

export default function ReportLayoutImport({ clientId: initialClient, onClose }: {
  /** The client the template is for; null lets the operator pick one (Reports module entry). */
  clientId: string | null;
  /** The parent mounts this only while it should be open; closing unmounts it. */
  onClose: () => void;
}) {
  const { clients, forms, meta, reportTemplates, put, appendAudit } = useCrms();
  const { notify } = useToast();
  const sources = meta.reportSources;

  const [client, setClient] = useState<string | null>(initialClient);
  const existing = useMemo(() => reportTemplates.find((t) => t.clientId === client) ?? null, [reportTemplates, client]);
  const fields = useMemo(() => fieldsForClient(forms, client, meta.genericClientId), [forms, client, meta.genericClientId]);

  const [book, setBook] = useState<Book | null>(null);
  const [step, setStep] = useState<Step>('file');
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [dataStart, setDataStart] = useState(2);
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<LayoutScope>('client');
  const [seeds, setSeeds] = useState<ColumnSeed[]>([]);
  const [cells, setCells] = useState<LayoutCell[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const grid = book?.grids[sheetIdx] ?? null;

  /* ── 1. The file ─────────────────────────────────────────── */

  async function accept(file: File | undefined) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { setError('Excel workbooks (.xlsx) only. Save the template as .xlsx first.'); return; }
    if (file.size > MAX_BYTES) { setError('Workbooks up to 10 MB only.'); return; }
    setBusy(true); setError(null);
    try {
      const grids = await parseXlsx(await file.arrayBuffer());
      if (grids.length === 0) throw new Error('The workbook has no worksheet to read.');
      const flavor = detectFlavor(grids);
      const idx = detectDataSheet(grids);
      const next: Book = { file, grids, flavor };
      setBook(next);
      applySheet(next, idx, existing?.layout ?? null);
      setTitle(existing?.layout?.title ?? titleFromFilename(file.name));
      // The Jefferies client's workbook is the co-brand upload: it lists the whole foreign book, whichever client is picked.
      setScope(existing?.layout?.scope ?? (client !== null && client === meta.jefferies.clientId ? 'foreign' : 'client'));
      setStep('layout');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The workbook could not be read.');
    } finally { setBusy(false); }
  }

  /** Re-detect rows and columns for a tab; an existing map for the same headers is carried over. */
  function applySheet(b: Book, idx: number, prior: ReportLayout | null, rows?: { headerRow: number; dataStart: number }) {
    const g = b.grids[idx];
    const detected = rows ?? (prior && prior.sheet === g.name ? { headerRow: prior.headerRow, dataStart: prior.dataStart } : detectHeaderRow(g));
    setSheetIdx(idx);
    setHeaderRow(detected.headerRow);
    setDataStart(detected.dataStart);
    const fresh = seedColumns(g, detected.headerRow, detected.dataStart, { flavor: b.flavor, sources, fields });
    setSeeds(prior ? carryOver(fresh, prior.columns, sources) : fresh);
    setCells(prior && prior.sheet === g.name && prior.cells.length ? prior.cells : suggestCells(g, detected.headerRow));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setHover(false);
    void accept(e.dataTransfer.files?.[0]);
  }

  /** Edit the stored map without re-uploading the workbook. */
  function editExisting() {
    const layout = existing?.layout;
    if (!layout) return;
    const byKey = new Map(sources.map((s) => [s.key, s]));
    setSeeds(layout.columns.map((c) => {
      const src = byKey.get(c.source);
      return { column: { ...c }, sample: '', kind: src?.kind ?? 'text', multi: src?.multi ?? false, formula: c.source === 'formula' };
    }));
    setCells(layout.cells);
    setTitle(layout.title ?? '');
    setScope(layout.scope);
    setHeaderRow(layout.headerRow);
    setDataStart(layout.dataStart);
    setStep('columns');
  }

  /* ── 2. Live values from the system ──────────────────────── */

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const columns = useMemo(() => seeds.map((s) => s.column), [seeds]);
  useEffect(() => {
    if (step !== 'columns' || !client) return;
    const live = columns.filter((c) => c.source !== 'blank' && c.source !== 'formula');
    if (live.length === 0) { setPreview({ rows: [], total: 0 }); return; }
    const handle = window.setTimeout(() => {
      setPreviewBusy(true);
      apiFetch<Preview>('/crms/report-templates/layout/preview', { method: 'POST', audience: 'cms', body: { clientId: Number(client), scope, columns: live, limit: 3 } })
        .then((p) => setPreview({ total: p.total, rows: p.rows.map((row) => {
          // Re-spread onto the full column list so the preview lines up with what is on screen.
          const out = new Array<string>(columns.length).fill('');
          live.forEach((c, k) => { out[columns.findIndex((x) => x.index === c.index)] = row[k] ?? ''; });
          return out;
        }) }))
        .catch(() => setPreview(null))
        .finally(() => setPreviewBusy(false));
    }, 500);
    return () => window.clearTimeout(handle);
  }, [step, client, scope, columns]);

  /* ── 3. Save ─────────────────────────────────────────────── */

  const mapped = seeds.filter((s) => s.column.source !== 'blank').length;
  const canSave = !!client && (book !== null || existing?.layout !== null) && seeds.length > 0 && !saving;

  async function save() {
    if (!client) { setError('Pick the client this template is for.'); return; }
    if (!book && !existing?.layout) { setError('Choose the Excel template to import.'); return; }
    setSaving(true); setError(null);
    try {
      const sheet = book ? book.grids[sheetIdx].name : existing?.layout?.sheet ?? 'Data';
      const layout = { title: title.trim() || null, sheet, headerRow, dataStart, scope, columns: seeds.map((s) => s.column), cells };
      const fd = new FormData();
      fd.append('clientId', client);
      if (book) fd.append('file', book.file, book.file.name);
      fd.append('layout', JSON.stringify(layout));
      const res = await apiFetch<{ item: ReportTemplate; audit?: AuditEntry }>('/crms/report-templates/layout', { method: 'POST', formData: fd, audience: 'cms' });
      put('reportTemplates', res.item);
      appendAudit(res.audit);
      notify(book ? 'Template imported.' : 'Template mapping saved.');
      onClose();
    } catch (e) {
      setError(errorText(e, 'The template could not be saved.'));
    } finally { setSaving(false); }
  }

  /* ── Rendering ───────────────────────────────────────────── */

  const clientName = clients.find((c) => c.id === client)?.name ?? null;
  const patchSeed = (i: number, p: Partial<LayoutColumn>) => setSeeds((all) => all.map((s, k) => {
    if (k !== i) return s;
    const column = { ...s.column, ...p };
    const src = sources.find((x) => x.key === column.source);
    // A new source may need a different write shape: reset separator / format to sensible defaults for it.
    if (p.source !== undefined && p.source !== s.column.source) {
      column.text = p.source === 'const' ? (s.column.text ?? '') : null;
      column.format = src?.kind === 'date' ? (s.kind === 'date' ? s.column.format : 'yyyy-mm-dd') : src?.kind === 'time' ? (s.kind === 'time' ? s.column.format : 'hh:mm') : null;
    }
    return { ...s, column, kind: src?.kind ?? 'text', multi: src?.multi ?? false };
  }));

  const options = useMemo(() => sourceOptions(sources, fields), [sources, fields]);
  const footer = step === 'file'
    ? <><BtnGhost onClick={onClose}>Cancel</BtnGhost>{existing?.layout && <BtnPrimary onClick={editExisting}>Edit the current mapping</BtnPrimary>}</>
    : step === 'layout'
      ? <><BtnGhost onClick={() => { setBook(null); setStep('file'); }}>Choose another file</BtnGhost><BtnPrimary onClick={() => setStep('columns')} disabled={!grid || dataStart <= headerRow}>Map the columns</BtnPrimary></>
      : <>
        <BtnGhost onClick={() => setStep(book ? 'layout' : 'file')}>{book ? 'Back to layout' : 'Back'}</BtnGhost>
        <BtnPrimary onClick={() => void save()} disabled={!canSave}>{saving ? 'Saving…' : book ? 'Import template' : 'Save mapping'}</BtnPrimary>
      </>;

  return (
    <Modal open wide title={book ? `Import template · ${book.file.name}` : existing?.layout && step === 'columns' ? `Template mapping · ${existing.layout.file ?? clientName ?? ''}` : 'Import an Excel report template'} onClose={onClose} footer={footer}>
      <div className="space-y-5">
        {initialClient === null && (
          <Picker label="Client" options={clients.map((c) => ({ id: c.id, label: c.name, hint: c.region }))} value={client} onChange={(v) => { setClient(v); }} hint="the template belongs to" />
        )}

        {step === 'file' && (
          <div className="space-y-4">
            {existing?.layout && (
              <div className="border rule bg-bone px-4 py-3 text-[12.5px] leading-relaxed text-slate">
                <span className="text-ink">{clientName}</span> already has an imported template, <span className="mono text-[11px] text-ink">{existing.layout.file}</span>. Dropping a new workbook replaces it; its column mapping is carried over where the headers match.
              </div>
            )}
            {existing && !existing.layout && (
              <div className="border rule bg-bone px-4 py-3 text-[12.5px] leading-relaxed text-slate">
                {existing.bundled
                  ? <><span className="text-ink">{clientName}</span> uses the bundled <span className="mono text-[11px] text-ink">{existing.bundled.file}</span> today. The workbook you drop takes over; remove the import later and the bundled one is back.</>
                  : <><span className="text-ink">{clientName}</span> is bound to a built-in layout today. Importing a workbook replaces that binding with the client’s own template.</>}
              </div>
            )}
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
              <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = ''; }} />
              <div className="flex flex-col items-center gap-4">
                <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
                <p className="text-[14.5px] text-ink">{busy ? 'Reading…' : 'Drop the client’s Excel template here'}</p>
                <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-graphite">
                  The workbook exactly as the client sends it, up to 10 MB. Every tab is kept as-is: reference lists, rules and instructions travel with the report. Only the data tab is filled, from the system, when the report is generated.
                </p>
                <BtnPrimary onClick={() => input.current?.click()} disabled={busy || !client}><IconUpload size={13} /> Choose workbook</BtnPrimary>
                {!client && <p className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">Pick the client first</p>}
              </div>
            </div>
          </div>
        )}

        {step === 'layout' && book && grid && (
          <LayoutStep
            book={book} grid={grid} sheetIdx={sheetIdx} headerRow={headerRow} dataStart={dataStart} title={title} scope={scope}
            onSheet={(i) => applySheet(book, i, existing?.layout ?? null)}
            onRows={(h, d) => applySheet(book, sheetIdx, null, { headerRow: h, dataStart: d })}
            onTitle={setTitle} onScope={setScope}
          />
        )}

        {step === 'columns' && (
          <ColumnsStep
            seeds={seeds} cells={cells} options={options} sources={sources} preview={preview} previewBusy={previewBusy}
            flavor={book?.flavor ?? null} scope={scope} clientName={clientName} mapped={mapped} hasBook={book !== null}
            onSeed={patchSeed} onCells={setCells}
          />
        )}

        <FormError message={error} />
      </div>
    </Modal>
  );
}

/* ── Step 2: which tab, which rows ─────────────────────────── */

function LayoutStep({ book, grid, sheetIdx, headerRow, dataStart, title, scope, onSheet, onRows, onTitle, onScope }: {
  book: Book; grid: Grid; sheetIdx: number; headerRow: number; dataStart: number; title: string; scope: LayoutScope;
  onSheet: (i: number) => void; onRows: (h: number, d: number) => void; onTitle: (v: string) => void; onScope: (s: LayoutScope) => void;
}) {
  const numbers = grid.rowNumbers ?? grid.rows.map((_, i) => i + 1);
  const rowChoices = Array.from(new Set([...numbers.filter((n) => n <= 60), headerRow, dataStart, headerRow + 1])).sort((a, b) => a - b).map(String);
  const others = book.grids.filter((_, i) => i !== sheetIdx).map((g) => g.name);
  const headerCells = (grid.rowNumbers?.indexOf(headerRow) ?? -1) >= 0 ? grid.rows[grid.rowNumbers!.indexOf(headerRow)].filter((v) => v.trim()).length : 0;
  const sampleRows = numbers.filter((n) => n >= dataStart).length;

  return (
    <div className="space-y-5">
      {book.grids.length > 1 && <Tabs tabs={book.grids.map((g, i) => ({ id: String(i), label: g.name }))} value={String(sheetIdx)} onChange={(id) => onSheet(Number(id))} label="Workbook tabs" />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="mono text-[10.5px] uppercase tracking-[0.16em] text-graphite">
          Data tab · <span className="text-ink">{grid.name}</span> · {headerCells} header cells · {sampleRows} sample row{sampleRows === 1 ? '' : 's'} to replace
        </p>
        {book.flavor && <Chip tone="live">{book.flavor === 'commcise' ? 'Commcise template' : 'Jefferies template'}</Chip>}
      </div>

      <GridPreview grid={grid} headerRow={headerRow} dataStart={dataStart} />

      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Header row" value={String(headerRow)} onChange={(v) => { const h = Number(v); onRows(h, Math.max(dataStart, h + 1)); }} options={rowChoices} hint="the column names" />
        <SelectField label="Data starts at row" value={String(dataStart)} onChange={(v) => onRows(headerRow, Number(v))} options={rowChoices.filter((r) => Number(r) > headerRow)} hint="rows from here are replaced" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Workbook title" value={title} onChange={onTitle} helper="Names the file: “Sep 2026 - {title}.xlsx” for one month, else the range." />
        <SelectField label="Rows included" value={SCOPE_LABELS[scope]} onChange={(v) => onScope((Object.keys(SCOPE_LABELS) as LayoutScope[]).find((k) => SCOPE_LABELS[k] === v) ?? 'client')} options={Object.values(SCOPE_LABELS)} helper="A co-brand upload (Jefferies) covers every Foreign client; a Commcise file covers the one client." />
      </div>
      {others.length > 0 && (
        <p className="text-[12px] leading-relaxed text-graphite">
          Kept exactly as uploaded: <span className="text-ink">{others.join(', ')}</span>. Dropdowns on the data tab that read from those tabs keep working on the rows the system writes.
        </p>
      )}
    </div>
  );
}

function GridPreview({ grid, headerRow, dataStart }: { grid: Grid; headerRow: number; dataStart: number }) {
  const numbers = grid.rowNumbers ?? grid.rows.map((_, i) => i + 1);
  const shown = grid.rows.slice(0, 12);
  const width = Math.min(8, Math.max(1, ...shown.map((r) => r.length)));
  return (
    <div className="overflow-x-auto border rule">
      <table className="mono w-full text-[10.5px]">
        <tbody>
          {shown.map((row, k) => {
            const n = numbers[k];
            const isHeader = n === headerRow;
            const isData = n >= dataStart;
            return (
              <tr key={n} className={isHeader ? 'bg-[color:color-mix(in_oklab,var(--color-amber)_16%,transparent)] text-ink' : isData ? 'text-silver' : 'text-graphite'}>
                <td className="w-8 border-r rule px-2 py-1 text-right text-[9.5px] text-silver">{n}{n === dataStart && <span className="text-[color:var(--color-amber-deep)]"> ▸</span>}</td>
                {Array.from({ length: width }, (_, c) => (
                  <td key={c} className="max-w-[160px] truncate border-r rule px-2 py-1 last:border-r-0" title={row[c] ?? ''}>{isData && row[c] ? <s>{row[c]}</s> : row[c] ?? ''}</td>
                ))}
                {(row.length > width) && <td className="px-2 py-1 text-silver">+{row.length - width}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Step 3: column → source ───────────────────────────────── */

const SCOPE_NOTE: Record<LayoutScope, string> = { client: 'this client’s latest interactions', foreign: 'the latest Foreign-client interactions', all: 'the latest interactions of every client' };

function ColumnsStep({ seeds, cells, options, sources, preview, previewBusy, flavor, scope, clientName, mapped, hasBook, onSeed, onCells }: {
  seeds: ColumnSeed[]; cells: LayoutCell[]; options: ReturnType<typeof sourceOptions>; sources: ReportSource[]; preview: Preview | null; previewBusy: boolean;
  flavor: Flavor; scope: LayoutScope; clientName: string | null; mapped: number; hasBook: boolean;
  onSeed: (i: number, p: Partial<LayoutColumn>) => void; onCells: (cells: LayoutCell[]) => void;
}) {
  const [newRef, setNewRef] = useState('');
  const cellOptions = options.filter((o) => o.group === 'Run' || o.id === 'const' || o.id === 'blank');
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mono text-[10.5px] uppercase tracking-[0.16em] text-graphite">
          <span className="text-ink">{mapped}</span> of {seeds.length} columns filled from the system{flavor ? ` · ${flavor === 'commcise' ? 'Commcise' : 'Jefferies'} vocabulary` : ''}
        </p>
        <p className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">
          {previewBusy ? 'Reading the system…' : preview ? `Preview · ${SCOPE_NOTE[scope]} (${preview.total} on record)` : 'Preview unavailable'}
        </p>
      </div>
      {!hasBook && <p className="text-[12.5px] leading-relaxed text-graphite">The workbook already on the server is kept; only the mapping changes.</p>}

      <ul className="divide-y rule border-y rule">
        {seeds.map((s, i) => {
          const c = s.column;
          const values = (preview?.rows ?? []).map((r) => r[i] ?? '').filter((v) => v !== '');
          const blank = c.source === 'blank';
          return (
            <li key={c.index} className={`py-4 ${blank ? 'opacity-70' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="mono text-[10px] uppercase tracking-[0.16em] text-graphite">{colLetters(c.index)} · <span className="text-ink">{c.header || `Column ${c.index + 1}`}</span></span>
                {s.formula && <Chip tone="muted">Formula in the template</Chip>}
                {s.multi && !blank && <Chip tone="live">List</Chip>}
                {blank && <Chip tone="amber">Left empty</Chip>}
                {clientName && c.source.startsWith('form.') && <Chip tone="live">Form field</Chip>}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <Picker label="Filled with" options={options} value={c.source} onChange={(v) => onSeed(i, { source: v ?? 'blank' })} allowEmpty={false} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {c.source === 'const' && <div className="sm:col-span-2"><TextField label="Fixed text" value={c.text ?? ''} onChange={(v) => onSeed(i, { text: v })} /></div>}
                  {s.multi && !blank && <TextField label="Separator" value={c.separator} onChange={(v) => onSeed(i, { separator: v })} helper="between values" />}
                  {(s.kind === 'date' || s.kind === 'time') && !blank && (
                    <SelectField label="Written as" value={formatOptions(s.kind, c.format).find((f) => f.id === (c.format ?? ''))?.label ?? formatOptions(s.kind, c.format)[0].label}
                      onChange={(v) => onSeed(i, { format: formatOptions(s.kind as 'date' | 'time', c.format).find((f) => f.label === v)?.id ?? null })}
                      options={formatOptions(s.kind, c.format).map((f) => f.label)} />
                  )}
                </div>
              </div>
              <p className="mono mt-2 truncate text-[11px] text-graphite">
                {s.sample && <><span className="text-silver">template · </span>{s.sample}<span className="text-silver"> · </span></>}
                <span className="text-silver">system · </span>
                {blank ? 'nothing' : s.formula && c.source === 'formula' ? 'the template’s own formula, re-addressed to each row' : values.length ? values.join(' · ') : previewBusy ? '…' : preview ? 'no value on the latest rows' : '—'}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3">
        <p className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">Cells above the table</p>
        {cells.length === 0 && <p className="text-[12.5px] text-graphite">None. A “Template Date:” or “Downloaded by:” value cell can be stamped at generation time.</p>}
        <ul className="space-y-2">
          {cells.map((cell, i) => (
            <li key={cell.ref} className="grid items-end gap-3 md:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <span className="mono pb-2.5 text-[12px] text-ink">{cell.ref}</span>
              <Picker label="Stamped with" options={cellOptions} value={cell.source} onChange={(v) => onCells(cells.map((x, k) => (k === i ? { ...x, source: v ?? 'blank', text: v === 'const' ? x.text ?? '' : null } : x)))} allowEmpty={false} />
              {cell.source === 'const' ? <TextField label="Text" value={cell.text ?? ''} onChange={(v) => onCells(cells.map((x, k) => (k === i ? { ...x, text: v } : x)))} /> : <span className="pb-2.5 text-[12px] text-graphite">{labelOf(cell.source)}</span>}
              <BtnGhost onClick={() => onCells(cells.filter((_, k) => k !== i))}>Remove</BtnGhost>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-3">
          <div className="w-[120px]"><TextField label="Add cell" value={newRef} onChange={(v) => setNewRef(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="F2" /></div>
          <BtnGhost onClick={() => { if (/^[A-Z]{1,3}[1-9]\d{0,3}$/.test(newRef) && !cells.some((c) => c.ref === newRef)) { onCells([...cells, { ref: newRef, source: 'meta.generated_at_utc', text: null }]); setNewRef(''); } }} disabled={!/^[A-Z]{1,3}[1-9]\d{0,3}$/.test(newRef)}>Add</BtnGhost>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-graphite">
        Headers were matched to the system’s data automatically{flavor ? `, using the ${flavor === 'commcise' ? 'Commcise' : 'Jefferies'} vocabulary the workbook carries` : ''}; check each against the preview and change any that read wrong. A list joins its values with the separator; dates and times are written as real Excel values in the template’s own format unless you choose otherwise.
        {sources.length === 0 && ' The data-source catalog has not loaded yet; reopen after the workspace finishes loading.'}
      </p>
    </div>
  );
}

/** Keep the operator's earlier choices for columns whose header is unchanged. */
function carryOver(fresh: ColumnSeed[], prior: ReportLayout['columns'], sources: ReportSource[]): ColumnSeed[] {
  const byHeader = new Map(prior.map((c) => [normalizeHeader(c.header), c]));
  const byKey = new Map(sources.map((s) => [s.key, s]));
  return fresh.map((s) => {
    const p = byHeader.get(normalizeHeader(s.column.header));
    if (!p || !s.column.header) return s;
    const src = byKey.get(p.source);
    return { ...s, column: { ...s.column, source: p.source, separator: p.separator, format: p.format, text: p.text }, kind: src?.kind ?? s.kind, multi: src?.multi ?? s.multi };
  });
}
