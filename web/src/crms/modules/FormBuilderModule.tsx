import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BtnGhost, BtnPrimary, Chip, ModuleHeader, RowAction, SelectField, Switch, TextField, useConfirm } from '../../cms/ui';
import { MiniBtn } from '../../cms/kit/parts';
import { IconArrowDown, IconArrowUp, IconCheck, IconDownload, IconPlus, IconTrash, IconUpload } from '../../cms/icons';
import { useCrms } from '../store';
import { FormError, Picker, SectionRule } from '../kit/fields';
import { errorText, useToast } from '../kit/toast';
import { fmtDate, TEMPLATE_CODES, type FieldSchema, type FieldType, type Form, type LookupSource, type ReportTemplate } from '../data';
import FormBuilderImport from './FormBuilderImport';
import ReportLayoutImport from './ReportLayoutImport';
import { slugName as slug } from '../kit/sheet';
import { SCOPE_LABELS } from '../kit/layout';
import { downloadFile } from '../kit/download';

/* ─────────────────────────────────────────────────────────────
   Form builder — the per-client dynamic fields an interaction
   captures, kept in the legacy FieldSchema shape so the seven
   production forms and 5,000+ captured interactions read back
   unchanged. internalName is the contract with the report
   generators, so it sits beside the label and stays stable.
   ───────────────────────────────────────────────────────────── */

const FIELD_TYPES: Record<FieldType, string> = { textBox: 'Text', textArea: 'Long text', select: 'Select', date: 'Date', number: 'Number' };
const SOURCES: Record<'Static' | LookupSource, string> = { Static: 'Typed choices', Corporate: 'Corporates', CorporateContact: 'Issuer contacts', SellsideContact: 'Regis directory' };
const TYPE_OPTIONS = Object.values(FIELD_TYPES);
const SOURCE_OPTIONS = Object.values(SOURCES);
const BIND_OPTIONS = ['Name', 'Ticker'];
const KNOWN = ['corporate', 'corporate_contact', 'sector', 'initiated_by', 'company_name', 'company_management', 'expert_contact', 'location', 'contract_id', 'parent_interaction_id', 'asset_class', 'client_initiated', 'meeting_name', 'stock1', 'stock2', 'stock3', 'stock4', 'stock5', 'sector1', 'sector2', 'sector3', 'sector4', 'sector5'];

function blankField(id: number): FieldSchema {
  return { id, internalName: '', label: '', fieldType: 'textBox', required: false, multiLine: false, rows: 0, multiSelect: false, options: { type: '', value: '', bindLabel: 'name' }, column: '1', defaultValue: '' };
}

/** Which source a select reads from, as the editor shows it. */
function sourceOf(f: FieldSchema): 'Static' | LookupSource {
  if (f.options.type === 'Lookup') return (typeof f.options.value === 'string' && f.options.value in SOURCES ? f.options.value : 'Corporate') as LookupSource;
  return 'Static';
}

