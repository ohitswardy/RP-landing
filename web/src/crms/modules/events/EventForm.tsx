import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../cms/auth';
import { BtnGhost, BtnPrimary, Chip, DateField, SelectField, TextField } from '../../../cms/ui';
import { IconDownload, IconPen } from '../../../cms/icons';
import { useCrms } from '../../store';
import { FormError, MultiPicker, Picker, SectionRule, Tabs } from '../../kit/fields';
import { useOptions } from '../../kit/options';
import { errorText, useToast } from '../../kit/toast';
import EventChildTab, { CHILD_CONFIG, CHILD_TABS, type ChildKey } from './EventChildTab';
import ItineraryModal from './Itinerary';
import { contactOptionsFrom } from './itineraryActions';
import { EVENT_TYPES, fmtRange, today, type AuditEntry, type CrmsEvent, type RoadshowCategory, type EventChildren, type EventDetail } from '../../data';

/* ─────────────────────────────────────────────────────────────
   One shell for the three roadshow-family event types. The header
   carries exactly the boxes the legacy form had — the subject
   (Corporate / Client + Client Contact / Analyst), Date Start and
   Date End, and the Primary Coordinator's name, Tel #, Mobile #
   and Email; a Company Roadshow adds its Classification. The Regis
   party is the Regis tab, as it was, not a header field. The child
   tabs show from the start: on a new event, the first "Add …" saves
   the header itself and opens that modal, so creating an event and
   filling its schedule is one flow rather than two.
   ───────────────────────────────────────────────────────────── */

type Draft = {
  classification: string; startDate: string; endDate: string; coordinator: string; telNo: string; mobileNo: string; email: string;
  corporateId: string | null; clientId: string | null; clientContactIds: string[]; sellsideContactIds: string[];
};

function toDraft(e: CrmsEvent | null, coordinator: { name: string; email: string } | null): Draft {
  return {
    classification: e?.classification ?? '', startDate: e?.startDate ?? today(), endDate: e?.endDate ?? e?.startDate ?? today(),
    coordinator: e?.coordinator ?? coordinator?.name ?? '', telNo: e?.telNo ?? '', mobileNo: e?.mobileNo ?? '', email: e?.email ?? coordinator?.email ?? '',
    corporateId: e?.corporateId ?? null, clientId: e?.clientId ?? null,
    clientContactIds: e?.clientContacts.map((c) => String(c.id)) ?? [], sellsideContactIds: e?.sellsideContacts.map((s) => String(s.id)) ?? [],
  };
}

const EMPTY_CHILDREN: EventChildren = { meetings: [], investors: [], flights: [], transportation: [], accommodation: [], attendees: [] };

