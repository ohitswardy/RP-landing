import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { ModuleHeader, SkeletonRows } from '../../cms/ui';
import { ToolBtn } from '../kit/DataTable';
import { errorText, useToast } from '../kit/toast';
import { EVENT_TYPES, fmtDay, type CrmsEvent, type EventCategory, type Meeting, type OneOffMeeting } from '../data';

/* ─────────────────────────────────────────────────────────────
   Calendar (§7.5). A month grid of every event type as a span,
   with each day's meetings listed beneath. Clicking an entry
   opens the event form with ?form=calendar so Cancel comes
   back here rather than to the list.
   ───────────────────────────────────────────────────────────── */

const TONE: Record<EventCategory, string> = {
  'roadshows': 'var(--color-navy)',
  'reverse-roadshows': 'var(--color-bronze)',
  'meetings': 'var(--color-amber-deep)',
  'analyst-marketing': 'var(--color-signal)',
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarModule() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [data, setData] = useState<{ events: CrmsEvent[]; meetings: Meeting[]; oneOffMeetings: OneOffMeeting[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7)); // Monday-first
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    return { from: iso(days[0]), to: iso(days[41]), days };
  }, [cursor]);

  useEffect(() => {
    let alive = true;
    setData(null);
    apiFetch<{ events: CrmsEvent[]; meetings: Meeting[]; oneOffMeetings: OneOffMeeting[] }>(`/crms/calendar?from=${grid.from}&to=${grid.to}`, { audience: 'cms' })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => notify(errorText(e, 'The calendar could not be loaded.'), 'warn'));
    return () => { alive = false; };
  }, [grid.from, grid.to, notify]);

  const byDay = useMemo(() => {
    const events = new Map<string, CrmsEvent[]>();
    const meetings = new Map<string, Meeting[]>();
    // One-off meetings sit beside the roadshows as spans of their own category.
    const spans: CrmsEvent[] = [...(data?.events ?? []), ...(data?.oneOffMeetings ?? []).map((m): CrmsEvent => ({
      id: m.id, category: 'meetings', categoryLabel: m.categoryLabel, classification: m.classification, subject: m.subject, startDate: m.startDate, endDate: m.endDate,
      coordinator: null, telNo: null, mobileNo: null, email: null, corporateId: m.corporateId, corporateName: m.corporateName, clientId: m.clientId, clientName: m.clientName,
      clientContacts: m.clientContacts, sellsideContacts: [], meetingCount: 0, updatedAt: m.updatedAt,
    }))];
    for (const e of spans) {
      const end = e.endDate ?? e.startDate;
      for (const d of grid.days) { const k = iso(d); if (k >= e.startDate && k <= end) events.set(k, [...(events.get(k) ?? []), e]); }
    }
    for (const m of data?.meetings ?? []) meetings.set(m.date, [...(meetings.get(m.date) ?? []), m]);
    return { events, meetings };
  }, [data, grid.days]);

  const eventById = useMemo(() => new Map((data?.events ?? []).map((e) => [e.id, e])), [data]);
  const todayKey = iso(new Date());
  const month = cursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const open = (e: CrmsEvent) => navigate(`/crms/events/${e.category}/${e.id}?form=calendar`);

  const dayMeetings = selected ? byDay.meetings.get(selected) ?? [] : [];
  const dayEvents = selected ? byDay.events.get(selected) ?? [] : [];

  return (
    <div className="space-y-8">
      <ModuleHeader code="03 · Calendar" title={month} blurb="Every roadshow, reverse roadshow, meeting and analyst marketing trip across the month. Pick a day to see its meetings."
        actions={<div className="flex items-center gap-1"><ToolBtn onClick={() => shift(-1)}>‹ Prev</ToolBtn><ToolBtn onClick={() => setCursor(() => { const d = new Date(); d.setDate(1); return d; })}>Today</ToolBtn><ToolBtn onClick={() => shift(1)}>Next ›</ToolBtn></div>} />

      <div className="flex flex-wrap gap-4">
        {(Object.keys(EVENT_TYPES) as EventCategory[]).map((c) => (
          <span key={c} className="mono inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-graphite"><span className="h-2 w-2" style={{ background: TONE[c] }} />{EVENT_TYPES[c].plural}</span>
        ))}
      </div>

      {!data ? <SkeletonRows rows={6} /> : (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="grid grid-cols-7 border-l rule border-t rule">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="mono border-b rule border-r rule px-2 py-1.5 text-[9.5px] uppercase tracking-[0.18em] text-graphite">{d}</div>)}
              {grid.days.map((d) => {
                const k = iso(d);
                const inMonth = d.getMonth() === cursor.getMonth();
                const evs = byDay.events.get(k) ?? [];
                const mts = byDay.meetings.get(k) ?? [];
                return (
                  <button key={k} type="button" onClick={() => setSelected(k)} className={`flex min-h-[86px] flex-col items-stretch gap-1 border-b rule border-r rule p-1.5 text-left transition-colors ${inMonth ? 'bg-paper' : 'bg-bone/60'} ${selected === k ? 'ring-1 ring-inset ring-[color:var(--color-amber)]' : 'hover:bg-bone'}`}>
                    <span className={`mono num text-[10.5px] ${k === todayKey ? 'text-[color:var(--color-amber-deep)]' : inMonth ? 'text-ink' : 'text-silver'}`}>{d.getDate()}</span>
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} onClick={(ev) => { ev.stopPropagation(); open(e); }} title={`${e.categoryLabel} · ${e.subject}`} className="truncate px-1 text-[10.5px] text-paper" style={{ background: TONE[e.category] }}>{e.subject}</span>
                    ))}
                    {evs.length > 3 && <span className="mono text-[9px] text-silver">+{evs.length - 3}</span>}
                    {mts.length > 0 && <span className="mt-auto flex gap-0.5">{mts.slice(0, 8).map((m) => <span key={m.id} className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-navy)' }} />)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="space-y-5 lg:col-span-4">
            <div className="border-b rule pb-3">
              <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">Selected day</div>
              <h3 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-ink">{selected ? fmtDay(selected) : 'Pick a day'}</h3>
            </div>
            {selected && dayEvents.length === 0 && dayMeetings.length === 0 && <p className="text-[13px] text-graphite">Nothing scheduled.</p>}
            {dayEvents.length > 0 && (
              <ul className="space-y-2">
                {dayEvents.map((e) => (
                  <li key={e.id}><button type="button" onClick={() => open(e)} className="flex w-full items-center gap-3 border rule bg-paper px-3 py-2 text-left hover:border-[color:var(--color-amber-deep)]"><span className="h-6 w-[3px]" style={{ background: TONE[e.category] }} /><span className="min-w-0"><span className="block truncate text-[13px] text-ink">{e.subject}</span><span className="mono block text-[9.5px] uppercase tracking-[0.14em] text-graphite">{e.categoryLabel}</span></span></button></li>
                ))}
              </ul>
            )}
            {dayMeetings.length > 0 && (
              <ul className="divide-y rule border-y rule">
                {dayMeetings.sort((a, b) => a.timeStart.localeCompare(b.timeStart)).map((m) => {
                  const e = eventById.get(m.eventId);
                  return (
                    <li key={m.id} className="grid grid-cols-[110px_1fr] gap-3 py-2.5 text-[13px]">
                      <span className="mono num text-[11.5px] text-slate">{m.timeStart}–{m.timeEnd} <span className="text-silver">{m.timezone}</span></span>
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{m.counterparty}</span>
                        <span className="block truncate text-[12px] text-graphite">{m.location}{e ? ` · ` : ''}{e && <Link to={`/crms/events/${e.category}/${e.id}?form=calendar`} className="hover:text-ink">{e.subject}</Link>}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