export default function FormBuilderModule() {
  const { forms, clients, meta, status, reportTemplates, mutate, destroy } = useCrms();
  const { notify } = useToast();
  // '' = nothing chosen yet (bootstrap may still be loading); 'new' = the user asked for a new client form.
  const [selected, setSelected] = useState<string>(() => forms[0]?.id ?? '');
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();
  const [importing, setImporting] = useState(false);
  /** The client whose Excel report template is being imported, while the modal is open. */
  const [importingTemplate, setImportingTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (selected === 'new' || forms.some((f) => f.id === selected)) return;
    // Nothing valid is selected: fall back to the first form once forms exist, or to a new form once the bootstrap says there are none.
    setSelected(forms[0]?.id ?? (status === 'ready' ? 'new' : ''));
  }, [forms, selected, status]);

  const current: Form | null = useMemo(() => forms.find((f) => f.id === selected) ?? null, [forms, selected]);
  useEffect(() => { setFields(current?.fields.map((f) => ({ ...f, options: { ...f.options } })) ?? []); setError(null); }, [current, selected]);

  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? `Client #${id}` : 'Default form');
  const isGeneric = (f: Form) => f.clientId === meta.genericClientId;
  const dirty = JSON.stringify(fields) !== JSON.stringify(current?.fields ?? []);
  const unformed = clients.filter((c) => !forms.some((f) => f.clientId === c.id)).map((c) => ({ id: c.id, label: c.name }));

  /* Every handler is stable and updates through functional setState, so a keystroke in one
     card re-renders that card alone (FieldCard is memoised) instead of the whole list. */
  const update = useCallback((i: number, patch: Partial<FieldSchema>) => setFields((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f))), []);
  const move = useCallback((i: number, d: -1 | 1) => setFields((fs) => { const n = fs.slice(); const j = i + d; if (j < 0 || j >= n.length) return fs; [n[i], n[j]] = [n[j], n[i]]; return n; }), []);
  const remove = useCallback((i: number) => setFields((fs) => fs.filter((_, k) => k !== i)), []);
  /** Spreadsheet columns arrive with placeholder ids; renumber them after whatever the form already holds. */
  const addImported = useCallback((imported: FieldSchema[], replace: boolean) => setFields((fs) => {
    const base = replace ? [] : fs;
    let next = Math.max(0, ...base.map((x) => x.id));
    return [...base, ...imported.map((f) => ({ ...f, id: ++next }))];
  }), []);

  async function save() {
    const names = fields.map((f) => f.internalName);
    if (fields.some((f) => !f.label.trim() || !f.internalName)) { setError('Every field needs a label and an internal name.'); return; }
    if (new Set(names).size !== names.length) { setError('Internal names must be unique.'); return; }
    if (selected === 'new' && !newClientId) { setError('Pick the client this form is for.'); return; }
    setSaving(true); setError(null);
    try {
      const body = { clientId: selected === 'new' ? Number(newClientId) : current?.clientId ? Number(current.clientId) : null, fields };
      const saved = await mutate('forms', current ? `/crms/forms/${current.id}` : '/crms/forms', current ? 'PUT' : 'POST', body);
      notify('Form saved.');
      setSelected(saved.id);
      setNewClientId(null);
    } catch (e) { setError(errorText(e, 'The form could not be saved.')); } finally { setSaving(false); }
  }

  async function removeForm(f: Form) {
    try { await destroy('forms', `/crms/forms/${f.id}`, f.id); notify('Form removed.'); setSelected(forms.find((x) => x.id !== f.id)?.id ?? 'new'); }
    catch (e) { notify(errorText(e, 'Could not remove the form.'), 'warn'); }
  }

  async function removeTemplate(t: ReportTemplate) {
    try { await destroy('reportTemplates', `/crms/report-templates/${t.id}`, t.id); notify('Report template removed.'); }
    catch (e) { notify(errorText(e, 'Could not remove the report template.'), 'warn'); }
  }

  const templateFor = (clientId: string | null) => (clientId ? reportTemplates.find((t) => t.clientId === clientId) ?? null : null);

  return (
    <div className="space-y-10">
      <ModuleHeader code="12 · Form builder" title="Interaction forms" blurb="The structured fields captured on an interaction, one form per client, and the client's own Excel report template. Internal names are what the consumption reports read, so keep them stable; a select either lists typed choices or looks up corporates, issuer contacts or the Regis directory." />

      <div className="grid gap-10 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-4">
          <SectionRule code="Forms" title={`${forms.length} defined`} actions={<BtnGhost onClick={() => setSelected('new')} disabled={unformed.length === 0}><IconPlus size={12} /> Client form</BtnGhost>} />
          <ul className="divide-y rule border-y rule">
            {forms.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => setSelected(f.id)} className={`flex w-full items-center justify-between gap-3 py-3 text-left ${selected === f.id ? 'text-ink' : 'text-slate hover:text-ink'}`}>
                  <span className="truncate text-[13.5px]">{clientName(f.clientId)}{isGeneric(f) && <span className="mono ml-2 text-[9px] uppercase tracking-[0.14em] text-[color:var(--color-amber-deep)]">fallback for every client</span>}</span>
                  <span className="mono shrink-0 text-[10px] uppercase tracking-[0.14em] text-silver">{f.fields.length} fields</span>
                </button>
              </li>
            ))}
            {selected === 'new' && <li className="py-3 text-[13.5px] text-ink">New client form</li>}
            {forms.length === 0 && selected !== 'new' && <li className="py-3 text-[13px] text-graphite">{status === 'loading' ? 'Loading…' : 'No forms yet.'}</li>}
          </ul>
          <p className="text-[12px] leading-relaxed text-graphite">A client without a form captures no structured fields — only the date, type, attendees and description.</p>
          <div className="text-[12px] leading-relaxed text-graphite">
            <p className="mono mb-1.5 text-[9.5px] uppercase tracking-[0.16em]">Names the reports read</p>
            <p className="flex flex-wrap gap-1">{KNOWN.map((k) => <span key={k} className="mono border rule bg-paper px-1.5 py-0.5 text-[10.5px]">{k}</span>)}</p>
          </div>
        </aside>

        <section className="space-y-6 lg:col-span-8">
          <SectionRule code={selected === 'new' ? 'New form' : 'Client form'} title={selected === 'new' ? 'Client form' : current ? clientName(current.clientId) : '—'}
            actions={current && <RowAction label={armed === current.id ? 'Confirm delete' : 'Delete form'} danger onClick={() => confirm(current.id, () => { void removeForm(current); })}>{armed === current.id ? <IconCheck /> : <IconTrash />}</RowAction>} />

          {selected === 'new' && <Picker label="Client" options={unformed} value={newClientId} onChange={setNewClientId} hint="clients without a form" />}

          {fields.length === 0 && (selected === 'new' || current) && <p className="border rule border-dashed px-5 py-6 text-[13px] text-graphite">No fields yet. Add the first one below.</p>}

          <ul className="space-y-3">
            {fields.map((f, i) => <FieldCard key={f.id} field={f} index={i} count={fields.length} onUpdate={update} onMove={move} onRemove={remove} />)}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t rule pt-5">
            <div className="flex items-center gap-2">
              <BtnGhost onClick={() => setFields((fs) => [...fs, blankField(Math.max(0, ...fs.map((x) => x.id)) + 1)])}><IconPlus size={12} /> Add field</BtnGhost>
              <BtnGhost onClick={() => setImporting(true)}><IconUpload size={12} /> Import columns</BtnGhost>
            </div>
            <div className="flex items-center gap-2">
              {dirty && <span className="mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-amber-deep)]">Unsaved changes</span>}
              <BtnPrimary onClick={() => void save()} disabled={saving || (!dirty && selected !== 'new')}>{saving ? 'Saving…' : 'Save form'}</BtnPrimary>
            </div>
          </div>
          <FormError message={error} />

          {current && !isGeneric(current) && current.clientId && (
            <ReportTemplatePanel
              clientName={clientName(current.clientId)}
              template={templateFor(current.clientId)}
              jefferies={current.clientId === meta.jefferies.clientId}
              armed={armed}
              onImport={() => setImportingTemplate(current.clientId)}
              onRemove={(t) => confirm(`tpl-${t.id}`, () => { void removeTemplate(t); })}
              onDownload={async (t) => {
                const path = t.layout ? `/crms/report-templates/${t.id}/layout/file` : `/crms/report-templates/bundled/${t.bundled?.key}/file`;
                try { await downloadFile(path, {}, t.layout?.file ?? t.bundled?.file ?? 'template.xlsx'); } catch (e) { notify(errorText(e, 'The workbook could not be downloaded.'), 'warn'); }
              }}
            />
          )}
        </section>
      </div>

      {/* Mounted only while open, like every other Modal in the app: toggling `open` leaves the faded overlay in the DOM, blocking clicks. */}
      {importing && <FormBuilderImport onClose={() => setImporting(false)} onAdd={addImported} existing={fields.map((f) => f.internalName).filter(Boolean)} known={KNOWN} hasFields={fields.length > 0} />}
      {importingTemplate !== null && <ReportLayoutImport clientId={importingTemplate} onClose={() => setImportingTemplate(null)} />}
    </div>
  );
}

