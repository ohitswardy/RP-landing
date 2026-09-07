import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../cms/auth';
import { BtnGhost, BtnPrimary, Chip, ModuleHeader, RowAction, SelectField, TextField, useConfirm } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconArrowRight, IconCheck, IconPen, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms } from '../store';
import DataTable, { type Column } from '../kit/DataTable';
import { FormError, SectionRule } from '../kit/fields';
import { errorText, useToast } from '../kit/toast';
import type { Client, ClientAddress } from '../data';

/* ─────────────────────────────────────────────────────────────
   Clients — the institutional firms. A list with counts, and a
   detail view per firm: addresses, contacts, and the two portal
   reconciliation lists (§7.6) — contacts with no portal account,
   and portal accounts at this firm with no contact.
   ───────────────────────────────────────────────────────────── */

type Draft = { id: string | null; name: string; region: string; monikers: string; clientType: string };
const BLANK: Draft = { id: null, name: '', region: '', monikers: '', clientType: 'Local' };

export default function ClientsModule() {
  const { id } = useParams();
  const { clients, status, mutate, destroy } = useCrms();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();
  const manage = can('crms.contacts.manage');

  const open = (c?: Client) => {
    setError(null);
    setDraft(c ? { id: c.id, name: c.name, region: c.region ?? '', monikers: c.monikers ?? '', clientType: c.clientType ?? 'Local' } : BLANK);
  };

  async function save() {
    if (!draft) return;
    if (draft.name.trim().length < 2) { setError('Give the client a name.'); return; }
    setSaving(true);
    setError(null);
    try {
      const body = { name: draft.name, region: draft.region || null, monikers: draft.monikers || null, clientType: draft.clientType || null };
      const item = await mutate('clients', draft.id ? `/crms/clients/${draft.id}` : '/crms/clients', draft.id ? 'PUT' : 'POST', body);
      notify(draft.id ? 'Client updated.' : `${item.name} added.`);
      setDraft(null);
    } catch (e) {
      setError(errorText(e, 'The client could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Client) {
    try {
      await destroy('clients', `/crms/clients/${c.id}`, c.id);
      notify(`${c.name} removed.`);
      if (id === c.id) navigate('/crms/clients');
    } catch (e) {
      notify(errorText(e, 'The client could not be removed.'), 'warn');
    }
  }

  const columns: Column<Client>[] = [
    { key: 'name', label: 'Client', render: (c) => <Link to={`/crms/clients/${c.id}`} className="text-ink hover:text-[color:var(--color-amber-deep)]">{c.name}</Link> },
    { key: 'region', label: 'Region' },
    { key: 'clientType', label: 'Type', render: (c) => c.clientType ? <Chip tone={c.clientType === 'Local' ? 'live' : 'amber'}>{c.clientType}</Chip> : <span className="text-silver">—</span> },
    { key: 'monikers', label: 'Also known as', hidden: true },
    { key: 'contactCount', label: 'Contacts', mono: true, align: 'right' },
    { key: 'addressCount', label: 'Offices', mono: true, align: 'right', hidden: true },
    { key: 'interactionCount', label: 'Interactions', mono: true, align: 'right' },
  ];

  const selected = id ? clients.find((c) => c.id === id) ?? null : null;

  return (
    <div className="space-y-10">
      <ModuleHeader
        code="04 · Clients"
        title="Clients"
        blurb="Institutional investor firms: the buy-side. Each carries its offices, its people, and the portal accounts the CMS has issued to them."
        actions={manage && <BtnPrimary onClick={() => open()}><IconPlus size={14} /> New client</BtnPrimary>}
      />

      {selected ? (
        <ClientDetail client={selected} onEdit={() => open(selected)} />
      ) : (
        <DataTable
          rows={clients}
          columns={columns}
          loading={status === 'loading'}
          title="Clients"
          storageKey="clients"
          emptyTitle="No clients yet."
          emptyHint="Add the first firm, then its offices and contacts."
          onRowClick={(c) => navigate(`/crms/clients/${c.id}`)}
          actions={(c) => (
            <>
              <RowAction label="Open" onClick={() => navigate(`/crms/clients/${c.id}`)}><IconArrowRight size={14} /></RowAction>
              {manage && <RowAction label="Edit" onClick={() => open(c)}><IconPen /></RowAction>}
              {manage && (
                <RowAction label={armed === c.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(c.id, () => { void remove(c); })}>
                  {armed === c.id ? <IconCheck /> : <IconTrash />}
                </RowAction>
              )}
            </>
          )}
        />
      )}

      {draft && (
        <Modal
          open
          title={draft.id ? `Edit · ${draft.name}` : 'New client'}
          onClose={() => setDraft(null)}
          footer={<><BtnGhost onClick={() => setDraft(null)}>Cancel</BtnGhost><BtnPrimary onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create client'}</BtnPrimary></>}
        >
          <div className="space-y-5">
            <TextField label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Schroders" />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Region" value={draft.region} onChange={(v) => setDraft({ ...draft, region: v })} placeholder="United Kingdom" />
              <SelectField label="Client type" value={draft.clientType} onChange={(v) => setDraft({ ...draft, clientType: v })} options={['Local', 'Foreign']} />
            </div>
            <TextField label="Also known as" value={draft.monikers} onChange={(v) => setDraft({ ...draft, monikers: v })} placeholder="Schroder Investment Management, SIM" helper="Aliases help match portal accounts by firm name." />
            <FormError message={error} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Detail ────────────────────────────────────────────────── */

function ClientDetail({ client, onEdit }: { client: Client; onEdit: () => void }) {
  const { addresses, clientContacts, portalAccounts, mutate, destroy } = useCrms();
  const { can } = useAuth();
  const { notify } = useToast();
  const manage = can('crms.contacts.manage');
  const [addr, setAddr] = useState<{ id: string | null; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, confirm] = useConfirm();

  const myAddresses = addresses.filter((a) => a.clientId === client.id);
  const myContacts = clientContacts.filter((c) => c.clientId === client.id);

  // Reconciliation: contacts without a portal account, and portal accounts
  // at this firm (by name or alias) that no contact is linked to.
  const unlinked = myContacts.filter((c) => !c.portalUserId);
  const terms = useMemo(() => [client.name, ...(client.monikers ?? '').split(/[,;/]+/)].map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 3), [client]);
  const linkedIds = new Set(clientContacts.map((c) => c.portalUserId).filter(Boolean));
  const orphans = portalAccounts.filter((a) => !linkedIds.has(a.id) && terms.some((t) => (a.firm ?? '').toLowerCase().includes(t)));

  useEffect(() => { setAddr(null); }, [client.id]);

  async function saveAddress() {
    if (!addr || addr.name.trim().length < 3) return;
    setBusy(true);
    try {
      await mutate('addresses', addr.id ? `/crms/clients/${client.id}/addresses/${addr.id}` : `/crms/clients/${client.id}/addresses`, addr.id ? 'PUT' : 'POST', { name: addr.name.trim() });
      notify('Office saved.');
      setAddr(null);
    } catch (e) {
      notify(errorText(e, 'The office could not be saved.'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(a: ClientAddress) {
    try {
      await destroy('addresses', `/crms/clients/${client.id}/addresses/${a.id}`, a.id);
      notify('Office removed.');
    } catch (e) {
      notify(errorText(e, 'The office could not be removed.'), 'warn');
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to="/crms/clients" className="mono text-[10px] uppercase tracking-[0.16em] text-graphite hover:text-ink">← All clients</Link>
          <h2 className="mt-3 text-[clamp(1.4rem,2.2vw,1.9rem)] tracking-[-0.02em] text-ink">{client.name}</h2>
          <p className="mono mt-2 flex flex-wrap items-center gap-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite">
            <span>{client.region ?? 'Region not set'}</span>
            {client.clientType && <Chip tone={client.clientType === 'Local' ? 'live' : 'amber'}>{client.clientType}</Chip>}
            {client.monikers && <span className="normal-case tracking-normal text-silver">aka {client.monikers}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/crms/interactions?clientId=${client.id}`} className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink">
            {client.interactionCount} interactions <IconArrowRight size={12} />
          </Link>
          {manage && <BtnGhost onClick={onEdit}><IconPen size={13} /> Edit client</BtnGhost>}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-5">
          <SectionRule code="Offices" title={`${myAddresses.length} address${myAddresses.length === 1 ? '' : 'es'}`} actions={manage && <BtnGhost onClick={() => setAddr({ id: null, name: '' })}><IconPlus size={12} /> Add</BtnGhost>} />
          {myAddresses.length === 0 && !addr && <p className="text-[13px] text-graphite">No office recorded.</p>}
          <ul className="divide-y rule">
            {myAddresses.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                {addr?.id === a.id ? (
                  <AddressEditor value={addr.name} onChange={(v) => setAddr({ id: a.id, name: v })} onSave={saveAddress} onCancel={() => setAddr(null)} busy={busy} />
                ) : (
                  <>
                    <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-slate">{a.name}</p>
                    {manage && (
                      <span className="flex shrink-0 gap-1.5">
                        <RowAction label="Edit office" onClick={() => setAddr({ id: a.id, name: a.name })}><IconPen /></RowAction>
                        <RowAction label={armed === a.id ? 'Confirm' : 'Remove office'} danger onClick={() => confirm(a.id, () => { void removeAddress(a); })}>{armed === a.id ? <IconCheck /> : <IconTrash />}</RowAction>
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
            {addr && addr.id === null && (
              <li className="py-3"><AddressEditor value={addr.name} onChange={(v) => setAddr({ id: null, name: v })} onSave={saveAddress} onCancel={() => setAddr(null)} busy={busy} /></li>
            )}
          </ul>
        </section>

        <section className="space-y-4 lg:col-span-7">
          <SectionRule code="People" title={`${myContacts.length} contact${myContacts.length === 1 ? '' : 's'}`} actions={manage && <Link to={`/crms/client-contacts/new?clientId=${client.id}`} className="mono inline-flex items-center gap-1.5 border rule px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"><IconPlus size={12} /> Add contact</Link>} />
          {myContacts.length === 0 ? <p className="text-[13px] text-graphite">No contacts yet.</p> : (
            <ul className="divide-y rule">
              {myContacts.map((c) => (
                <li key={c.id} className="grid grid-cols-12 items-center gap-3 py-3">
                  <div className="col-span-7 min-w-0">
                    <Link to={`/crms/client-contacts/${c.id}`} className="block truncate text-[13.5px] text-ink hover:text-[color:var(--color-amber-deep)]">{c.name}</Link>
                    <p className="truncate text-[12px] text-graphite">{c.position ?? c.email ?? '—'}</p>
                  </div>
                  <div className="col-span-5 flex justify-end">
                    {c.portalUserId ? <Chip tone="live">Portal linked</Chip> : <Chip tone="muted">No portal account</Chip>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-4 border-t rule pt-8">
        <SectionRule code="Reconciliation · §7.6" title="Portal accounts vs. contacts" />
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="mono mb-3 text-[10px] uppercase tracking-[0.16em] text-graphite">Contacts with no portal account · {unlinked.length}</p>
            {unlinked.length === 0 ? <p className="text-[13px] text-graphite">Every contact here has a portal account linked.</p> : (
              <ul className="space-y-1.5">
                {unlinked.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-slate">{c.name} <span className="text-silver">{c.email ?? ''}</span></span>
                    <Link to={`/crms/client-contacts/${c.id}`} className="mono shrink-0 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-amber-deep)] hover:underline">Link →</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mono mb-3 text-[10px] uppercase tracking-[0.16em] text-graphite">Portal accounts with no contact · {orphans.length}</p>
            {orphans.length === 0 ? <p className="text-[13px] text-graphite">No unmatched portal accounts at this firm.</p> : (
              <ul className="space-y-1.5">
                {orphans.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-slate">{a.name} <span className="text-silver">{a.email}</span></span>
                    <Link to={`/crms/client-contacts/new?clientId=${client.id}&portalUserId=${a.id}`} className="mono shrink-0 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-amber-deep)] hover:underline">Create contact →</Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[12px] text-silver">Accounts are provisioned in <a href="/cms/access" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">CMS → Users &amp; access</a>; the CRMS only links to them.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function AddressEditor({ value, onChange, onSave, onCancel, busy }: { value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div className="w-full space-y-3">
      <TextField label="Office address" value={value} onChange={onChange} multiline placeholder="Floor, building, street, city" />
      <div className="flex justify-end gap-2">
        <BtnGhost onClick={onCancel}>Cancel</BtnGhost>
        <BtnPrimary onClick={onSave} disabled={busy || value.trim().length < 3}>{busy ? 'Saving…' : 'Save office'}</BtnPrimary>
      </div>
    </div>
  );
}
