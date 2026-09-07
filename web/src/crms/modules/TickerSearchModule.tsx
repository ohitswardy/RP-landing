import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { Chip, ModuleHeader, SkeletonRows } from '../../cms/ui';
import { useCrms } from '../store';
import { Picker, SectionRule } from '../kit/fields';
import { useOptions } from '../kit/options';
import { errorText } from '../kit/toast';
import { fmtDay, type ClientContact, type Corporate, type Interaction } from '../data';

/* ─────────────────────────────────────────────────────────────
   Ticker search (§7.4): pick a corporate, see every client
   contact who holds or watches it, and the last interactions
   that named it.
   ───────────────────────────────────────────────────────────── */

type Holders = { corporate: Corporate; owners: ClientContact[]; watchers: ClientContact[]; lastDiscussed: Interaction[] };

export default function TickerSearchModule() {
  const [params, setParams] = useSearchParams();
  const { status } = useCrms();
  const options = useOptions();
  const corporateId = params.get('corporateId');
  const [data, setData] = useState<Holders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!corporateId) { setData(null); return; }
    let alive = true;
    setLoading(true);
    apiFetch<Holders>(`/crms/corporates/${corporateId}/holders`, { audience: 'cms' })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(errorText(e, 'The lookup failed.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [corporateId]);

  return (
    <div className="space-y-10">
      <ModuleHeader code="10 · Ticker search" title="Who owns, who watches" blurb="Given a corporate, every client contact whose holdings or watchlist names it — the call list for a reverse roadshow or a results note." />

      <div className="max-w-[520px]">
        <Picker label="Corporate" options={options.corporates} value={corporateId} onChange={(v) => setParams(v ? { corporateId: v } : {})} placeholder={status === 'loading' ? 'Loading corporates…' : 'Type a name or ticker'} />
      </div>

      {error && <p className="border-l-2 pl-3 text-[12.5px]" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>{error}</p>}

      {corporateId && (loading || !data ? <SkeletonRows rows={4} /> : (
        <div className="space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b rule pb-6">
            <div>
              <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{data.corporate.ticker ?? '—'} · {data.corporate.sectorGeneric ?? 'Sector not set'}</div>
              <h2 className="mt-2 text-[clamp(1.3rem,2vw,1.7rem)] tracking-[-0.02em] text-ink">{data.corporate.name}</h2>
            </div>
            <div className="flex gap-8">
              <span className="text-right"><span className="mono num block text-[1.6rem] leading-none text-ink">{data.owners.length}</span><span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">holders</span></span>
              <span className="text-right"><span className="mono num block text-[1.6rem] leading-none text-ink">{data.watchers.length}</span><span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">watching</span></span>
            </div>
          </div>

          <div className="grid gap-10 md:grid-cols-2">
            <ContactList code="Holds" title="Own the stock" items={data.owners} />
            <ContactList code="Watches" title="On the watchlist" items={data.watchers} />
          </div>

          <section className="space-y-4">
            <SectionRule code="Discussed" title="Recent interactions naming this stock" />
            {data.lastDiscussed.length === 0 ? <p className="text-[13px] text-graphite">No interaction form has named it yet.</p> : (
              <ul className="divide-y rule">
                {data.lastDiscussed.map((i) => (
                  <li key={i.id} className="grid grid-cols-12 gap-3 py-3 text-[13px]">
                    <Link to={`/crms/interactions/${i.id}`} className="mono num col-span-3 text-[11px] tracking-[0.06em] text-graphite hover:text-ink md:col-span-2">{i.reference}</Link>
                    <span className="mono col-span-3 text-[11px] text-slate md:col-span-2">{fmtDay(i.date)}</span>
                    <span className="col-span-6 truncate text-ink md:col-span-3">{i.clientName}</span>
                    <span className="col-span-12 truncate text-graphite md:col-span-5">{i.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ))}
    </div>
  );
}

function ContactList({ code, title, items }: { code: string; title: string; items: ClientContact[] }) {
  return (
    <section className="space-y-4">
      <SectionRule code={code} title={title} />
      {items.length === 0 ? <p className="text-[13px] text-graphite">No one recorded.</p> : (
        <ul className="divide-y rule">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link to={`/crms/client-contacts/${c.id}`} className="block truncate text-[13.5px] text-ink hover:text-[color:var(--color-amber-deep)]">{c.name}</Link>
                <p className="truncate text-[12px] text-graphite">{c.clientName}{c.position ? ` · ${c.position}` : ''}</p>
              </div>
              {c.portalUserId && <Chip tone="live">Portal</Chip>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
