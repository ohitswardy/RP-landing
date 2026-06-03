import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const ease = [0.25, 1, 0.5, 1] as const;

export default function PageHeader({
  eyebrow, title, italic, dek, bgImage, bgImages, overlayStyle,
}: {
  eyebrow?: string; title: string; italic?: string; dek?: string; bgImage?: string; bgImages?: string[]; overlayStyle?: React.CSSProperties;
}) {
  const slides = bgImages && bgImages.length > 1 ? bgImages : bgImage ? [bgImage] : [];
  const isSlideshow = slides.length > 1;

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!isSlideshow) return;
    const id = setInterval(() => setCurrent(c => (c + 1) % slides.length), 2500);
    return () => clearInterval(id);
  }, [isSlideshow, slides.length]);

  return (
    <section className={`relative text-paper overflow-hidden ${slides.length > 0 ? '' : 'bg-blueprint'}`}>
      {slides.length > 0 && (
        <>
          {isSlideshow ? slides.map((src, i) => (
            <motion.img
              key={src}
              src={src}
              alt=""
              aria-hidden
              animate={{ opacity: i === current ? 1 : 0 }}
              transition={{ duration: 1.4, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{ zIndex: i === current ? 1 : 0 }}
            />
          )) : (
            <img
              src={slides[0]}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ ...( overlayStyle ?? { background: 'linear-gradient(to top, oklch(0.14 0.040 260 / 0.88) 0%, oklch(0.14 0.040 260 / 0.70) 50%, oklch(0.14 0.040 260 / 0.55) 100%)' }), zIndex: 2 }}
          />

        </>
      )}
      {slides.length === 0 && (
        <div
          aria-hidden
          className="absolute -left-40 -top-40 w-[700px] h-[700px] rounded-full pointer-events-none opacity-[0.18]"
          style={{ background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)' }}
        />
      )}
      <div className="container-fluid relative pt-20 md:pt-28 pb-20 md:pb-28" style={{ zIndex: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="eyebrow eyebrow-paper mb-10"
        >
          {eyebrow}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease, delay: 0.05 }}
          className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[1.04] tracking-[-0.028em] max-w-[18ch] font-medium"
        >
          {title}{italic ? <> <span className="text-paper/75">{italic}</span></> : null}
        </motion.h1>
        {dek && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.2 }}
            className="mt-9 max-w-[60ch] text-[17px] leading-[1.6] text-paper/72"
          >
            {dek}
          </motion.p>
        )}
      </div>
    </section>
  );
}
