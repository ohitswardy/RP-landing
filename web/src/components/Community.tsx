import { motion } from 'framer-motion';
import ArrowCta from './ArrowCta';
import type { HomeCopy } from '../cms/data';

const ease = [0.25, 1, 0.5, 1] as const;

/**
 * Mirror of the Culture panel: photograph bleeding left, bronze block
 * riding over its right edge (the GIC rightBox move). Authored in the
 * CMS Landing page module.
 */
export default function Community({ copy }: { copy: HomeCopy['community'] }) {
  return (
    <section className="bg-paper">
      <div className="container-fluid pt-4 md:pt-5 pb-24 md:pb-32">
        <div className="relative">
          {/* Photograph */}
          <motion.div
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            whileInView={{ clipPath: 'inset(0 0 0% 0)' }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.1, ease }}
            className="relative overflow-hidden bg-bone lg:mr-[28%] aspect-[4/3] lg:aspect-[16/9]"
          >
            {copy.image && (
              <img
                src={copy.image}
                alt={copy.imageAlt}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            )}
          </motion.div>

          {/* Bronze block, offset over the photo's right edge */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.9, ease, delay: 0.2 }}
            className="relative -mt-16 mx-4 lg:mx-0 lg:mt-0 lg:absolute lg:inset-y-14 lg:right-0 lg:w-[42%] bg-bronze text-paper p-9 md:p-12 lg:p-14 flex flex-col justify-center"
          >
            {copy.eyebrow && <div className="eyebrow eyebrow-paper mb-7">{copy.eyebrow}</div>}
            <h2 className="text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.12] tracking-[-0.02em] max-w-[20ch]">
              {copy.heading}
            </h2>
            {copy.body && (
              <p className="mt-6 max-w-[42ch] text-paper/75 leading-[1.65] text-[14.5px]">{copy.body}</p>
            )}
            {copy.cta.label && (
              <div className="mt-9">
                <ArrowCta to={copy.cta.href || '/about'} tone="paper">{copy.cta.label}</ArrowCta>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
