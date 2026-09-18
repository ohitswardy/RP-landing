import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { ModuleHeader, SkeletonRows } from '../../cms/ui';
import { ToolBtn } from '../kit/DataTable';
import { errorText, useToast } from '../kit/toast';
import { EVENT_TYPES, fmtDay, type CrmsEvent, type EventCategory, type Meeting, type OneOffMeeting } from '../data';

/* ─────────────────────────────────────────────────────────────
   Calendar (§7.5). Four views, as the legacy FullCalendar had:
   a month grid of every event type as a span with each day's
   meetings beneath; a week and a day as agenda columns with the
   all-day events on top and the timed slots (roadshow meetings
   and one-off meetings) in order; and a list of the coming days.
   Clicking an entry opens the event form with ?form=calendar so
   Cancel comes back here rather than to the list.
   ───────────────────────────────────────────────────────────── */

const TONE: Record<EventCategory, string> = {
  'roadshows': 'var(--color-navy)',
  'reverse-roadshows': 'var(--color-bronze)',
  'meetings': 'var(--color-amber-deep)',
  'analyst-marketing': 'var(--color-signal)',
};

type View = 'month' | 'week' | 'day' | 'list';
const VIEWS: { id: View; label: string }[] = [{ id: 'month', label: 'Month' }, { id: 'week', label: 'Week' }, { id: 'day', label: 'Day' }, { id: 'list', label: 'List' }];

/** One timed entry in the agenda views: a roadshow meeting or a one-off meeting. */
type Slot = { id: string; time: string; timeEnd: string | null; timezone: string | null; title: string; where: string | null; category: EventCategory; event: CrmsEvent | null; to: string };

type Feed = { events: CrmsEvent[]; meetings: Meeting[]; oneOffMeetings: OneOffMeeting[] };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const parseIso = (s: string | null): Date => { const [y, m, d] = (s ?? iso(new Date())).split('-').map(Number); return new Date(y, m - 1, d); };

