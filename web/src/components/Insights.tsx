import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Reveal from './Reveal';
import ArrowCta from './ArrowCta';
import type { HomeCopy } from '../cms/data';

const ease = [0.25, 1, 0.5, 1] as const;

/** Featured research and the ledger under it. Authored in the CMS Landing page module. */
export default function Insights({ copy }: { copy: HomeCopy['insights'] }) {
  const aside = Boolean(copy.intro || copy.cta.label);
  const featured = copy.featured;
  const rows = copy.rows;

  return (
    <section className="bg-paper text-ink">
      <div className="container-fluid py-24 md:py-32">
        {/* Intro — GIC title/text split */}
        <div className={`grid grid-cols-12 gap-x-6 gap-y-8 ${featured.length > 0 || rows.length > 0 ? 'mb-14 md:mb-20' : ''}`}>
          <Reveal className="col-span-12 lg:col-span-4">
            {copy.eyebrow && <div className="eyebrow mb-6">{copy.eyebrow}</div>}
            <h2 className="text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.06] tracking-[-0.024em] max-w-[12ch]">
              {copy.heading}
            </h2>
          </Reveal>
          {aside && (
            <Reveal delay={0.08} className="col-span-12 lg:col-span-6 lg:col-start-6">
              {copy.intro && (
                <p className="max-w-[54ch] text-slate leading-[1.7] text-[15.5px]">{copy.intro}</p>
              )}
              {copy.cta.label && (
                <div className={copy.intro ? 'mt-7' : ''}>
                  <ArrowCta to={copy.cta.href || '/insights'}>{copy.cta.label}</ArrowCta>
                </div>
              )}
            </Reveal>
          )}
        </div>

        {/* Featured pair */}
        {featured.length > 0 && (
          <div className={`grid grid-cols-1 gap-x-6 gap-y-12 ${featured.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
            {featured.map((c, i) => (
              <motion.article
                key={`${i}-${c.title}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: i * 0.08, ease }}
                className="group"
              >
                <Link to={c.href || '/insights'} className="block">
                  <div className="aspect-[16/9] overflow-hidden bg-bone">
                    {c.image && (
                      <img
                        src={c.image}
                        alt={c.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  {c.kicker && <div className="eyebrow mt-7 mb-3">{c.kicker}</div>}
                  <h3 className={`text-[clamp(1.2rem,1.8vw,1.5rem)] leading-[1.25] tracking-[-0.016em] text-ink group-hover:text-[color:var(--color-amber-deep)] transition-colors max-w-[30ch] ${c.kicker ? '' : 'mt-7'}`}>
                    {c.title}
                  </h3>
                  {c.blurb && <p className="mt-3 max-w-[52ch] text-slate text-[14.5px] leading-[1.65]">{c.blurb}</p>}
                  {c.meta && <div className="mono num mt-4 text-[10px] tracking-[0.18em] text-graphite">{c.meta}</div>}
                </Link>
              </motion.article>
            ))}
          </div>
        )}

        {/* Ruled listing */}
        {rows.length > 0 && (
          <div className={`border-t rule ${featured.length > 0 ? 'mt-16' : ''}`}>
            {rows.map((r, i) => (
              <motion.div
                key={`${i}-${r.title}`}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: i * 0.05, ease }}
                className="border-b rule"
              >
                <Link
                  to={r.href || '/insights'}
                  className="group grid grid-cols-12 items-baseline gap-x-4 py-6 md:py-7 -mx-4 px-4 transition-colors hover:bg-bone"
                >
                  <div className="col-span-12 md:col-span-3 mono text-[10px] tracking-[0.16em] uppercase text-graphite">
                    {r.kicker}
                  </div>
                  <div className="col-span-10 md:col-span-6 mt-2 md:mt-0">
                    <span className="text-[15.5px] md:text-[16px] leading-[1.4] tracking-[-0.012em] text-ink group-hover:text-[color:var(--color-amber-deep)] transition-colors">
                      {r.title}
                    </span>
                  </div>
                  <div className="hidden md:block col-span-2 mono num text-[10px] tracking-[0.14em] text-graphite">
                    {r.meta}
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <span className="text-graphite transition-all duration-500 group-hover:text-[color:var(--color-amber-deep)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                      ↗
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
