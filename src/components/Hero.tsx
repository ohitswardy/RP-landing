import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const ease = [0.25, 1, 0.5, 1] as const;

const stats = [
  { k: '25+',  v: 'Years of partnership' },
  { k: '120+', v: 'PSE names under coverage' },
  { k: '300+', v: 'Institutional counterparties' },
  { k: '₱1T+', v: 'In flow facilitated' },
];

export default function Hero() {
  return (
    <section className="relative">
      {/* HERO — drenched navy with architectural backdrop */}
      <div className="relative bg-blueprint text-paper overflow-hidden">
        {/* Architectural backdrop — abstract skyline silhouette + light streaks (no stock photo) */}
        <div aria-hidden className="absolute inset-0">
          {/* Soft amber horizon glow from bottom-left */}
          <div
            className="absolute -left-40 -bottom-40 w-[900px] h-[900px] rounded-full opacity-[0.18]"
            style={{ background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)' }}
          />
          {/* Skyline silhouette */}
          <svg
            className="absolute inset-x-0 bottom-0 w-full h-[55%]"
            viewBox="0 0 1600 500"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="skyline" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="oklch(0.165 0.040 260)" stopOpacity="0" />
                <stop offset="1" stopColor="oklch(0.140 0.040 260)" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            {/* Background ridge */}
            <path
              d="M0 380 L60 380 L60 300 L120 300 L120 340 L200 340 L200 250 L260 250 L260 320 L340 320 L340 220 L400 220 L400 280 L470 280 L470 200 L540 200 L540 290 L620 290 L620 180 L690 180 L690 270 L760 270 L760 230 L840 230 L840 160 L900 160 L900 240 L970 240 L970 200 L1040 200 L1040 280 L1120 280 L1120 220 L1190 220 L1190 300 L1260 300 L1260 250 L1340 250 L1340 320 L1420 320 L1420 240 L1500 240 L1500 310 L1600 310 L1600 500 L0 500 Z"
              fill="url(#skyline)"
            />
            {/* Foreground ridge — denser */}
            <path
              d="M0 460 L100 460 L100 400 L180 400 L180 430 L260 430 L260 360 L340 360 L340 410 L420 410 L420 340 L500 340 L500 400 L580 400 L580 320 L660 320 L660 380 L740 380 L740 350 L820 350 L820 290 L900 290 L900 360 L980 360 L980 320 L1060 320 L1060 380 L1140 380 L1140 340 L1220 340 L1220 400 L1300 400 L1300 360 L1380 360 L1380 420 L1460 420 L1460 380 L1540 380 L1540 440 L1600 440 L1600 500 L0 500 Z"
              fill="oklch(0.130 0.040 260)"
              fillOpacity="0.9"
            />
            {/* Window lights — sparse amber */}
            {[
              [220, 290], [280, 340], [410, 270], [510, 230], [620, 250],
              [710, 220], [820, 200], [930, 200], [1080, 250], [1200, 270],
              [1310, 290], [1430, 280], [350, 380], [620, 360], [890, 330],
              [1040, 350], [1220, 370], [1380, 390],
            ].map(([x, y], i) => (
              <rect
                key={i}
                x={x}
                y={y}
                width="2"
                height="2"
                fill="var(--color-amber)"
                opacity={0.6 + (i % 3) * 0.13}
              />
            ))}
          </svg>
          {/* Subtle vertical light beam (atrium feel) */}
          <div
            className="absolute top-0 right-[18%] w-px h-full opacity-30"
            style={{ background: 'linear-gradient(to bottom, transparent, oklch(0.97 0.005 80 / 0.6), transparent)' }}
          />
        </div>

        <div className="relative container-fluid pt-24 md:pt-36 pb-28 md:pb-40">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="eyebrow eyebrow-paper mb-10"
          >
            Philippine Institutional Brokerage & Capital Markets
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease, delay: 0.05 }}
            className="text-[clamp(2.5rem,6.5vw,6rem)] leading-[1.02] tracking-[-0.028em] max-w-[18ch] font-medium"
          >
            The Philippines' pure-play institutional brokerage and research firm.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.22 }}
            className="mt-10 max-w-[58ch] text-[17px] leading-[1.6] text-paper/72"
          >
            Independent since 1999. We connect global institutional capital to
            the Philippine market through original research, high-touch
            execution, and the deepest corporate-access franchise on the PSE.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.35 }}
            className="mt-12 flex flex-wrap gap-3"
          >
            <Link to="/services" className="btn-primary">
              Explore our services <span>→</span>
            </Link>
            <Link to="/insights" className="btn-ghost">
              Latest insights
            </Link>
          </motion.div>
        </div>
      </div>

      {/* STAT BAND — sits on the navy, separated by hairline */}
      <div className="bg-navy-deep text-paper">
        <div className="container-fluid">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.v}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.7, delay: i * 0.08, ease }}
                className={`py-10 md:py-14 px-2 md:px-8 ${i > 0 ? 'md:border-l rule-navy' : ''} ${i >= 2 ? 'border-t md:border-t-0 rule-navy' : ''} ${i === 1 ? 'border-l rule-navy' : ''}`}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className="inline-block w-4 h-px"
                    style={{ background: 'var(--color-amber)' }}
                    aria-hidden
                  />
                  <span className="num text-[clamp(2.25rem,4vw,3.5rem)] leading-none tracking-[-0.025em] font-medium">
                    {s.k}
                  </span>
                </div>
                <div className="mono mt-4 text-[11px] tracking-[0.16em] uppercase text-paper/55">
                  {s.v}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
