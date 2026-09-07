import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BtnGhost, BtnPrimary, Chip, ModuleHeader, RowAction, SelectField, Switch, TextField, useConfirm } from '../../cms/ui';
import { MiniBtn } from '../../cms/kit/parts';
import { IconArrowDown, IconArrowUp, IconCheck, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms } from '../store';
import { FormError, Picker, SectionRule } from '../kit/fields';
import { errorText, useToast } from '../kit/toast';
import type { FieldSchema, FieldType, Form, LookupSource } from '../data';

/* ─────────────────────────────────────────────────────────────
   Form builder — the per-client dynamic fields an interaction
   captures, kept in the legacy FieldSchema shape so the seven
   production forms and 5,000+ captured interactions read back
   unchanged. internalName is the contract with the report
   generators, so it sits beside the label and stays stable.
   ───────────────────────────────────────────────────────────── */

const FIELD_TYPES: Record<FieldType, string> = { textBox: 'Text', textArea: 'Long text', select: 'Select', date: 'Date', number: 'Number' };
const SOURCES: Record<'Static' | LookupSource, string> = { Static: 'Typed choices', Corporate: 'Corporates', CorporateContact: 'Issuer contacts', SellsideContact: 'Regis directory' };
const KNOWN = ['corporate', 'corporate_contact', 'sector', 'initiated_by', 'company_name', 'company_management', 'expert_contact', 'location', 'contract_id', 'parent_interaction_id', 'asset_class', 'client_initiated', 'meeting_name', 'stock1', 'stock2', 'stock3', 'stock4', 'stock5', 'sector1', 'sector2', 'sector3', 'sector4', 'sector5'];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[0-9]/, 'f$&');

function blankField(id: number): FieldSchema {
  return { id, internalName: '', label: '', fieldType: 'textBox', required: false, multiLine: false, rows: 0, multiSelect: false, options: { type: '', value: '', bindLabel: 'name' }, column: '1', defaultValue: '' };
}

/** Which source a select reads from, as the editor shows it. */
function sourceOf(f: FieldSchema): 'Static' | LookupSource {
  if (f.options.type === 'Lookup') return (typeof f.options.value === 'string' && f.options.value in SOURCES ? f.options.value : 'Corporate') as LookupSource;
  return 'Static';
}

