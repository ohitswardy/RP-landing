import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../cms/auth';
import { BtnPrimary, ModuleHeader, RowAction, SelectField, useConfirm } from '../../cms/ui';
import { IconArrowRight, IconCheck, IconDownload, IconMail, IconPeople, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms } from '../store';
import DataTable, { type Column } from '../kit/DataTable';
import { Tabs } from '../kit/fields';
import { errorText, useToast } from '../kit/toast';
import EventForm from './events/EventForm';
import OneOffMeetingForm from './events/OneOffMeetingForm';
import ItineraryModal from './events/Itinerary';
import { contactOptionsFrom, downloadItinerary, emailItinerary } from './events/itineraryActions';
import { EVENT_TYPES, fmtDay, fmtRange, type AuditEntry, type CrmsEvent, type EventCategory, type EventDetail, type OneOffMeeting, type RoadshowCategory } from '../data';

/* ─────────────────────────────────────────────────────────────
   Events. One list per type (tabs) with a year filter. Company
   roadshows, reverse roadshows and analyst marketing share the
   roadshow record and EventForm with its child tabs; one-off
   meetings are their own record (the legacy `event` table).
   ───────────────────────────────────────────────────────────── */

const CATEGORIES = Object.keys(EVENT_TYPES) as EventCategory[];

