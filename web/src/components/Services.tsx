import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import Reveal from './Reveal';
import ArrowCta from './ArrowCta';

const ease = [0.25, 1, 0.5, 1] as const;

const services = [
  { t: 'Research Advisory',   d: 'Original equity research across 120+ PSE names',      to: '/services/research',  img: '/Service1.1.jpg' },
  { t: 'Sales Advisory',      d: 'High-touch institutional sales and idea generation',  to: '/services/sales',     img: '/Service 2.1.jpg' },
  { t: 'Trading & Execution', d: 'Block, agency, and algorithmic execution on the PSE', to: '/services/trading',   img: '/Service 3.1.jpg' },
  { t: 'Corporate Access',    d: 'Conferences, NDRs, and C-suite engagement',           to: '/services/corporate', img: '/Service 3.2.jpg' },
  { t: 'Capital Markets',     d: 'Equity issuance, follow-ons, and placements',         to: '/services',           img: '/Services 4.1.jpg' },
  { t: 'Advisory',            d: 'Strategic and corporate finance counsel',             to: '/services',           img: '/Service 4.2.jpg' },
];

export default function Services() {
  const [active, setActive] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Cursor-following preview — springs trail the pointer for weight.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 140, damping: 18, mass: 0.4 });
  const y = useSpring(my, { stiffness: 140, damping: 18, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    const rect = listRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  return (
    <section className="bg-navy text-paper">
      <div className="container-fluid py-24 md:py-32">
        {/* Section head */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-6 mb-14 md:mb-20">
          <Reveal>
            <div className="eyebrow eyebrow-paper mb-6">What we do</div>
            <h2 className="text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.06] tracking-[-0.024em] max-w-[20ch]">
              Deep expertise across the Philippine capital markets.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <ArrowCta to="/services" tone="paper">All services</ArrowCta>
          </Reveal>
        </div>

        {/* Index — hovering a row floats its image alongside the cursor */}
        <div
          ref={listRef}
          className="relative"
          onMouseMove={onMove}
          onMouseLeave={() => setActive(null)}
        >
          {/* Floating preview (pointer devices, lg and up) */}
          <AnimatePresence>
            {active !== null && (
              <motion.div
                key="float"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, ease }}
                className="pointer-events-none absolute z-10 hidden lg:block w-[280px] aspect-[4/5] overflow-hidden"
                style={{ x, y, top: -175, left: 48, rotate: -2 }}
                aria-hidden
              >
                <AnimatePresence mode="popLayout">
                  <motion.img
                    key={services[active].img}
                    src={services[active].img}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease }}
                  />
                </AnimatePresence>
                <div
                  className="absolute inset-0"
                  style={{ boxShadow: 'inset 0 0 0 1px oklch(1 0 0 / 0.12)' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <ul className="border-t rule-navy">
            {services.map((s, i) => (
              <motion.li
                key={s.t}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.05, ease }}
                className="border-b rule-navy"
              >
                <Link
                  to={s.to}
                  onMouseEnter={() => setActive(i)}
                  className="group grid grid-cols-12 items-baseline gap-x-4 py-7 md:py-9 -mx-4 px-4 transition-colors duration-500 hover:bg-[color:var(--color-navy-mid)]"
                >
                  <div className="col-span-2 md:col-span-1 mono num text-[11px] tracking-[0.16em] text-paper/35">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="col-span-8 md:col-span-6">
                    <div className="text-[clamp(1.3rem,2.6vw,2rem)] font-medium leading-[1.1] tracking-[-0.02em] text-paper transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-2">
                      {s.t}
                    </div>
                    <div className="md:hidden mt-2 text-paper/55 text-[13.5px]">{s.d}</div>
                  </div>
                  <div className="hidden md:block col-span-4 text-paper/55 text-[14.5px] leading-[1.5]">
                    {s.d}
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end self-center">
                    <span className="text-paper/45 transition-all duration-500 group-hover:text-[color:var(--color-amber)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                      ↗
                    </span>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
