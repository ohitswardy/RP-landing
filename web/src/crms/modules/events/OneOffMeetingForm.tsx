import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../cms/auth';
import { BtnGhost, BtnPrimary, Chip, DateField, TextField } from '../../../cms/ui';
import { IconArrowRight, IconPen } from '../../../cms/icons';
import { useCrms } from '../../store';
import { FormError, MultiPicker, Picker, SectionRule, TimeField } from '../../kit/fields';
import { useOptions } from '../../kit/options';
import { errorText, useToast } from '../../kit/toast';
import { fmtDay, today, type AuditEntry, type OneOffClassification, type OneOffMeeting } from '../../data';

/* ─────────────────────────────────────────────────────────────
   A standalone meeting (the legacy `event` table): one client,
   optionally one corporate, a time slot, and the attendees. It
   converts into an interaction with one click, like a roadshow
   meeting does.
   ───────────────────────────────────────────────────────────── */

const CLASS_LABEL: Record<OneOffClassification, string> = { analyst: 'Analyst meeting', corporate: 'Corporate meeting', expert_meeting: 'Expert meeting' };

type Draft = {
  clientId: string | null; corporateId: string | null; startDate: string; endDate: string; timeStart: string | null; timeEnd: string | null; timezone: string;
  location: string; meetingType: string; classification: OneOffClassification; description: string; note: string; corporateAddress: string;
  clientContactIds: string[]; corporateContactIds: string[];
};

function toDraft(m: OneOffMeeting | null): Draft {
  return {
    clientId: m?.clientId ?? null, corporateId: m?.corporateId ?? null, startDate: m?.startDate ?? today(), endDate: m?.endDate ?? m?.startDate ?? today(),
    timeStart: m?.timeStart ?? '10:00', timeEnd: m?.timeEnd ?? '11:00', timezone: m?.timezone ?? 'MNL', location: m?.location ?? '', meetingType: m?.meetingType ?? '1-on-1',
    classification: m?.classification ?? 'analyst', description: m?.description ?? '', note: m?.note ?? '', corporateAddress: m?.corporateAddress ?? '',
    clientContactIds: m?.clientContacts.map((c) => String(c.id)) ?? [], corporateContactIds: m?.corporateContacts.map((c) => String(c.id)) ?? [],
  };
}

type ItemResponse = { item: OneOffMeeting; audit?: AuditEntry };

