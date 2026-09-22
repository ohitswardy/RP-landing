import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../cms/auth';
import { Chip, DateField, EASE, EmptyState, ModuleHeader, SkeletonRows, Stat } from '../../cms/ui';
import { IconArrowRight } from '../../cms/icons';
import UserBlobatar from '../../cms/kit/UserBlobatar';
import { Pager } from '../kit/fields';
import { ImportantStar } from '../kit/important';
import { errorText } from '../kit/toast';
import { fmtMinutes, type ActivityItem, type ActivityKind, type MyActivity } from '../data';

/* ─────────────────────────────────────────────────────────────
   My activity (masterplan "My Profile / My Activity"). The
   signed-in staff member's own footprint for a range: who the
   system thinks they are (CMS account and the legacy CRMS user
   it maps to), tiles for what they logged, and one feed merging
   their interactions, one-off meetings, the roadshows they were
   on, and their rows in the audit ledger — each linking into
   the module that owns it. Server-merged and paged.
   ───────────────────────────────────────────────────────────── */

function firstOfMonthsAgo(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

const KIND: Record<ActivityKind, { label: string; code: string }> = {
  interaction: { label: 'Interaction', code: 'INT' },
  meeting: { label: 'One-off meeting', code: 'MTG' },
  event: { label: 'Event', code: 'EVT' },
  audit: { label: 'Ledger', code: 'LOG' },
};

function when(item: ActivityItem): string {
  if (!item.at) return '—';
  const d = new Date(item.at);
  // Ledger rows carry a moment; records carry a day.
  return item.kind === 'audit'
    ? d.toLocaleString('en-PH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function FeedRow({ item, index }: { item: ActivityItem; index: number }) {
  const reduce = useReducedMotion();
  const body = (
    <>
      <span className="mono num col-span-12 text-[10.5px] uppercase tracking-[0.12em] text-silver md:col-span-2">{when(item)}</span>
      <span className="mono col-span-3 text-[9.5px] uppercase tracking-[0.18em] text-graphite md:col-span-1">{KIND[item.kind].code}</span>
      <span className="col-span-9 min-w-0 md:col-span-7">
        <span className="flex items-center gap-2">
          {item.important && <ImportantStar on size={12} />}
          <span className={`truncate text-[13.5px] text-ink ${item.href ? 'group-hover:text-[color:var(--color-amber-deep)]' : ''}`}>{item.title}</span>
          {item.disposition === 'flagged' && <Chip tone="amber">Flagged</Chip>}
        </span>
        {item.subtitle && <span className="mt-0.5 block truncate text-[12px] text-graphite">{item.subtitle}</span>}
      </span>
      <span className="mono num col-span-12 flex items-center justify-end gap-3 text-[11px] text-slate md:col-span-2">
        {item.minutes !== null && item.minutes > 0 ? fmtMinutes(item.minutes) : ''}
        {item.href && <IconArrowRight size={12} className="text-silver transition-colors group-hover:text-[color:var(--color-amber-deep)]" />}
      </span>
    </>
  );
  return (
    <motion.li initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 12) * 0.03 }}>
      {item.href
        ? <Link to={item.href} className="group grid grid-cols-12 items-center gap-x-3 gap-y-1 py-3 transition-colors hover:bg-bone/70">{body}</Link>
        : <div className="grid grid-cols-12 items-center gap-x-3 gap-y-1 py-3">{body}</div>}
    </motion.li>
  );
}