export default function CalendarModule() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.some((v) => v.id === params.get('view')) ? params.get('view') : 'month') as View;
  const cursor = useMemo(() => parseIso(params.get('date')), [params]);
  const [data, setData] = useState<Feed | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const go = (next: { view?: View; date?: Date }) => {
    const p = new URLSearchParams(params);
    if (next.view) p.set('view', next.view);
    if (next.date) p.set('date', iso(next.date));
    setParams(p);
  };

  // The days each view shows; the feed is fetched for exactly that span.
  const days = useMemo(() => {
    if (view === 'month') {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const start = mondayOf(first);
      return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    }
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(mondayOf(cursor), i));
    if (view === 'day') return [cursor];
    return Array.from({ length: 14 }, (_, i) => addDays(cursor, i));
  }, [view, cursor]);
  const from = iso(days[0]);
  const to = iso(days[days.length - 1]);

  useEffect(() => {
    let alive = true;
    setData(null);
    apiFetch<Feed>(`/crms/calendar?from=${from}&to=${to}`, { audience: 'cms' })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => notify(errorText(e, 'The calendar could not be loaded.'), 'warn'));
    return () => { alive = false; };
  }, [from, to, notify]);

  const eventById = useMemo(() => new Map((data?.events ?? []).map((e) => [e.id, e])), [data]);

  const byDay = useMemo(() => {
    const spans = new Map<string, CrmsEvent[]>();
    const slots = new Map<string, Slot[]>();
    // One-off meetings sit beside the roadshows: a span in the month grid, a timed slot in the agenda views.
    const oneOffSpans: CrmsEvent[] = (data?.oneOffMeetings ?? []).map((m): CrmsEvent => ({
      id: m.id, category: 'meetings', categoryLabel: m.categoryLabel, classification: m.classification, subject: m.subject, startDate: m.startDate, endDate: m.endDate,
      coordinator: null, telNo: null, mobileNo: null, email: null, corporateId: m.corporateId, corporateName: m.corporateName, clientId: m.clientId, clientName: m.clientName,
      clientContacts: m.clientContacts, sellsideContacts: [], meetingCount: 0, updatedAt: m.updatedAt,
    }));
    for (const e of [...(data?.events ?? []), ...(view === 'month' ? oneOffSpans : [])]) {
      const end = e.endDate ?? e.startDate;
      for (const d of days) { const k = iso(d); if (k >= e.startDate && k <= end) spans.set(k, [...(spans.get(k) ?? []), e]); }
    }
    const push = (k: string, s: Slot) => slots.set(k, [...(slots.get(k) ?? []), s]);
    for (const m of data?.meetings ?? []) {
      const e = eventById.get(m.eventId) ?? null;
      push(m.date, { id: `m${m.id}`, time: m.timeStart, timeEnd: m.timeEnd, timezone: m.timezone, title: m.counterparty, where: m.location, category: e?.category ?? 'roadshows', event: e, to: e ? `/crms/events/${e.category}/${e.id}?form=calendar` : '' });
    }
    if (view !== 'month') {
      for (const m of data?.oneOffMeetings ?? []) {
        push(m.startDate, { id: `o${m.id}`, time: m.timeStart ?? '', timeEnd: m.timeEnd, timezone: m.timezone, title: m.subject, where: m.location, category: 'meetings', event: null, to: `/crms/events/meetings/${m.id}?form=calendar` });
      }
    }
    for (const [k, list] of slots) slots.set(k, list.sort((a, b) => a.time.localeCompare(b.time)));
    return { spans, slots };
  }, [data, days, eventById, view]);

  const todayKey = iso(new Date());
  const title = view === 'month' ? cursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    : view === 'day' ? fmtDay(iso(cursor))
    : `${fmtDay(from)} – ${fmtDay(to)}`;
  const step = view === 'month' ? 0 : view === 'week' ? 7 : view === 'day' ? 1 : 14;
  const shift = (n: number) => go({ date: step === 0 ? new Date(cursor.getFullYear(), cursor.getMonth() + n, 1) : addDays(cursor, n * step) });
  const open = (e: CrmsEvent) => navigate(`/crms/events/${e.category}/${e.id}?form=calendar`);

  const daySlots = selected ? byDay.slots.get(selected) ?? [] : [];
  const dayEvents = selected ? byDay.spans.get(selected) ?? [] : [];

  const spanBar = (e: CrmsEvent) => (
    <button key={e.id} type="button" onClick={() => open(e)} title={`${e.categoryLabel} · ${e.subject}`} className="block w-full truncate px-1.5 py-0.5 text-left text-[10.5px] text-paper" style={{ background: TONE[e.category] }}>{e.subject}</button>
  );
  const slotRow = (s: Slot) => (
    <li key={s.id} className="grid grid-cols-[3px_1fr] gap-2 py-1.5">
      <span className="block" style={{ background: TONE[s.category] }} />
      <span className="min-w-0 text-[12.5px]">
        <span className="mono num block text-[10.5px] text-slate">{s.time}{s.timeEnd ? `–${s.timeEnd}` : ''} <span className="text-silver">{s.timezone ?? ''}</span></span>
        {s.to ? <Link to={s.to} className="block truncate text-ink hover:text-[color:var(--color-amber-deep)]">{s.title}</Link> : <span className="block truncate text-ink">{s.title}</span>}
        <span className="block truncate text-[11.5px] text-graphite">{[s.where, s.event?.subject].filter(Boolean).join(' · ')}</span>
      </span>
    </li>
  );

  return (
    <div className="space-y-8">
      <ModuleHeader code="03 · Calendar" title={title} blurb="Every roadshow, reverse roadshow, meeting and analyst marketing trip. Month for the shape of things, week and day for the slots, list for what is coming."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">{VIEWS.map((v) => <ToolBtn key={v.id} active={view === v.id} onClick={() => go({ view: v.id })}>{v.label}</ToolBtn>)}</div>
            <div className="flex items-center gap-1"><ToolBtn onClick={() => shift(-1)}>‹ Prev</ToolBtn><ToolBtn onClick={() => go({ date: new Date() })}>Today</ToolBtn><ToolBtn onClick={() => shift(1)}>Next ›</ToolBtn></div>
          </div>
        } />

      <div className="flex flex-wrap gap-4">
        {(Object.keys(EVENT_TYPES) as EventCategory[]).map((c) => (
          <span key={c} className="mono inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-graphite"><span className="h-2 w-2" style={{ background: TONE[c] }} />{EVENT_TYPES[c].plural}</span>
        ))}
      </div>

      {!data ? <SkeletonRows rows={6} /> : view === 'month' ? (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="grid grid-cols-7 border-l rule border-t rule">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="mono border-b rule border-r rule px-2 py-1.5 text-[9.5px] uppercase tracking-[0.18em] text-graphite">{d}</div>)}
              {days.map((d) => {
                const k = iso(d);
                const inMonth = d.getMonth() === cursor.getMonth();
                const evs = byDay.spans.get(k) ?? [];
                const mts = byDay.slots.get(k) ?? [];
                return (
                  <button key={k} type="button" onClick={() => setSelected(k)} onDoubleClick={() => go({ view: 'day', date: d })} className={`flex min-h-[86px] flex-col items-stretch gap-1 border-b rule border-r rule p-1.5 text-left transition-colors ${inMonth ? 'bg-paper' : 'bg-bone/60'} ${selected === k ? 'ring-1 ring-inset ring-[color:var(--color-amber)]' : 'hover:bg-bone'}`}>
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
            {selected && dayEvents.length === 0 && daySlots.length === 0 && <p className="text-[13px] text-graphite">Nothing scheduled.</p>}
            {dayEvents.length > 0 && (
              <ul className="space-y-2">
                {dayEvents.map((e) => (
                  <li key={e.id}><button type="button" onClick={() => open(e)} className="flex w-full items-center gap-3 border rule bg-paper px-3 py-2 text-left hover:border-[color:var(--color-amber-deep)]"><span className="h-6 w-[3px]" style={{ background: TONE[e.category] }} /><span className="min-w-0"><span className="block truncate text-[13px] text-ink">{e.subject}</span><span className="mono block text-[9.5px] uppercase tracking-[0.14em] text-graphite">{e.categoryLabel}</span></span></button></li>
                ))}
              </ul>
            )}
            {daySlots.length > 0 && <ul className="divide-y rule border-y rule">{daySlots.map(slotRow)}</ul>}
            {selected && <button type="button" onClick={() => go({ view: 'day', date: parseIso(selected) })} className="mono text-[10px] uppercase tracking-[0.16em] text-graphite hover:text-ink">Open day view →</button>}
          </aside>
        </div>
      ) : view === 'list' ? (
        <div className="max-w-[820px]">
          {days.every((d) => !(byDay.spans.get(iso(d))?.length || byDay.slots.get(iso(d))?.length)) && <p className="border rule border-dashed px-6 py-8 text-[13px] text-graphite">Nothing scheduled in the next two weeks.</p>}
          {days.map((d) => {
            const k = iso(d);
            const evs = byDay.spans.get(k) ?? [];
            const sl = byDay.slots.get(k) ?? [];
            if (evs.length === 0 && sl.length === 0) return null;
            return (
              <section key={k} className="mb-6">
                <div className={`mono bg-navy px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-paper ${k === todayKey ? 'border-l-2 border-[color:var(--color-amber)]' : ''}`}>{fmtDay(k)}{k === todayKey ? ' · Today' : ''}</div>
                {evs.length > 0 && <div className="mt-2 space-y-1">{evs.map(spanBar)}</div>}
                {sl.length > 0 && <ul className="divide-y rule">{sl.map(slotRow)}</ul>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className={`grid border-l rule border-t rule ${view === 'week' ? 'grid-cols-7' : 'grid-cols-1 max-w-[820px]'}`}>
          {days.map((d) => {
            const k = iso(d);
            const evs = byDay.spans.get(k) ?? [];
            const sl = byDay.slots.get(k) ?? [];
            return (
              <div key={k} className={`flex min-h-[420px] flex-col border-b rule border-r rule ${k === todayKey ? 'bg-paper' : 'bg-paper'}`}>
                <div className={`mono border-b rule px-2 py-1.5 text-[9.5px] uppercase tracking-[0.18em] ${k === todayKey ? 'text-[color:var(--color-amber-deep)]' : 'text-graphite'}`}>
                  {d.toLocaleDateString('en-PH', { weekday: 'short' })} <span className="num text-ink">{d.getDate()}</span>{view === 'day' ? ` · ${d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}` : ''}
                </div>
                <div className="space-y-0.5 border-b rule p-1.5 min-h-[34px]">{evs.map(spanBar)}</div>
                <ul className="divide-y rule px-1.5">
                  {sl.length === 0 && <li className="py-3 text-[11.5px] text-silver">—</li>}
                  {sl.map(slotRow)}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
