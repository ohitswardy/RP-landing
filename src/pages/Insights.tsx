import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import { Link } from 'react-router-dom';
import Newsletter from '../components/Newsletter';

const items = [
  { k: 'Macro',    d: 'May 24, 2026', t: 'Beyond the rate cycle: why Philippine consumption is the durable trade for 2026–2028.', a: 'M. Bautista' },
  { k: 'Banks',    d: 'May 21, 2026', t: 'NIMs have peaked. What survives the compression.',                                    a: 'M. Bautista' },
  { k: 'Single',   d: 'May 19, 2026', t: 'ICT: an underappreciated optionality on Manila Port volumes.',                       a: 'J. Reyes' },
  { k: 'Policy',   d: 'May 16, 2026', t: 'BSP\'s quiet pivot, in five charts.',                                                a: 'M. Bautista' },
  { k: 'Property', d: 'May 13, 2026', t: 'Office vacancy has bottomed. Why the next leg is selective.',                        a: 'A. Lim' },
  { k: 'Consumer', d: 'May 09, 2026', t: 'Mid-cap consumer: where the re-rating is just starting.',                            a: 'P. Cruz' },
  { k: 'Power',    d: 'May 06, 2026', t: 'After Malampaya: the LNG transition the market is mispricing.',                      a: 'A. Lim' },
  { k: 'Strategy', d: 'May 02, 2026', t: 'PSEi targets, sector weights, conviction list — Q2 2026 update.',                   a: 'M. Bautista' },
];

const tags = ['All', 'Macro', 'Banks', 'Consumer', 'Property', 'Power', 'Single name', 'Policy', 'Strategy'];

export default function Insights() {
  return (
    <>
      <PageHeader
        eyebrow="The journal"
        title="Research worth being early on."
        dek="Selected publications from the Regis research desk. Full archive and models available to institutional clients via the research portal."
      />

      <section className="bg-paper">
        <div className="container-fluid py-10 md:py-12 border-b rule">
          <div className="flex flex-wrap gap-x-2 gap-y-2">
            {tags.map((t, i) => (
              <button
                key={t}
                className={`mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 border rule transition-colors ${i === 0 ? 'bg-navy text-paper border-navy' : 'bg-paper text-slate hover:bg-bone hover:text-ink'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="container-fluid">
          <ul className="divide-y rule">
            {items.map((p, i) => (
              <Reveal key={i} delay={i * 0.04}>
                <Link to="/login" className="block py-8 md:py-10 group grid grid-cols-12 gap-x-6 items-baseline hover:bg-bone transition-colors duration-500 px-2 -mx-2">
                  <div className="col-span-12 md:col-span-2 eyebrow !mb-0">{p.k}</div>
                  <div className="col-span-12 md:col-span-2 mono text-[12px] text-graphite">{p.d}</div>
                  <h3 className="col-span-12 md:col-span-6 text-[clamp(1.15rem,1.8vw,1.6rem)] leading-[1.25] tracking-[-0.015em] font-medium group-hover:text-[color:var(--color-amber-deep)] transition-colors">
                    {p.t}
                  </h3>
                  <div className="col-span-12 md:col-span-2 text-slate text-[13.5px] md:text-right">{p.a}</div>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>

        <div className="container-fluid py-20 text-center">
          <Link to="/login" className="inline-flex items-center gap-3 text-[14px] text-slate hover:text-ink">
            Sign in for the full archive
            <span style={{ color: 'var(--color-amber-deep)' }}>→</span>
          </Link>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
