import { useState } from 'react';
import { BtnGhost, BtnPrimary, Chip, ModuleHeader, RowAction, TextField, useConfirm } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconCheck, IconPen, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms } from '../store';
import DataTable, { type Column } from '../kit/DataTable';
import { FormError, Picker } from '../kit/fields';
import { useOptions } from '../kit/options';
import { errorText, useToast } from '../kit/toast';
import type { InteractionType } from '../data';

/* ─────────────────────────────────────────────────────────────
   Interaction types — the taxonomy an interaction is filed
   under, global or per client, each with its allowed sub-types.
   ───────────────────────────────────────────────────────────── */

type Draft = { id: string | null; type: string; meetingTypes: string; clientId: string | null };

export default function InteractionTypesModule() {
  const { interactionTypes, clients, status, mutate, destroy } = useCrms();
  const options = useOptions();
  const { notify } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();
  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? `Client #${id}` : null);

  const open = (t?: InteractionType) => {
    setError(null);
    setDraft(t ? { id: t.id, type: t.type, meetingTypes: t.meetingTypes.join('\n'), clientId: t.clientId } : { id: null, type: '', meetingTypes: '', clientId: null });
  };

  async function save() {
    if (!draft) return;
    if (draft.type.trim().length < 2) { setError('Name the type.'); return; }
    setSaving(true); setError(null);
    try {
      await mutate('interactionTypes', draft.id ? `/crms/interaction-types/${draft.id}` : '/crms/interaction-types', draft.id ? 'PUT' : 'POST', {
        type: draft.type, meetingTypes: draft.meetingTypes.split('\n').map((s) => s.trim()).filter(Boolean), clientId: draft.clientId ? Number(draft.clientId) : null,
      });
      notify('Interaction type saved.');
      setDraft(null);
    } catch (e) { setError(errorText(e, 'The type could not be saved.')); } finally { setSaving(false); }
  }

  async function remove(t: InteractionType) {
    try { await destroy('interactionTypes', `/crms/interaction-types/${t.id}`, t.id); notify(`${t.type} removed.`); }
    catch (e) { notify(errorText(e, 'Could not remove the type.'), 'warn'); }
  }

  const columns: Column<InteractionType>[] = [
    { key: 'type', label: 'Type', render: (t) => <span className="text-ink">{t.type}</span> },
    { key: 'scope', label: 'Scope', value: (t) => clientName(t.clientId) ?? 'Global', render: (t) => t.clientId ? <span className="text-slate">{clientName(t.clientId)}</span> : <Chip tone="live">Global</Chip> },
    { key: 'meetingTypes', label: 'Sub-types', value: (t) => t.meetingTypes.join(', '), render: (t) => (
      <span className="flex flex-wrap gap-1.5">{t.meetingTypes.map((m) => <span key={m} className="border rule bg-paper px-2 py-0.5 text-[12px] text-slate">{m}</span>)}</span>
    ) },
  ];

  return (
    <div className="space-y-10">
      <ModuleHeader code="11 · Interaction types" title="Interaction types" blurb="How the desk classifies a touchpoint. Global types apply to every client; a client-scoped type appears only on that client's form. Sub-types become the meeting-type list."
        actions={<BtnPrimary onClick={() => open()}><IconPlus size={14} /> New type</BtnPrimary>} />

      <DataTable rows={interactionTypes} columns={columns} loading={status === 'loading'} title="Interaction types" storageKey="interaction-types" initialPageSize={50}
        emptyTitle="No interaction types yet." emptyHint="Start with Conference Call, Meeting, Corporate Access and Email / Chat."
        actions={(t) => (
          <>
            <RowAction label="Edit" onClick={() => open(t)}><IconPen /></RowAction>
            <RowAction label={armed === t.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(t.id, () => { void remove(t); })}>{armed === t.id ? <IconCheck /> : <IconTrash />}</RowAction>
          </>
        )} />

      {draft && (
        <Modal open title={draft.id ? `Edit · ${draft.type}` : 'New interaction type'} onClose={() => setDraft(null)}
          footer={<><BtnGhost onClick={() => setDraft(null)}>Cancel</BtnGhost><BtnPrimary onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save type'}</BtnPrimary></>}>
          <div className="space-y-5">
            <TextField label="Type" value={draft.type} onChange={(v) => setDraft({ ...draft, type: v })} placeholder="Conference Call" />
            <Picker label="Scope" options={options.clients} value={draft.clientId} onChange={(v) => setDraft({ ...draft, clientId: v })} placeholder="Global — every client" hint="leave empty for global" />
            <TextField label="Sub-types" value={draft.meetingTypes} onChange={(v) => setDraft({ ...draft, meetingTypes: v })} multiline placeholder={'One-on-one\nGroup call\nEarnings call'} helper="One per line." />
            <FormError message={error} />
          </div>
        </Modal>
      )}
    </div>
  );
}
