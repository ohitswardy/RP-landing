import { useMemo } from 'react';
import { DateField, TextField } from '../../../cms/ui';
import { MultiPicker, NumberField, Picker, type Option } from '../../kit/fields';
import { useCrms } from '../../store';
import type { FieldSchema, FormFieldValue, FormValue, LookupSnapshot } from '../../data';

/* ─────────────────────────────────────────────────────────────
   Renders a client's form-builder definition in the legacy shape
   and captures values exactly as the production rows hold them:
   '' or a string for text and static selects, a list of strings
   for a multi static select, and lookup snapshots (the picked
   corporate / contact / staff row) for Lookup selects — one
   object, or a list when multiSelect. Reports read those back.
   ───────────────────────────────────────────────────────────── */

/** The captured list for a form: existing values kept, new fields seeded with their default. */
export function seedValues(fields: FieldSchema[], existing: FormValue[]): FormValue[] {
  const byName = new Map(existing.map((v) => [v.internalName, v]));
  return fields.map((f) => ({
    id: f.id,
    internalName: f.internalName,
    label: f.label,
    fieldType: f.fieldType,
    options: f.options,
    multiSelect: f.multiSelect,
    value: byName.get(f.internalName)?.value ?? f.defaultValue ?? '',
  }));
}

/** A value as a list of ids / strings, whatever shape it arrived in. */
function asList(v: FormFieldValue): (string | LookupSnapshot)[] {
  if (v === null || v === '' || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

const snapId = (x: string | LookupSnapshot): string => (typeof x === 'string' ? x : String(x.id));

export default function DynamicForm({ fields, values, onChange }: { fields: FieldSchema[]; values: FormValue[]; onChange: (next: FormValue[]) => void }) {
  const { corporates, corporateContacts, sellsideContacts } = useCrms();

  // Lookup sources: options for the picker, and the snapshot the legacy rows store when one is picked.
  const lookups = useMemo(() => ({
    Corporate: {
      options: corporates.map((c): Option => ({ id: c.id, label: c.name, hint: c.ticker })),
      snapshot: (id: string): LookupSnapshot | null => {
        const c = corporates.find((x) => x.id === id);
        return c ? { id: Number(c.id), name: c.name, ticker: c.ticker, identifiers1: c.identifiers1, identifiers2: c.identifiers2 } : null;
      },
    },
    CorporateContact: {
      options: corporateContacts.map((c): Option => ({ id: c.id, label: c.name, hint: c.corporateName })),
      snapshot: (id: string): LookupSnapshot | null => {
        const c = corporateContacts.find((x) => x.id === id);
        return c ? { id: Number(c.id), name: c.name, email: c.email, position: c.position } : null;
      },
    },
    SellsideContact: {
      options: sellsideContacts.map((s): Option => ({ id: s.id, label: s.name, hint: s.type })),
      snapshot: (id: string): LookupSnapshot | null => {
        const s = sellsideContacts.find((x) => x.id === id);
        return s ? { id: Number(s.id), name: s.name, email: s.email } : null;
      },
    },
  }), [corporates, corporateContacts, sellsideContacts]);

  const get = (name: string): FormFieldValue => values.find((v) => v.internalName === name)?.value ?? '';
  const set = (name: string, value: FormFieldValue) => onChange(values.map((v) => (v.internalName === name ? { ...v, value } : v)));

  if (fields.length === 0) {
    return <p className="border rule border-dashed px-4 py-4 text-[12.5px] text-graphite">This client has no form yet. Build one in the form builder to capture the companies discussed and other structured detail.</p>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((f) => {
        const label = f.required ? `${f.label} *` : f.label;
        const value = get(f.internalName);
        const text = typeof value === 'string' ? value : '';

        if (f.fieldType === 'select') {
          const isLookup = f.options.type === 'Lookup';
          if (isLookup) {
            const source = lookups[(typeof f.options.value === 'string' ? f.options.value : 'Corporate') as keyof typeof lookups] ?? lookups.Corporate;
            const picked = asList(value).map(snapId);
            // A snapshot whose row is gone still shows, so historic picks are never silently dropped.
            const options = [...source.options, ...asList(value).filter((x) => typeof x !== 'string' && !source.options.some((o) => o.id === String((x as LookupSnapshot).id))).map((x) => ({ id: String((x as LookupSnapshot).id), label: (x as LookupSnapshot).name, hint: 'no longer listed' }))];
            const toSnapshot = (id: string): LookupSnapshot | null => source.snapshot(id) ?? (asList(value).find((x) => snapId(x) === id) as LookupSnapshot | undefined) ?? null;
            if (f.multiSelect) {
              return <div key={f.id} className="sm:col-span-2"><MultiPicker label={label} options={options} value={picked} onChange={(ids) => set(f.internalName, ids.map(toSnapshot).filter((x): x is LookupSnapshot => x !== null))} placeholder="Search…" /></div>;
            }
            return <Picker key={f.id} label={label} options={options} value={picked[0] ?? null} onChange={(id) => set(f.internalName, id ? toSnapshot(id) : '')} placeholder="Search…" />;
          }
          const choices = (Array.isArray(f.options.value) ? f.options.value : []).map((v): Option => ({ id: v, label: v }));
          if (f.multiSelect) {
            return <MultiPicker key={f.id} label={label} options={choices} value={asList(value).map(snapId)} onChange={(ids) => set(f.internalName, ids)} />;
          }
          return <Picker key={f.id} label={label} options={choices} value={text || null} onChange={(v) => set(f.internalName, v ?? '')} />;
        }

        switch (f.fieldType) {
          case 'textArea':
            return <div key={f.id} className="sm:col-span-2"><TextField label={label} value={text} onChange={(v) => set(f.internalName, v)} multiline /></div>;
          case 'number':
            return <NumberField key={f.id} label={label} value={text === '' ? null : Number(text)} onChange={(v) => set(f.internalName, v === null ? '' : String(v))} />;
          case 'date':
            return <DateField key={f.id} label={label} value={text} onChange={(v) => set(f.internalName, v)} />;
          default:
            return f.multiLine
              ? <div key={f.id} className="sm:col-span-2"><TextField label={label} value={text} onChange={(v) => set(f.internalName, v)} multiline /></div>
              : <TextField key={f.id} label={label} value={text} onChange={(v) => set(f.internalName, v)} />;
        }
      })}
    </div>
  );
}

/** Human text for a captured value, for read-only views. */
export function valueText(v: FormFieldValue): string {
  return asList(v).map((x) => (typeof x === 'string' ? x : x.ticker ?? x.name)).filter(Boolean).join(', ');
}
