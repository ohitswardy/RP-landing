import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../cms/auth';
import { BtnGhost, BtnPrimary, ModuleHeader, RowAction, TextField, useConfirm } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconCheck, IconPen, IconPlus, IconSearch, IconTrash } from '../../cms/icons';
import { useCrms } from '../store';
import DataTable, { type Column } from '../kit/DataTable';
import { FormError, MultiPicker, Picker, Tabs } from '../kit/fields';
import { useOptions } from '../kit/options';
import { errorText, useToast } from '../kit/toast';
import type { Corporate, CorporateContact } from '../data';

/* ─────────────────────────────────────────────────────────────
   Corporates — the issuers — and the IR / management contacts
   under them. Five sector columns, since each client template
   files the same company under its own taxonomy.
   ───────────────────────────────────────────────────────────── */

type CorpDraft = {
  id: string | null; name: string; ticker: string; identifiers1: string; identifiers2: string; address: string;
  sectorGeneric: string; sectorGmo: string; sectorJpmorgan: string; sectorSchroders: string; sectorTrowe: string;
};
const BLANK_CORP: CorpDraft = { id: null, name: '', ticker: '', identifiers1: '', identifiers2: '', address: '', sectorGeneric: '', sectorGmo: '', sectorJpmorgan: '', sectorSchroders: '', sectorTrowe: '' };

type ContactDraft = {
  id: string | null; corporateId: string | null; name: string; position: string; email: string; mobile: string; phone: string;
  address: string; assistant: string; assistantEmail: string; analystIds: string[];
};
const BLANK_CONTACT: ContactDraft = { id: null, corporateId: null, name: '', position: '', email: '', mobile: '', phone: '', address: '', assistant: '', assistantEmail: '', analystIds: [] };

