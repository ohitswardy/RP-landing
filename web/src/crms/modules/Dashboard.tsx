import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../cms/auth';
import { Chip, DateField, EASE, ModuleHeader, SkeletonRows, Stat } from '../../cms/ui';
import { IconArrowRight } from '../../cms/icons';
import { useCrms } from '../store';
import { fmtDay, fmtMinutes, timeAgo, type DashboardSummary } from '../data';
import { ImportantStar } from '../kit/important';
import { errorText } from '../kit/toast';
import { AreaChart } from '@/components/charts/area-chart';
import { Area } from '@/components/charts/area';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { ChartTooltip } from '@/components/charts/tooltip';

/* ─────────────────────────────────────────────────────────────
   Dashboard (§7.7). Interaction load by month as a Bklit area
   chart carrying logged minutes over time, the clients taking
   the most contact time, the stocks most discussed, and
   reverse-roadshow demand fanned out to the clients who asked,
   and the legacy tallies: company roadshows per corporate and
   reverse roadshows per client.
   Plus the important shelf: the latest interactions the desk
   starred, regardless of the range. All server-aggregated,
   read-only.
   ───────────────────────────────────────────────────────────── */

function firstOfMonthsAgo(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { session } = useAuth();
  const { audit, status } = useCrms();
  const [from, setFrom] = useState(() => firstOfMonthsAgo(11));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let alive = true;
    setError(null);
    apiFetch<DashboardSummary>(`/crms/dashboard/summary?from=${from}&to=${to}`, { audience: 'cms' })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(errorText(e, 'The summary could not be loaded.')); });
    return () => { alive = false; };
  }, [from, to]);

  const loadByMonth = useMemo(
    () => (data?.byMonth ?? []).map((m) => {
      const [y, mo] = m.month.split('-').map(Number);
      return { date: new Date(y, mo - 1, 1), minutes: m.minutes, count: m.count };
    }),
    [data],
  );
  const maxClient = useMemo(() => Math.max(1, ...(data?.byClient.map((c) => c.minutes) ?? [1])), [data]);
  const maxTally = useMemo(() => Math.max(1, ...(data?.roadshowTally.map((t) => t.events) ?? [1]), ...(data?.reverseTally.map((t) => t.events) ?? [1])), [data]);

  /* One tally list: a name, a bar scaled to the busiest row, and the count of events and meetings. */
  const tally = (rows: { name: string; events: number; meetings: number }[], empty: string) => (
    !data ? <SkeletonRows rows={4} /> : rows.length === 0 ? (
      <p className="border rule border-dashed px-6 py-8 text-[13px] text-graphite">{empty}</p>
    ) : (
      <ul className="divide-y rule border-y rule">
        {rows.map((r, i) => (
          <li key={r.name} className="grid grid-cols-12 items-center gap-3 py-3">
            <span className="mono num col-span-1 text-[10.5px] text-silver">{String(i + 1).padStart(2, '0')}</span>
            <span className="col-span-5 truncate text-[13.5px] text-ink">{r.name}</span>
            <div className="col-span-3 h-1.5 bg-bone">
              <motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.round((r.events / maxTally) * 100)}%` }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.04 }} className="h-full" style={{ background: 'var(--color-bronze)' }} />
            </div>
            <span className="mono num col-span-3 text-right text-[11.5px] text-slate">{r.events} event{r.events === 1 ? '' : 's'} · {r.meetings} mtg</span>
          </li>
        ))}
      </ul>
    )
  );
  const firstName = session?.name.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-12">
      <ModuleHeader
        code="00 · Dashboard"
        title={`Good day, ${firstName}.`}
        blurb="Logged client contact by month, who is taking the most of the desk's time, what is being discussed, and which corporates clients are asking to meet."
        actions={
          <div className="grid grid-cols-2 gap-3">
            <DateField label="From" value={from} onChange={setFrom} />
            <DateField label="To" value={to} onChange={setTo} />
          </div>
        }
      />

      {error && <p className="border-l-2 pl-3 text-[12.5px]" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>{error}</p>}

      {/* Totals */}
      <section className="grid grid-cols-2 gap-8 border-b rule pb-10 md:grid-cols-3 xl:grid-cols-6">
        <Stat value={data ? data.totals.interactions.toLocaleString('en-PH') : '—'} label="Interactions" />
        <Stat value={data ? fmtMinutes(data.totals.minutes) : '—'} label="Contact time" />
        <Stat value={data ? String(data.totals.clients) : '—'} label="Clients reached" />
        <Link to="/crms/interactions?important=1" className="group">
          <Stat value={data ? String(data.totals.important) : '—'} label="Important" />
          <span className="mono mt-1 block text-[9.5px] uppercase tracking-[0.16em] text-[color:var(--color-amber-deep)] opacity-0 transition-opacity group-hover:opacity-100">See all →</span>
        </Link>
        <Link to="/crms/interactions?disposition=open" className="group">
          <Stat value={data ? String(data.totals.openFlags) : '—'} label="Open flags" />
          <span className="mono mt-1 block text-[9.5px] uppercase tracking-[0.16em] text-[color:var(--color-amber-deep)] opacity-0 transition-opacity group-hover:opacity-100">Send to recipients →</span>
        </Link>
        <Link to="/crms/events/calendar" className="group">
          <Stat value={data ? String(data.totals.upcomingEvents) : '—'} label="Upcoming events" />
          <span className="mono mt-1 block text-[9.5px] uppercase tracking-[0.16em] text-[color:var(--color-amber-deep)] opacity-0 transition-opacity group-hover:opacity-100">Open calendar →</span>
        </Link>
      </section>

      <div className="grid gap-12 lg:grid-cols-12">
        <div className="space-y-12 lg:col-span-7">
        {/* Interaction load by month */}
        <section>
          <header className="mb-6 flex items-end justify-between">
            <div>
              <div className="eyebrow mb-2">Interaction load</div>
              <p className="text-[13px] text-graphite">Minutes of logged contact per month.</p>
            </div>
            <Chip tone="muted">{data ? `${data.byMonth.length} months` : '…'}</Chip>
          </header>
          {!data ? <SkeletonRows rows={4} /> : data.byMonth.length === 0 ? (
            <p className="border rule border-dashed px-6 py-10 text-[13px] text-graphite">No interactions logged in this range.</p>
          ) : (
            <div className="border-b rule pb-px">
              <AreaChart
                data={loadByMonth}
                xDataKey="date"
                aspectRatio="auto"
                style={{ height: 220 }}
                margin={{ top: 16, right: 12, bottom: 28, left: 16 }}
                animationDuration={reduce ? 0 : 1100}
              >
                <Grid horizontal numTicksRows={4} />
                <Area
                  dataKey="minutes"
                  fill="var(--color-navy)"
                  stroke="var(--color-navy)"
                  fillOpacity={0.14}
                  strokeWidth={2}
                  animate={!reduce}
                />
                <XAxis numTicks={Math.min(loadByMonth.length, 6)} />
                <ChartTooltip
                  rows={(point) => [
                    { color: 'var(--color-navy)', label: 'Contact time', value: fmtMinutes(Number(point.minutes)) },
                    { color: 'var(--color-amber-deep)', label: 'Interactions', value: Number(point.count) },
                  ]}
                />
              </AreaChart>
            </div>
          )}
        </section>

        {/* Important shelf */}
        <section>
          <header className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-2">Important</div>
              <p className="text-[13px] text-graphite">Interactions the desk starred. Latest first, any date.</p>
            </div>
            {data && data.totals.important > 0 && (
              <Link to="/crms/interactions?important=1" className="mono shrink-0 text-[10px] uppercase tracking-[0.16em] text-graphite hover:text-ink">
                All {data.totals.important} →
              </Link>
            )}
          </header>
          {!data ? <SkeletonRows rows={3} /> : data.important.length === 0 ? (
            <p className="border rule border-dashed px-6 py-8 text-[13px] text-graphite">Nothing marked important yet — the star on any interaction, or the Importance panel on its record, pins it here.</p>
          ) : (
            <ul className="divide-y rule border-y rule">
              {data.important.map((i, idx) => (
                <motion.li
                  key={i.id}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: idx * 0.04 }}
                >
                  <Link to={`/crms/interactions/${i.id}`} className="group grid grid-cols-[auto_1fr_auto] items-start gap-x-4 py-3.5 transition-colors hover:bg-bone/70">
                    <span className="pt-0.5 pl-1"><ImportantStar on size={14} /></span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="truncate text-[13.5px] text-ink group-hover:text-[color:var(--color-amber-deep)]">{i.clientName ?? 'Unknown client'}</span>
                        <span className="mono text-[10.5px] tracking-[0.06em] text-silver">{i.reference}</span>
                      </span>
                      <span className="mono mt-1 block truncate text-[10px] uppercase tracking-[0.14em] text-graphite">
                        {fmtDay(i.date)}{i.typeName ? ` · ${i.typeName}` : ''}{i.meetingType ? ` · ${i.meetingType}` : ''}
                      </span>
                      {i.importantNote && <span className="mt-1.5 block text-[12.5px] leading-snug text-slate">{i.importantNote}</span>}
                    </span>
                    <span className="flex flex-col items-end gap-1.5 pr-1">
                      <span className="mono num text-[12px] text-slate">{fmtMinutes(i.minutes)}</span>
                      {i.disposition === 'flagged' && !i.actionedAt
                        ? <Chip tone="amber" pulse>Flag open</Chip>
                        : <span className="text-silver opacity-0 transition-opacity group-hover:opacity-100"><IconArrowRight size={13} /></span>}
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </section>
        </div>

        {/* Top clients */}
        <section className="lg:col-span-5">
          <header className="mb-6">
            <div className="eyebrow mb-2">Time by client</div>
            <p className="text-[13px] text-graphite">Where the desk's contact hours went.</p>
          </header>
          {!data ? <SkeletonRows rows={5} /> : (
            <ul className="divide-y rule border-y rule">
              {data.byClient.length === 0 && <li className="py-4 text-[13px] text-graphite">Nothing in range.</li>}
              {data.byClient.map((c, i) => (
                <li key={c.clientId} className="grid grid-cols-12 items-center gap-3 py-3">
                  <span className="mono num col-span-1 text-[10.5px] text-silver">{String(i + 1).padStart(2, '0')}</span>
                  <Link to={`/crms/clients/${c.clientId}`} className="col-span-6 truncate text-[13.5px] text-ink hover:text-[color:var(--color-amber-deep)]">{c.client}</Link>
                  <div className="col-span-3 h-1.5 bg-bone">
                    <motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.round((c.minutes / maxClient) * 100)}%` }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.04 }} className="h-full" style={{ background: 'var(--color-navy)' }} />
                  </div>
                  <span className="mono num col-span-2 text-right text-[12px] text-slate">{fmtMinutes(c.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Stocks */}
        <section className="lg:col-span-5">
          <header className="mb-6">
            <div className="eyebrow mb-2">Most discussed</div>
            <p className="text-[13px] text-graphite">Stocks named on interaction forms in range.</p>
          </header>
          {!data ? <SkeletonRows rows={5} /> : data.topStocks.length === 0 ? (
            <p className="border rule border-dashed px-6 py-8 text-[13px] text-graphite">No stocks recorded yet — the form builder's stock fields feed this list.</p>
          ) : (
            <ol className="grid grid-cols-2 gap-x-6 divide-y rule border-y rule sm:grid-cols-1">
              {data.topStocks.map((s, i) => (
                <li key={s.stock} className="flex items-center justify-between gap-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="mono num text-[10.5px] text-silver">{String(i + 1).padStart(2, '0')}</span>
                    <span className="mono text-[13.5px] tracking-[0.02em] text-ink">{s.stock}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex gap-px">{Array.from({ length: Math.min(s.mentions, 20) }).map((_, b) => <span key={b} className="block h-3 w-[3px]" style={{ background: 'var(--color-navy)' }} />)}</span>
                    <span className="mono num w-6 text-right text-[12px] text-slate">{s.mentions}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Reverse roadshow demand */}
        <section className="lg:col-span-7">
          <header className="mb-6">
            <div className="eyebrow mb-2">Reverse-roadshow demand</div>
            <p className="text-[13px] text-graphite">Corporates clients asked to meet, and which clients asked.</p>
          </header>
          {!data ? <SkeletonRows rows={4} /> : data.reverseDemand.length === 0 ? (
            <p className="border rule border-dashed px-6 py-8 text-[13px] text-graphite">No reverse roadshows in range.</p>
          ) : (
            <ul className="divide-y rule border-y rule">
              {data.reverseDemand.map((d) => (
                <li key={d.corporate} className="grid grid-cols-12 gap-3 py-3.5">
                  <div className="col-span-5 min-w-0">
                    <p className="truncate text-[13.5px] text-ink">{d.corporate}</p>
                    <p className="mono mt-0.5 text-[10px] uppercase tracking-[0.14em] text-silver">{d.ticker ?? '—'} · {d.requests} request{d.requests === 1 ? '' : 's'}</p>
                  </div>
                  <div className="col-span-7 flex flex-wrap gap-1.5">
                    {d.clients.map((c) => <span key={c} className="border rule bg-paper px-2 py-0.5 text-[12px] text-slate">{c}</span>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Roadshow tallies — the two bar charts the legacy dashboard carried */}
      <div className="grid gap-12 border-t rule pt-10 lg:grid-cols-2">
        <section>
          <header className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-2">Company roadshow tally</div>
              <p className="text-[13px] text-graphite">Corporates that presented in range, by number of roadshows.</p>
            </div>
            <Chip tone="muted">{data ? `${data.totals.events} events` : '…'}</Chip>
          </header>
          {tally((data?.roadshowTally ?? []).map((t) => ({ name: t.corporate, events: t.events, meetings: t.meetings })), 'No company roadshows in range.')}
        </section>
        <section>
          <header className="mb-6">
            <div className="eyebrow mb-2">Reverse roadshow tally</div>
            <p className="text-[13px] text-graphite">Clients who came to visit, by number of trips.</p>
          </header>
          {tally((data?.reverseTally ?? []).map((t) => ({ name: t.client, events: t.events, meetings: t.meetings })), 'No reverse roadshows in range.')}
        </section>
      </div>

      {/* Recent activity */}
      <section className="border-t rule pt-10">
        <header className="mb-5 flex items-end justify-between">
          <div className="eyebrow">Recent activity</div>
          <Link to="/crms/logs" className="mono text-[10px] uppercase tracking-[0.16em] text-graphite hover:text-ink">Full log →</Link>
        </header>
        {status === 'loading' ? <SkeletonRows rows={3} /> : audit.length === 0 ? (
          <p className="text-[13px] text-graphite">No CRMS changes recorded yet.</p>
        ) : (
          <ul className="divide-y rule border-y rule">
            {audit.slice(0, 8).map((a) => (
              <li key={a.id} className="grid grid-cols-12 gap-3 py-3 text-[13px]">
                <span className="col-span-3 truncate text-ink md:col-span-2">{a.actor}</span>
                <span className="col-span-6 truncate text-slate md:col-span-7">{a.action.replace(/^CRMS · /, '')} <span className="text-graphite">· {a.target}</span></span>
                <span className="mono col-span-3 text-right text-[10.5px] uppercase tracking-[0.12em] text-silver">{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
