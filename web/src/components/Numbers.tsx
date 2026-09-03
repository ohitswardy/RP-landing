import { useEffect, useRef } from 'react';
import { animate, useInView } from 'framer-motion';
import Reveal from './Reveal';

const STATS = [
  { value: 1999, suffix: '',  label: 'Founded, member of the PSE' },
  { value: 25,   suffix: '+', label: 'Years of partnership' },
  { value: 120,  suffix: '+', label: 'PSE names under coverage' },
  { value: 300,  suffix: '+', label: 'Institutional counterparties' },
];

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  useEffect(() => {
    const el = ref.current;
    if (!inView || !el) return;
    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span className="mono num inline-flex items-baseline">
      <span ref={ref}>0</span>
      {suffix && (
        <span className="text-[0.45em] text-[color:var(--color-amber-deep)] translate-y-[-0.55em]">
          {suffix}
        </span>
      )}
    </span>
  );
}

export default function Numbers() {
  return (
    <section className="bg-paper text-ink">
      <div className="container-fluid py-24 md:py-32">
        {/* Intro row — GIC title/text split */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-8">
          <Reveal className="col-span-12 lg:col-span-4">
            <div className="eyebrow mb-6">The firm</div>
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.022em] max-w-[14ch]">
              Strength in numbers.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="col-span-12 lg:col-span-6 lg:col-start-6">
            <p className="max-w-[58ch] text-slate leading-[1.7] text-[15.5px]">
              Regis Partners is an independent Philippine brokerage built for a
              single client base: institutions. One market, covered deeply. One
              desk, answerable only to its clients. The franchise has compounded
              through every cycle the PSE has traded since 1999.
            </p>
          </Reveal>
        </div>

        {/* Numeral rail */}
        <div className="mt-16 md:mt-20 border-t rule">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal
                key={s.label}
                delay={i * 0.07}
                className={[
                  'py-10 md:py-14 pr-6',
                  i % 2 === 1 ? 'pl-6 border-l rule' : '',
                  i >= 2 ? 'border-t lg:border-t-0 rule' : '',
                  i >= 1 ? 'lg:border-l lg:pl-10' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="text-[clamp(3rem,7vw,6rem)] leading-none tracking-[-0.03em] font-medium">
                  <CountUp value={s.value} suffix={s.suffix} />
                </div>
                <div className="eyebrow mt-6 text-graphite">{s.label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
