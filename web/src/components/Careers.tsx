import Reveal from './Reveal';
import ArrowCta from './ArrowCta';
import type { HomeCopy } from '../cms/data';

/**
 * GIC banner1Col: a drenched navy panel with the photograph rising past
 * its top edge, bottom-aligned. Authored in the CMS Landing page module.
 */
export default function Careers({ copy }: { copy: HomeCopy['careers'] }) {
  return (
    <section className="bg-bone">
      <div className="container-fluid py-24 md:py-32">
        <div className="relative bg-navy text-paper lg:mr-[6%]">
          <div className="grid grid-cols-12 gap-x-6 items-end">
            {/* Copy */}
            <Reveal className={`col-span-12 p-9 md:p-14 lg:py-20 ${copy.image ? 'lg:col-span-6' : 'lg:col-span-8'}`}>
              {copy.eyebrow && <div className="eyebrow eyebrow-paper mb-7">{copy.eyebrow}</div>}
              <h2 className="text-[clamp(1.8rem,3.2vw,2.7rem)] leading-[1.08] tracking-[-0.02em] max-w-[16ch]">
                {copy.heading}
              </h2>
              {copy.body && (
                <p className="mt-6 max-w-[46ch] text-paper/68 leading-[1.7] text-[15px]">{copy.body}</p>
              )}
              {copy.cta.label && (
                <div className="mt-10">
                  <ArrowCta to={copy.cta.href || '/contact'} tone="paper">{copy.cta.label}</ArrowCta>
                </div>
              )}
            </Reveal>

            {/* Photo rising out of the panel */}
            {copy.image && (
              <Reveal delay={0.12} className="col-span-12 lg:col-span-5 lg:col-start-8 self-end">
                <div className="relative overflow-hidden aspect-[4/3] lg:aspect-[4/4.5] lg:-mt-16 lg:translate-y-0">
                  <img
                    src={copy.image}
                    alt={copy.imageAlt}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
