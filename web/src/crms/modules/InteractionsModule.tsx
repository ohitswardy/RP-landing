import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../cms/auth';
import { BtnPrimary, Chip, ModuleHeader, RowAction, SelectField, useConfirm } from '../../cms/ui';
import { IconArrowRight, IconCheck, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms } from '../store';
import DataTable, { type Column } from '../kit/DataTable';
import { Pager, Picker, Tabs } from '../kit/fields';
import { useOptions } from '../kit/options';
import { errorText, useToast } from '../kit/toast';
import InteractionForm from './interactions/InteractionForm';
import { fmtDay, fmtMinutes, type AuditEntry, type Interaction, type Paged } from '../data';

/* ─────────────────────────────────────────────────────────────
   Interactions — the consumption record. Paged and filtered
   server-side (year, client, type, flag state, free text); the
   record itself is a full page.
   ───────────────────────────────────────────────────────────── */

const PAGE_SIZE = 25;
type Flag = 'all' | 'open' | 'flagged' | 'closed';

export default function InteractionsModule() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { meta, appendAudit } = useCrms();
  const { can } = useAuth();
  const options = useOptions();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [armed, confirm] = useConfirm();
  const manage = can('crms.interactions.manage');

  const year = params.get('year') ?? '';
  const clientId = params.get('clientId');
  const typeId = params.get('typeId');
  const flag = (params.get('disposition') as Flag) ?? 'all';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);

  const [data, setData] = useState<(Paged<Interaction> & { minutes: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<Interaction | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ perPage: String(PAGE_SIZE), page: String(page) });
    if (year) p.set('year', year);
    if (clientId) p.set('clientId', clientId);
    if (typeId) p.set('typeId', typeId);
    if (flag !== 'all') p.set('disposition', flag);
    if (q.trim()) p.set('q', q.trim());
    return apiFetch<Paged<Interaction> & { minutes: number }>(`/crms/interactions?${p}`, { audience: 'cms' })
      .then(setData)
      .catch((e) => notify(errorText(e, 'Interactions could not be loaded.'), 'warn'))
      .finally(() => setLoading(false));
  }, [year, clientId, typeId, flag, q, page, notify]);

  useEffect(() => { if (!id) void load(); }, [id, load]);

  // The record page: fetch by id (the list page may not hold it).
  useEffect(() => {
    if (!id || id === 'new') { setRecord(null); setRecordError(null); return; }
    let alive = true;
    apiFetch<{ item: Interaction }>(`/crms/interactions/${id}`, { audience: 'cms' })
      .then((r) => { if (alive) setRecord(r.item); })
      .catch((e) => { if (alive) setRecordError(errorText(e, 'That interaction could not be opened.')); });
    return () => { alive = false; };
  }, [id]);

  async function remove(i: Interaction) {
    try {
      const res = await apiFetch<{ audit?: AuditEntry }>(`/crms/interactions/${i.id}`, { method: 'DELETE', audience: 'cms' });
      appendAudit(res.audit);
      notify(`Interaction ${i.reference} deleted.`);
      void load();
    } catch (e) { notify(errorText(e, 'Could not delete the interaction.'), 'warn'); }
  }

  if (id) {
    if (id !== 'new' && recordError) return <p className="text-[13px]" style={{ color: 'var(--color-warn)' }}>{recordError}</p>;
    if (id !== 'new' && !record) return null;
    return <InteractionForm key={id} interaction={record} presets={{ clientId: params.get('clientId'), contactId: params.get('contactId') }} onSaved={() => undefined} />;
  }

  const columns: Column<Interaction>[] = [
    { key: 'reference', label: 'Ref', mono: true, render: (i) => <Link to={`/crms/interactions/${i.id}`} className="mono text-[12px] tracking-[0.06em] text-ink hover:text-[color:var(--color-amber-deep)]">{i.reference}</Link>, className: 'w-[110px]' },
    { key: 'date', label: 'Date', mono: true, value: (i) => i.date, render: (i) => <span className="mono text-[12.5px]">{fmtDay(i.date)}</span> },
    { key: 'clientName', label: 'Client', render: (i) => <span className="text-ink">{i.clientName}</span> },
    { key: 'typeName', label: 'Type', value: (i) => [i.typeName, i.meetingType].filter(Boolean).join(' · ') },
    { key: 'clientContacts', label: 'Contacts', value: (i) => i.clientContacts.map((c) => c.name).join(', ') },
    { key: 'sellsideContacts', label: 'Regis', value: (i) => i.sellsideContacts.map((c) => c.name).join(', '), hidden: true },
    { key: 'minutes', label: 'Time', mono: true, align: 'right', value: (i) => i.minutes, render: (i) => <span className="mono num text-[12.5px]">{fmtMinutes(i.minutes)}</span> },
    { key: 'description', label: 'Description', hidden: true },
    { key: 'disposition', label: 'Flag', value: (i) => (i.disposition === 'flagged' ? (i.actionedAt ? 'sent' : 'open') : 'closed'), render: (i) => i.disposition === 'flagged' ? (i.actionedAt ? <Chip tone="live">Sent</Chip> : <Chip tone="amber" pulse>Open</Chip>) : <span className="text-silver">—</span> },
  ];

  return (
    <div className="space-y-8">
      <ModuleHeader code="01 · Interactions" title="Interactions" blurb="Every client touchpoint, logged as evidence of research consumption. Filter by year, client and type; open a row to see the full record and its captured form."
        actions={manage && <BtnPrimary onClick={() => navigate('/crms/interactions/new')}><IconPlus size={14} /> Log interaction</BtnPrimary>} />

      <Tabs label="Flag state" value={flag} onChange={(v) => setParam('disposition', v === 'all' ? null : v)} tabs={[
        { id: 'all', label: 'All' }, { id: 'open', label: 'Open flags' }, { id: 'flagged', label: 'Sent to recipients' }, { id: 'closed', label: 'Filed' },
      ]} />

      <div className="grid gap-4 md:grid-cols-[140px_1fr_1fr_1fr] md:items-end">
        <SelectField label="Year" value={year || 'All years'} onChange={(v) => setParam('year', v === 'All years' ? null : v)} options={['All years', ...meta.years.map(String)]} />
        <Picker label="Client" options={options.clients} value={clientId} onChange={(v) => setParam('clientId', v)} placeholder="Every client" />
        <Picker label="Type" options={options.typesFor(clientId)} value={typeId} onChange={(v) => setParam('typeId', v)} placeholder="Every type" />
        <div className="flex flex-col gap-2">
          <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Search</label>
          <input defaultValue={q} onKeyDown={(e) => { if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value || null); }} onBlur={(e) => { if (e.target.value !== q) setParam('q', e.target.value || null); }} placeholder="Description, contact, reference" className="w-full border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-silver focus:border-[color:var(--color-amber-deep)]" />
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-6 border-y rule py-3">
          <span className="mono num text-[10.5px] uppercase tracking-[0.16em] text-graphite">{data.total.toLocaleString('en-PH')} interaction{data.total === 1 ? '' : 's'}</span>
          <span className="mono num text-[10.5px] uppercase tracking-[0.16em] text-graphite">{fmtMinutes(data.minutes)} on this page</span>
        </div>
      )}

      <DataTable rows={data?.items ?? []} columns={columns} loading={loading && !data} title="Interactions" storageKey="interactions" hideSearch initialPageSize={0}
        emptyTitle="No interactions match." emptyHint="Widen the filters, or log the first interaction."
        onRowClick={(i) => navigate(`/crms/interactions/${i.id}`)}
        actions={(i) => (
          <>
            <RowAction label="Open" onClick={() => navigate(`/crms/interactions/${i.id}`)}><IconArrowRight size={14} /></RowAction>
            {manage && <RowAction label={armed === i.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(i.id, () => { void remove(i); })}>{armed === i.id ? <IconCheck /> : <IconTrash />}</RowAction>}
          </>
        )} />

      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => setParam('page', String(p))} />}
    </div>
  );
}