export default function CorporatesModule() {
  const { corporates, corporateContacts, status, mutate, destroy } = useCrms();
  const { can } = useAuth();
  const { notify } = useToast();
  const options = useOptions();
  const manage = can('crms.contacts.manage');
  const [tab, setTab] = useState<'corporates' | 'contacts'>('corporates');
  const [corp, setCorp] = useState<CorpDraft | null>(null);
  const [contact, setContact] = useState<ContactDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();

  const openCorp = (c?: Corporate) => {
    setError(null);
    setCorp(c ? {
      id: c.id, name: c.name, ticker: c.ticker ?? '', identifiers1: c.identifiers1 ?? '', identifiers2: c.identifiers2 ?? '', address: c.address ?? '',
      sectorGeneric: c.sectorGeneric ?? '', sectorGmo: c.sectorGmo ?? '', sectorJpmorgan: c.sectorJpmorgan ?? '', sectorSchroders: c.sectorSchroders ?? '', sectorTrowe: c.sectorTrowe ?? '',
    } : BLANK_CORP);
  };

  const openContact = (c?: CorporateContact, corporateId?: string) => {
    setError(null);
    setContact(c ? {
      id: c.id, corporateId: c.corporateId, name: c.name, position: c.position ?? '', email: c.email ?? '', mobile: c.mobile ?? '', phone: c.phone ?? '',
      address: c.address ?? '', assistant: c.assistant ?? '', assistantEmail: c.assistantEmail ?? '', analystIds: c.analyst.map((a) => String(a.id)),
    } : { ...BLANK_CONTACT, corporateId: corporateId ?? null });
  };

  const nul = (s: string) => s.trim() || null;

  async function saveCorp() {
    if (!corp) return;
    if (corp.name.trim().length < 2) { setError('Give the corporate a name.'); return; }
    setSaving(true); setError(null);
    try {
      await mutate('corporates', corp.id ? `/crms/corporates/${corp.id}` : '/crms/corporates', corp.id ? 'PUT' : 'POST', {
        name: corp.name, ticker: nul(corp.ticker), identifiers1: nul(corp.identifiers1), identifiers2: nul(corp.identifiers2), address: nul(corp.address),
        sectorGeneric: nul(corp.sectorGeneric), sectorGmo: nul(corp.sectorGmo), sectorJpmorgan: nul(corp.sectorJpmorgan), sectorSchroders: nul(corp.sectorSchroders), sectorTrowe: nul(corp.sectorTrowe),
      });
      notify(corp.id ? 'Corporate updated.' : 'Corporate added.');
      setCorp(null);
    } catch (e) { setError(errorText(e, 'The corporate could not be saved.')); } finally { setSaving(false); }
  }

  async function saveContact() {
    if (!contact) return;
    if (contact.name.trim().length < 2) { setError('Give the contact a name.'); return; }
    setSaving(true); setError(null);
    try {
      await mutate('corporateContacts', contact.id ? `/crms/corporate-contacts/${contact.id}` : '/crms/corporate-contacts', contact.id ? 'PUT' : 'POST', {
        corporateId: contact.corporateId ? Number(contact.corporateId) : null, name: contact.name, position: nul(contact.position), email: nul(contact.email),
        mobile: nul(contact.mobile), phone: nul(contact.phone), address: nul(contact.address), assistant: nul(contact.assistant), assistantEmail: nul(contact.assistantEmail),
        analystIds: contact.analystIds.map(Number),
      });
      notify(contact.id ? 'Contact updated.' : 'Contact added.');
      setContact(null);
    } catch (e) { setError(errorText(e, 'The contact could not be saved.')); } finally { setSaving(false); }
  }

  async function removeCorp(c: Corporate) {
    try { await destroy('corporates', `/crms/corporates/${c.id}`, c.id); notify(`${c.name} removed.`); }
    catch (e) { notify(errorText(e, 'Could not remove the corporate.'), 'warn'); }
  }
  async function removeContact(c: CorporateContact) {
    try { await destroy('corporateContacts', `/crms/corporate-contacts/${c.id}`, c.id); notify(`${c.name} removed.`); }
    catch (e) { notify(errorText(e, 'Could not remove the contact.'), 'warn'); }
  }

  const corpColumns: Column<Corporate>[] = [
    { key: 'ticker', label: 'Ticker', mono: true, render: (c) => <span className="mono text-[12.5px] tracking-[0.04em] text-ink">{c.ticker ?? '—'}</span>, className: 'w-[90px]' },
    { key: 'name', label: 'Corporate', render: (c) => <span className="text-ink">{c.name}</span> },
    { key: 'sectorGeneric', label: 'Sector' },
    { key: 'identifiers1', label: 'Bloomberg', mono: true, hidden: true },
    { key: 'identifiers2', label: 'Reuters', mono: true, hidden: true },
    { key: 'contactCount', label: 'Contacts', mono: true, align: 'right' },
    { key: 'holders', label: 'Holders', sortable: false, value: () => '', render: (c) => <Link to={`/crms/ticker-search?corporateId=${c.id}`} className="mono inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-graphite hover:text-ink"><IconSearch size={11} /> Who owns</Link> },
  ];

  const contactColumns: Column<CorporateContact>[] = [
    { key: 'name', label: 'Name', render: (c) => <span className="text-ink">{c.name}</span> },
    { key: 'corporateName', label: 'Corporate' },
    { key: 'position', label: 'Position' },
    { key: 'email', label: 'Email', mono: true },
    { key: 'mobile', label: 'Mobile', mono: true, hidden: true },
    { key: 'phone', label: 'Phone', mono: true, hidden: true },
    { key: 'analyst', label: 'Covering analyst', value: (c) => c.analyst.map((a) => a.name).join(', ') },
  ];

  return (
    <div className="space-y-8">
      <ModuleHeader
        code="06 · Corporates"
        title="Corporates & issuer contacts"
        blurb="Listed companies the desk covers or arranges access to, with their identifiers under each client's sector taxonomy, and the IR and management people met on roadshows."
        actions={manage && (tab === 'corporates'
          ? <BtnPrimary onClick={() => openCorp()}><IconPlus size={14} /> New corporate</BtnPrimary>
          : <BtnPrimary onClick={() => openContact()}><IconPlus size={14} /> New issuer contact</BtnPrimary>)}
      />

      <Tabs label="Corporates" value={tab} onChange={(v) => setTab(v as typeof tab)} tabs={[
        { id: 'corporates', label: 'Corporates', count: corporates.length },
        { id: 'contacts', label: 'Issuer contacts', count: corporateContacts.length },
      ]} />

      {tab === 'corporates' ? (
        <DataTable rows={corporates} columns={corpColumns} loading={status === 'loading'} title="Corporates" storageKey="corporates"
          emptyTitle="No corporates yet." emptyHint="Add the covered universe; tickers drive stock fields, ticker search and the distribution list."
          actions={(c) => manage && (
            <>
              <RowAction label="Add contact" onClick={() => openContact(undefined, c.id)}><IconPlus /></RowAction>
              <RowAction label="Edit" onClick={() => openCorp(c)}><IconPen /></RowAction>
              <RowAction label={armed === c.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(c.id, () => { void removeCorp(c); })}>{armed === c.id ? <IconCheck /> : <IconTrash />}</RowAction>
            </>
          )} />
      ) : (
        <DataTable rows={corporateContacts} columns={contactColumns} loading={status === 'loading'} title="Issuer contacts" storageKey="corporate-contacts"
          emptyTitle="No issuer contacts yet." emptyHint="IR officers, CFOs and the people who host meetings."
          actions={(c) => manage && (
            <>
              <RowAction label="Edit" onClick={() => openContact(c)}><IconPen /></RowAction>
              <RowAction label={armed === `c${c.id}` ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(`c${c.id}`, () => { void removeContact(c); })}>{armed === `c${c.id}` ? <IconCheck /> : <IconTrash />}</RowAction>
            </>
          )} />
      )}

      {corp && (
        <Modal open wide title={corp.id ? `Edit · ${corp.name}` : 'New corporate'} onClose={() => setCorp(null)}
          footer={<><BtnGhost onClick={() => setCorp(null)}>Cancel</BtnGhost><BtnPrimary onClick={() => void saveCorp()} disabled={saving}>{saving ? 'Saving…' : corp.id ? 'Save changes' : 'Create corporate'}</BtnPrimary></>}>
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-[1fr_140px]">
              <TextField label="Name" value={corp.name} onChange={(v) => setCorp({ ...corp, name: v })} placeholder="Ayala Land" />
              <TextField label="Ticker" value={corp.ticker} onChange={(v) => setCorp({ ...corp, ticker: v.toUpperCase() })} placeholder="ALI" />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <TextField label="Bloomberg" value={corp.identifiers1} onChange={(v) => setCorp({ ...corp, identifiers1: v })} placeholder="ALI PM" />
              <TextField label="Reuters" value={corp.identifiers2} onChange={(v) => setCorp({ ...corp, identifiers2: v })} placeholder="ALI.PS" />
            </div>
            <TextField label="Default meeting address" value={corp.address} onChange={(v) => setCorp({ ...corp, address: v })} multiline />
            <div>
              <p className="mono mb-3 text-[10px] uppercase tracking-[0.18em] text-graphite">Sector, per taxonomy</p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <TextField label="Generic" value={corp.sectorGeneric} onChange={(v) => setCorp({ ...corp, sectorGeneric: v })} />
                <TextField label="GMO" value={corp.sectorGmo} onChange={(v) => setCorp({ ...corp, sectorGmo: v })} />
                <TextField label="JPMorgan" value={corp.sectorJpmorgan} onChange={(v) => setCorp({ ...corp, sectorJpmorgan: v })} />
                <TextField label="Schroders" value={corp.sectorSchroders} onChange={(v) => setCorp({ ...corp, sectorSchroders: v })} />
                <TextField label="T. Rowe Price" value={corp.sectorTrowe} onChange={(v) => setCorp({ ...corp, sectorTrowe: v })} />
              </div>
            </div>
            <FormError message={error} />
          </div>
        </Modal>
      )}

      {contact && (
        <Modal open wide title={contact.id ? `Edit · ${contact.name}` : 'New issuer contact'} onClose={() => setContact(null)}
          footer={<><BtnGhost onClick={() => setContact(null)}>Cancel</BtnGhost><BtnPrimary onClick={() => void saveContact()} disabled={saving}>{saving ? 'Saving…' : contact.id ? 'Save changes' : 'Create contact'}</BtnPrimary></>}>
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <Picker label="Corporate" options={options.corporates} value={contact.corporateId} onChange={(v) => setContact({ ...contact, corporateId: v })} />
              <TextField label="Name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <TextField label="Position" value={contact.position} onChange={(v) => setContact({ ...contact, position: v })} placeholder="Head of Investor Relations" />
              <TextField label="Email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <TextField label="Mobile" value={contact.mobile} onChange={(v) => setContact({ ...contact, mobile: v })} />
              <TextField label="Phone" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} />
            </div>
            <TextField label="Address" value={contact.address} onChange={(v) => setContact({ ...contact, address: v })} />
            <div className="grid gap-5 md:grid-cols-2">
              <TextField label="Assistant" value={contact.assistant} onChange={(v) => setContact({ ...contact, assistant: v })} />
              <TextField label="Assistant email" value={contact.assistantEmail} onChange={(v) => setContact({ ...contact, assistantEmail: v })} />
            </div>
            <MultiPicker label="Covering analyst(s)" options={options.sellside} value={contact.analystIds} onChange={(ids) => setContact({ ...contact, analystIds: ids })} />
            <FormError message={error} />
          </div>
        </Modal>
      )}
    </div>
  );
}