export default function EventForm({ category, eventId }: { category: RoadshowCategory; eventId: string | null }) {
  const [params] = useSearchParams();
  const location = useLocation();
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
  // A freshly created event arrives with the child tab whose "Add" triggered the save, so its modal opens straight away.
  const openChild = (location.state as { openChild?: ChildKey } | null)?.openChild ?? null;
  const [tab, setTab] = useState<ChildKey>(openChild ?? 'meetings');
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

  /** Validates and saves the header; resolves with the saved event, or null when something was missing. */
  async function saveHeader(): Promise<CrmsEvent | null> {
    // The legacy required set: the subject, both dates, and the classification on a Company Roadshow.
    if (category === 'roadshows' && !draft.corporateId) { setError('Corporate is required.'); return null; }
    if (category === 'reverse-roadshows' && !draft.clientId) { setError('Client is required.'); return null; }
    if (category === 'analyst-marketing' && draft.sellsideContactIds.length === 0) { setError('Analyst is required.'); return null; }
    if (!draft.startDate) { setError('Date Start is required.'); return null; }
    if (!draft.endDate) { setError('Date End is required.'); return null; }
    if (category === 'roadshows' && !draft.classification) { setError('Classification is required.'); return null; }
    if (draft.endDate < draft.startDate) { setError('The event ends before it starts.'); return null; }
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
      return res.item;
    } catch (e) { setError(errorText(e, 'The event could not be saved.')); return null; } finally { setSaving(false); }
  }

  const urlFor = (e: CrmsEvent) => `/crms/events/${category}/${e.id}${fromCalendar ? '?form=calendar' : ''}`;

  async function save() {
    const wasNew = !event;
    const saved = await saveHeader();
    if (!saved) return;
    notify(wasNew ? `${meta.label} created — add its meetings and logistics below.` : 'Event saved.');
    if (wasNew) navigate(urlFor(saved), { replace: true });
  }

  // "Add …" on a not-yet-saved event: save the header, then reopen on the record with that tab's modal up.
  async function saveThenAdd(type: ChildKey) {
    const saved = await saveHeader();
    if (!saved) return;
    notify(`${meta.label} created — now add its first ${CHILD_CONFIG[type].singular}.`);
    navigate(urlFor(saved), { replace: true, state: { openChild: type } });
  }

  // A stand-in for the tabs before the header exists: what the blank child drafts read (dates, counterparties).
  const previewEvent = useMemo((): CrmsEvent => ({
    id: '', category, categoryLabel: meta.label, classification: draft.classification || null, subject: `New ${meta.label.toLowerCase()}`,
    startDate: draft.startDate, endDate: draft.endDate || null, coordinator: draft.coordinator || null, telNo: null, mobileNo: null, email: null,
    corporateId: draft.corporateId, corporateName: options.corporates.find((c) => c.id === draft.corporateId)?.label ?? null,
    clientId: draft.clientId, clientName: options.clients.find((c) => c.id === draft.clientId)?.label ?? null,
    clientContacts: [], sellsideContacts: draft.sellsideContactIds.map((id) => ({ id: Number(id), name: options.sellside.find((s) => s.id === id)?.label ?? '' })),
    meetingCount: 0, updatedAt: null,
  }), [category, meta.label, draft, options]);

  const contactOptions = useMemo(() => contactOptionsFrom(children), [children]);

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
              <SectionRule code={meta.code} title={`${meta.label} information`} />
              {/* Row one, as the legacy form laid it out: subject · Date Start · Date End (· Classification). */}
              <div className={`grid gap-5 sm:grid-cols-2 ${category === 'roadshows' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                {category === 'roadshows' && <Picker label="Corporate" options={options.corporates} value={draft.corporateId} onChange={(v) => set('corporateId', v)} placeholder="Select" hint="required" allowEmpty={false} />}
                {category === 'reverse-roadshows' && <Picker label="Client" options={options.clients} value={draft.clientId} onChange={(v) => { set('clientId', v); set('clientContactIds', []); }} placeholder="Select" hint="required" allowEmpty={false} />}
                {category === 'analyst-marketing' && <MultiPicker label="Analyst" options={options.sellside} value={draft.sellsideContactIds} onChange={(v) => set('sellsideContactIds', v)} placeholder="Select" hint="required" />}
                <DateField label="Date Start" value={draft.startDate} onChange={(v) => setDraft((d) => ({ ...d, startDate: v, endDate: d.endDate < v ? v : d.endDate }))} />
                <DateField label="Date End" value={draft.endDate} onChange={(v) => set('endDate', v)} />
                {category === 'roadshows' && <SelectField label="Classification" value={draft.classification} onChange={(v) => set('classification', v)} options={['', 'Deal Roadshow', 'Non-Deal Roadshow']} />}
              </div>
              {category === 'reverse-roadshows' && (
                <MultiPicker label="Client Contact" options={options.contactsOf(draft.clientId)} value={draft.clientContactIds} onChange={(v) => set('clientContactIds', v)} placeholder="Select" />
              )}
            </section>
            <section className="space-y-5">
              <SectionRule code="Coordinator" title="Printed in every page footer" />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <TextField label="Primary Coordinator" value={draft.coordinator} onChange={(v) => set('coordinator', v)} />
                <TextField label="Primary Coordinator Tel #" value={draft.telNo} onChange={(v) => set('telNo', v)} />
                <TextField label="Primary Coordinator Mobile #" value={draft.mobileNo} onChange={(v) => set('mobileNo', v)} />
                <TextField label="Primary Coordinator Email" value={draft.email} onChange={(v) => set('email', v)} />
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
              {event ? 'Meetings, investors, flights, ground transportation, accommodation and the Regis party are edited in the tabs once you finish here.' : 'Meetings, investors, flights, ground transportation, accommodation and the Regis party go in the tabs below — the first one you add saves this header for you.'}
            </div>
          </aside>
          {!event && (
            <div className="space-y-4 lg:col-span-12">
              <Tabs label="Event detail" value={tab} onChange={(v) => setTab(v as ChildKey)} tabs={CHILD_TABS.map((t) => ({ ...t, count: 0 }))} />
              <EventChildTab key={tab} type={tab} event={previewEvent} rows={[]} onChange={() => undefined} onRequestSave={saving ? undefined : () => void saveThenAdd(tab)} />
            </div>
          )}
        </div>
      ) : event && (
        <>
          <div className="grid gap-x-8 gap-y-3 border-y rule py-4 text-[13px] sm:grid-cols-3">
            <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Coordinator</span><span className="text-ink">{event.coordinator ?? '—'}</span> <span className="text-graphite">{[event.telNo, event.mobileNo, event.email].filter(Boolean).join(' · ')}</span></p>
            {/* The Regis party: the travelling analysts on Analyst Marketing, otherwise whoever is on the Regis tab. */}
            <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Regis</span><span className="text-slate">{(category === 'analyst-marketing' ? event.sellsideContacts.map((s) => s.name) : children.attendees.map((a) => a.name ?? '')).filter(Boolean).join(', ') || '—'}</span></p>
            <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Client contacts</span><span className="text-slate">{event.clientContacts.map((c) => c.name).join(', ') || '—'}</span></p>
          </div>
          <Tabs label="Event detail" value={tab} onChange={(v) => setTab(v as ChildKey)} tabs={CHILD_TABS.map((t) => ({ ...t, count: children[t.id].length }))} />
          <EventChildTab key={tab} type={tab} event={event} rows={children[tab] as never[]} onChange={(next) => setChildren((c) => ({ ...c, [tab]: next }))} autoOpen={openChild === tab} onOpened={() => navigate(location.pathname + location.search, { replace: true, state: null })} />
        </>
      )}

      {itinerary && event && <ItineraryModal event={event} contactOptions={contactOptions} onClose={() => setItinerary(false)} />}
    </div>
  );
}
