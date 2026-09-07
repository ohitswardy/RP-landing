import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { BtnGhost, BtnPrimary, Chip, DateField, SelectField, TextField } from '../../../cms/ui';
import { IconArrowRight, IconCheck } from '../../../cms/icons';
import { useCrms } from '../../store';
import { FormError, MultiPicker, NumberField, Picker, SectionRule, TimeField } from '../../kit/fields';
import { useOptions } from '../../kit/options';
import { errorText, useToast } from '../../kit/toast';
import DynamicForm, { seedValues } from './DynamicForm';
import { fmtMinutes, today, type AuditEntry, type FormValue, type Interaction, type InteractionPayload } from '../../data';

/* ─────────────────────────────────────────────────────────────
   One interaction. The client picks the form (its own, else the
   default) and narrows the type list and attendees. Every save
   is stored; the two buttons differ only in what happens after:
   close, or flag it and hand it to the CMS Email desk composer
   pre-filled (§7.1). Nothing here sends mail.
   ───────────────────────────────────────────────────────────── */

type Draft = Omit<InteractionPayload, 'disposition'>;

function toDraft(i: Interaction | null, presets: { clientId?: string | null; contactId?: string | null }): Draft {
  return {
    clientId: i?.clientId ?? presets.clientId ?? '',
    typeId: i?.typeId ?? null,
    date: i?.date ?? today(),
    timeStart: i?.timeStart ?? null,
    timeEnd: i?.timeEnd ?? null,
    duration: i?.duration ? Number(i.duration) : null,
    meetingType: i?.meetingType ?? null,
    description: i?.description ?? '',
    internalNotes: i?.internalNotes ?? '',
    actionPoint: i?.actionPoint ?? '',
    recipients: i?.recipients ?? '',
    clientContactIds: i?.clientContacts.map((c) => String(c.id)) ?? (presets.contactId ? [presets.contactId] : []),
    sellsideContactIds: i?.sellsideContacts.map((s) => String(s.id)) ?? [],
    form: i?.form ?? [],
  };
}

function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  const d = bh * 60 + bm - (ah * 60 + am);
  return d > 0 ? d : null;
}

type ItemResponse = { item: Interaction; audit?: AuditEntry };

