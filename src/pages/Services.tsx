import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import { Link, useParams } from 'react-router-dom';
import Newsletter from '../components/Newsletter';

const data = {
  research: {
    eyebrow: 'Practice 01',
    title: 'Research Advisory',
    dek: 'Original, conviction-led equity research with the institutional rigor of a global house and the ground-truth of a local one.',
    pillars: [
      ['Single-name coverage',      'Initiations, quarterly updates, and event-driven notes across 120+ PSE-listed names.'],
      ['Sector deep-dives',         'Quarterly thematic work on banks, property, consumer, power, conglomerates, and TMT.'],
      ['Macro & strategy',          'BSP, inflation, FX, fiscal, and politics translated into PSE positioning.'],
      ['Bespoke commissioned work', 'Confidential research mandates for allocators with specific exposure questions.'],
    ],
    proof: [['120+', 'names'], ['1,400', 'notes / yr'], ['22 yrs', 'avg PM tenure']],
  },
  sales: {
    eyebrow: 'Practice 02',
    title: 'Sales Advisory',
    dek: 'A high-touch institutional dealing desk that knows your mandate, your benchmarks, and your reporting calendar.',
    pillars: [
      ['Idea generation',         'Daily morning calls and conviction lists, filtered to your risk appetite.'],
      ['Portfolio overlays',      'Tactical pair trades, hedges, and rotations across PSE sectors.'],
      ['Cross-asset commentary',  'How peso, rates, and Asian risk are positioning Philippine equities.'],
      ['Bespoke roadshows',       'Custom NDRs assembled around portfolio gaps.'],
    ],
    proof: [['300+', 'institutions'], ['9', 'global jurisdictions'], ['Partner-led', 'coverage']],
  },
  trading: {
    eyebrow: 'Practice 03',
    title: 'Trading & Execution',
    dek: 'Discreet block, agency, and program execution on the PSE by a desk that has traded through every regime since 1999.',
    pillars: [
      ['Block & facilitation',     'Liquidity in size, with minimal information leakage.'],
      ['Algos & program',          'VWAP, TWAP, and implementation-shortfall trajectories.'],
      ['Cross-border settlement',  'DvP, omnibus, and segregated custody with global banks.'],
      ['After-hours liquidity',    'Coordinated execution outside the PSE clock when it matters.'],
    ],
    proof: [['Top 10', 'PSE trading participant'], ['<10bps', 'avg slippage on blocks'], ['24/5', 'global desk coverage']],
  },
  corporate: {
    eyebrow: 'Practice 04',
    title: 'Corporate Access',
    dek: 'The deepest C-suite rolodex in Philippine equities. Conferences, NDRs, site visits, and corporate days that move conviction.',
    pillars: [
      ['Annual Manila Conference', 'Three days. 60+ issuers, 200+ investors, 4,000+ one-on-ones.'],
      ['C-suite NDRs',             'Single-name roadshows for CEOs, CFOs, and IROs into Asia, the US, and Europe.'],
      ['Site visits & plant tours','Operating-asset visits across power, food, logistics, and property.'],
      ['Thematic corporate days',  'Banks, consumer, infrastructure, and ESG-themed calendars.'],
    ],
    proof: [['25 yrs', 'C-suite relationships'], ['60+', 'issuers / conference'], ['Asia · EU · US', 'NDR routes']],
  },
} as const;

type Key = keyof typeof data;

export default function Services() {
  const { slug } = useParams();
  const key = (slug && (slug.toLowerCase() in data)) ? slug.toLowerCase() as Key : null;

  if (!key) {
    return (
      <>
        <PageHeader
          eyebrow="Practices"
          title="Four practices, one mandate."
          dek="Each practice is run by senior partners with two decades of specialization. The work compounds; the client benefits."
        />
        <section className="bg-paper">
          <div className="container-fluid py-24 md:py-32">
            <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l rule">
              {(Object.keys(data) as Key[]).map((k, i) => {
                const d = data[k];
                return (
                  <Reveal key={k} delay={i * 0.06} className="border-r border-b rule p-10 md:p-12 hover:bg-bone transition-colors duration-500 group">
                    <Link to={`/services/${k}`} className="block">
                      <div className="eyebrow mb-8">{d.eyebrow}</div>
                      <h3 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.022em] font-medium">
                        {d.title}
                      </h3>
                      <p className="mt-6 text-slate text-[15px] leading-relaxed max-w-[44ch]">{d.dek}</p>
                      <div className="mt-10 inline-flex items-center gap-3 text-[13.5px] text-ink group-hover:text-[color:var(--color-amber-deep)] transition-colors">
                        Read the practice brief
                        <span className="block h-px w-10 bg-ink/30 group-hover:w-16 group-hover:bg-[color:var(--color-amber-deep)] transition-all duration-500" />
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
        <Newsletter />
      </>
    );
  }

  const d = data[key];
  return (
    <>
      <PageHeader eyebrow={d.eyebrow} title={d.title} dek={d.dek} />
      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            <Reveal className="col-span-12 lg:col-span-4">
              <div className="eyebrow mb-6">Pillars</div>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.02em]">
                What the practice delivers.
              </h2>
            </Reveal>
            <ul className="col-span-12 lg:col-span-8 border-t rule">
              {d.pillars.map(([t, b], i) => (
                <Reveal key={t} delay={i * 0.05} className="grid grid-cols-12 gap-x-6 items-baseline border-b rule py-8">
                  <div className="col-span-1 mono text-[11px] tracking-[0.16em] uppercase text-graphite">0{i+1}</div>
                  <div className="col-span-11 md:col-span-5 text-lg md:text-xl tracking-[-0.012em] font-medium">{t}</div>
                  <div className="col-span-12 md:col-span-6 text-slate text-[14.5px] leading-relaxed mt-2 md:mt-0">{b}</div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-navy text-paper">
        <div className="container-fluid">
          <div className="grid grid-cols-1 md:grid-cols-3">
            {d.proof.map(([k, v], i) => (
              <div
                key={k}
                className={`py-12 md:py-14 px-2 md:px-8 ${i > 0 ? 'md:border-l rule-navy' : ''} ${i >= 1 ? 'border-t md:border-t-0 rule-navy' : ''}`}
              >
                <div className="flex items-baseline gap-3">
                  <span className="inline-block w-4 h-px" style={{ background: 'var(--color-amber)' }} aria-hidden />
                  <span className="num text-[clamp(2.25rem,4vw,3.5rem)] leading-none tracking-[-0.025em] font-medium">{k}</span>
                </div>
                <div className="mono mt-4 text-[11px] tracking-[0.16em] uppercase text-paper/55">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