export default function FormBuilderModule() {
  const { forms, clients, meta, mutate, destroy } = useCrms();
  const { notify } = useToast();
  const [selected, setSelected] = useState<string>(() => forms[0]?.id ?? 'new');
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();

  useEffect(() => { if (selected === 'new' && forms.length && !forms.some((f) => f.id === selected)) setSelected(forms[0].id); }, [forms, selected]);

  const current: Form | null = useMemo(() => forms.find((f) => f.id === selected) ?? null, [forms, selected]);
  useEffect(() => { setFields(current?.fields.map((f) => ({ ...f, options: { ...f.options } })) ?? []); setError(null); }, [current, selected]);

  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? `Client #${id}` : 'Default form');
  const isGeneric = (f: Form) => f.clientId === meta.genericClientId;
  const dirty = JSON.stringify(fields) !== JSON.stringify(current?.fields ?? []);
  const unformed = clients.filter((c) => !forms.some((f) => f.clientId === c.id)).map((c) => ({ id: c.id, label: c.name }));

  const update = (i: number, patch: Partial<FieldSchema>) => setFields((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) => setFields((fs) => { const n = fs.slice(); const j = i + d; if (j < 0 || j >= n.length) return fs; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const setType = (i: number, f: FieldSchema, fieldType: FieldType) => update(i, {
    fieldType,
    multiLine: fieldType === 'textArea',
    options: fieldType === 'select' ? (f.options.type ? f.options : { type: 'Static', value: [], bindLabel: 'name' }) : { type: '', value: '', bindLabel: 'name' },
  });
  const setSource = (i: number, f: FieldSchema, source: 'Static' | LookupSource) => update(i, {
    options: source === 'Static'
      ? { type: 'Static', value: Array.isArray(f.options.value) ? f.options.value : [], bindLabel: 'name' }
      : { type: 'Lookup', value: source, bindLabel: source === 'Corporate' ? (f.options.bindLabel === 'ticker' ? 'ticker' : 'name') : 'name' },
  });

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
    } catch (e) { setError(errorText(e, 'The form could not be saved.')); } finally { setSaving(false); }
  }

  async function remove(f: Form) {
    try { await destroy('forms', `/crms/forms/${f.id}`, f.id); notify('Form removed.'); setSelected(forms.find((x) => x.id !== f.id)?.id ?? 'new'); }
    catch (e) { notify(errorText(e, 'Could not remove the form.'), 'warn'); }
  }

  return (
    <div className="space-y-10">
      <ModuleHeader code="12 · Form builder" title="Interaction forms" blurb="The structured fields captured on an interaction, one form per client. Internal names are what the consumption reports read, so keep them stable; a select either lists typed choices or looks up corporates, issuer contacts or the Regis directory." />

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
            {forms.length === 0 && selected !== 'new' && <li className="py-3 text-[13px] text-graphite">No forms yet.</li>}
          </ul>
          <p className="text-[12px] leading-relaxed text-graphite">A client without a form captures no structured fields — only the date, type, attendees and description.</p>
          <div className="text-[12px] leading-relaxed text-graphite">
            <p className="mono mb-1.5 text-[9.5px] uppercase tracking-[0.16em]">Names the reports read</p>
            <p className="flex flex-wrap gap-1">{KNOWN.map((k) => <span key={k} className="mono border rule bg-paper px-1.5 py-0.5 text-[10.5px]">{k}</span>)}</p>
          </div>
        </aside>

        <section className="space-y-6 lg:col-span-8">
          <SectionRule code={selected === 'new' ? 'New form' : 'Client form'} title={selected === 'new' ? 'Client form' : clientName(current?.clientId ?? null)}
            actions={current && <RowAction label={armed === current.id ? 'Confirm delete' : 'Delete form'} danger onClick={() => confirm(current.id, () => { void remove(current); })}>{armed === current.id ? <IconCheck /> : <IconTrash />}</RowAction>} />

          {selected === 'new' && <Picker label="Client" options={unformed} value={newClientId} onChange={setNewClientId} hint="clients without a form" />}

          {fields.length === 0 && <p className="border rule border-dashed px-5 py-6 text-[13px] text-graphite">No fields yet. Add the first one below.</p>}

          <ul className="space-y-3">
            {fields.map((f, i) => {
              const source = sourceOf(f);
              return (
                <motion.li key={f.id} layout="position" className="border rule bg-paper p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="mono text-[10px] uppercase tracking-[0.16em] text-graphite">Field {String(i + 1).padStart(2, '0')} · <span className="text-ink">{f.internalName || 'unnamed'}</span>{KNOWN.includes(f.internalName) && <Chip tone="live">Read by reports</Chip>}</span>
                    <span className="flex items-center gap-1">
                      <MiniBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><IconArrowUp size={12} /></MiniBtn>
                      <MiniBtn label="Move down" onClick={() => move(i, 1)} disabled={i === fields.length - 1}><IconArrowDown size={12} /></MiniBtn>
                      <MiniBtn label="Remove field" danger onClick={() => setFields((fs) => fs.filter((_, k) => k !== i))}><IconTrash size={12} /></MiniBtn>
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_150px]">
                    <TextField label="Label" value={f.label} onChange={(v) => update(i, { label: v, internalName: f.internalName && f.internalName !== slug(f.label) ? f.internalName : slug(v) })} />
                    <TextField label="Internal name" value={f.internalName} onChange={(v) => update(i, { internalName: slug(v) })} helper="lowercase, underscores" />
                    <SelectField label="Type" value={FIELD_TYPES[f.fieldType] ?? 'Text'} onChange={(v) => setType(i, f, (Object.keys(FIELD_TYPES) as FieldType[]).find((k) => FIELD_TYPES[k] === v) ?? 'textBox')} options={Object.values(FIELD_TYPES)} />
                  </div>
                  {f.fieldType === 'select' && (
                    <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                      <SelectField label="Choices come from" value={SOURCES[source]} onChange={(v) => setSource(i, f, (Object.keys(SOURCES) as ('Static' | LookupSource)[]).find((k) => SOURCES[k] === v) ?? 'Static')} options={Object.values(SOURCES)} />
                      {source === 'Static' ? (
                        <TextField label="Choices" value={(Array.isArray(f.options.value) ? f.options.value : []).join('\n')} onChange={(v) => update(i, { options: { ...f.options, type: 'Static', value: v.split('\n') } })} multiline placeholder={'Broker\nInvestor'} helper="One per line." />
                      ) : source === 'Corporate' ? (
                        <SelectField label="Show as" value={f.options.bindLabel === 'ticker' ? 'Ticker' : 'Name'} onChange={(v) => update(i, { options: { ...f.options, bindLabel: v === 'Ticker' ? 'ticker' : 'name' } })} options={['Name', 'Ticker']} />
                      ) : <div />}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2.5 text-[12.5px] text-slate"><Switch on={f.required} onToggle={() => update(i, { required: !f.required })} label="Required" /> Required</label>
                    {f.fieldType === 'select' && <label className="flex items-center gap-2.5 text-[12.5px] text-slate"><Switch on={f.multiSelect} onToggle={() => update(i, { multiSelect: !f.multiSelect })} label="Multiple" /> Allow several</label>}
                    {f.fieldType !== 'select' && <div className="flex-1 sm:max-w-[260px]"><TextField label="Default value" value={f.defaultValue ?? ''} onChange={(v) => update(i, { defaultValue: v })} /></div>}
                  </div>
                </motion.li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t rule pt-5">
            <BtnGhost onClick={() => setFields((fs) => [...fs, blankField(Math.max(0, ...fs.map((x) => x.id)) + 1)])}><IconPlus size={12} /> Add field</BtnGhost>
            <div className="flex items-center gap-2">
              {dirty && <span className="mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-amber-deep)]">Unsaved changes</span>}
              <BtnPrimary onClick={() => void save()} disabled={saving || (!dirty && selected !== 'new')}>{saving ? 'Saving…' : 'Save form'}</BtnPrimary>
            </div>
          </div>
          <FormError message={error} />
        </section>
      </div>
    </div>
  );
}
