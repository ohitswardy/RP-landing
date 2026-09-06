import Reveal from './Reveal';
import ArrowCta from './ArrowCta';
import type { HomeCopy } from '../cms/data';

/** The President's word over the portrait. Authored in the CMS Landing page module. */
export default function LeadershipQuote({ copy }: { copy: HomeCopy['quote'] }) {
  const signature = Boolean(copy.name || copy.role);

  return (
    <section className="relative bg-navy-deep text-paper overflow-hidden">
      {/* Portrait — right-anchored, fading into navy on the left */}
      <div aria-hidden className="absolute inset-0">
        {copy.image && (
          <img
            src={copy.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-right"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/85 via-navy-deep/55 to-navy-deep/10" />
      </div>

      <div className="container-fluid relative py-24 md:py-36">
        {copy.eyebrow && (
          <Reveal>
            <div className="eyebrow eyebrow-paper mb-10">{copy.eyebrow}</div>
          </Reveal>
        )}
        <Reveal delay={0.08}>
          <blockquote className="text-[clamp(1.6rem,3vw,2.6rem)] leading-[1.15] tracking-[-0.024em] font-medium max-w-[38ch] text-paper">
            “{copy.quote}”
          </blockquote>
        </Reveal>
        {(signature || copy.cta.label) && (
          <Reveal delay={0.16}>
            <footer className="mt-12 flex flex-wrap items-center gap-x-14 gap-y-8">
              {signature && (
                <div className="flex items-center gap-4">
                  <span className="block w-6 h-[1.5px]" style={{ background: 'var(--color-amber)' }} aria-hidden />
                  <div>
                    {copy.name && <div className="text-paper text-[14.5px]">{copy.name}</div>}
                    {copy.role && (
                      <div className="mono text-[11px] tracking-[0.16em] uppercase text-paper/55 mt-0.5">
                        {copy.role}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {copy.cta.label && (
                <ArrowCta to={copy.cta.href || '/about'} tone="paper">{copy.cta.label}</ArrowCta>
              )}
            </footer>
          </Reveal>
        )}
      </div>
    </section>
  );
}
