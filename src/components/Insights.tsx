import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Reveal from './Reveal';

type Card = { k: string; t: string; tone: 'data' | 'meeting' | 'chart' | 'speaker' };

const cards: Card[] = [
  { k: 'The Big Picture',         t: 'How sovereign AI became the new arena for state power.',           tone: 'data' },
  { k: 'Boardroom Intelligence',  t: 'The exit doors are open: liquidity returns to private markets.',   tone: 'meeting' },
  { k: 'Sustainability & Culture',t: 'Secondary market surge: how evergreen vehicles are writing PE\'s next chapter.', tone: 'chart' },
  { k: 'The Big Picture',         t: 'India\'s IPO market: signs point to a strong finish to 2026.',     tone: 'speaker' },
];

// Editorial cover panels — abstract, conceptual, no stock photo
function Cover({ tone }: { tone: Card['tone'] }) {
  if (tone === 'data') {
    return (
      <svg viewBox="0 0 400 280" preserveAspectRatio="none" className="w-full h-full">
        <rect width="400" height="280" fill="oklch(0.215 0.048 260)" />
        {Array.from({ length: 16 }).map((_, x) => (
          <g key={x}>
            {Array.from({ length: 11 }).map((_, y) => (
              <rect
                key={y}
                x={x * 26 + 8}
                y={y * 26 + 8}
                width="14"
                height="14"
                fill={(x + y) % 7 === 0 ? 'var(--color-amber)' : 'oklch(0.97 0.005 80)'}
                fillOpacity={(x + y) % 3 === 0 ? 0.35 : 0.12}
              />
            ))}
          </g>
        ))}
      </svg>
    );
  }
  if (tone === 'meeting') {
    return (
      <svg viewBox="0 0 400 280" preserveAspectRatio="none" className="w-full h-full">
        <rect width="400" height="280" fill="oklch(0.965 0.006 80)" />
        {/* Boardroom: long table + chairs from above */}
        <rect x="80" y="110" width="240" height="60" fill="oklch(0.215 0.048 260)" />
        {[0,1,2,3].map((i) => (
          <g key={i}>
            <rect x={100 + i * 60} y="80" width="40" height="22" fill="oklch(0.180 0.018 260)" />
            <rect x={100 + i * 60} y="178" width="40" height="22" fill="oklch(0.180 0.018 260)" />
          </g>
        ))}
        <line x1="200" y1="0" x2="200" y2="280" stroke="oklch(0.760 0.140 62)" strokeOpacity="0.35" strokeWidth="1" />
      </svg>
    );
  }
  if (tone === 'chart') {
    return (
      <svg viewBox="0 0 400 280" preserveAspectRatio="none" className="w-full h-full">
        <rect width="400" height="280" fill="oklch(0.270 0.050 260)" />
        {/* Candlesticks */}
        {Array.from({ length: 22 }).map((_, i) => {
          const x = 20 + i * 17;
          const up = i % 3 !== 1;
          const open = 100 + (i * 7) % 80;
          const close = open + (up ? -20 - (i % 5) * 4 : 15 + (i % 4) * 3);
          const high = Math.min(open, close) - 12;
          const low = Math.max(open, close) + 10;
          const color = up ? 'oklch(0.640 0.130 145)' : 'oklch(0.640 0.190 28)';
          return (
            <g key={i}>
              <line x1={x + 5} y1={high} x2={x + 5} y2={low} stroke={color} strokeWidth="1" />
              <rect x={x} y={Math.min(open, close)} width="10" height={Math.abs(close - open)} fill={color} />
            </g>
          );
        })}
        <line x1="0" y1="200" x2="400" y2="200" stroke="oklch(0.97 0.005 80)" strokeOpacity="0.1" />
      </svg>
    );
  }
  // speaker
  return (
    <svg viewBox="0 0 400 280" preserveAspectRatio="none" className="w-full h-full">
      <rect width="400" height="280" fill="oklch(0.215 0.048 260)" />
      {/* Stage lines */}
      {Array.from({ length: 14 }).map((_, i) => (
        <line
          key={i}
          x1={i * 32}
          y1="0"
          x2={i * 32 + 60}
          y2="280"
          stroke="oklch(0.97 0.005 80)"
          strokeOpacity="0.05"
        />
      ))}
      {/* Podium silhouette */}
      <path d="M170 100 a30 30 0 1 1 60 0 a30 30 0 1 1 -60 0" fill="oklch(0.165 0.040 260)" />
      <path d="M140 230 L260 230 L240 140 L160 140 Z" fill="oklch(0.165 0.040 260)" />
      <rect x="190" y="200" width="20" height="60" fill="oklch(0.760 0.140 62)" opacity="0.85" />
    </svg>
  );
}

export default function Insights() {
  return (
    <section className="bg-paper text-ink">
      <div className="container-fluid py-24 md:py-32">
        <div className="flex items-end justify-between gap-6 mb-12 md:mb-16">
          <Reveal>
            <div className="eyebrow mb-6">Our insights</div>
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-[-0.025em]">
              Research that moves markets.
            </h2>
          </Reveal>
          <Reveal>
            <Link
              to="/insights"
              className="hidden md:inline-flex items-center gap-2 mono text-[11px] tracking-[0.16em] uppercase text-slate hover:text-[color:var(--color-amber-deep)]"
            >
              All insights <span>↗</span>
            </Link>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {cards.map((c, i) => (
            <motion.article
              key={c.t}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.25, 1, 0.5, 1] }}
              className="group"
            >
              <Link to="/insights" className="block">
                <div className="aspect-[4/3] overflow-hidden bg-bone">
                  <div className="w-full h-full transition-transform duration-700 group-hover:scale-[1.03]">
                    <Cover tone={c.tone} />
                  </div>
                </div>
                <div className="eyebrow mt-6 mb-3">{c.k}</div>
                <h3 className="text-[17px] md:text-[18px] leading-[1.3] tracking-[-0.012em] text-ink group-hover:text-[color:var(--color-amber-deep)] transition-colors max-w-[28ch]">
                  {c.t}
                </h3>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
