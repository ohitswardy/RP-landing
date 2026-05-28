import Reveal from './Reveal';
import { Link } from 'react-router-dom';

export default function Community() {
  return (
    <section className="bg-paper">
      <div className="container-fluid py-24 md:py-32">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10 items-center">
          <Reveal className="col-span-12 lg:col-span-5 lg:col-start-1 order-2 lg:order-1">
            <div className="eyebrow mb-8">Community & engagement</div>
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] tracking-[-0.02em] max-w-[20ch] text-ink">
              Our people are our greatest contribution to the country.
            </h2>
            <p className="mt-7 max-w-[44ch] text-slate leading-relaxed text-[15px]">
              As a people-driven business, our greatest contribution flows
              through the teams and communities we serve across the
              Philippines, from Makati to Mindanao.
            </p>
            <Link to="/about" className="btn-dark mt-10">
              Explore our programs <span>→</span>
            </Link>
          </Reveal>

          <Reveal delay={0.1} className="col-span-12 lg:col-span-7 lg:col-start-6 order-1 lg:order-2">
            <div className="aspect-[4/3] relative overflow-hidden bg-bone">
              {/* Abstract aerial-crowd composition */}
              <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
                <rect width="800" height="600" fill="oklch(0.94 0.012 80)" />
                {/* Banner */}
                <g transform="translate(280 380) rotate(-6)">
                  <rect width="260" height="60" fill="oklch(0.992 0.003 80)" stroke="oklch(0.555 0.010 260)" strokeWidth="1" />
                  <text x="130" y="38" textAnchor="middle" fontFamily="Geist, sans-serif" fontSize="22" fontWeight="500" fill="oklch(0.215 0.048 260)" letterSpacing="0.12em">
                    REGIS · 25
                  </text>
                </g>
                {/* Aerial crowd dots */}
                {Array.from({ length: 180 }).map((_, i) => {
                  const x = 60 + (i * 137) % 700;
                  const y = 60 + (i * 89) % 480;
                  // Skip points in the banner zone
                  if (x > 270 && x < 560 && y > 360 && y < 460) return null;
                  const palette = ['oklch(0.215 0.048 260)', 'oklch(0.270 0.050 260)', 'oklch(0.180 0.018 260)', 'oklch(0.760 0.140 62)'];
                  const fill = palette[i % 17 === 0 ? 3 : i % 3];
                  return <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 5 : 4} fill={fill} opacity={i % 17 === 0 ? 0.9 : 0.85} />;
                })}
              </svg>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
