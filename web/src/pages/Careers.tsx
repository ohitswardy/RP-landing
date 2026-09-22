import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import ArrowCta from '../components/ArrowCta';
import { CAREERS_PAGE, fmtPosted, useCareersContent, type CareerPost } from '../lib/careersContent';

const EASE = [0.25, 1, 0.5, 1] as const;

const BODY_CLASS = [
  'text-[15.5px] leading-[1.7] text-slate',
  '[&_p]:mb-5 [&_p]:max-w-[62ch]',
  '[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:mono [&_h3]:text-[11px] [&_h3]:uppercase [&_h3]:tracking-[0.18em] [&_h3]:text-ink',
  '[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-[15.5px] [&_h4]:font-medium [&_h4]:text-ink',
  '[&_strong]:font-medium [&_strong]:text-ink',
  '[&_a]:text-ink [&_a]:underline [&_a]:decoration-[color:var(--color-amber)] [&_a]:underline-offset-4',
  '[&_ul]:mb-5 [&_ul]:max-w-[62ch] [&_ul]:list-none [&_ul]:pl-0 [&_ul>li]:relative [&_ul>li]:pl-6 [&_ul>li]:mb-2',
  "[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.8em] [&_ul>li]:before:h-[1.5px] [&_ul>li]:before:w-3.5 [&_ul>li]:before:bg-[color:var(--color-amber)] [&_ul>li]:before:content-['']",
  '[&_ol]:mb-5 [&_ol]:max-w-[62ch] [&_ol]:list-decimal [&_ol]:pl-6 [&_ol>li]:mb-2',
].join(' ');

/** /careers — the open-roles ledger. */
export default function Careers() {
  const content = useCareersContent();

  useEffect(() => {
    document.title = 'Careers — Regis Partners';
  }, []);

  return (
    <>
      <PageHeader
        eyebrow={CAREERS_PAGE.eyebrow}
        title={CAREERS_PAGE.title}
        dek={CAREERS_PAGE.dek}
        bgImage={CAREERS_PAGE.image}
      />

      <section className="bg-paper">
        <div className="container-fluid py-20 md:py-28">
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            <Reveal className="col-span-12 lg:col-span-4">
              <div className="eyebrow mb-6">Open roles</div>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.02em]">
                Where the desk is hiring.
              </h2>
              <p className="mt-6 max-w-[38ch] text-[14.5px] leading-relaxed text-slate">
                Each role is posted by the team that will work beside you. Applications go to the contact desk with the role pre-selected.
              </p>
              <div className="mt-8">
                <ArrowCta to={CAREERS_PAGE.speculativeHref}>{CAREERS_PAGE.speculativeLabel}</ArrowCta>
              </div>
            </Reveal>

            <div className="col-span-12 lg:col-span-8">
              {content === null ? (
                <LedgerSkeleton />
              ) : content.careers.length === 0 ? (
                <Empty />
              ) : (
                <Ledger posts={content.careers} />
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ── The ledger ────────────────────────────────────────────── */

function Ledger({ posts }: { posts: CareerPost[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="border-t rule">
      {posts.map((post, i) => {
        const open = openId === post.id;
        const panelId = `role-${post.id}`;
        return (
          <li key={post.id} className="border-b rule">
            <Reveal delay={Math.min(i * 0.05, 0.3)}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : post.id)}
                aria-expanded={open}
                aria-controls={panelId}
                className="group grid w-full grid-cols-12 items-baseline gap-x-6 py-8 text-left transition-colors duration-500 -mx-2 px-2 hover:bg-bone md:py-9"
              >
                <div className="col-span-12 md:col-span-3">
                  <div className="eyebrow !mb-0">{post.dept || 'Regis'}</div>
                  <div className="mono mt-3 hidden text-[10.5px] uppercase tracking-[0.16em] text-graphite md:block">
                    {post.type}{post.location ? ` · ${post.location}` : ''}
                  </div>
                </div>
                <div className="col-span-10 md:col-span-7">
                  <h3 className={`text-[clamp(1.2rem,2vw,1.7rem)] font-medium leading-[1.2] tracking-[-0.016em] transition-colors ${open ? 'text-[color:var(--color-amber-deep)]' : 'group-hover:text-[color:var(--color-amber-deep)]'}`}>
                    {post.title}
                  </h3>
                  {post.summary && (
                    <p className="mt-3 max-w-[58ch] text-[14.5px] leading-relaxed text-slate">{post.summary}</p>
                  )}
                  <div className="mono mt-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite md:hidden">
                    {post.type}{post.location ? ` · ${post.location}` : ''}
                  </div>
                  {post.posted && (
                    <div className="mono num mt-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite">
                      Posted {fmtPosted(post.posted)}
                    </div>
                  )}
                </div>
                <div className="col-span-2 flex justify-end self-center">
                  <span
                    aria-hidden
                    className="inline-block text-graphite transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:text-[color:var(--color-amber-deep)]"
                    style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
                  >
                    +
                  </span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={panelId}
                    key="panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-12 gap-x-6 pb-10 md:pb-12">
                      <div className="col-span-12 md:col-span-7 md:col-start-4">
                        {post.body ? (
                          <div className={BODY_CLASS} dangerouslySetInnerHTML={{ __html: post.body }} />
                        ) : (
                          <p className="text-[15px] leading-relaxed text-slate">
                            Write to us for the full brief.
                          </p>
                        )}
                        <div className="mt-8">
                          <ArrowCta to={CAREERS_PAGE.applyHref(post)}>{CAREERS_PAGE.applyLabel}</ArrowCta>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Nothing open ──────────────────────────────────────────── */

function Empty() {
  return (
    <div className="border-t rule py-20 md:py-24">
      <span aria-hidden className="mb-6 block h-[2px] w-8" style={{ background: 'var(--color-amber)' }} />
      <h3 className="text-[clamp(1.4rem,2.4vw,2rem)] font-medium leading-[1.15] tracking-[-0.018em]">
        {CAREERS_PAGE.emptyHeading}
      </h3>
      <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed text-slate">{CAREERS_PAGE.emptyBody}</p>
      <Link
        to={CAREERS_PAGE.speculativeHref}
        className="mt-8 inline-flex items-center gap-3 text-[13.5px] text-ink hover:text-[color:var(--color-amber-deep)]"
      >
        {CAREERS_PAGE.speculativeLabel}
        <span style={{ color: 'var(--color-amber-deep)' }}>&rarr;</span>
      </Link>
    </div>
  );
}

/* ── First paint ───────────────────────────────────────────── */

function LedgerSkeleton() {
  return (
    <ul className="border-t rule">
      {[0, 1, 2].map((i) => (
        <li key={i} className="grid grid-cols-12 items-baseline gap-x-6 border-b rule py-9">
          <div className="col-span-3 h-3 w-20 skeleton-bar" style={{ animationDelay: `${i * 90}ms` }} />
          <div className="col-span-7">
            <div className="h-6 skeleton-bar" style={{ width: `${70 - i * 8}%`, animationDelay: `${i * 90 + 50}ms` }} />
            <div className="mt-3 h-3 w-[85%] skeleton-bar" style={{ animationDelay: `${i * 90 + 100}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
