import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.25, 1, 0.5, 1] as const;

const HEADLINE = ["The Philippines'", 'pure-play institutional', 'brokerage & research house.'];

// Latest from the desk — surfaces in the rotating wire panel, GIC-style.
const WIRE = [
  { d: 'AUG 2026', k: 'The Big Picture', t: 'How sovereign AI became the new arena for state power.' },
  { d: 'JUL 2026', k: 'Strategy',        t: 'The exit doors are open: liquidity returns to private markets.' },
  { d: 'JUL 2026', k: 'PSE Desk',        t: 'Positioning ahead of the August MSCI rebalance.' },
  { d: 'JUN 2026', k: 'Economics',       t: 'The BSP easing path: what 150bps means for the banks.' },
];

function DeskWire() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % WIRE.length), 5200);
    return () => clearInterval(id);
  }, []);

  const item = WIRE[i];

  return (
    <div className="bg-paper text-ink">
      <div className="h-[2px] w-full" style={{ background: 'var(--color-amber)' }} aria-hidden />
      <div className="p-6 md:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <span className="mono text-[10px] tracking-[0.2em] uppercase text-graphite">
            From the desk
          </span>
          <span className="mono num text-[10px] tracking-[0.2em] text-graphite">
            {String(i + 1).padStart(2, '0')} / {String(WIRE.length).padStart(2, '0')}
          </span>
        </div>
        <div className="relative mt-4 h-[86px] sm:h-[74px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={item.t}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.55, ease }}
            >
              <div className="mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-amber-deep)]">
                {item.k} · {item.d}
              </div>
              <Link
                to="/insights"
                className="mt-2 block text-[16px] md:text-[17px] leading-[1.35] tracking-[-0.012em] text-ink hover:text-[color:var(--color-amber-deep)] transition-colors max-w-[52ch]"
              >
                {item.t}
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative bg-navy text-paper overflow-hidden">
      {/* Photo backdrop */}
      <div aria-hidden className="absolute inset-0">
        <img
          src="/hero-lobby.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, oklch(0.14 0.040 260 / 0.94) 0%, oklch(0.14 0.040 260 / 0.76) 55%, oklch(0.14 0.040 260 / 0.50) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-72"
          style={{
            background: 'linear-gradient(to top, oklch(0.10 0.036 260 / 0.95) 0%, transparent 100%)',
          }}
        />
        <div
          className="absolute -left-40 -bottom-40 w-[700px] h-[700px] rounded-full opacity-[0.13]"
          style={{ background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative container-fluid pt-24 md:pt-36 pb-10 md:pb-14">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="eyebrow eyebrow-paper mb-10"
        >
          Philippine Institutional Brokerage & Capital Markets
        </motion.div>

        {/* Headline — per-line mask reveal */}
        <h1 className="text-[clamp(2.4rem,6vw,5.5rem)] leading-[1.02] tracking-[-0.028em] font-medium max-w-[18ch]">
          {HEADLINE.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <motion.span
                className="block"
                initial={{ y: '112%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.95, ease, delay: 0.08 + i * 0.11 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        {/* Deck */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.5 }}
          className="mt-9 max-w-[54ch] text-[16.5px] leading-[1.65] text-paper/72"
        >
          Independent research, high-touch sales, and disciplined execution for
          global allocators active in Philippine equities. Trusted on the PSE
          since 1999.
        </motion.p>

        {/* Bottom row: scroll cue + desk wire panel */}
        <div className="mt-16 md:mt-24 grid grid-cols-12 gap-x-6 items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease, delay: 0.9 }}
            className="hidden lg:flex col-span-5 items-center gap-4 pb-2"
            aria-hidden
          >
            <span className="mono text-[10px] tracking-[0.24em] uppercase text-paper/45">Scroll</span>
            <span className="relative block h-px w-24 overflow-hidden bg-paper/15">
              <motion.span
                className="absolute inset-y-0 left-0 w-8"
                style={{ background: 'var(--color-amber)' }}
                animate={{ x: ['-100%', '400%'] }}
                transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
              />
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.7 }}
            className="col-span-12 lg:col-span-7"
          >
            <DeskWire />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
