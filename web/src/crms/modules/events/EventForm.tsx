import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../cms/auth';
import { BtnGhost, BtnPrimary, Chip, DateField, SelectField, TextField } from '../../../cms/ui';
import { IconDownload, IconPen } from '../../../cms/icons';
import { useCrms } from '../../store';
import { FormError, MultiPicker, Picker, SectionRule, Tabs } from '../../kit/fields';
import { useOptions } from '../../kit/options';
import { errorText, useToast } from '../../kit/toast';
import EventChildTab, { CHILD_TABS, type ChildKey } from './EventChildTab';
import ItineraryModal from './Itinerary';
import { EVENT_TYPES, fmtRange, today, type AuditEntry, type CrmsEvent, type RoadshowCategory, type EventChildren, type EventDetail } from '../../data';

/* ─────────────────────────────────────────────────────────────
   One shell for all four event types. The category decides the
   subject field (corporate / client / analyst) and the rest —
   dates, coordinator, party — is shared. Child tabs appear once
   the event exists.
   ───────────────────────────────────────────────────────────── */

type Draft = {
  classification: string; startDate: string; endDate: string; coordinator: string; telNo: string; mobileNo: string; email: string;
  corporateId: string | null; clientId: string | null; clientContactIds: string[]; sellsideContactIds: string[];
};

function toDraft(e: CrmsEvent | null, coordinator: { name: string; email: string } | null): Draft {
  return {
    classification: e?.classification ?? 'Non-Deal Roadshow', startDate: e?.startDate ?? today(), endDate: e?.endDate ?? e?.startDate ?? today(),
    coordinator: e?.coordinator ?? coordinator?.name ?? '', telNo: e?.telNo ?? '', mobileNo: e?.mobileNo ?? '', email: e?.email ?? coordinator?.email ?? '',
    corporateId: e?.corporateId ?? null, clientId: e?.clientId ?? null,
    clientContactIds: e?.clientContacts.map((c) => String(c.id)) ?? [], sellsideContactIds: e?.sellsideContacts.map((s) => String(s.id)) ?? [],
  };
}

const EMPTY_CHILDREN: EventChildren = { meetings: [], investors: [], flights: [], transportation: [], accommodation: [], attendees: [] };

