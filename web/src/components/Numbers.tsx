import { useEffect, useRef } from 'react';
import { animate, useInView } from 'framer-motion';
import Reveal from './Reveal';
import type { HomeCopy } from '../cms/data';

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

/** The firm-figures rail. Copy is authored in the CMS Landing page module. */
export default function Numbers({ copy }: { copy: HomeCopy['numbers'] }) {
  const stats = copy.stats;
  const cols = stats.length >= 4 ? 'lg:grid-cols-4' : stats.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <section className="bg-paper text-ink">
      <div className="container-fluid py-24 md:py-32">
        {/* Intro row — GIC title/text split */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-8">
          <Reveal className="col-span-12 lg:col-span-4">
            {copy.eyebrow && <div className="eyebrow mb-6">{copy.eyebrow}</div>}
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.022em] max-w-[14ch]">
              {copy.heading}
            </h2>
          </Reveal>
          {copy.intro && (
            <Reveal delay={0.08} className="col-span-12 lg:col-span-6 lg:col-start-6">
              <p className="max-w-[58ch] text-slate leading-[1.7] text-[15.5px]">{copy.intro}</p>
            </Reveal>
          )}
        </div>

        {/* Numeral rail */}
        {stats.length > 0 && (
          <div className="mt-16 md:mt-20 border-t rule">
            <div className={`grid grid-cols-2 ${cols}`}>
              {stats.map((s, i) => (
                <Reveal
                  key={`${i}-${s.label}`}
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
        )}
      </div>
    </section>
  );
}
