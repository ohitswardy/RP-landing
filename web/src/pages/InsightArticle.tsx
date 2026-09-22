import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Reveal from '../components/Reveal';
import ArrowCta from '../components/ArrowCta';
import NotFound from './NotFound';
import {
  fmtNoteDate, noteHref, useInsightArticle,
  type InsightArticle as Article, type JournalNote,
} from '../lib/insightsContent';

const EASE = [0.25, 1, 0.5, 1] as const;

/**
 * Typography for the sanitized HTML body. Tailwind arbitrary variants keep
 * it scoped to this page without touching the global stylesheet.
 */
const BODY_CLASS = [
  'text-[17px] leading-[1.75] text-ink',
  '[&_p]:mb-7 [&_p]:max-w-[64ch]',
  '[&_h2]:mt-14 [&_h2]:mb-5 [&_h2]:text-[clamp(1.4rem,2.2vw,1.9rem)] [&_h2]:font-medium [&_h2]:leading-[1.2] [&_h2]:tracking-[-0.018em] [&_h2]:max-w-[30ch]',
  '[&_h3]:mt-10 [&_h3]:mb-4 [&_h3]:text-[clamp(1.15rem,1.8vw,1.4rem)] [&_h3]:font-medium [&_h3]:leading-[1.3] [&_h3]:tracking-[-0.012em]',
  '[&_h4]:mt-8 [&_h4]:mb-3 [&_h4]:mono [&_h4]:text-[11px] [&_h4]:uppercase [&_h4]:tracking-[0.18em] [&_h4]:text-slate',
  '[&_a]:text-ink [&_a]:underline [&_a]:decoration-[color:var(--color-amber)] [&_a]:decoration-[1.5px] [&_a]:underline-offset-4 [&_a:hover]:text-[color:var(--color-amber-deep)]',
  '[&_strong]:font-medium [&_strong]:text-ink',
  '[&_em]:italic',
  '[&_ul]:mb-7 [&_ul]:max-w-[62ch] [&_ul]:list-none [&_ul]:pl-0 [&_ul>li]:relative [&_ul>li]:pl-7 [&_ul>li]:mb-3',
  "[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.85em] [&_ul>li]:before:h-[1.5px] [&_ul>li]:before:w-4 [&_ul>li]:before:bg-[color:var(--color-amber)] [&_ul>li]:before:content-['']",
  '[&_ol]:mb-7 [&_ol]:max-w-[62ch] [&_ol]:list-decimal [&_ol]:pl-7 [&_ol>li]:mb-3 [&_ol>li]:pl-1 [&_ol>li]:marker:mono [&_ol>li]:marker:text-[13px] [&_ol>li]:marker:text-graphite',
  '[&_blockquote]:my-10 [&_blockquote]:max-w-[56ch] [&_blockquote]:border-l-2 [&_blockquote]:border-[color:var(--color-amber)] [&_blockquote]:pl-7 [&_blockquote]:text-[clamp(1.2rem,1.9vw,1.55rem)] [&_blockquote]:font-medium [&_blockquote]:leading-[1.4] [&_blockquote]:tracking-[-0.014em] [&_blockquote]:text-ink [&_blockquote_p]:mb-0',
  '[&_hr]:my-12 [&_hr]:h-px [&_hr]:w-16 [&_hr]:border-0 [&_hr]:bg-ink/20',
  '[&_img]:my-10 [&_img]:block [&_img]:max-w-full [&_img]:h-auto',
  '[&_figure]:my-10 [&_figcaption]:mono [&_figcaption]:mt-3 [&_figcaption]:text-[11px] [&_figcaption]:uppercase [&_figcaption]:tracking-[0.16em] [&_figcaption]:text-graphite',
  '[&_table]:my-10 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[14.5px]',
  '[&_th]:mono [&_th]:border-b [&_th]:border-ink/20 [&_th]:py-3 [&_th]:pr-6 [&_th]:text-left [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-slate [&_th]:font-normal',
  '[&_td]:border-b [&_td]:border-ink/10 [&_td]:py-3 [&_td]:pr-6 [&_td]:align-top',
  '[&_code]:mono [&_code]:text-[0.92em] [&_code]:bg-bone [&_code]:px-1.5 [&_code]:py-0.5',
  '[&_pre]:my-8 [&_pre]:overflow-x-auto [&_pre]:bg-bone [&_pre]:p-6 [&_pre]:mono [&_pre]:text-[13.5px] [&_pre]:leading-[1.6] [&_pre_code]:bg-transparent [&_pre_code]:p-0',
].join(' ');

/* ── /insights/:slug ───────────────────────────────────────── */

export default function InsightArticle() {
  const { slug } = useParams();
  const state = useInsightArticle(slug);

  if (state.status === 'loading') return <ArticleSkeleton />;

  if (state.status === 'missing') {
    return (
      <NotFound
        title="That note is not on the journal."
        detail="It may have been withdrawn, or the address may be wrong. Every published note is listed on the journal page."
      />
    );
  }

  if (state.status === 'unavailable') {
    return (
      <NotFound
        code="503"
        title="The journal is briefly out of reach."
        detail="The note could not be loaded just now. Please try again in a moment, or return to the journal for the notes we can still show."
      />
    );
  }

  return <ArticleView article={state.article} related={state.related} cached={state.cached} />;
}

/* ── The note ──────────────────────────────────────────────── */