export default function EventForm({ category, eventId }: { category: RoadshowCategory; eventId: string | null }) {
  const [params] = useSearchParams();
  const { session, can } = useAuth();
  const { appendAudit } = useCrms();
  const options = useOptions();
  const navigate = useNavigate();
  const { notify } = useToast();
  const manage = can('crms.events.manage');
  const meta = EVENT_TYPES[category];
  const fromCalendar = params.get('form') === 'calendar';
  const backTo = fromCalendar ? '/crms/events/calendar' : `/crms/events/${category}`;

  const [event, setEvent] = useState<CrmsEvent | null>(null);
  const [children, setChildren] = useState<EventChildren>(EMPTY_CHILDREN);
  const [draft, setDraft] = useState<Draft>(() => toDraft(null, session ? { name: session.name, email: session.email } : null));
  const [editing, setEditing] = useState(eventId === null);
  const [tab, setTab] = useState<ChildKey>('meetings');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    apiFetch<EventDetail>(`/crms/events/${eventId}`, { audience: 'cms' })
      .then((d) => { if (alive) { setEvent(d.item); setChildren(d.children); setDraft(toDraft(d.item, null)); } })
      .catch((e) => { if (alive) setError(errorText(e, 'That event could not be opened.')); });
    return () => { alive = false; };
  }, [eventId]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    if (draft.endDate && draft.endDate < draft.startDate) { setError('The event ends before it starts.'); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        category, classification: category === 'roadshows' ? draft.classification : null, startDate: draft.startDate, endDate: draft.endDate || null,
        coordinator: draft.coordinator || null, telNo: draft.telNo || null, mobileNo: draft.mobileNo || null, email: draft.email || null,
        corporateId: draft.corporateId ? Number(draft.corporateId) : null, clientId: draft.clientId ? Number(draft.clientId) : null,
        clientContactIds: draft.clientContactIds.map(Number), sellsideContactIds: draft.sellsideContactIds.map(Number),
      };
      const res = event
        ? await apiFetch<{ item: CrmsEvent; audit?: AuditEntry }>(`/crms/events/${event.id}`, { method: 'PUT', audience: 'cms', body })
        : await apiFetch<{ item: CrmsEvent; audit?: AuditEntry }>('/crms/events', { method: 'POST', audience: 'cms', body });
      appendAudit(res.audit);
      setEvent(res.item);
      setEditing(false);
      notify(event ? 'Event saved.' : `${meta.label} created — add its meetings and logistics below.`);
      if (!event) navigate(`/crms/events/${category}/${res.item.id}${fromCalendar ? '?form=calendar' : ''}`, { replace: true });
    } catch (e) { setError(errorText(e, 'The event could not be saved.')); } finally { setSaving(false); }
  }

  // Contacts who could receive a personal schedule: everyone on a meeting or the investor list.
  const contactOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; hint?: string | null }>();
    for (const m of children.meetings) for (const c of m.clientContacts) seen.set(String(c.id), { id: String(c.id), label: c.name, hint: c.client_name ?? m.clientName });
    for (const i of children.investors) for (const c of i.clientContacts) seen.set(String(c.id), { id: String(c.id), label: c.name, hint: i.clientName });
    return Array.from(seen.values());
  }, [children]);

  if (eventId && !event && !error) return null;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to={backTo} className="mono text-[10px] uppercase tracking-[0.16em] text-graphite hover:text-ink">← {fromCalendar ? 'Calendar' : meta.plural}</Link>
          <h2 className="mt-3 text-[clamp(1.4rem,2.2vw,1.9rem)] tracking-[-0.02em] text-ink">{event ? event.subject : `New ${meta.label.toLowerCase()}`}</h2>
          <p className="mono mt-2 flex flex-wrap items-center gap-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite">
            <Chip tone="amber">{meta.label}</Chip>
            {event && <span>{fmtRange(event.startDate, event.endDate)}</span>}
            {event?.classification && <span className="text-silver">{event.classification}</span>}
          </p>
        </div>
        {event && !editing && (
          <div className="flex flex-wrap gap-2">
            <BtnGhost onClick={() => setItinerary(true)}><IconDownload size={13} /> Itinerary PDF</BtnGhost>
            {manage && <BtnGhost onClick={() => setEditing(true)}><IconPen size={13} /> Edit event</BtnGhost>}
          </div>
        )}
      </div>

      {error && !editing && <FormError message={error} />}

      {editing ? (
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <section className="space-y-5">
              <SectionRule code="Subject" title={meta.subject} />
              <div className="grid gap-5 sm:grid-cols-2">
                {category === 'roadshows' && <>
                  <Picker label="Corporate presenting" options={options.corporates} value={draft.corporateId} onChange={(v) => set('corporateId', v)} allowEmpty={false} />
                  <SelectField label="Classification" value={draft.classification} onChange={(v) => set('classification', v)} options={['Non-Deal Roadshow', 'Deal Roadshow']} />
                </>}
                {category === 'reverse-roadshows' && <>
                  <Picker label="Visiting client" options={options.clients} value={draft.clientId} onChange={(v) => { set('clientId', v); set('clientContactIds', []); }} allowEmpty={false} />
                  <MultiPicker label="Client contacts travelling" options={options.contactsOf(draft.clientId)} value={draft.clientContactIds} onChange={(v) => set('clientContactIds', v)} />
                </>}
                {category === 'analyst-marketing' && (
                  <div className="sm:col-span-2"><MultiPicker label="Travelling analyst(s)" options={options.sellside} value={draft.sellsideContactIds} onChange={(v) => set('sellsideContactIds', v)} /></div>
                )}
                {category !== 'analyst-marketing' && (
                  <MultiPicker label="Regis analysts / sales" options={options.sellside} value={draft.sellsideContactIds} onChange={(v) => set('sellsideContactIds', v)} />
                )}
              </div>
            </section>
            <section className="space-y-5">
              <SectionRule code="When" title="Dates" />
              <div className="grid gap-5 sm:grid-cols-2">
                <DateField label="Start" value={draft.startDate} onChange={(v) => setDraft((d) => ({ ...d, startDate: v, endDate: d.endDate < v ? v : d.endDate }))} />
                <DateField label="End" value={draft.endDate} onChange={(v) => set('endDate', v)} />
              </div>
            </section>
            <section className="space-y-5">
              <SectionRule code="Coordinator" title="Printed in every page footer" />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Primary coordinator" value={draft.coordinator} onChange={(v) => set('coordinator', v)} />
                <TextField label="Email" value={draft.email} onChange={(v) => set('email', v)} />
                <TextField label="Mobile" value={draft.mobileNo} onChange={(v) => set('mobileNo', v)} />
                <TextField label="Telephone" value={draft.telNo} onChange={(v) => set('telNo', v)} />
              </div>
            </section>
            <FormError message={error} />
            <div className="flex justify-end gap-2 border-t rule pt-5">
              <BtnGhost onClick={() => (event ? (setEditing(false), setDraft(toDraft(event, null))) : navigate(backTo))}>Cancel</BtnGhost>
              <BtnPrimary onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : event ? 'Save changes' : `Create ${meta.label.toLowerCase()}`}</BtnPrimary>
            </div>
          </div>
          <aside className="lg:col-span-4">
            <div className="border rule border-dashed px-5 py-6 text-[13px] leading-relaxed text-graphite">
              {event ? 'Meetings, investors, flights, ground transportation, accommodation and the Regis party are edited in the tabs once you finish here.' : 'Save the event first; its meetings and logistics are added in tabs afterwards.'}
            </div>
          </aside>
        </div>
      ) : event && (
        <>
          <div className="grid gap-x-8 gap-y-3 border-y rule py-4 text-[13px] sm:grid-cols-3">
            <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Coordinator</span><span className="text-ink">{event.coordinator ?? '—'}</span> <span className="text-graphite">{[event.mobileNo, event.email].filter(Boolean).join(' · ')}</span></p>
            <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Regis</span><span className="text-slate">{event.sellsideContacts.map((s) => s.name).join(', ') || '—'}</span></p>
            <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Client contacts</span><span className="text-slate">{event.clientContacts.map((c) => c.name).join(', ') || '—'}</span></p>
          </div>
          <Tabs label="Event detail" value={tab} onChange={(v) => setTab(v as ChildKey)} tabs={CHILD_TABS.map((t) => ({ ...t, count: children[t.id].length }))} />
          <EventChildTab key={tab} type={tab} event={event} rows={children[tab] as never[]} onChange={(next) => setChildren((c) => ({ ...c, [tab]: next }))} />
        </>
      )}

      {itinerary && event && <ItineraryModal event={event} contactOptions={contactOptions} onClose={() => setItinerary(false)} />}
    </div>
  );
}
