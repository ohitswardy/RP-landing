import Reveal from './Reveal';
import { Link } from 'react-router-dom';

export default function LeadershipQuote() {
  return (
    <section className="relative bg-navy-deep text-paper overflow-hidden">
      {/* President portrait — right-anchored, fades into navy on the left */}
      <div aria-hidden className="absolute inset-0">
        <img
          src="/President.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-right"
        />
        {/* left-to-right overlay so text remains legible */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/80 via-navy-deep/50 to-navy-deep/10" />
      </div>

      <div className="container-fluid relative py-24 md:py-32">
        <Reveal delay={0.05}>
          <blockquote className="text-[clamp(1.6rem,3vw,2.6rem)] leading-[1.02] tracking-[-0.028em] font-medium max-w-[44ch] text-paper">
            "In a year defined by complexity and change, we believe it is
            essential to reflect on the principles that define us. At Regis,
            we prioritize clients, people, and insight, always."
          </blockquote>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-12 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="block w-12 h-px bg-paper/30" />
              <div>
                <div className="text-paper text-[14.5px]">Michael Angelo B. Macale</div>
                <div className="mono text-[11px] tracking-[0.16em] uppercase text-paper/55 mt-0.5">President</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
