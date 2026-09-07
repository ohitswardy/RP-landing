import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { BtnGhost, BtnPrimary, SkeletonRows } from '../../../cms/ui';
import { Modal } from '../../../cms/kit/parts';
import { IconDownload } from '../../../cms/icons';
import { Picker } from '../../kit/fields';
import { errorText } from '../../kit/toast';
import { fmtDay, fmtRange, type CrmsEvent, type Itinerary as ItineraryData, type ItineraryItem } from '../../data';

/* ─────────────────────────────────────────────────────────────
   The itinerary (§7.2): cover, participants, summary schedule,
   and the day-by-day detailed schedule with hotels on every day
   they cover. Rendered in-app and printed to PDF from the same
   data through a print window — download, or filtered to one
   client contact so they only see the meetings they attend.
   ───────────────────────────────────────────────────────────── */

const KIND: Record<ItineraryItem['kind'], { label: string; color: string }> = {
  meeting: { label: 'Meeting', color: 'var(--color-navy)' },
  flight: { label: 'Flight', color: 'var(--color-amber-deep)' },
  transport: { label: 'Transport', color: 'var(--color-graphite)' },
  hotel: { label: 'Hotel', color: 'var(--color-bronze)' },
};

const PRINT_COLOR: Record<ItineraryItem['kind'], string> = { meeting: '#1c2745', flight: '#b26a17', transport: '#6b7280', hotel: '#7a5a34' };

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] ?? ch));
}

