import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { ModuleHeader, SelectField, SkeletonRows, EmptyState } from '../../cms/ui';
import { IconSearch } from '../../cms/icons';
import { useCrms } from '../store';
import { Pager } from '../kit/fields';
import { errorText } from '../kit/toast';
import type { AuditEntry, Paged } from '../data';

/* ─────────────────────────────────────────────────────────────
   Logs — the CRMS slice of the CMS audit ledger, written by the
   API on every mutation (no client-side logging to spoof).
   ───────────────────────────────────────────────────────────── */

const MONTHS = ['All months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function stamp(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function LogsModule() {
  const { meta } = useCrms();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState('All months');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AuditEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [year, month, q]);

  useEffect(() => {
    let alive = true;
    const p = new URLSearchParams({ year, page: String(page), perPage: '50' });
    const m = MONTHS.indexOf(month);
    if (m > 0) p.set('month', String(m));
    if (q.trim()) p.set('q', q.trim());
    const t = setTimeout(() => {
      apiFetch<Paged<AuditEntry>>(`/crms/logs?${p}`, { audience: 'cms' })
        .then((d) => { if (alive) { setData(d); setError(null); } })
        .catch((e) => { if (alive) setError(errorText(e, 'The log could not be loaded.')); });
    }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [year, month, q, page]);

  return (
    <div className="space-y-8">
      <ModuleHeader code="13 · Logs" title="CRMS activity log" blurb="Every create, update, delete, link and report generated through the CRMS, attributed to the signed-in staff member and written server-side." />

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-2 gap-3 md:w-[360px]">
          <SelectField label="Year" value={year} onChange={setYear} options={meta.years.map(String)} />
          <SelectField label="Month" value={month} onChange={setMonth} options={MONTHS} />
        </div>
        <label className="flex items-center gap-2 border rule bg-white px-3">
          <IconSearch size={13} className="text-silver" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Actor, action, target" className="w-[240px] bg-transparent py-2.5 text-[13px] outline-none placeholder:text-silver" />
        </label>
      </div>

      {error && <p className="border-l-2 pl-3 text-[12.5px]" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>{error}</p>}

      {!data ? <SkeletonRows rows={8} /> : data.items.length === 0 ? (
        <EmptyState title="Nothing logged for this period." hint="Actions appear here the moment they are saved." />
      ) : (
        <>
          <ul className="divide-y rule border-y rule">
            {data.items.map((a) => (
              <li key={a.id} className="grid grid-cols-12 gap-3 py-3 text-[13px]">
                <span className="mono num col-span-12 text-[10.5px] uppercase tracking-[0.12em] text-silver md:col-span-2">{stamp(a.at)}</span>
                <span className="col-span-4 truncate text-ink md:col-span-2">{a.actor}</span>
                <span className="col-span-8 truncate text-slate md:col-span-3">{a.action.replace(/^CRMS · /, '')}</span>
                <span className="col-span-12 truncate text-graphite md:col-span-5">{a.target}</span>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
