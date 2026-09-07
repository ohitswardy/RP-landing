import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../cms/auth';
import { BtnGhost, BtnPrimary, Chip, ModuleHeader, RowAction, TextField, useConfirm } from '../../cms/ui';
import { IconArrowRight, IconCheck, IconPen, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms, useLookups } from '../store';
import DataTable, { type Column } from '../kit/DataTable';
import { FormError, MultiPicker, Picker, SectionRule } from '../kit/fields';
import { useOptions } from '../kit/options';
import { errorText, useToast } from '../kit/toast';
import PortalAccountPanel from './clients/PortalAccountPanel';
import type { ClientContact } from '../data';

/* ─────────────────────────────────────────────────────────────
   Client contacts — the individuals the desk talks to. List with
   a client filter and the portal state; a full-page record with
   holdings, watchlist, coverage team, sales, the research
   distribution selection, and the portal bridge alongside.
   ───────────────────────────────────────────────────────────── */

type Draft = {
  clientId: string | null; addressId: string | null; firstName: string; lastName: string; email: string; contactNo: string; mobileNo: string;
  position: string; country: string; assistant: string; assistantEmail: string; assistantContactNo: string;
  ownIds: string[]; watchlistIds: string[]; coverageTeamIds: string[]; salesIds: string[]; sectorGroupIds: string[];
};

function toDraft(c: ClientContact | null, clientId: string | null): Draft {
  return {
    clientId: c?.clientId ?? clientId, addressId: c?.addressId ?? null, firstName: c?.firstName ?? '', lastName: c?.lastName ?? '', email: c?.email ?? '',
    contactNo: c?.contactNo ?? '', mobileNo: c?.mobileNo ?? '', position: c?.position ?? '', country: c?.country ?? '',
    assistant: c?.assistant ?? '', assistantEmail: c?.assistantEmail ?? '', assistantContactNo: c?.assistantContactNo ?? '',
    ownIds: c?.own.map((x) => String(x.id)) ?? [], watchlistIds: c?.watchlist.map((x) => String(x.id)) ?? [],
    coverageTeamIds: c?.coverageTeam.map((x) => String(x.id)) ?? [], salesIds: c?.sales.map((x) => String(x.id)) ?? [],
    sectorGroupIds: c?.sectorGroupIds ?? [],
  };
}

export default function ClientContactsModule() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { clientContacts, status, destroy } = useCrms();
  const { can } = useAuth();
  const options = useOptions();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [armed, confirm] = useConfirm();
  const manage = can('crms.contacts.manage');
  const clientFilter = params.get('clientId');

  if (id) {
    const existing = id === 'new' ? null : clientContacts.find((c) => c.id === id) ?? null;
    if (id !== 'new' && !existing && status === 'ready') {
      return <p className="text-[13px] text-graphite">That contact no longer exists. <Link to="/crms/client-contacts" className="text-ink underline-offset-4 hover:underline">Back to contacts</Link>.</p>;
    }
    if (id !== 'new' && !existing) return null;
    return <ContactRecord key={id} contact={existing} presetClientId={params.get('clientId')} presetPortalUserId={params.get('portalUserId')} />;
  }

  async function remove(c: ClientContact) {
    try { await destroy('clientContacts', `/crms/client-contacts/${c.id}`, c.id); notify(`${c.name} removed.`); }
    catch (e) { notify(errorText(e, 'Could not remove the contact.'), 'warn'); }
  }

  const rows = clientFilter ? clientContacts.filter((c) => c.clientId === clientFilter) : clientContacts;

  const columns: Column<ClientContact>[] = [
    { key: 'name', label: 'Contact', render: (c) => <Link to={`/crms/client-contacts/${c.id}`} className="text-ink hover:text-[color:var(--color-amber-deep)]">{c.name}</Link> },
    { key: 'clientName', label: 'Client' },
    { key: 'position', label: 'Position' },
    { key: 'email', label: 'Email', mono: true },
    { key: 'country', label: 'Country', hidden: true },
    { key: 'own', label: 'Holds', value: (c) => c.own.map((o) => o.ticker ?? o.name).join(' '), render: (c) => <Tickers items={c.own} /> },
    { key: 'watchlist', label: 'Watches', value: (c) => c.watchlist.map((o) => o.ticker ?? o.name).join(' '), render: (c) => <Tickers items={c.watchlist} />, hidden: true },
    { key: 'portal', label: 'Portal', value: (c) => (c.portalUserId ? 'linked' : 'unlinked'), render: (c) => (c.portalUserId ? <Chip tone="live">Linked</Chip> : <Chip tone="muted">No account</Chip>) },
    { key: 'sectors', label: 'Sectors', value: (c) => c.sectorGroupIds.length, mono: true, align: 'right', hidden: true },
  ];

  return (
    <div className="space-y-10">
      <ModuleHeader code="05 · Client contacts" title="Client contacts" blurb="The buy-side individuals behind every interaction: what they hold and watch, who covers them, which research they are tagged for, and whether their portal account is linked."
        actions={manage && <BtnPrimary onClick={() => navigate('/crms/client-contacts/new' + (clientFilter ? `?clientId=${clientFilter}` : ''))}><IconPlus size={14} /> New contact</BtnPrimary>} />

      <DataTable rows={rows} columns={columns} loading={status === 'loading'} title="Client contacts" storageKey="client-contacts"
        emptyTitle={clientFilter ? 'No contacts at this client.' : 'No client contacts yet.'} emptyHint="Add the people the desk talks to. Contacts with a matching portal email link automatically."
        onRowClick={(c) => navigate(`/crms/client-contacts/${c.id}`)}
        toolbar={<div className="w-[260px]"><Picker label="Client" options={options.clients} value={clientFilter} onChange={(v) => setParams(v ? { clientId: v } : {})} placeholder="Every client" /></div>}
        actions={(c) => (
          <>
            <RowAction label="Open" onClick={() => navigate(`/crms/client-contacts/${c.id}`)}><IconArrowRight size={14} /></RowAction>
            {manage && <RowAction label={armed === c.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(c.id, () => { void remove(c); })}>{armed === c.id ? <IconCheck /> : <IconTrash />}</RowAction>}
          </>
        )} />
    </div>
  );
}