export default function InteractionForm({ interaction, presets, onSaved }: {
  interaction: Interaction | null;
  presets: { clientId?: string | null; contactId?: string | null };
  onSaved: (item: Interaction) => void;
}) {
  const { forms, interactionTypes, meta, appendAudit } = useCrms();
  const options = useOptions();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(interaction, presets));
  const [saving, setSaving] = useState<'closed' | 'flagged' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // The client's own form, else the default one (client_id null), else the "Generic Form" client's — the legacy convention.
  const form = useMemo(
    () => forms.find((f) => f.clientId === draft.clientId) ?? forms.find((f) => f.clientId === null) ?? forms.find((f) => f.clientId === meta.genericClientId) ?? null,
    [forms, draft.clientId, meta.genericClientId],
  );
  useEffect(() => {
    setDraft((d) => ({ ...d, form: seedValues(form?.fields ?? [], d.form) }));
  }, [form]);

  const type = interactionTypes.find((t) => t.id === draft.typeId) ?? null;
  const meetingTypes = type?.meetingTypes ?? [];
  const derived = minutesBetween(draft.timeStart, draft.timeEnd);
  const minutes = draft.duration ?? derived ?? 0;
  const locked = interaction?.disposition === 'flagged' && !!interaction.actionedAt;

  async function save(disposition: 'closed' | 'flagged') {
    if (!draft.clientId) { setError('Pick the client.'); return; }
    if (!draft.date) { setError('Set the interaction date.'); return; }
    const empty = (v: unknown) => v === null || v === '' || (Array.isArray(v) && v.length === 0);
    const missing = (form?.fields ?? []).filter((f) => f.required && empty(draft.form.find((v) => v.internalName === f.internalName)?.value));
    if (missing.length) { setError(`Fill in ${missing.map((f) => f.label).join(', ')}.`); return; }
    setSaving(disposition); setError(null);
    try {
      const body: InteractionPayload = {
        ...draft,
        typeId: draft.typeId,
        clientContactIds: draft.clientContactIds,
        sellsideContactIds: draft.sellsideContactIds,
        disposition,
      };
      const wire = {
        ...body,
        clientId: Number(body.clientId), typeId: body.typeId ? Number(body.typeId) : null,
        clientContactIds: body.clientContactIds.map(Number), sellsideContactIds: body.sellsideContactIds.map(Number),
        description: body.description || null, internalNotes: body.internalNotes || null, actionPoint: body.actionPoint || null, recipients: body.recipients || null,
      };
      const res = interaction
        ? await apiFetch<ItemResponse>(`/crms/interactions/${interaction.id}`, { method: 'PUT', audience: 'cms', body: wire })
        : await apiFetch<ItemResponse>('/crms/interactions', { method: 'POST', audience: 'cms', body: wire });
      appendAudit(res.audit);

      if (disposition === 'flagged') {
        // Mark it actioned, then open the Email desk composer with the summary pre-filled.
        const actioned = await apiFetch<ItemResponse>(`/crms/interactions/${res.item.id}/actioned`, { method: 'POST', audience: 'cms' });
        appendAudit(actioned.audit);
        onSaved(actioned.item);
        const subject = `Interaction ${actioned.item.reference} · ${actioned.item.clientName ?? ''}`;
        const body = [
          `${actioned.item.clientName ?? ''} — ${actioned.item.typeName ?? 'Interaction'}${actioned.item.meetingType ? ` (${actioned.item.meetingType})` : ''} on ${actioned.item.date}`,
          '', actioned.item.description ?? '', '',
          actioned.item.actionPoint ? `Action point: ${actioned.item.actionPoint}` : '',
        ].join('\n').trim();
        const params = new URLSearchParams({ compose: 'adhoc', subject, body, to: actioned.item.recipients ?? '' });
        window.open(`/cms/email?${params}`, '_blank', 'noopener');
        notify('Saved and handed to the Email desk.');
        navigate('/crms/interactions');
      } else {
        onSaved(res.item);
        notify(interaction ? 'Interaction saved.' : `Interaction ${res.item.reference} logged.`);
        navigate('/crms/interactions');
      }
    } catch (e) {
      setError(errorText(e, 'The interaction could not be saved.'));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to="/crms/interactions" className="mono text-[10px] uppercase tracking-[0.16em] text-graphite hover:text-ink">← Interactions</Link>
          <h2 className="mono mt-3 text-[clamp(1.4rem,2.2vw,1.9rem)] tracking-[-0.01em] text-ink">{interaction ? interaction.reference : 'New interaction'}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] text-graphite">
            {interaction ? `Logged ${interaction.createdAt ? new Date(interaction.createdAt).toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}` : 'Every interaction is saved — it is the record the firm is paid on.'}
            {interaction?.disposition === 'flagged' && (interaction.actionedAt ? <Chip tone="live">Sent to recipients</Chip> : <Chip tone="amber" pulse>Flag open</Chip>)}
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="mono num text-[1.8rem] leading-none text-ink">{fmtMinutes(minutes)}</span>
          <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">contact time</span>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section className="space-y-5">
            <SectionRule code="Who" title="Client and attendees" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Picker label="Client" options={options.clients} value={draft.clientId || null} onChange={(v) => setDraft((d) => ({ ...d, clientId: v ?? '', typeId: null, meetingType: null, clientContactIds: [] }))} allowEmpty={false} />
              <Picker label="Interaction type" options={options.typesFor(draft.clientId || null, draft.typeId)} value={draft.typeId} onChange={(v) => setDraft((d) => ({ ...d, typeId: v, meetingType: null }))} disabled={!draft.clientId} placeholder={draft.clientId ? 'Choose a type' : 'Pick the client first'} />
              <MultiPicker label="Client contacts" options={options.contactsOf(draft.clientId || null)} value={draft.clientContactIds} onChange={(v) => set('clientContactIds', v)} placeholder={draft.clientId ? 'Who attended' : 'Pick the client first'} />
              <MultiPicker label="Regis attendees" options={options.sellside} value={draft.sellsideContactIds} onChange={(v) => set('sellsideContactIds', v)} placeholder="Analyst, sales" />
            </div>
          </section>

          <section className="space-y-5">
            <SectionRule code="When" title="Date and duration" />
            <div className="grid gap-5 sm:grid-cols-4">
              <DateField label="Date" value={draft.date} onChange={(v) => set('date', v)} />
              <TimeField label="Start" value={draft.timeStart} onChange={(v) => set('timeStart', v)} />
              <TimeField label="End" value={draft.timeEnd} onChange={(v) => set('timeEnd', v)} />
              <NumberField label="Minutes" value={draft.duration} onChange={(v) => set('duration', v)} placeholder={derived ? String(derived) : '—'} hint={derived && !draft.duration ? 'from times' : undefined} />
            </div>
            {meetingTypes.length > 0 && (
              <SelectField label="Sub-type" value={draft.meetingType ?? ''} onChange={(v) => set('meetingType', v || null)} options={['', ...meetingTypes]} />
            )}
          </section>

          <section className="space-y-5">
            <SectionRule code="What" title="Discussion" />
            <TextField label="Description" value={draft.description} onChange={(v) => set('description', v)} multiline placeholder="What was discussed, positions taken, questions asked" />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Action point" value={draft.actionPoint} onChange={(v) => set('actionPoint', v)} multiline placeholder="Follow-ups owed" />
              <TextField label="Internal notes" value={draft.internalNotes} onChange={(v) => set('internalNotes', v)} multiline placeholder="Not printed on client reports" />
            </div>
          </section>

          <section className="space-y-5">
            <SectionRule code={form && form.clientId === draft.clientId ? 'Client form' : 'Generic form'} title="Structured detail" />
            <DynamicForm fields={form?.fields ?? []} values={draft.form} onChange={(v) => set('form', v)} />
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="border rule bg-paper p-5">
            <p className="mono text-[9.5px] uppercase tracking-[0.18em] text-graphite">Save</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate">The interaction is recorded either way. Flag it when sales should move on it now — the Email desk composer opens with the summary, and the send goes through the same Graph pipeline and delivery log as every CMS email.</p>
            <div className="mt-5 space-y-2">
              <BtnPrimary onClick={() => void save('closed')} disabled={saving !== null}><IconCheck size={13} /> {saving === 'closed' ? 'Saving…' : 'Save and close'}</BtnPrimary>
              <button type="button" onClick={() => void save('flagged')} disabled={saving !== null || locked}
                className="inline-flex w-full items-center justify-center gap-2 border px-4 py-2.5 text-[13px] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: 'var(--color-amber-deep)', color: 'var(--color-amber-deep)' }}>
                {saving === 'flagged' ? 'Saving…' : 'Save and send to recipients'} <IconArrowRight size={13} />
              </button>
              {locked && <p className="mono text-[9.5px] uppercase tracking-[0.14em] text-silver">Already handed to the Email desk</p>}
            </div>
            <TextField label="Recipients" value={draft.recipients} onChange={(v) => set('recipients', v)} placeholder="sales@regis.ph, name@client.com" helper="Pre-fills the composer's To line." />
          </div>
          <FormError message={error} />
          <div className="flex justify-end">
            <BtnGhost onClick={() => navigate('/crms/interactions')}>Cancel</BtnGhost>
          </div>
        </aside>
      </div>
    </div>
  );
}
