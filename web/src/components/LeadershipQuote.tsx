import { useEffect, useRef, useState } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import { gsap } from 'gsap';
import Reveal from './Reveal';

const QUOTE =
  '"In a year defined by complexity and change, we believe it is essential to reflect on the principles that define us. At Regis, we prioritize clients, people, and insight, always."';

// Scroll-progress window (of the pinned section) over which the quote types out.
// The lead-in before TYPE_START lets the pinned section settle in view first;
// the hold after TYPE_END keeps the finished quote on screen before releasing.
const TYPE_START = 0.25;
const TYPE_END = 0.8;

/**
 * Types the text while the section is pinned and backspaces it on scroll up.
 * Character count is driven directly by scroll progress, so it's fully reversible.
 */
function ScrollTypeQuote({ targetRef }: { targetRef: React.RefObject<HTMLElement | null> }) {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const [charCount, setCharCount] = useState(0);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', progress => {
    const typed = (progress - TYPE_START) / (TYPE_END - TYPE_START);
    const clamped = Math.min(1, Math.max(0, typed));
    setCharCount(Math.round(clamped * QUOTE.length));
  });

  useEffect(() => {
    if (!cursorRef.current) return;
    gsap.set(cursorRef.current, { opacity: 1 });
    const tween = gsap.to(cursorRef.current, {
      opacity: 0,
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: 'power2.inOut',
    });
    return () => {
      tween.kill();
    };
  }, []);

  const isTyping = charCount > 0 && charCount < QUOTE.length;

  return (
    <blockquote className="text-[clamp(1.6rem,3vw,2.6rem)] leading-[1.02] tracking-[-0.028em] font-medium max-w-[44ch] text-paper whitespace-pre-wrap">
      <span>{QUOTE.slice(0, charCount)}</span>
      <span
        ref={cursorRef}
        aria-hidden
        className={`ml-1 inline-block opacity-100 ${isTyping ? 'hidden' : ''}`}
      >
        |
      </span>
    </blockquote>
  );
}

export default function LeadershipQuote() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section ref={sectionRef} className="relative bg-navy-deep text-paper h-[220vh]">
      {/* Sticky viewport — stays pinned while the quote types, then releases */}
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
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

        <div className="container-fluid relative w-full">
          <ScrollTypeQuote targetRef={sectionRef} />
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
      </div>
    </section>
  );
}
