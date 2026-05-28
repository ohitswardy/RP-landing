import { Link } from 'react-router-dom';
import Reveal from './Reveal';
import { motion } from 'framer-motion';

const services = [
  { t: 'Research Advisory',   d: 'Original equity research across 120+ PSE names',     to: '/services/research' },
  { t: 'Sales Advisory',      d: 'High-touch institutional sales and idea generation', to: '/services/sales' },
  { t: 'Trading & Execution', d: 'Block, agency, and algorithmic execution on the PSE',to: '/services/trading' },
  { t: 'Corporate Access',    d: 'Conferences, NDRs, and C-suite engagement',          to: '/services/corporate' },
  { t: 'Capital Markets',     d: 'Equity issuance, follow-ons, and placements',        to: '/services' },
  { t: 'Advisory',            d: 'Strategic and corporate finance counsel',            to: '/services' },
];

export default function Services() {
  return (
    <section className="bg-navy text-paper">
      <div className="container-fluid py-24 md:py-32">
        <div className="grid grid-cols-12 gap-x-6 gap-y-12 items-start">
          <Reveal className="col-span-12 lg:col-span-5">
            <div className="relative overflow-hidden rounded-sm h-full min-h-[420px] lg:min-h-[520px]">
              <img
                src="/Skyline.jpg"
                alt="Philippine skyline at night"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              {/* Dark navy gradient overlay */}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, oklch(0.14 0.040 260 / 0.92) 0%, oklch(0.14 0.040 260 / 0.55) 55%, oklch(0.14 0.040 260 / 0.30) 100%)' }}
              />
              {/* Text anchored to bottom */}
              <div className="absolute inset-x-0 bottom-0 p-8 md:p-10">
                <h2 className="text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.05] tracking-[-0.025em] max-w-[16ch]">
                  Deep expertise across the Philippine capital markets.
                </h2>
              </div>
            </div>
          </Reveal>

          <div className="col-span-12 lg:col-span-7">
            <ul className="border-t rule-navy">
              {services.map((s, i) => (
                <motion.li
                  key={s.t}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: [0.25, 1, 0.5, 1] }}
                  className="group border-b rule-navy"
                >
                  <Link
                    to={s.to}
                    className="grid grid-cols-12 items-baseline gap-x-4 py-6 md:py-7 transition-colors hover:bg-[color:var(--color-navy-mid)] -mx-4 px-4"
                  >
                    <div className="col-span-1 mono text-[11px] tracking-[0.16em] uppercase text-paper/40">
                      0{i + 1}
                    </div>
                    <div className="col-span-7 md:col-span-5">
                      <div className="text-[18px] md:text-[19px] font-medium tracking-[-0.012em] text-paper">{s.t}</div>
                    </div>
                    <div className="hidden md:block col-span-5 text-paper/60 text-[14.5px]">{s.d}</div>
                    <div className="col-span-4 md:col-span-1 flex justify-end">
                      <span
                        className="text-paper/50 group-hover:text-[color:var(--color-amber)] transition-all duration-500 group-hover:translate-x-1"
                      >
                        ↗
                      </span>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