function ArticleView({ article, related, cached }: { article: Article; related: JournalNote[]; cached: boolean }) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${article.title} — Regis Partners`;
    return () => { document.title = prev; };
  }, [article.title]);

  return (
    <article>
      {/* Hero: the tag, date and author on the journal's blueprint navy */}
      <header className="relative overflow-hidden bg-blueprint text-paper">
        <div
          aria-hidden
          className="absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full pointer-events-none opacity-[0.18]"
          style={{ background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)' }}
        />
        <div className="container-fluid relative pt-16 pb-16 md:pt-24 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            <Link to="/insights" className="mono inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.2em] text-paper/55 transition-colors hover:text-paper">
              <span aria-hidden>←</span> The journal
            </Link>
            {article.tag && <span className="eyebrow eyebrow-paper !mb-0">{article.tag}</span>}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.05 }}
            className="mt-10 max-w-[22ch] text-[clamp(2rem,4.6vw,4.2rem)] font-medium leading-[1.06] tracking-[-0.026em]"
          >
            {article.title}
          </motion.h1>
          {article.excerpt && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
              className="mt-8 max-w-[60ch] text-[17px] leading-[1.6] text-paper/72"
            >
              {article.excerpt}
            </motion.p>
          )}
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
            className="mono mt-12 flex flex-wrap gap-x-10 gap-y-4 text-[11px] uppercase tracking-[0.18em]"
          >
            {article.date && (
              <div>
                <dt className="text-paper/40">Published</dt>
                <dd className="mt-1.5 text-paper/85">{fmtNoteDate(article.date)}</dd>
              </div>
            )}
            {article.author && (
              <div>
                <dt className="text-paper/40">Author</dt>
                <dd className="mt-1.5 text-paper/85">{article.author}</dd>
              </div>
            )}
          </motion.dl>
        </div>
      </header>

      {/* Body */}
      <section className="bg-paper">
        <div className="container-fluid grid grid-cols-12 gap-x-6 py-16 md:py-24">
          <aside className="col-span-12 mb-10 lg:col-span-3 lg:mb-0">
            <Reveal>
              <span aria-hidden className="mb-5 block h-[2px] w-8" style={{ background: 'var(--color-amber)' }} />
              <p className="max-w-[28ch] text-[13.5px] leading-relaxed text-slate">
                Published research from Regis Partners is for information only and is not investment advice. Clients read the full archive in the portal.
              </p>
              <div className="mt-6">
                <ArrowCta to="/login">Client login</ArrowCta>
              </div>
            </Reveal>
          </aside>

          <div className="col-span-12 lg:col-span-8 lg:col-start-5">
            {cached && (
              <p className="mono mb-8 border-l-2 border-[color:var(--color-amber)] pl-4 text-[11px] uppercase tracking-[0.16em] text-slate">
                Showing the cached summary — the full note could not be loaded.
              </p>
            )}
            {article.body ? (
              <div className={BODY_CLASS} dangerouslySetInnerHTML={{ __html: article.body }} />
            ) : (
              <p className="text-[15.5px] leading-relaxed text-slate">
                The full text of this note is available to clients in the research portal.
              </p>
            )}

            <div className="mt-16 flex flex-wrap items-center gap-x-10 gap-y-4 border-t rule pt-8">
              <Link to="/insights" className="inline-flex items-center gap-3 text-[13.5px] text-ink hover:text-[color:var(--color-amber-deep)]">
                <span aria-hidden>←</span> Back to the journal
              </Link>
              <Link to="/login" className="mono text-[10.5px] uppercase tracking-[0.2em] text-graphite hover:text-ink">
                Full archive for clients
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t rule bg-bone">
          <div className="container-fluid py-16 md:py-20">
            <Reveal>
              <div className="eyebrow mb-8">Related notes</div>
            </Reveal>
            <ul className="border-t rule">
              {related.map((n, i) => (
                <li key={n.id || n.slug} className="border-b rule">
                  <Reveal delay={i * 0.05}>
                    <Link
                      to={noteHref(n)}
                      className="group -mx-2 grid grid-cols-12 items-baseline gap-x-6 px-2 py-7 transition-colors duration-500 hover:bg-paper"
                    >
                      <div className="col-span-12 md:col-span-2 eyebrow !mb-0">{n.tag}</div>
                      <div className="mono col-span-12 text-[12px] text-graphite md:col-span-2">{fmtNoteDate(n.date)}</div>
                      <div className="col-span-12 md:col-span-6">
                        <h3 className="text-[clamp(1.05rem,1.6vw,1.35rem)] font-medium leading-[1.3] tracking-[-0.012em] transition-colors group-hover:text-[color:var(--color-amber-deep)]">
                          {n.title}
                        </h3>
                      </div>
                      <div className="col-span-12 text-[13.5px] text-slate md:col-span-2 md:text-right">{n.author}</div>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}

/* ── First paint ───────────────────────────────────────────── */

function ArticleSkeleton() {
  return (
    <>
      <section className="relative overflow-hidden bg-blueprint">
        <div className="container-fluid pt-16 pb-16 md:pt-24 md:pb-24">
          <div className="h-3 w-24 skeleton-bar opacity-30" />
          <div className="mt-10 h-12 w-[min(720px,90%)] skeleton-bar opacity-30" />
          <div className="mt-4 h-12 w-[min(520px,70%)] skeleton-bar opacity-30" />
          <div className="mt-12 h-3 w-48 skeleton-bar opacity-25" />
        </div>
      </section>
      <section className="bg-paper">
        <div className="container-fluid grid grid-cols-12 gap-x-6 py-16 md:py-24">
          <div className="col-span-12 lg:col-span-8 lg:col-start-5">
            {[96, 100, 92, 88, 100, 60].map((w, i) => (
              <div key={i} className="mb-4 h-4 skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 70}ms` }} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