export default function OneOffMeetingForm({ meetingId }: { meetingId: string | null }) {
  const [params] = useSearchParams();
  const { can } = useAuth();
  const { appendAudit } = useCrms();
  const options = useOptions();
  const navigate = useNavigate();
  const { notify } = useToast();
  const manage = can('crms.events.manage');
  const fromCalendar = params.get('form') === 'calendar';
  const backTo = fromCalendar ? '/crms/events/calendar' : '/crms/events/meetings';

  const [meeting, setMeeting] = useState<OneOffMeeting | null>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(null));
  const [editing, setEditing] = useState(meetingId === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId) return;
    let alive = true;
    apiFetch<{ item: OneOffMeeting }>(`/crms/one-off-meetings/${meetingId}`, { audience: 'cms' })
      .then((d) => { if (alive) { setMeeting(d.item); setDraft(toDraft(d.item)); } })
      .catch((e) => { if (alive) setError(errorText(e, 'That meeting could not be opened.')); });
    return () => { alive = false; };
  }, [meetingId]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const nul = (s: string) => (s.trim() ? s : null);

  async function save() {
    if (!draft.clientId) { setError('Pick the client.'); return; }
    if (!draft.location.trim()) { setError('Where is the meeting?'); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        clientId: Number(draft.clientId), corporateId: draft.corporateId ? Number(draft.corporateId) : null,
        startDate: draft.startDate, endDate: draft.endDate || null, timeStart: draft.timeStart, timeEnd: draft.timeEnd, timezone: nul(draft.timezone),
        location: draft.location, meetingType: nul(draft.meetingType), classification: draft.classification, description: nul(draft.description), note: nul(draft.note), corporateAddress: nul(draft.corporateAddress),
        clientContactIds: draft.clientContactIds.map(Number), corporateContactIds: draft.corporateContactIds.map(Number),
      };
      const res = meeting
        ? await apiFetch<ItemResponse>(`/crms/one-off-meetings/${meeting.id}`, { method: 'PUT', audience: 'cms', body })
        : await apiFetch<ItemResponse>('/crms/one-off-meetings', { method: 'POST', audience: 'cms', body });
      appendAudit(res.audit);
      setMeeting(res.item);
      setEditing(false);
      notify(meeting ? 'Meeting saved.' : 'Meeting recorded.');
      if (!meeting) navigate(`/crms/events/meetings/${res.item.id}${fromCalendar ? '?form=calendar' : ''}`, { replace: true });
    } catch (e) { setError(errorText(e, 'The meeting could not be saved.')); } finally { setSaving(false); }
  }

  async function convert() {
    if (!meeting) return;
    try {
      const res = await apiFetch<{ item: { id: string; reference: string }; meeting: OneOffMeeting; audit?: AuditEntry }>(`/crms/one-off-meetings/${meeting.id}/convert-to-interaction`, { method: 'POST', audience: 'cms' });
      appendAudit(res.audit);
      setMeeting(res.meeting);
      notify(`Interaction ${res.item.reference} logged from this meeting.`);
      navigate(`/crms/interactions/${res.item.id}`);
    } catch (e) { notify(errorText(e, 'The meeting could not be converted.'), 'warn'); }
  }

  if (meetingId && !meeting && !error) return null;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to={backTo} className="mono text-[10px] uppercase tracking-[0.16em] text-graphite hover:text-ink">← {fromCalendar ? 'Calendar' : 'One-off meetings'}</Link>
          <h2 className="mt-3 text-[clamp(1.4rem,2.2vw,1.9rem)] tracking-[-0.02em] text-ink">{meeting ? meeting.subject : 'New one-off meeting'}</h2>
          <p className="mono mt-2 flex flex-wrap items-center gap-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite">
            <Chip tone="amber">One-Off Meeting</Chip>
            {meeting && <span>{fmtDay(meeting.startDate)} · {meeting.timeStart}–{meeting.timeEnd} {meeting.timezone}</span>}
            {meeting?.classification && <span className="text-silver">{CLASS_LABEL[meeting.classification]}</span>}
          </p>
        </div>
        {meeting && !editing && (
          <div className="flex flex-wrap gap-2">
            {meeting.interactionId
              ? <Link to={`/crms/interactions/${meeting.interactionId}`} className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink">Logged interaction <IconArrowRight size={12} /></Link>
              : manage && <BtnPrimary onClick={() => void convert()}>Log as interaction <IconArrowRight size={13} /></BtnPrimary>}
            {manage && <BtnGhost onClick={() => setEditing(true)}><IconPen size={13} /> Edit</BtnGhost>}
          </div>
        )}
      </div>

      {error && !editing && <FormError message={error} />}

      {editing ? (
        <div className="max-w-[900px] space-y-8">
          <section className="space-y-5">
            <SectionRule code="Who" title="Counterparties" />
            <div role="radiogroup" aria-label="Classification" className="grid gap-px border rule bg-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] sm:grid-cols-3">
              {(Object.keys(CLASS_LABEL) as OneOffClassification[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={draft.classification === k} onClick={() => set('classification', k)} className={`px-4 py-3 text-left text-[13px] transition-colors ${draft.classification === k ? 'bg-navy text-paper' : 'bg-paper text-slate hover:bg-bone'}`}>{CLASS_LABEL[k]}</button>
              ))}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Picker label="Client" options={options.clients} value={draft.clientId} onChange={(v) => { set('clientId', v); set('clientContactIds', []); }} allowEmpty={false} />
              <MultiPicker label="Client contacts" options={options.contactsOf(draft.clientId)} value={draft.clientContactIds} onChange={(v) => set('clientContactIds', v)} />
              {draft.classification !== 'analyst' && <>
                <Picker label={draft.classification === 'corporate' ? 'Corporate' : 'Corporate (optional)'} options={options.corporates} value={draft.corporateId} onChange={(v) => { set('corporateId', v); set('corporateContactIds', []); }} />
                <MultiPicker label="Corporate contacts" options={options.corporateContactsOf(draft.corporateId)} value={draft.corporateContactIds} onChange={(v) => set('corporateContactIds', v)} />
              </>}
            </div>
          </section>
          <section className="space-y-5">
            <SectionRule code="When & where" title="Slot" />
            <div className="grid gap-5 sm:grid-cols-5">
              <DateField label="Date" value={draft.startDate} onChange={(v) => setDraft((d) => ({ ...d, startDate: v, endDate: d.endDate < v ? v : d.endDate }))} />
              <DateField label="Ends" value={draft.endDate} onChange={(v) => set('endDate', v)} />
              <TimeField label="Start" value={draft.timeStart} onChange={(v) => set('timeStart', v)} />
              <TimeField label="End" value={draft.timeEnd} onChange={(v) => set('timeEnd', v)} />
              <TextField label="Timezone" value={draft.timezone} onChange={(v) => set('timezone', v.toUpperCase())} placeholder="MNL" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Location" value={draft.location} onChange={(v) => set('location', v)} placeholder="Virtual, office, restaurant" />
              <TextField label="Format" value={draft.meetingType} onChange={(v) => set('meetingType', v)} placeholder="1-on-1, Group Call, Lunch" />
            </div>
            <TextField label="Corporate address" value={draft.corporateAddress} onChange={(v) => set('corporateAddress', v)} />
          </section>
          <section className="space-y-5">
            <SectionRule code="Notes" title="Description" />
            <TextField label="Description" value={draft.description} onChange={(v) => set('description', v)} multiline />
            <TextField label="Note" value={draft.note} onChange={(v) => set('note', v)} multiline />
          </section>
          <FormError message={error} />
          <div className="flex justify-end gap-2 border-t rule pt-5">
            <BtnGhost onClick={() => (meeting ? (setEditing(false), setDraft(toDraft(meeting))) : navigate(backTo))}>Cancel</BtnGhost>
            <BtnPrimary onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : meeting ? 'Save changes' : 'Record meeting'}</BtnPrimary>
          </div>
        </div>
      ) : meeting && (
        <div className="grid gap-x-8 gap-y-4 border-y rule py-5 text-[13.5px] sm:grid-cols-2">
          <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Client</span><span className="text-ink">{meeting.clientName ?? '—'}</span> <span className="text-graphite">{meeting.clientContacts.map((c) => c.name).join(', ')}</span></p>
          <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Corporate</span><span className="text-ink">{meeting.corporateName ?? '—'}</span> <span className="text-graphite">{meeting.corporateContacts.map((c) => c.name).join(', ')}</span></p>
          <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Where</span><span className="text-ink">{meeting.location}</span> <span className="text-graphite">{meeting.meetingType}</span></p>
          <p><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Address</span><span className="text-slate">{meeting.corporateAddress ?? '—'}</span></p>
          {meeting.description && <p className="sm:col-span-2"><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Description</span><span className="whitespace-pre-line text-slate">{meeting.description}</span></p>}
          {meeting.note && <p className="sm:col-span-2"><span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">Note</span><span className="whitespace-pre-line text-slate">{meeting.note}</span></p>}
        </div>
      )}
    </div>
  );
}
