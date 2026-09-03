import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Reveal from './Reveal';
import ArrowCta from './ArrowCta';

const ease = [0.25, 1, 0.5, 1] as const;

type Featured = { k: string; t: string; d: string; meta: string; img: string };
type Row = { k: string; t: string; meta: string };

const featured: Featured[] = [
  {
    k: 'The Big Picture',
    t: 'How sovereign AI became the new arena for state power.',
    d: 'Compute is the new oil concession. We map the capital flowing into national AI programs and what it signals for emerging-market allocators.',
    meta: '24 AUG 2026 · 6 MIN READ',
    img: '/AiBG.jpg',
  },
  {
    k: 'Boardroom Intelligence',
    t: 'The exit doors are open: liquidity returns to private markets.',
    d: 'Secondaries, evergreen vehicles, and a reawakened IPO pipeline are rewriting private equity\'s next chapter across the region.',
    meta: '11 AUG 2026 · 5 MIN READ',
    img: '/insight-exit.jpg',
  },
];

const rows: Row[] = [
  { k: 'Sustainability & Culture', t: 'Secondary market surge: how evergreen vehicles are writing PE\'s next chapter.', meta: '29 JUL 2026 · 4 MIN READ' },
  { k: 'The Big Picture',          t: 'India\'s IPO market: signs point to a strong finish to 2026.',                   meta: '15 JUL 2026 · 3 MIN READ' },
  { k: 'PSE Desk',                 t: 'Positioning ahead of the August MSCI rebalance.',                               meta: '02 JUL 2026 · 4 MIN READ' },
];

export default function Insights() {
  return (
    <section className="bg-paper text-ink">
      <div className="container-fluid py-24 md:py-32">
        {/* Intro — GIC title/text split */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-8 mb-14 md:mb-20">
          <Reveal className="col-span-12 lg:col-span-4">
            <div className="eyebrow mb-6">Insights</div>
            <h2 className="text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.06] tracking-[-0.024em] max-w-[12ch]">
              Research that moves markets.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="col-span-12 lg:col-span-6 lg:col-start-6">
            <p className="max-w-[54ch] text-slate leading-[1.7] text-[15.5px]">
              Original work from the Regis research desk: sector coverage,
              market structure, and the macro forces shaping Philippine
              equities. Selected pieces are open; the full library lives in the
              client portal.
            </p>
            <div className="mt-7">
              <ArrowCta to="/insights">Explore all insights</ArrowCta>
            </div>
          </Reveal>
        </div>

        {/* Featured pair */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-12">
          {featured.map((c, i) => (
            <motion.article
              key={c.t}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease }}
              className="group"
            >
              <Link to="/insights" className="block">
                <div className="aspect-[16/9] overflow-hidden bg-bone">
                  <img
                    src={c.img}
                    alt={c.t}
                    className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]"
                  />
                </div>
                <div className="eyebrow mt-7 mb-3">{c.k}</div>
                <h3 className="text-[clamp(1.2rem,1.8vw,1.5rem)] leading-[1.25] tracking-[-0.016em] text-ink group-hover:text-[color:var(--color-amber-deep)] transition-colors max-w-[30ch]">
                  {c.t}
                </h3>
                <p className="mt-3 max-w-[52ch] text-slate text-[14.5px] leading-[1.65]">{c.d}</p>
                <div className="mono num mt-4 text-[10px] tracking-[0.18em] text-graphite">{c.meta}</div>
              </Link>
            </motion.article>
          ))}
        </div>

        {/* Ruled listing */}
        <div className="mt-16 border-t rule">
          {rows.map((r, i) => (
            <motion.div
              key={r.t}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: i * 0.05, ease }}
              className="border-b rule"
            >
              <Link
                to="/insights"
                className="group grid grid-cols-12 items-baseline gap-x-4 py-6 md:py-7 -mx-4 px-4 transition-colors hover:bg-bone"
              >
                <div className="col-span-12 md:col-span-3 mono text-[10px] tracking-[0.16em] uppercase text-graphite">
                  {r.k}
                </div>
                <div className="col-span-10 md:col-span-6 mt-2 md:mt-0">
                  <span className="text-[15.5px] md:text-[16px] leading-[1.4] tracking-[-0.012em] text-ink group-hover:text-[color:var(--color-amber-deep)] transition-colors">
                    {r.t}
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
      </div>
    </section>
  );
}
