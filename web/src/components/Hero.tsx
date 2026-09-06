import { useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { headlineLines, type HomeCopy } from '../cms/data';

const ease = [0.25, 1, 0.5, 1] as const;

/** The full-height opener. Copy and photo are authored in the CMS Landing page module. */
export default function Hero({ copy }: { copy: HomeCopy['hero'] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const lines = headlineLines(copy.headline);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ribbon = document.getElementById('market-ribbon');
    const navbar = document.getElementById('site-navbar');

    const updateHeight = () => {
      const headerHeight = (ribbon?.offsetHeight ?? 0) + (navbar?.offsetHeight ?? 0);
      section.style.minHeight = `calc(100dvh - ${headerHeight}px)`;
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    if (ribbon) observer.observe(ribbon);
    if (navbar) observer.observe(navbar);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`relative text-paper overflow-hidden min-h-[calc(100dvh-101px)] flex flex-col ${copy.image ? 'bg-navy' : 'bg-blueprint'}`}
    >
      {/* Photo backdrop */}
      <div aria-hidden className="absolute inset-0">
        {copy.image && (
          <img
            src={copy.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, oklch(0.14 0.040 260 / 0.94) 0%, oklch(0.14 0.040 260 / 0.76) 55%, oklch(0.14 0.040 260 / 0.50) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-72"
          style={{
            background: 'linear-gradient(to top, oklch(0.10 0.036 260 / 0.95) 0%, transparent 100%)',
          }}
        />
        <div
          className="absolute -left-40 -bottom-40 w-[700px] h-[700px] rounded-full opacity-[0.13]"
          style={{ background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative container-fluid flex-1 flex flex-col justify-center pb-16 md:pb-24">
        {/* Eyebrow */}
        {copy.eyebrow && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="eyebrow eyebrow-paper mb-10"
          >
            {copy.eyebrow}
          </motion.div>
        )}

        {/* Headline — per-line mask reveal */}
        <h1 className="text-[clamp(2.4rem,6vw,5.5rem)] leading-[1.02] tracking-[-0.028em] font-medium max-w-[18ch]">
          {lines.map((line, i) => (
            <span key={`${i}-${line}`} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <motion.span
                className="block"
                initial={{ y: '112%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.95, ease, delay: 0.08 + i * 0.11 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        {/* Deck */}
        {copy.dek && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.5 }}
            className="mt-9 max-w-[54ch] text-[16.5px] leading-[1.65] text-paper/72"
          >
            {copy.dek}
          </motion.p>
        )}
      </div>
    </section>
  );
}