export default function MyActivityModule() {
  const { session } = useAuth();
  const [from, setFrom] = useState(() => firstOfMonthsAgo(11));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MyActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [from, to]);

  useEffect(() => {
    let alive = true;
    setError(null);
    const p = new URLSearchParams({ from, to, page: String(page), perPage: '25' });
    apiFetch<MyActivity>(`/crms/my-activity?${p}`, { audience: 'cms' })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(errorText(e, 'Your activity could not be loaded.')); });
    return () => { alive = false; };
  }, [from, to, page]);

  const profile = data?.profile;
  const legacy = profile?.legacyUser;

  return (
    <div className="space-y-12">
      <ModuleHeader
        code="14 · My activity"
        title="Your footprint"
        blurb="What you logged and where you were in the range: interactions, one-off meetings, the roadshows you travelled on, and every change the ledger attributes to you."
        actions={
          <div className="grid grid-cols-2 gap-3">
            <DateField label="From" value={from} onChange={setFrom} />
            <DateField label="To" value={to} onChange={setTo} />
          </div>
        }
      />

      {error && <p className="border-l-2 pl-3 text-[12.5px]" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>{error}</p>}

      {/* Profile strip */}
      <section className="grid gap-8 border-b rule pb-10 lg:grid-cols-12">
        <div className="flex items-start gap-5 lg:col-span-6">
          <UserBlobatar name={profile?.name ?? session?.name} size={48} />
          <div className="min-w-0">
            <div className="eyebrow mb-2">Profile</div>
            <p className="truncate text-[17px] font-medium tracking-[-0.01em] text-ink">{profile?.name ?? session?.name ?? '—'}</p>
            <p className="mono mt-1 truncate text-[11px] tracking-[0.04em] text-graphite">{profile?.email ?? session?.email ?? '—'}</p>
            <p className="mono mt-2 text-[9.5px] uppercase tracking-[0.18em] text-graphite">
              {profile?.role ?? session?.role ?? '—'}
              {profile?.outlookEmail && <span className="text-silver"> · sends as {profile.outlookEmail}</span>}
            </p>
          </div>
        </div>
        <div className="lg:col-span-6">
          <div className="eyebrow mb-2">Legacy CRMS user</div>
          {!data ? (
            <div className="h-3 w-40 skeleton-bar" aria-hidden />
          ) : legacy?.matched ? (
            <div className="space-y-1">
              <p className="flex flex-wrap items-center gap-3 text-[13.5px] text-ink">
                <Chip tone="live">Matched</Chip>
                <span>{legacy.name ?? 'Unnamed'}</span>
                <span className="mono text-[10.5px] tracking-[0.06em] text-silver">#{legacy.id}{legacy.type ? ` · ${legacy.type}` : ''}</span>
              </p>
              <p className="text-[12.5px] leading-relaxed text-graphite">
                Interactions and one-off meetings you save carry this legacy id, so the Sales / Analysts sheets on the internal report credit you by name.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="flex items-center gap-3 text-[13.5px] text-ink"><Chip tone="amber">Not matched</Chip><span>No legacy user carries your email</span></p>
              <p className="text-[12.5px] leading-relaxed text-graphite">
                Author attribution lives in the audit ledger only: your saves stamp no legacy author, and the interaction tiles below stay empty until an administrator adds your email to the legacy directory.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Tiles */}
      <section className="grid grid-cols-2 gap-8 border-b rule pb-10 md:grid-cols-4 xl:grid-cols-7">
        <Stat value={data ? data.totals.interactions.toLocaleString('en-PH') : '—'} label="Interactions" />
        <Stat value={data ? fmtMinutes(data.totals.minutes) : '—'} label="Contact time" />
        <Stat value={data ? String(data.totals.important) : '—'} label="Important" />
        <Stat value={data ? String(data.totals.meetingsCreated) : '—'} label="Meetings created" />
        <Stat value={data ? String(data.totals.eventsCreated) : '—'} label="Events created" />
        <Stat value={data ? String(data.totals.eventsAttended) : '—'} label="Events attended" />
        <Stat value={data ? String(data.totals.actions) : '—'} label="Ledger rows" />
      </section>

      {/* Feed */}
      <section>
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Feed</div>
            <p className="text-[13px] text-graphite">Newest first across every source. Records open in their module; ledger rows name what changed.</p>
          </div>
          <div className="mono hidden shrink-0 items-center gap-4 text-[9.5px] uppercase tracking-[0.18em] text-silver md:flex">
            {(Object.keys(KIND) as ActivityKind[]).map((k) => <span key={k}><span className="text-graphite">{KIND[k].code}</span> {KIND[k].label}</span>)}
          </div>
        </header>
        {!data ? <SkeletonRows rows={8} /> : data.feed.items.length === 0 ? (
          <EmptyState
            title="Nothing in this range."
            hint={legacy?.matched
              ? 'Interactions you save, meetings you create, roadshows you travel on and every change you make land here.'
              : 'Without a legacy user match only your ledger rows can appear here; interactions you save are still counted in reports.'}
          />
        ) : (
          <>
            <ul className="divide-y rule border-y rule">
              {data.feed.items.map((item, i) => <FeedRow key={item.key} item={item} index={i} />)}
            </ul>
            <Pager page={data.feed.page} pages={data.feed.pages} total={data.feed.total} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
