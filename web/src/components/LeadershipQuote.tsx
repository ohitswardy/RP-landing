import Reveal from './Reveal';
import ArrowCta from './ArrowCta';

export default function LeadershipQuote() {
  return (
    <section className="relative bg-navy-deep text-paper overflow-hidden">
      {/* President portrait — right-anchored, fading into navy on the left */}
      <div aria-hidden className="absolute inset-0">
        <img
          src="/President.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/85 via-navy-deep/55 to-navy-deep/10" />
      </div>

      <div className="container-fluid relative py-24 md:py-36">
        <Reveal>
          <div className="eyebrow eyebrow-paper mb-10">A word from the President</div>
        </Reveal>
        <Reveal delay={0.08}>
          <blockquote className="text-[clamp(1.6rem,3vw,2.6rem)] leading-[1.15] tracking-[-0.024em] font-medium max-w-[38ch] text-paper">
            "In a year defined by complexity and change, we believe it is
            essential to reflect on the principles that define us. At Regis,
            we prioritize clients, people, and insight, always."
          </blockquote>
        </Reveal>
        <Reveal delay={0.16}>
          <footer className="mt-12 flex flex-wrap items-center gap-x-14 gap-y-8">
            <div className="flex items-center gap-4">
              <span className="block w-6 h-[1.5px]" style={{ background: 'var(--color-amber)' }} aria-hidden />
              <div>
                <div className="text-paper text-[14.5px]">Michael Angelo B. Macale</div>
                <div className="mono text-[11px] tracking-[0.16em] uppercase text-paper/55 mt-0.5">
                  President
                </div>
              </div>
            </div>
            <ArrowCta to="/about#leadership" tone="paper">Meet our leadership</ArrowCta>
          </footer>
        </Reveal>
      </div>
    </section>
  );
}
