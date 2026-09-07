import { useState } from 'react';
import { useAuth } from '../../cms/auth';
import { BtnGhost, BtnPrimary, Chip, ModuleHeader, RowAction, SelectField, TextField, useConfirm } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconCheck, IconPen, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms } from '../store';
import DataTable, { type Column } from '../kit/DataTable';
import { FormError } from '../kit/fields';
import { errorText, useToast } from '../kit/toast';
import { SELLSIDE_TYPES, type SellsideContact } from '../data';

/* ─────────────────────────────────────────────────────────────
   Regis directory — the sell-side staff who appear on schedules,
   coverage teams and interaction attendee lists. The two desk
   mailboxes (research@, sales@) sort to the top.
   ───────────────────────────────────────────────────────────── */

type Draft = { id: string | null; name: string; email: string; type: string; position: string; officeNo: string; mobileNo: string };
const BLANK: Draft = { id: null, name: '', email: '', type: 'Research', position: '', officeNo: '', mobileNo: '' };
const DESKS = ['research@regis.ph', 'sales@regis.ph'];

export default function SellsideModule() {
  const { sellsideContacts, status, mutate, destroy } = useCrms();
  const { can } = useAuth();
  const { notify } = useToast();
  const manage = can('crms.contacts.manage');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();

  const rows = sellsideContacts.slice().sort((a, b) => Number(DESKS.includes(b.email)) - Number(DESKS.includes(a.email)) || a.name.localeCompare(b.name));

  const open = (s?: SellsideContact) => {
    setError(null);
    setDraft(s ? { id: s.id, name: s.name, email: s.email, type: s.type ?? 'Research', position: s.position ?? '', officeNo: s.officeNo ?? '', mobileNo: s.mobileNo ?? '' } : BLANK);
  };

  async function save() {
    if (!draft) return;
    if (draft.name.trim().length < 2 || !draft.email.includes('@')) { setError('A name and a work email are required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await mutate('sellsideContacts', draft.id ? `/crms/sellside-contacts/${draft.id}` : '/crms/sellside-contacts', draft.id ? 'PUT' : 'POST', {
        name: draft.name, email: draft.email, type: draft.type || null, position: draft.position || null, officeNo: draft.officeNo || null, mobileNo: draft.mobileNo || null,
      });
      notify(draft.id ? 'Directory entry updated.' : 'Added to the directory.');
      setDraft(null);
    } catch (e) {
      setError(errorText(e, 'The entry could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: SellsideContact) {
    try {
      await destroy('sellsideContacts', `/crms/sellside-contacts/${s.id}`, s.id);
      notify(`${s.name} removed.`);
    } catch (e) {
      notify(errorText(e, 'The entry could not be removed.'), 'warn');
    }
  }

  const columns: Column<SellsideContact>[] = [
    { key: 'name', label: 'Name', render: (s) => <span className="text-ink">{s.name}{DESKS.includes(s.email) && <span className="mono ml-2 text-[9px] uppercase tracking-[0.14em] text-[color:var(--color-amber-deep)]">desk</span>}</span> },
    { key: 'type', label: 'Desk', render: (s) => s.type ? <Chip tone={s.type === 'Research' ? 'live' : s.type === 'Sales' ? 'amber' : 'muted'}>{s.type}</Chip> : <span className="text-silver">—</span> },
    { key: 'position', label: 'Position' },
    { key: 'email', label: 'Email', mono: true },
    { key: 'officeNo', label: 'Office', mono: true, hidden: true },
    { key: 'mobileNo', label: 'Mobile', mono: true },
  ];

  return (
    <div className="space-y-10">
      <ModuleHeader
        code="07 · Regis directory"
        title="Sell-side contacts"
        blurb="Analysts, sales and management as they appear on itineraries, coverage teams and interaction records. Keep positions and numbers current — schedules print them."
        actions={manage && <BtnPrimary onClick={() => open()}><IconPlus size={14} /> New entry</BtnPrimary>}
      />

      <DataTable
        rows={rows}
        columns={columns}
        loading={status === 'loading'}
        title="Regis directory"
        storageKey="sellside"
        emptyTitle="The directory is empty."
        emptyHint="Add the desk mailboxes first, then each analyst and salesperson."
        actions={(s) => manage && (
          <>
            <RowAction label="Edit" onClick={() => open(s)}><IconPen /></RowAction>
            <RowAction label={armed === s.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(s.id, () => { void remove(s); })}>{armed === s.id ? <IconCheck /> : <IconTrash />}</RowAction>
          </>
        )}
      />

      {draft && (
        <Modal open title={draft.id ? `Edit · ${draft.name}` : 'New directory entry'} onClose={() => setDraft(null)}
          footer={<><BtnGhost onClick={() => setDraft(null)}>Cancel</BtnGhost><BtnPrimary onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add entry'}</BtnPrimary></>}>
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
              <TextField label="Email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} placeholder="name@regis.ph" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField label="Desk" value={draft.type} onChange={(v) => setDraft({ ...draft, type: v })} options={SELLSIDE_TYPES} />
              <TextField label="Position" value={draft.position} onChange={(v) => setDraft({ ...draft, position: v })} placeholder="Senior Analyst, Banks" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Office no." value={draft.officeNo} onChange={(v) => setDraft({ ...draft, officeNo: v })} />
              <TextField label="Mobile no." value={draft.mobileNo} onChange={(v) => setDraft({ ...draft, mobileNo: v })} />
            </div>
            <FormError message={error} />
          </div>
        </Modal>
      )}
    </div>
  );
}
