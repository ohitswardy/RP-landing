import { motion } from 'framer-motion';

const ease = [0.25, 1, 0.5, 1] as const;

const stats = [
  { k: '25+',  v: 'Years of partnership' },
  { k: '120+', v: 'PSE names under coverage' },
  { k: '300+', v: 'Institutional counterparties' },
  { k: 'PSE', v: 'Trusted since 1999' },
];

export default function Hero() {
  return (
    <section className="relative bg-blueprint text-paper overflow-hidden">
      {/* Photo backdrop */}
      <div aria-hidden className="absolute inset-0">
        <img
          src="/hero-lobby.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Navy overlay — heavier on left, lighter on right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, oklch(0.14 0.040 260 / 0.92) 0%, oklch(0.14 0.040 260 / 0.74) 55%, oklch(0.14 0.040 260 / 0.52) 100%)',
          }}
        />
        {/* Bottom vignette behind stats */}
        <div
          className="absolute inset-x-0 bottom-0 h-64"
          style={{
            background:
              'linear-gradient(to top, oklch(0.10 0.036 260 / 0.96) 0%, transparent 100%)',
          }}
        />
        {/* Amber glow bottom-left */}
        <div
          className="absolute -left-40 -bottom-40 w-[700px] h-[700px] rounded-full opacity-[0.14]"
          style={{
            background:
              'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative container-fluid pt-24 md:pt-36 pb-0">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="eyebrow eyebrow-paper mb-10"
        >
          Philippine Institutional Brokerage & Capital Markets
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease, delay: 0.05 }}
          className="text-[clamp(2.5rem,6.5vw,6rem)] leading-[1.02] tracking-[-0.028em] max-w-[18ch] font-medium"
        >
          The Philippines' pure-play institutional brokerage and research firm.
        </motion.h1>

        {/* Body copy */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.22 }}
          className="mt-10 max-w-[58ch] text-[17px] leading-[1.6] text-paper/72"
        >
          
        </motion.p>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 1, ease, delay: 0.42 }}
          className="mt-16 origin-left"
          style={{ height: '1px', background: 'oklch(1 0 0 / 0.15)' }}
          aria-hidden
        />

        {/* Stats row — inside the hero */}
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.v}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.48 + i * 0.09, ease }}
              className={[
                'py-8 md:py-10 pr-6 md:pr-10',
                i > 0 ? 'pl-6 md:pl-10' : '',
                i > 0 ? 'border-l' : '',
                i >= 2 ? 'border-t md:border-t-0' : '',
                i === 1 ? 'border-l' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ borderColor: 'oklch(1 0 0 / 0.12)' }}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="inline-block w-4 h-px shrink-0"
                  style={{ background: 'var(--color-amber)' }}
                  aria-hidden
                />
                <span className="num text-[clamp(1.75rem,3.5vw,3rem)] leading-none tracking-[-0.025em] font-medium">
                  {s.k}
                </span>
              </div>
              <div className="mono mt-3 text-[10px] tracking-[0.16em] uppercase text-paper/50">
                {s.v}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
