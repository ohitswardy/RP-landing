import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import Newsletter from '../components/Newsletter';

const timeline = [
  { y: '1999', t: 'Founded in Makati',                     d: 'Established by senior research and trading partners.' },
  { y: '2004', t: 'PSE seat acquired',                     d: 'Member firm of the Philippine Stock Exchange and SCCP.' },
  { y: '2009', t: 'First Manila Conference',               d: 'Inaugural institutional conference; 80 investors, 22 issuers.' },
  { y: '2014', t: 'Asia-wide corporate-access mandate',    d: 'Singapore and Hong Kong NDR series launched.' },
  { y: '2019', t: '20-year anniversary',                   d: 'Coverage universe crosses 100 PSE names.' },
  { y: '2024', t: 'Research portal modernized',            d: 'New institutional client portal with morning calls and replay.' },
  { y: '2026', t: 'Regis next',                            d: 'A renewed digital experience for the next quarter-century.' },
];

const leaders = [
  { n: 'Antonio R. Salcedo', r: 'Chairman & CEO',           e: 'Founded the firm in 1999. 30+ years across PSE, HKEX, SGX.' },
  { n: 'Maria C. Bautista',  r: 'Head of Research',         e: 'Philippine banks and macro. Previously IB equity strategy, London.' },
  { n: 'Renato S. Yulo',     r: 'Head of Sales',            e: 'Built the firm\'s institutional sales franchise from 2003.' },
  { n: 'Patricia L. Ong',    r: 'Head of Trading',          e: 'Block, program, and after-hours liquidity since 2007.' },
  { n: 'Eduardo M. del Mar', r: 'Head of Corporate Access', e: 'Architect of the Manila Conference and Asian NDR programs.' },
  { n: 'Karla R. Tiongson',  r: 'Chief Compliance Officer', e: 'Cross-border regulatory frameworks; ex-BSP, ex-SEC PH.' },
];

export default function About() {
  return (
    <>
      <PageHeader
        eyebrow="The firm"
        title="A quarter-century in Philippine equities."
        dek="Regis Partners is an independent institutional brokerage, research, and capital markets firm, founded in Makati in 1999."
      />

      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            <Reveal className="col-span-12 lg:col-span-4">
              <div className="eyebrow mb-6">Heritage</div>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.02em]">
                Twenty-five years, no shortcuts.
              </h2>
            </Reveal>
            <ol className="col-span-12 lg:col-span-8 border-t rule">
              {timeline.map((e, i) => (
                <Reveal key={i} delay={i * 0.05} className="grid grid-cols-12 gap-x-6 items-baseline border-b rule py-7">
                  <div className="col-span-3 md:col-span-2 num text-2xl md:text-3xl tracking-[-0.02em]">{e.y}</div>
                  <div className="col-span-9 md:col-span-4 text-lg md:text-xl tracking-[-0.012em] font-medium">{e.t}</div>
                  <div className="col-span-12 md:col-span-6 text-slate text-[14.5px] leading-relaxed mt-2 md:mt-0">{e.d}</div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-bone">
        <div className="container-fluid py-24 md:py-32">
          <Reveal className="max-w-3xl mb-14">
            <div className="eyebrow mb-6">Leadership</div>
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-[-0.025em]">
              Run by the people on the call.
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
            {leaders.map((p) => (
              <Reveal key={p.n}>
                <div className="aspect-[4/5] bg-navy relative overflow-hidden mb-5">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-paper/10 text-[10rem] leading-none tracking-tighter font-medium">
                      {p.n.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                    </div>
                  </div>
                  <div className="absolute left-5 bottom-5 right-5">
                    <div
                      className="mono text-[11px] tracking-[0.16em] uppercase"
                      style={{ color: 'var(--color-amber)' }}
                    >
                      {p.r}
                    </div>
                  </div>
                </div>
                <h3 className="text-xl tracking-[-0.012em] font-medium">{p.n}</h3>
                <p className="text-slate mt-2 text-[14.5px] leading-relaxed max-w-[40ch]">{p.e}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <Reveal className="max-w-3xl mb-12">
            <div className="eyebrow mb-6">Recognition</div>
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
              Selected awards & rankings.
            </h2>
          </Reveal>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            {[
              ['Asiamoney Brokers Poll',    'Best Local Brokerage, PH — 2018–2024'],
              ['Institutional Investor',     'All-Asia Research Team #1, PH — 2021, 2023'],
              ['FinanceAsia',                'Best Equity House, PH — 2019, 2022'],
              ['Alpha Southeast Asia',       'Best Local Broker, PH — 2020, 2024'],
              ['The Asset Triple A',         'Best Corporate Access House — 2023'],
              ['PSE Bell Awards',            'Top Trading Participant by Value — 2022'],
            ].map(([a, b]) => (
              <Reveal key={a} className="border-b rule py-6 flex items-baseline justify-between gap-6">
                <span className="text-lg tracking-[-0.012em] font-medium">{a}</span>
                <span className="text-slate text-[14px] text-right">{b}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