export default function EventsModule() {
  const { type, id } = useParams();
  const [params, setParams] = useSearchParams();
  const { meta, appendAudit } = useCrms();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [armed, confirm] = useConfirm();
  const manage = can('crms.events.manage');
  const category = CATEGORIES.includes(type as EventCategory) ? (type as EventCategory) : null;
  const year = params.get('year') ?? '';
  const oneOff = category === 'meetings';

  const [rows, setRows] = useState<CrmsEvent[]>([]);
  const [meetings, setMeetings] = useState<OneOffMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState<{ event: CrmsEvent; contacts: { id: string; label: string; hint?: string | null }[] } | null>(null);

  useEffect(() => {
    if (!category || id) return;
    let alive = true;
    setLoading(true);
    const p = new URLSearchParams();
    if (year) p.set('year', year);
    const req = oneOff
      ? apiFetch<{ items: OneOffMeeting[] }>(`/crms/one-off-meetings?${p}`, { audience: 'cms' }).then((d) => { if (alive) setMeetings(d.items); })
      : apiFetch<{ items: CrmsEvent[] }>(`/crms/events?${new URLSearchParams({ category, ...(year ? { year } : {}) })}`, { audience: 'cms' }).then((d) => { if (alive) setRows(d.items); });
    req.catch((e) => notify(errorText(e, 'Events could not be loaded.'), 'warn')).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [category, year, id, oneOff, notify]);

  if (!category) return <Navigate to="/crms/events/roadshows" replace />;
  if (id && oneOff) return <OneOffMeetingForm key={id} meetingId={id === 'new' ? null : id} />;
  if (id) return <EventForm key={`${category}-${id}`} category={category as RoadshowCategory} eventId={id === 'new' ? null : id} />;

  const info = EVENT_TYPES[category];

  async function removeEvent(e: CrmsEvent) {
    try {
      const res = await apiFetch<{ audit?: AuditEntry }>(`/crms/events/${e.id}`, { method: 'DELETE', audience: 'cms' });
      appendAudit(res.audit);
      setRows((r) => r.filter((x) => x.id !== e.id));
      notify('Event deleted.');
    } catch (err) { notify(errorText(err, 'Could not delete the event.'), 'warn'); }
  }

  async function removeMeeting(m: OneOffMeeting) {
    try {
      const res = await apiFetch<{ audit?: AuditEntry }>(`/crms/one-off-meetings/${m.id}`, { method: 'DELETE', audience: 'cms' });
      appendAudit(res.audit);
      setMeetings((r) => r.filter((x) => x.id !== m.id));
      notify('Meeting deleted.');
    } catch (err) { notify(errorText(err, 'Could not delete the meeting.'), 'warn'); }
  }

  // The legacy row icons: download the itinerary PDF, email it to yourself, or pick one contact for a personal schedule.
  async function download(e: CrmsEvent) {
    setBusy(e.id);
    try { notify(`Downloading ${await downloadItinerary(e)}`); }
    catch (err) { notify(errorText(err, 'The PDF could not be downloaded.'), 'warn'); }
    finally { setBusy(null); }
  }
  async function email(e: CrmsEvent) {
    setBusy(e.id);
    try {
      const res = await emailItinerary(e);
      appendAudit(res.audit);
      notify(`Itinerary PDF sent to ${res.to}.`);
    } catch (err) { notify(errorText(err, 'The itinerary could not be emailed.'), 'warn'); }
    finally { setBusy(null); }
  }
  async function byContact(e: CrmsEvent) {
    setBusy(e.id);
    try {
      const d = await apiFetch<EventDetail>(`/crms/events/${e.id}`, { audience: 'cms' });
      setItinerary({ event: d.item, contacts: contactOptionsFrom(d.children) });
    } catch (err) { notify(errorText(err, 'That event could not be opened.'), 'warn'); }
    finally { setBusy(null); }
  }

  const eventColumns: Column<CrmsEvent>[] = [
    { key: 'startDate', label: 'Dates', mono: true, value: (e) => e.startDate, render: (e) => <span className="mono text-[12.5px]">{fmtRange(e.startDate, e.endDate)}</span> },
    { key: 'subject', label: info.subject, render: (e) => <span className="text-ink">{e.subject}</span> },
    ...(category === 'roadshows' ? [{ key: 'classification', label: 'Classification' } as Column<CrmsEvent>] : []),
    // The header only names the Regis party on Analyst Marketing (where they are the subject); elsewhere it lives on the Regis tab.
    { key: 'sellside', label: 'Regis', value: (e) => e.sellsideContacts.map((s) => s.name).join(', '), hidden: true },
    { key: 'coordinator', label: 'Coordinator', hidden: true },
    { key: 'meetingCount', label: 'Meetings', mono: true, align: 'right' },
    { key: 'updatedAt', label: 'Updated', mono: true, hidden: true, value: (e) => e.updatedAt ?? '', render: (e) => <span className="mono text-[12px]">{e.updatedAt ? fmtDay(e.updatedAt.slice(0, 10)) : '—'}</span> },
  ];

  const meetingColumns: Column<OneOffMeeting>[] = [
    { key: 'startDate', label: 'Date', mono: true, value: (m) => m.startDate, render: (m) => <span className="mono text-[12.5px]">{fmtDay(m.startDate)}</span> },
    { key: 'time', label: 'Time', mono: true, value: (m) => `${m.timeStart ?? ''}–${m.timeEnd ?? ''} ${m.timezone ?? ''}` },
    { key: 'subject', label: 'With', render: (m) => <span className="text-ink">{m.subject}</span> },
    { key: 'clientName', label: 'Client', value: (m) => m.clientName ?? '' },
    { key: 'corporateName', label: 'Corporate', hidden: true },
    { key: 'classification', label: 'Kind', value: (m) => ({ analyst: 'Analyst', corporate: 'Corporate', expert_meeting: 'Expert' }[m.classification ?? 'analyst']) },
    { key: 'location', label: 'Location' },
    { key: 'meetingType', label: 'Format', hidden: true },
    { key: 'attendees', label: 'Attendees', value: (m) => [...m.clientContacts, ...m.corporateContacts].map((c) => c.name).join(', '), hidden: true },
    { key: 'interactionId', label: 'Logged', value: (m) => (m.interactionId ? 'yes' : ''), render: (m) => (m.interactionId ? <span className="mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-signal)]">Logged</span> : <span className="text-silver">—</span>) },
  ];

  const yearFilter = <div className="w-[150px]"><SelectField label="Year" value={year || 'All years'} onChange={(v) => setParams(v === 'All years' ? {} : { year: v })} options={['All years', ...meta.years.map(String)]} /></div>;

  return (
    <div className="space-y-8">
      <ModuleHeader code="02 · Events" title="Events" blurb="Company roadshows, reverse roadshows and analyst marketing trips carry their meetings, investors, flights, ground transport, hotels and the Regis party as one printable itinerary. One-off meetings are single slots that convert straight into an interaction."
        actions={manage && <BtnPrimary onClick={() => navigate(`/crms/events/${category}/new`)}><IconPlus size={14} /> New {info.label.toLowerCase()}</BtnPrimary>} />

      <Tabs label="Event type" value={category} onChange={(v) => navigate(`/crms/events/${v}${year ? `?year=${year}` : ''}`)} tabs={CATEGORIES.map((c) => ({ id: c, label: EVENT_TYPES[c].plural }))} />

      {oneOff ? (
        <DataTable rows={meetings} columns={meetingColumns} loading={loading} title={info.plural} storageKey="events-meetings"
          emptyTitle={`No one-off meetings ${year ? `in ${year}` : 'yet'}.`} emptyHint="Record a meeting, then log it as an interaction with one click."
          onRowClick={(m) => navigate(`/crms/events/meetings/${m.id}`)} toolbar={yearFilter}
          actions={(m) => (
            <>
              <RowAction label="Open" onClick={() => navigate(`/crms/events/meetings/${m.id}`)}><IconArrowRight size={14} /></RowAction>
              {manage && <RowAction label={armed === m.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(m.id, () => { void removeMeeting(m); })}>{armed === m.id ? <IconCheck /> : <IconTrash />}</RowAction>}
            </>
          )} />
      ) : (
        <DataTable rows={rows} columns={eventColumns} loading={loading} title={info.plural} storageKey={`events-${category}`}
          emptyTitle={`No ${info.plural.toLowerCase()} ${year ? `in ${year}` : 'yet'}.`} emptyHint={`Create the first ${info.label.toLowerCase()} and build its schedule.`}
          onRowClick={(e) => navigate(`/crms/events/${category}/${e.id}`)} toolbar={yearFilter}
          actions={(e) => (
            <>
              <RowAction label="Open" onClick={() => navigate(`/crms/events/${category}/${e.id}`)}><IconArrowRight size={14} /></RowAction>
              <RowAction label="Download itinerary PDF" disabled={busy === e.id} onClick={() => void download(e)}><IconDownload size={14} /></RowAction>
              <RowAction label="Email itinerary PDF to me" disabled={busy === e.id} onClick={() => void email(e)}><IconMail size={14} /></RowAction>
              <RowAction label="Itinerary for one contact" disabled={busy === e.id} onClick={() => void byContact(e)}><IconPeople size={14} /></RowAction>
              {manage && <RowAction label={armed === e.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(e.id, () => { void removeEvent(e); })}>{armed === e.id ? <IconCheck /> : <IconTrash />}</RowAction>}
            </>
          )} />
      )}

      {itinerary && <ItineraryModal event={itinerary.event} contactOptions={itinerary.contacts} onClose={() => setItinerary(null)} />}
    </div>
  );
}