/** The print document: same sections as the screen, A4 portrait, page footer with the coordinator. */
function printHtml(d: ItineraryData): string {
  const ev = d.event;
  const stamp = new Date(d.generatedAt).toLocaleString('en-PH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const footer = `Primary Coordinator: ${esc(ev.coordinator ?? '—')} · ${esc([ev.mobileNo, ev.telNo, ev.email].filter(Boolean).join(' · '))} · Generated ${stamp}`;
  const people = (ps: string[]) => (ps.length ? `<div class="p">${ps.map(esc).join(' · ')}</div>` : '');

  const participants = `
    <h2>Participants</h2>
    <h3>Investors</h3>
    ${d.participants.investors.length === 0 ? '<p class="muted">—</p>' : d.participants.investors.map((i) => `
      <div class="firm"><strong>${esc(i.client)}</strong>${i.contacts.map((c) => `<div class="row"><span>${esc(c.name)}${c.position ? ` <em>${esc(c.position)}</em>` : ''}</span><span class="m">${esc([c.email, c.phone].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>`).join('')}
    <h3>Regis</h3>
    ${d.participants.regis.length === 0 ? '<p class="muted">—</p>' : d.participants.regis.map((r) => `<div class="row"><span>${esc(r.name)}${r.position ? ` <em>${esc(r.position)}</em>` : ''}</span><span class="m">${esc([r.email, r.phone].filter(Boolean).join(' · '))}</span></div>`).join('')}`;

  const summary = `
    <h2>Summary schedule</h2>
    ${d.summary.length === 0 ? '<p class="muted">No meetings scheduled.</p>' : d.summary.map((day) => `
      <div class="day"><div class="dh">${esc(fmtDay(day.date))}</div>
      ${day.meetings.map((m) => `<div class="row"><span class="m t">${esc(m.time)}–${esc(m.timeEnd)} ${esc(m.timezone ?? '')}</span><span>${esc(m.title)} <em>${esc(m.type)}</em></span><span class="muted">${esc(m.location)}</span></div>`).join('')}</div>`).join('')}`;

  const detail = `
    <h2>Detailed schedule</h2>
    ${d.days.map((day) => `
      <div class="day"><div class="dh">${esc(fmtDay(day.date))}</div>
      ${day.items.map((it) => `
        <div class="item"><span class="band" style="background:${PRINT_COLOR[it.kind]}"></span>
          <div class="m t">${esc(it.time ?? '')}${it.timeEnd ? `–${esc(it.timeEnd)}` : ''} ${esc(it.timezone ?? '')}</div>
          <div><div><strong>${esc(it.title)}</strong>${it.subtitle ? ` <em>${esc(it.subtitle)}</em>` : ''} <span class="k">${KIND[it.kind].label}</span></div>
          ${it.detail ? `<div class="muted">${esc(it.detail)}</div>` : ''}${people(it.people)}${it.note ? `<div class="note">NOTE: ${esc(it.note)}</div>` : ''}</div>
        </div>`).join('')}</div>`).join('')}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(ev.categoryLabel)} Schedule - ${esc(ev.subject)}</title><style>
    @page{size:A4 portrait;margin:18mm 16mm 22mm}
    body{font:11.5px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#111;margin:0}
    .cover{height:240mm;display:flex;flex-direction:column;justify-content:flex-end;page-break-after:always;border-left:6px solid #1c2745;padding-left:18px}
    .cover .k{font:10px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#777}
    .cover h1{font-size:34px;font-weight:500;letter-spacing:-.02em;margin:10px 0 6px}
    .cover .range{font-size:15px;color:#444}
    .logo{position:fixed;top:0;right:0;font:10px ui-monospace,monospace;letter-spacing:.24em;text-transform:uppercase;color:#1c2745}
    .foot{position:fixed;bottom:0;left:0;right:0;font:9px ui-monospace,monospace;letter-spacing:.06em;color:#777;border-top:1px solid #ddd;padding-top:5px}
    h2{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#1c2745;border-bottom:1px solid #1c2745;padding-bottom:4px;margin:22px 0 10px}
    h3{font:10px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#777;margin:14px 0 6px}
    .row{display:flex;gap:14px;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #e5e5e5}
    .firm{margin-bottom:8px}.m{font-family:ui-monospace,monospace;font-size:10.5px}.t{min-width:118px}
    .muted{color:#777}em{font-style:normal;color:#777}.k{font:9px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#999;margin-left:6px}
    .day{margin-bottom:14px;page-break-inside:avoid}.dh{background:#1c2745;color:#fff;font:10px ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;padding:4px 8px;margin-bottom:6px}
    .item{display:grid;grid-template-columns:4px 118px 1fr;gap:10px;padding:5px 0;border-bottom:1px solid #eee}.band{display:block;height:100%;min-height:14px}
    .p{color:#444;font-size:10.5px}.note{margin-top:3px;font-size:10.5px;color:#b26a17}
  </style></head><body>
    <div class="cover"><div class="k">${esc(ev.categoryLabel)}${ev.classification ? ` · ${esc(ev.classification)}` : ''}</div><h1>${esc(ev.subject)}</h1><div class="range">${esc(fmtRange(ev.startDate, ev.endDate))}</div>${d.filteredTo ? '<div class="k" style="margin-top:8px">Personal schedule</div>' : ''}</div>
    <div class="logo">Regis Partners</div>
    ${participants}${summary}${detail}
    <div class="foot">${footer}</div>
  </body></html>`;
}

export default function ItineraryModal({ event, contactOptions, onClose }: {
  event: CrmsEvent; contactOptions: { id: string; label: string; hint?: string | null }[]; onClose: () => void;
}) {
  const [contactId, setContactId] = useState<string | null>(null);
  const [data, setData] = useState<ItineraryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    apiFetch<ItineraryData>(`/crms/events/${event.id}/itinerary${contactId ? `?contactId=${contactId}` : ''}`, { audience: 'cms' })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(errorText(e, 'The itinerary could not be built.')); });
    return () => { alive = false; };
  }, [event.id, contactId]);

  const filename = useMemo(() => `${event.categoryLabel} Schedule - ${event.subject} (${new Date().toLocaleString('en-PH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })})`, [event]);

  const print = () => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.write(printHtml(data).replace('<title>', `<title>${esc(filename)}`).replace(/<title>[^<]*<title>/, '<title>'));
    w.document.title = filename;
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  return (
    <Modal open wide title={`Itinerary · ${event.subject}`} onClose={onClose}
      footer={<>
        <span className="mono mr-auto text-[10px] uppercase tracking-[0.14em] text-silver">Saves as PDF from the print dialog</span>
        <BtnGhost onClick={onClose}>Close</BtnGhost>
        <BtnPrimary onClick={print} disabled={!data}><IconDownload size={13} /> {contactId ? 'Print personal schedule' : 'Print / Save PDF'}</BtnPrimary>
      </>}>
      <div className="space-y-6">
        <div className="max-w-[360px]">
          <Picker label="Filter to one client contact" options={contactOptions} value={contactId} onChange={setContactId} placeholder="Full schedule" hint="only their meetings" />
        </div>
        {error && <p className="text-[12.5px]" style={{ color: 'var(--color-warn)' }}>{error}</p>}
        {!data ? <SkeletonRows rows={5} /> : (
          <div className="space-y-8">
            <div className="border-l-[3px] pl-4" style={{ borderColor: 'var(--color-navy)' }}>
              <p className="mono text-[10px] uppercase tracking-[0.2em] text-graphite">{data.event.categoryLabel}{data.event.classification ? ` · ${data.event.classification}` : ''}</p>
              <h3 className="mt-1 text-[22px] tracking-[-0.02em] text-ink">{data.event.subject}</h3>
              <p className="mt-1 text-[13px] text-slate">{fmtRange(data.event.startDate, data.event.endDate)}</p>
            </div>

            <section>
              <h4 className="mono mb-3 border-b rule pb-2 text-[10px] uppercase tracking-[0.2em] text-ink">Participants</h4>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mono mb-2 text-[9.5px] uppercase tracking-[0.16em] text-graphite">Investors</p>
                  {data.participants.investors.length === 0 && <p className="text-[12.5px] text-silver">—</p>}
                  {data.participants.investors.map((i, k) => (
                    <div key={k} className="mb-2 text-[13px]"><span className="text-ink">{i.client}</span>{i.contacts.map((c) => <div key={c.name} className="text-slate">{c.name} <span className="text-graphite">{c.position}</span></div>)}</div>
                  ))}
                </div>
                <div>
                  <p className="mono mb-2 text-[9.5px] uppercase tracking-[0.16em] text-graphite">Regis</p>
                  {data.participants.regis.length === 0 && <p className="text-[12.5px] text-silver">—</p>}
                  {data.participants.regis.map((r, k) => <div key={k} className="text-[13px] text-slate">{r.name} <span className="text-graphite">{r.position}</span> <span className="mono text-[11px] text-silver">{r.phone}</span></div>)}
                </div>
              </div>
            </section>

            <section>
              <h4 className="mono mb-3 border-b rule pb-2 text-[10px] uppercase tracking-[0.2em] text-ink">Detailed schedule</h4>
              {data.days.length === 0 && <p className="text-[13px] text-graphite">Nothing scheduled{contactId ? ' for this contact' : ''}.</p>}
              <div className="space-y-5">
                {data.days.map((day) => (
                  <div key={day.date}>
                    <div className="mono bg-navy px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-paper">{fmtDay(day.date)}</div>
                    <ul className="divide-y rule">
                      {day.items.map((it, k) => (
                        <li key={k} className="grid grid-cols-[3px_120px_1fr] gap-3 py-2.5">
                          <span className="block" style={{ background: KIND[it.kind].color }} />
                          <span className="mono num text-[11.5px] text-slate">{it.time ?? ''}{it.timeEnd ? `–${it.timeEnd}` : ''} <span className="text-silver">{it.timezone ?? ''}</span></span>
                          <div className="min-w-0 text-[13px]">
                            <p><span className="text-ink">{it.title}</span>{it.subtitle && <span className="text-graphite"> · {it.subtitle}</span>} <span className="mono ml-1 text-[9px] uppercase tracking-[0.14em] text-silver">{KIND[it.kind].label}</span></p>
                            {it.detail && <p className="text-graphite">{it.detail}</p>}
                            {it.people.length > 0 && <p className="text-[12px] text-slate">{it.people.join(' · ')}</p>}
                            {it.note && <p className="text-[12px]" style={{ color: 'var(--color-amber-deep)' }}>NOTE: {it.note}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}
