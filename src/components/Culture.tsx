import Reveal from './Reveal';
import { Link } from 'react-router-dom';

export default function Culture() {
  return (
    <section className="bg-paper">
      <div className="container-fluid py-24 md:py-32">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10 items-stretch">
          {/* Visual — abstract trading floor */}
          <Reveal className="col-span-12 lg:col-span-7">
            <div className="aspect-[4/3] lg:aspect-auto lg:h-full bg-navy relative overflow-hidden">
              <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
                {/* Multi-screen wall */}
                {Array.from({ length: 4 }).map((_, c) =>
                  Array.from({ length: 3 }).map((_, r) => (
                    <g key={`${c}-${r}`}>
                      <rect
                        x={60 + c * 180}
                        y={80 + r * 130}
                        width="160"
                        height="110"
                        fill="oklch(0.180 0.018 260)"
                        stroke="oklch(0.355 0.045 260)"
                        strokeWidth="0.75"
                      />
                      {/* Mini chart inside */}
                      <path
                        d={`M${60 + c * 180 + 8} ${80 + r * 130 + 90} L${60 + c * 180 + 28} ${80 + r * 130 + 70 + (c * 7) % 25} L${60 + c * 180 + 48} ${80 + r * 130 + 50 + (r * 11) % 30} L${60 + c * 180 + 68} ${80 + r * 130 + 60 + (c * 5) % 20} L${60 + c * 180 + 88} ${80 + r * 130 + 30 + (r * 9) % 25} L${60 + c * 180 + 108} ${80 + r * 130 + 45} L${60 + c * 180 + 128} ${80 + r * 130 + 25 + (c * 4) % 20} L${60 + c * 180 + 148} ${80 + r * 130 + 35}`}
                        fill="none"
                        stroke={(c + r) % 3 === 0 ? 'oklch(0.640 0.190 28)' : 'oklch(0.640 0.130 145)'}
                        strokeWidth="1.2"
                      />
                      {/* Number readout */}
                      <text
                        x={60 + c * 180 + 8}
                        y={80 + r * 130 + 105}
                        fontFamily="ui-monospace, monospace"
                        fontSize="8"
                        fill="oklch(0.760 0.140 62)"
                        opacity="0.8"
                      >
                        {(1000 + c * 137 + r * 53).toFixed(0)}.{(c * 7 + r * 3) % 99}
                      </text>
                    </g>
                  ))
                )}
              </svg>
            </div>
          </Reveal>

          {/* Dark card with amber accent — like the reference */}
          <Reveal delay={0.12} className="col-span-12 lg:col-span-5">
            <div className="h-full bg-navy-deep text-paper p-10 md:p-14 flex flex-col justify-center">
              <div className="eyebrow eyebrow-paper mb-8">Culture & growth story</div>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] tracking-[-0.02em] max-w-[22ch]">
                From a Makati boutique to the institution global allocators call first.
              </h2>
              <p className="mt-7 max-w-[44ch] text-paper/65 leading-relaxed text-[15px]">
                Twenty-five years of disciplined growth, entrepreneurial spirit,
                and an unwavering commitment to our clients and our people.
              </p>
              <Link
                to="/about"
                className="mt-10 inline-flex items-center gap-3 self-start text-[color:var(--color-amber)] text-[13.5px] group"
              >
                <span>Get to know us better</span>
                <span className="block h-px w-10 bg-[color:var(--color-amber)] group-hover:w-16 transition-all duration-500" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
