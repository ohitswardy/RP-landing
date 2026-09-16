import { useCallback, useState, type CSSProperties } from 'react';
import Reveal from './Reveal';
import ArrowCta from './ArrowCta';
import type { HomeCopy } from '../cms/data';

/** The President's word over the portrait. Authored in the CMS Landing page module. */
export default function LeadershipQuote({ copy }: { copy: HomeCopy['quote'] }) {
  const signature = Boolean(copy.name || copy.role);

  // Whatever the CMS uploads, the band sizes itself from the file's own dimensions:
  // on mobile the portrait sits in flow at its natural aspect (never cropped), and on
  // desktop it goes full-bleed behind the copy with the band's height derived from the
  // same ratio — clamped so an extreme portrait or panorama still reads as a band.
  const [aspect, setAspect] = useState(0);
  const measure = useCallback((img: HTMLImageElement | null) => {
    if (img?.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
  }, []);

  return (
    <section
      className="relative bg-navy-deep text-paper overflow-hidden md:flex md:items-center md:min-h-[clamp(26rem,var(--quote-media,32rem),92vh)]"
      style={aspect ? ({ '--quote-media': `${(100 / aspect).toFixed(3)}vw` } as CSSProperties) : undefined}
    >
      {/* Portrait — in flow on mobile, right-anchored full-bleed from md up */}
      {copy.image && (
        <div aria-hidden className="relative md:absolute md:inset-0">
          <img
            key={copy.image}
            ref={measure}
            onLoad={(e) => measure(e.currentTarget)}
            src={copy.image}
            alt=""
            style={aspect ? { aspectRatio: aspect } : undefined}
            className="block w-full h-auto md:absolute md:inset-0 md:h-full md:aspect-auto md:object-cover md:object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/10 via-navy-deep/35 to-navy-deep md:bg-gradient-to-r md:from-navy-deep/85 md:via-navy-deep/55 md:to-navy-deep/10" />
        </div>
      )}

      <div className="container-fluid relative w-full py-16 md:py-36">
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
