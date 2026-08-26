import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import Newsletter from '../components/Newsletter';
import {
  fmtNoteDate, useInsightsContent,
  type InsightsPage, type JournalNote,
} from '../lib/insightsContent';

const EASE = [0.25, 1, 0.5, 1] as const;

/** Sentinel for the unfiltered rail button — never a real sector tag. */
const ALL = ' all';

export default function Insights() {
  const content = useInsightsContent();

  if (!content) return <InsightsSkeleton />;

  return <Journal page={content.page} notes={content.articles} />;
}

/* ── The journal ───────────────────────────────────────────── */

function Journal({ page, notes }: { page: InsightsPage; notes: JournalNote[] }) {
  const [tag, setTag] = useState(ALL);
  const unfiltered = tag === ALL;

  /* Only tags that actually carry a published note reach the rail — a
     filter that resolves to nothing is a dead end, not a choice. */
  const rail = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) counts.set(n.tag, (counts.get(n.tag) ?? 0) + 1);
    return page.filters.tags
      .filter((t) => (counts.get(t) ?? 0) > 0)
      .map((t) => ({ tag: t, count: counts.get(t) as number }));
  }, [notes, page.filters.tags]);

  const lead = page.list.featureLead ? notes.find((n) => n.featured) : undefined;

  /* The lead only sits above the ledger while nothing is filtered. Under a
     sector it returns to the list, so a tag never hides one of its notes. */
  const showLead = Boolean(lead) && unfiltered;

  const ledger = useMemo(() => {
    const scoped = unfiltered
      ? (showLead ? notes.filter((n) => n.id !== lead?.id) : notes)
      : notes.filter((n) => n.tag === tag);
    return page.list.limit > 0 ? scoped.slice(0, page.list.limit) : scoped;
  }, [notes, tag, unfiltered, showLead, lead?.id, page.list.limit]);

  const { showExcerpt, showAuthor, showDate, noteHref } = page.list;

  return (
    <>
      <PageHeader
        eyebrow={page.hero.eyebrow || undefined}
        title={page.hero.title}
        dek={page.hero.dek || undefined}
        bgImage={page.hero.image || undefined}
      />

      <section className="bg-paper">
        {showLead && lead && <LeadNote note={lead} href={noteHref} showAuthor={showAuthor} showDate={showDate} />}

        {page.filters.enabled && rail.length > 0 && (
          <div className="container-fluid py-10 md:py-12 border-b rule">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-x-2 gap-y-2">
                <RailButton
                  label={page.filters.allLabel}
                  count={notes.length}
                  active={unfiltered}
                  onClick={() => setTag(ALL)}
                />
                {rail.map((t) => (
                  <RailButton
                    key={t.tag}
                    label={t.tag}
                    count={t.count}
                    active={tag === t.tag}
                    onClick={() => setTag(t.tag)}
                  />
                ))}
              </div>
              <p className="mono shrink-0 text-[11px] uppercase tracking-[0.14em] text-graphite">
                {ledger.length} {ledger.length === 1 ? 'note' : 'notes'}
              </p>
            </div>
          </div>
        )}

        <div className="container-fluid">
          {ledger.length === 0 ? (
            <div className="py-24 text-center md:py-32">
              <span aria-hidden className="mx-auto mb-6 block h-[2px] w-8" style={{ background: 'var(--color-amber)' }} />
              <p className="text-[15px] text-slate">{page.list.emptyText}</p>
              {!unfiltered && (
                <button
                  type="button"
                  onClick={() => setTag(ALL)}
                  className="mono mt-6 border-b border-ink/30 pb-1 text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-[color:var(--color-amber-deep)]"
                >
                  Show every note
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y rule">
              <AnimatePresence initial={false} mode="popLayout">
                {ledger.map((n, i) => (
                  <motion.li
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: Math.min(i * 0.04, 0.28) } }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  >
                    <Link
                      to={noteHref}
                      className="group -mx-2 grid grid-cols-12 items-baseline gap-x-6 px-2 py-8 transition-colors duration-500 hover:bg-bone md:py-10"
                    >
                      <div className="col-span-12 md:col-span-2 eyebrow !mb-0">{n.tag}</div>
                      {showDate && (
                        <div className="mono col-span-12 text-[12px] text-graphite md:col-span-2">{fmtNoteDate(n.date)}</div>
                      )}
                      <div className={showDate ? 'col-span-12 md:col-span-6' : 'col-span-12 md:col-span-8'}>
                        <h3 className="text-[clamp(1.15rem,1.8vw,1.6rem)] font-medium leading-[1.25] tracking-[-0.015em] transition-colors group-hover:text-[color:var(--color-amber-deep)]">
                          {n.title}
                        </h3>
                        {showExcerpt && n.excerpt && (
                          <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-slate">{n.excerpt}</p>
                        )}
                      </div>
                      {showAuthor && (
                        <div className="col-span-12 text-[13.5px] text-slate md:col-span-2 md:text-right">{n.author}</div>
                      )}
                    </Link>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {page.cta.enabled && page.cta.label && (
          <div className="container-fluid py-20 text-center">
            <Link to={page.cta.href} className="inline-flex items-center gap-3 text-[14px] text-slate hover:text-ink">
              {page.cta.label}
              <span style={{ color: 'var(--color-amber-deep)' }}>&rarr;</span>
            </Link>
          </div>
        )}
      </section>

      {page.newsletter.enabled && <Newsletter />}
    </>
  );
}

/* ── Filter rail button ────────────────────────────────────── */

function RailButton({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`mono border rule px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
        active ? 'border-navy bg-navy text-paper' : 'bg-paper text-slate hover:bg-bone hover:text-ink'
      }`}
    >
      {label}
      <span className="num ml-2 opacity-50">{count}</span>
    </button>
  );
}

/* ── Lead note ─────────────────────────────────────────────── */

function LeadNote({ note, href, showAuthor, showDate }: {
  note: JournalNote; href: string; showAuthor: boolean; showDate: boolean;
}) {
  return (
    <div className="border-b rule bg-bone">
      <div className="container-fluid py-14 md:py-20">
        <Reveal>
          <Link to={href} className="group grid grid-cols-12 gap-x-6 gap-y-6">
            <div className="col-span-12 md:col-span-3">
              <span aria-hidden className="mb-5 block h-[2px] w-8" style={{ background: 'var(--color-amber)' }} />
              <div className="eyebrow !mb-0">{note.tag}</div>
              {showDate && <div className="mono mt-3 text-[12px] text-graphite">{fmtNoteDate(note.date)}</div>}
              {showAuthor && <div className="mt-6 text-[13.5px] text-slate">{note.author}</div>}
            </div>
            <div className="col-span-12 md:col-span-9">
              <h2 className="max-w-[24ch] text-[clamp(1.7rem,3.4vw,2.9rem)] font-medium leading-[1.1] tracking-[-0.022em] transition-colors duration-500 group-hover:text-[color:var(--color-amber-deep)]">
                {note.title}
              </h2>
              {note.excerpt && (
                <p className="mt-7 max-w-[64ch] text-[15.5px] leading-relaxed text-slate">{note.excerpt}</p>
              )}
              <span className="mt-9 inline-flex items-center gap-3 text-[13.5px] text-ink">
                Read the note
                <span className="block h-px w-10 bg-ink/30 transition-all duration-500 group-hover:w-16 group-hover:bg-[color:var(--color-amber-deep)]" />
              </span>
            </div>
          </Link>
        </Reveal>
      </div>
    </div>
  );
}

/* ── First paint, before the content lands ─────────────────── */

function InsightsSkeleton() {
  return (
    <>
      <section className="relative overflow-hidden bg-blueprint">
        <div className="container-fluid pb-20 pt-20 md:pb-28 md:pt-28">
          <div className="h-3 w-32 skeleton-bar opacity-30" />
          <div className="mt-10 h-12 w-[min(620px,85%)] skeleton-bar opacity-30" />
        </div>
      </section>
      <section className="bg-paper">
        <div className="container-fluid border-b rule py-10 md:py-12">
          <div className="flex flex-wrap gap-2">
            {[64, 52, 58, 70, 56].map((w, i) => (
              <div key={i} className="h-7 skeleton-bar" style={{ width: w, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
        <div className="container-fluid">
          <ul className="divide-y rule">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="grid grid-cols-12 items-baseline gap-x-6 py-8 md:py-10">
                <div className="col-span-12 h-3 w-16 skeleton-bar md:col-span-2" style={{ animationDelay: `${i * 90}ms` }} />
                <div className="col-span-12 h-3 w-24 skeleton-bar md:col-span-2" style={{ animationDelay: `${i * 90 + 50}ms` }} />
                <div className="col-span-12 h-5 skeleton-bar md:col-span-6" style={{ width: `${92 - i * 6}%`, animationDelay: `${i * 90 + 100}ms` }} />
                <div className="col-span-12 h-3 w-20 skeleton-bar md:col-span-2 md:ml-auto" style={{ animationDelay: `${i * 90 + 150}ms` }} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