function Tickers({ items }: { items: { id: number; name: string; ticker: string | null }[] }) {
  if (items.length === 0) return <span className="text-silver">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.slice(0, 6).map((o) => <span key={o.id} className="mono border rule bg-paper px-1.5 py-0.5 text-[10.5px] tracking-[0.04em] text-slate" title={o.name}>{o.ticker ?? o.name}</span>)}
      {items.length > 6 && <span className="mono text-[10px] text-silver">+{items.length - 6}</span>}
    </span>
  );
}

/* ── Record ────────────────────────────────────────────────── */

function ContactRecord({ contact, presetClientId, presetPortalUserId }: { contact: ClientContact | null; presetClientId: string | null; presetPortalUserId: string | null }) {
  const { addresses, sectorGroups, mutate, put, appendAudit } = useCrms();
  const { clientById } = useLookups();
  const { can } = useAuth();
  const options = useOptions();
  const navigate = useNavigate();
  const { notify } = useToast();
  const manage = can('crms.contacts.manage');
  const [draft, setDraft] = useState<Draft>(() => toDraft(contact, presetClientId));
  const [editing, setEditing] = useState(contact === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDraft(toDraft(contact, presetClientId)); }, [contact, presetClientId]);

  const addressOptions = useMemo(() => addresses.filter((a) => a.clientId === draft.clientId).map((a) => ({ id: a.id, label: a.name })), [addresses, draft.clientId]);
  const groupOptions = useMemo(() => sectorGroups.map((g) => ({ id: g.id, label: g.name, hint: g.scope })), [sectorGroups]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const nul = (s: string) => s.trim() || null;

  async function save() {
    if (!draft.clientId) { setError('Pick the client this person belongs to.'); return; }
    if (draft.firstName.trim().length < 1) { setError('A first name is required.'); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        clientId: Number(draft.clientId), addressId: draft.addressId ? Number(draft.addressId) : null,
        firstName: draft.firstName, lastName: nul(draft.lastName), email: nul(draft.email), contactNo: nul(draft.contactNo), mobileNo: nul(draft.mobileNo),
        position: nul(draft.position), country: nul(draft.country), assistant: nul(draft.assistant), assistantEmail: nul(draft.assistantEmail), assistantContactNo: nul(draft.assistantContactNo),
        ownIds: draft.ownIds.map(Number), watchlistIds: draft.watchlistIds.map(Number), coverageTeamIds: draft.coverageTeamIds.map(Number), salesIds: draft.salesIds.map(Number),
        sectorGroupIds: draft.sectorGroupIds.map(Number),
      };
      const saved = await mutate('clientContacts', contact ? `/crms/client-contacts/${contact.id}` : '/crms/client-contacts', contact ? 'PUT' : 'POST', body);
      // A contact created from the reconciliation list links to the chosen account straight away.
      if (!contact && presetPortalUserId && !saved.portalUserId) {
        const res = await apiFetch<{ item: ClientContact; audit?: { id: string; actor: string; action: string; target: string; at: string } }>(`/crms/client-contacts/${saved.id}/portal`, { method: 'POST', audience: 'cms', body: { portalUserId: Number(presetPortalUserId) } });
        put('clientContacts', res.item);
        appendAudit(res.audit);
      }
      notify(contact ? 'Contact saved.' : `${saved.name} added.`);
      if (!contact) navigate(`/crms/client-contacts/${saved.id}`, { replace: true });
      else setEditing(false);
    } catch (e) {
      setError(errorText(e, 'The contact could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  const client = draft.clientId ? clientById.get(draft.clientId) : null;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to={contact ? `/crms/client-contacts?clientId=${contact.clientId}` : '/crms/client-contacts'} className="mono text-[10px] uppercase tracking-[0.16em] text-graphite hover:text-ink">← Client contacts</Link>
          <h2 className="mt-3 text-[clamp(1.4rem,2.2vw,1.9rem)] tracking-[-0.02em] text-ink">{contact ? contact.name : 'New client contact'}</h2>
          <p className="mono mt-2 flex flex-wrap items-center gap-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite">
            {client ? <Link to={`/crms/clients/${client.id}`} className="hover:text-ink">{client.name}</Link> : <span>No client chosen</span>}
            {contact?.position && <span className="normal-case tracking-normal text-silver">{contact.position}</span>}
          </p>
        </div>
        {contact && manage && !editing && (
          <div className="flex gap-2">
            <Link to={`/crms/interactions/new?clientId=${contact.clientId}&contactId=${contact.id}`} className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink">Log interaction <IconArrowRight size={12} /></Link>
            <BtnGhost onClick={() => setEditing(true)}><IconPen size={13} /> Edit</BtnGhost>
          </div>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          {editing ? (
            <>
              <section className="space-y-5">
                <SectionRule code="Identity" title="Who they are" />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Picker label="Client" options={options.clients} value={draft.clientId} onChange={(v) => { set('clientId', v); set('addressId', null); }} allowEmpty={false} />
                  <Picker label="Office" options={addressOptions} value={draft.addressId} onChange={(v) => set('addressId', v)} placeholder={draft.clientId ? 'Choose an office' : 'Pick the client first'} disabled={!draft.clientId} />
                  <TextField label="First name" value={draft.firstName} onChange={(v) => set('firstName', v)} />
                  <TextField label="Last name" value={draft.lastName} onChange={(v) => set('lastName', v)} />
                  <TextField label="Position" value={draft.position} onChange={(v) => set('position', v)} />
                  <TextField label="Country" value={draft.country} onChange={(v) => set('country', v)} />
                  <TextField label="Email" value={draft.email} onChange={(v) => set('email', v)} helper="An exact match to a portal account links it automatically." />
                  <TextField label="Contact no." value={draft.contactNo} onChange={(v) => set('contactNo', v)} />
                  <TextField label="Mobile no." value={draft.mobileNo} onChange={(v) => set('mobileNo', v)} />
                </div>
              </section>
              <section className="space-y-5">
                <SectionRule code="Coverage" title="Holdings, watchlist and desk" />
                <MultiPicker label="Owns" options={options.corporates} value={draft.ownIds} onChange={(v) => set('ownIds', v)} placeholder="Corporates held" />
                <MultiPicker label="Watchlist" options={options.corporates} value={draft.watchlistIds} onChange={(v) => set('watchlistIds', v)} placeholder="Corporates watched" />
                <div className="grid gap-5 sm:grid-cols-2">
                  <MultiPicker label="Coverage team" options={options.sellside} value={draft.coverageTeamIds} onChange={(v) => set('coverageTeamIds', v)} placeholder="Analysts" />
                  <MultiPicker label="Sales" options={options.sellside} value={draft.salesIds} onChange={(v) => set('salesIds', v)} placeholder="Salesperson" />
                </div>
              </section>
              <section className="space-y-5">
                <SectionRule code="Research distribution · §7.8" title="Sectors of interest" />
                <MultiPicker label="Sector groups" options={groupOptions} value={draft.sectorGroupIds} onChange={(v) => set('sectorGroupIds', v)} placeholder="Banks, Property…" />
                {!contact?.portalUserId && draft.sectorGroupIds.length > 0 && (
                  <p className="mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-amber-deep)]">Not wired to a send until a portal account is linked</p>
                )}
              </section>
              <section className="space-y-5">
                <SectionRule code="Assistant" title="Executive assistant" />
                <div className="grid gap-5 sm:grid-cols-3">
                  <TextField label="Name" value={draft.assistant} onChange={(v) => set('assistant', v)} />
                  <TextField label="Email" value={draft.assistantEmail} onChange={(v) => set('assistantEmail', v)} />
                  <TextField label="Contact no." value={draft.assistantContactNo} onChange={(v) => set('assistantContactNo', v)} />
                </div>
              </section>
              <FormError message={error} />
              <div className="flex justify-end gap-2 border-t rule pt-5">
                <BtnGhost onClick={() => (contact ? (setEditing(false), setDraft(toDraft(contact, presetClientId))) : navigate('/crms/client-contacts'))}>Cancel</BtnGhost>
                <BtnPrimary onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : contact ? 'Save changes' : 'Create contact'}</BtnPrimary>
              </div>
            </>
          ) : contact && <ContactSummary contact={contact} />}
        </div>

        <aside className="space-y-8 lg:col-span-5">
          {contact ? <PortalAccountPanel contact={contact} /> : (
            <div className="border rule border-dashed px-5 py-6 text-[13px] leading-relaxed text-graphite">
              The portal bridge appears once the contact is saved.{presetPortalUserId && ' The chosen portal account will be linked on save.'}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ContactSummary({ contact }: { contact: ClientContact }) {
  const { groupById } = useLookups();
  const pair = (label: string, value: string | null) => (
    <div className="py-2">
      <p className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">{label}</p>
      <p className="mt-0.5 text-[13.5px] text-ink">{value || <span className="text-silver">—</span>}</p>
    </div>
  );
  const names = (list: { name: string }[]) => list.map((x) => x.name).join(', ');

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionRule code="Identity" title="Contact details" />
        <div className="grid grid-cols-2 gap-x-6 divide-y rule sm:grid-cols-3">
          {pair('Email', contact.email)}{pair('Contact no.', contact.contactNo)}{pair('Mobile', contact.mobileNo)}
          {pair('Position', contact.position)}{pair('Country', contact.country)}{pair('Assistant', contact.assistant ? `${contact.assistant}${contact.assistantEmail ? ` · ${contact.assistantEmail}` : ''}` : null)}
        </div>
      </section>
      <section className="space-y-3">
        <SectionRule code="Coverage" title="Holdings and desk" />
        <div className="space-y-4">
          <div><p className="mono mb-2 text-[9.5px] uppercase tracking-[0.16em] text-graphite">Owns</p><Tickers items={contact.own} /></div>
          <div><p className="mono mb-2 text-[9.5px] uppercase tracking-[0.16em] text-graphite">Watchlist</p><Tickers items={contact.watchlist} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pair('Coverage team', names(contact.coverageTeam))}{pair('Sales', names(contact.sales))}
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <SectionRule code="Research distribution" title="Sectors of interest" />
        {contact.sectorGroupIds.length === 0 ? <p className="text-[13px] text-graphite">Not tagged to any sector.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {contact.sectorGroupIds.map((id) => { const g = groupById.get(id); return <span key={id} className="border rule bg-paper px-2 py-0.5 text-[12px] text-slate">{g?.name ?? `#${id}`} <span className="mono text-[9px] uppercase tracking-[0.12em] text-silver">{g?.scope}</span></span>; })}
          </div>
        )}
        {!contact.portalUserId && contact.sectorGroupIds.length > 0 && <Chip tone="amber">Not wired to a send — link a portal account</Chip>}
      </section>
    </div>
  );
}
