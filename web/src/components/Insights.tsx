import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Reveal from './Reveal';

type Card = { k: string; t: string; img: string };

const cards: Card[] = [
  { k: 'The Big Picture',         t: 'How sovereign AI became the new arena for state power.',           img: '/AiBG.jpg' },
  { k: 'Boardroom Intelligence',  t: 'The exit doors are open: liquidity returns to private markets.',   img: '/insight-exit.jpg' },
  { k: 'Sustainability & Culture',t: 'Secondary market surge: how evergreen vehicles are writing PE\'s next chapter.', img: '/insight-meeting.jpg' },
  { k: 'The Big Picture',         t: 'India\'s IPO market: signs point to a strong finish to 2026.',     img: '/insight-presenting.jpg' },
];

export default function Insights() {
  return (
    <section className="bg-paper text-ink">
      <div className="container-fluid py-24 md:py-32">
        <div className="flex items-end justify-between gap-6 mb-12 md:mb-16">
          <Reveal>
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-[-0.025em]">
              Research that moves markets.
            </h2>
          </Reveal>
          <Reveal>
            <Link
              to="/insights"
              className="hidden md:inline-flex items-center gap-2 mono text-[11px] tracking-[0.16em] uppercase text-slate hover:text-[color:var(--color-amber-deep)]"
            >
              All insights <span>↗</span>
            </Link>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {cards.map((c, i) => (
            <motion.article
              key={c.t}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.25, 1, 0.5, 1] }}
              className="group"
            >
              <Link to="/insights" className="block">
                <div className="aspect-[4/3] overflow-hidden bg-bone">
                  <div className="w-full h-full transition-transform duration-700 group-hover:scale-[1.03]">
                    <img src={c.img} alt={c.t} className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="eyebrow mt-6 mb-3">{c.k}</div>
                <h3 className="text-[17px] md:text-[18px] leading-[1.3] tracking-[-0.012em] text-ink group-hover:text-[color:var(--color-amber-deep)] transition-colors max-w-[28ch]">
                  {c.t}
                </h3>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