/* ── The client's Excel report template: imported workbook + column map, used by Reports → By client ── */

function ReportTemplatePanel({ clientName, template, jefferies, armed, onImport, onRemove, onDownload }: {
  clientName: string; template: ReportTemplate | null; armed: string | null;
  /** The client named Jefferies: its workbook is the co-brand upload (Reports → Jefferies upload), not a By-client report. */
  jefferies: boolean;
  onImport: () => void; onRemove: (t: ReportTemplate) => void; onDownload: (t: ReportTemplate) => void;
}) {
  const bundled = template?.bundled ?? null;
  const layout = template?.layout ?? bundled;
  const filled = layout ? layout.columns.filter((c) => c.source !== 'blank').length : 0;
  return (
    <div className="space-y-4 border-t rule pt-6">
      <SectionRule code="Report template" title={`${clientName} · Excel template`} actions={
        <>
          {layout && <BtnGhost onClick={() => onDownload(template!)}><IconDownload size={12} /> Original</BtnGhost>}
          <BtnGhost onClick={onImport}><IconUpload size={12} /> {layout ? (bundled && !template?.layout ? 'Import a newer download' : 'Replace or re-map') : 'Import Excel template'}</BtnGhost>
        </>
      } />
      {layout ? (
        <div className="border rule bg-paper p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] text-ink">{layout.file}</p>
              <p className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-graphite">
                {layout.title ?? '—'} · tab {layout.sheet} · header row {layout.headerRow} · data from row {layout.dataStart}
              </p>
            </div>
            <span className="flex items-center gap-3">
              {bundled && !template?.layout && <Chip tone="amber">Ships with the CRMS</Chip>}
              <Chip tone={template?.active ? 'live' : 'muted'}>{template?.active ? 'Used by Reports' : 'Off'}</Chip>
            </span>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
            <div><dt className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">Columns</dt><dd className="text-slate">{filled} of {layout.columns.length} filled from the system{layout.columns.some((c) => c.source === 'formula') ? ' · formula column kept' : ''}</dd></div>
            <div><dt className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">Rows included</dt><dd className="text-slate">{SCOPE_LABELS[layout.scope]}</dd></div>
            <div><dt className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">Other tabs kept</dt><dd className="truncate text-slate" title={layout.sheets.filter((s) => s !== layout.sheet).join(', ')}>{layout.sheets.filter((s) => s !== layout.sheet).join(', ') || 'none'}</dd></div>
            <div><dt className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">{template?.layout ? 'Imported' : 'Source'}</dt><dd className="text-slate">{template?.layout ? (layout.importedAt ? fmtDate(layout.importedAt) : '—') : 'The client’s own download, bundled with the CRMS'}{layout.cells.length > 0 ? ` · stamps ${layout.cells.map((c) => c.ref).join(', ')}` : ''}</dd></div>
          </dl>
          <div className="mt-4 flex items-center justify-between gap-3 border-t rule pt-4">
            <p className="text-[12px] leading-relaxed text-graphite">{jefferies ? 'Reports → Jefferies upload fills this exact workbook with every Foreign client’s interactions in range' : 'Reports → By client fills this exact workbook with the interactions in range'}; every other tab, style and rule comes back as in the file.{bundled && !template?.layout ? ` When ${jefferies ? 'Jefferies' : 'the client'} sends a newer template, import it here and it takes over.` : ''}</p>
            {template && <RowAction label={armed === `tpl-${template.id}` ? 'Confirm remove' : 'Remove template'} danger onClick={() => onRemove(template)}>{armed === `tpl-${template.id}` ? <IconCheck /> : <IconTrash />}</RowAction>}
          </div>
        </div>
      ) : (
        <p className="border rule border-dashed px-5 py-5 text-[13px] leading-relaxed text-graphite">
          {template
            ? <>Bound to the built-in <span className="text-ink">{TEMPLATE_CODES[template.code]}</span> layout. Import the client’s own workbook to replace it with their exact template.</>
            : <>No template yet: By-client reports use the generic extract. Import the workbook this client’s compliance desk sends (every tab is kept) and map its columns to the system’s data.</>}
        </p>
      )}
    </div>
  );
}

