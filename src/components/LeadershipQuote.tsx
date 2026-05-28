import Reveal from './Reveal';
import { Link } from 'react-router-dom';

export default function LeadershipQuote() {
  return (
    <section className="relative bg-navy-deep text-paper overflow-hidden">
      {/* Subtle portrait halftone — abstract, not photographic */}
      <div aria-hidden className="absolute inset-0 opacity-20">
        <svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <radialGradient id="lh" cx="0.78" cy="0.55" r="0.45">
              <stop offset="0" stopColor="oklch(0.760 0.140 62)" stopOpacity="0.7" />
              <stop offset="1" stopColor="oklch(0.165 0.040 260)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1600" height="600" fill="url(#lh)" />
          {/* Vertical hairlines as office venetian feel */}
          {Array.from({ length: 24 }).map((_, i) => (
            <line key={i} x1={i * 70 + 50} y1="0" x2={i * 70 + 50} y2="600" stroke="oklch(0.97 0.005 80)" strokeOpacity="0.04" />
          ))}
        </svg>
      </div>

      <div className="container-fluid relative py-24 md:py-32">
        <Reveal>
          <div className="eyebrow eyebrow-paper mb-10">Leadership letter</div>
        </Reveal>
        <Reveal delay={0.05}>
          <blockquote className="serif italic text-[clamp(1.6rem,3vw,2.6rem)] leading-[1.25] tracking-[-0.015em] max-w-[44ch] text-paper">
            "In a year defined by complexity and change, we believe it is
            essential to reflect on the principles that define us. At Regis,
            we prioritize clients, people, and insight, always."
          </blockquote>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-12 flex flex-wrap items-center gap-6">
            <Link to="/about" className="btn-ghost">
              More from leadership <span>→</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="block w-12 h-px bg-paper/30" />
              <div>
                <div className="text-paper text-[14.5px]">Antonio R. Salcedo</div>
                <div className="mono text-[11px] tracking-[0.16em] uppercase text-paper/55 mt-0.5">Chairman & CEO</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
