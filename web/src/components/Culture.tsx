import { motion } from 'framer-motion';
import ArrowCta from './ArrowCta';

const ease = [0.25, 1, 0.5, 1] as const;

/**
 * GIC-style offset panel: full-bleed photograph with a drenched navy
 * block riding over its left edge.
 */
export default function Culture() {
  return (
    <section className="bg-paper">
      <div className="container-fluid pt-24 md:pt-32 pb-4 md:pb-5">
        <div className="relative">
          {/* Photograph */}
          <motion.div
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            whileInView={{ clipPath: 'inset(0 0 0% 0)' }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.1, ease }}
            className="relative overflow-hidden lg:ml-[28%] aspect-[4/3] lg:aspect-[16/9]"
          >
            <img
              src="/StockWork.png"
              alt="The Regis trading floor during market hours"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          </motion.div>

          {/* Navy block, offset over the photo's left edge */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.9, ease, delay: 0.2 }}
            className="relative -mt-16 mx-4 lg:mx-0 lg:mt-0 lg:absolute lg:inset-y-14 lg:left-0 lg:w-[42%] bg-navy-deep text-paper p-9 md:p-12 lg:p-14 flex flex-col justify-center"
          >
            <div className="eyebrow eyebrow-paper mb-7">Our story</div>
            <h2 className="text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.12] tracking-[-0.02em] max-w-[20ch]">
              From a Makati desk to the house global allocators call first.
            </h2>
            <div className="mt-9">
              <ArrowCta to="/about" tone="paper">Get to know us better</ArrowCta>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