/* ── One field card, memoised: re-renders only when its own field, position or the list length changes ── */

const FieldCard = memo(function FieldCard({ field: f, index: i, count, onUpdate, onMove, onRemove }: {
  field: FieldSchema; index: number; count: number;
  onUpdate: (i: number, patch: Partial<FieldSchema>) => void;
  onMove: (i: number, d: -1 | 1) => void;
  onRemove: (i: number) => void;
}) {
  const source = sourceOf(f);
  const setType = (fieldType: FieldType) => onUpdate(i, {
    fieldType,
    multiLine: fieldType === 'textArea',
    options: fieldType === 'select' ? (f.options.type ? f.options : { type: 'Static', value: [], bindLabel: 'name' }) : { type: '', value: '', bindLabel: 'name' },
  });
  const setSource = (next: 'Static' | LookupSource) => onUpdate(i, {
    options: next === 'Static'
      ? { type: 'Static', value: Array.isArray(f.options.value) ? f.options.value : [], bindLabel: 'name' }
      : { type: 'Lookup', value: next, bindLabel: next === 'Corporate' ? (f.options.bindLabel === 'ticker' ? 'ticker' : 'name') : 'name' },
  });

  return (
    <li className="border rule bg-paper p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-graphite">Field {String(i + 1).padStart(2, '0')} · <span className="text-ink">{f.internalName || 'unnamed'}</span>{KNOWN.includes(f.internalName) && <Chip tone="live">Read by reports</Chip>}</span>
        <span className="flex items-center gap-1">
          <MiniBtn label="Move up" onClick={() => onMove(i, -1)} disabled={i === 0}><IconArrowUp size={12} /></MiniBtn>
          <MiniBtn label="Move down" onClick={() => onMove(i, 1)} disabled={i === count - 1}><IconArrowDown size={12} /></MiniBtn>
          <MiniBtn label="Remove field" danger onClick={() => onRemove(i)}><IconTrash size={12} /></MiniBtn>
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_150px]">
        <TextField label="Label" value={f.label} onChange={(v) => onUpdate(i, { label: v, internalName: f.internalName && f.internalName !== slug(f.label) ? f.internalName : slug(v) })} />
        <TextField label="Internal name" value={f.internalName} onChange={(v) => onUpdate(i, { internalName: slug(v) })} helper="lowercase, underscores" />
        <SelectField label="Type" value={FIELD_TYPES[f.fieldType] ?? 'Text'} onChange={(v) => setType((Object.keys(FIELD_TYPES) as FieldType[]).find((k) => FIELD_TYPES[k] === v) ?? 'textBox')} options={TYPE_OPTIONS} />
      </div>
      {f.fieldType === 'select' && (
        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
          <SelectField label="Choices come from" value={SOURCES[source]} onChange={(v) => setSource((Object.keys(SOURCES) as ('Static' | LookupSource)[]).find((k) => SOURCES[k] === v) ?? 'Static')} options={SOURCE_OPTIONS} />
          {source === 'Static' ? (
            <TextField label="Choices" value={(Array.isArray(f.options.value) ? f.options.value : []).join('\n')} onChange={(v) => onUpdate(i, { options: { ...f.options, type: 'Static', value: v.split('\n') } })} multiline placeholder={'Broker\nInvestor'} helper="One per line." />
          ) : source === 'Corporate' ? (
            <SelectField label="Show as" value={f.options.bindLabel === 'ticker' ? 'Ticker' : 'Name'} onChange={(v) => onUpdate(i, { options: { ...f.options, bindLabel: v === 'Ticker' ? 'ticker' : 'name' } })} options={BIND_OPTIONS} />
          ) : <div />}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2.5 text-[12.5px] text-slate"><Switch on={f.required} onToggle={() => onUpdate(i, { required: !f.required })} label="Required" /> Required</label>
        {f.fieldType === 'select' && <label className="flex items-center gap-2.5 text-[12.5px] text-slate"><Switch on={f.multiSelect} onToggle={() => onUpdate(i, { multiSelect: !f.multiSelect })} label="Multiple" /> Allow several</label>}
        {f.fieldType !== 'select' && <div className="flex-1 sm:max-w-[260px]"><TextField label="Default value" value={f.defaultValue ?? ''} onChange={(v) => onUpdate(i, { defaultValue: v })} /></div>}
      </div>
    </li>
  );
});
