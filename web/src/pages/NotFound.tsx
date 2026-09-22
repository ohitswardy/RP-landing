import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import ArrowCta from '../components/ArrowCta';

const EASE = [0.25, 1, 0.5, 1] as const;

const DESTINATIONS = [
  { label: 'Home', desc: 'Back to the front door.', to: '/' },
  { label: 'Our Services', desc: 'Research, sales, trading, corporate access.', to: '/services' },
  { label: 'Our Insights', desc: 'The journal — research worth being early on.', to: '/insights' },
  { label: 'Contact Us', desc: 'Address, numbers, and the enquiry desk.', to: '/contact' },
] as const;

/**
 * The catch-all page. Also rendered inline by pages whose own lookup
 * came back empty (an unpublished insight slug), so it takes an optional
 * heading and never assumes it owns the URL.
 */
export default function NotFound({
  title = 'This page is not on the ledger.',
  detail,
  code = '404',
}: {
  title?: string;
  detail?: string;
  code?: string;
}) {
  const { pathname } = useLocation();

  useEffect(() => {
    const prev = document.title;
    document.title = `${code} — Regis Partners`;
    return () => { document.title = prev; };
  }, [code]);

  return (
    <section className="relative overflow-hidden bg-navy text-paper">
      {/* Blueprint grid + amber glow, the register the public page headers share */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 4%, transparent) 1px, transparent 1px),' +
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />
      <div
        aria-hidden
        className="absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full pointer-events-none opacity-[0.18]"
        style={{ background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)' }}
      />

      <div className="container-fluid relative grid grid-cols-12 gap-x-6 gap-y-14 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="col-span-12 lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="eyebrow eyebrow-paper mb-10"
          >
            Error {code}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.05 }}
            className="max-w-[16ch] text-[clamp(2.5rem,6vw,5.5rem)] font-medium leading-[1.04] tracking-[-0.028em]"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            className="mt-9 max-w-[56ch] text-[17px] leading-[1.6] text-paper/72"
          >
            {detail ?? 'The address may have moved, been retired, or never existed. Nothing here is lost — every public page is one step away.'}
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
            className="mono mt-12 flex flex-wrap items-center gap-x-4 text-[10.5px] uppercase tracking-[0.2em] text-paper/40"
          >
            <span>Requested</span>
            <span className="max-w-full truncate text-paper/65" title={pathname}>{pathname}</span>
          </motion.div>
        </div>

        <motion.nav
          aria-label="Where to go instead"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
          className="col-span-12 lg:col-span-4 lg:col-start-9"
        >
          <ul className="border-t rule-navy">
            {DESTINATIONS.map((d, i) => (
              <li key={d.to} className="border-b rule-navy">
                <Link
                  to={d.to}
                  className="group grid grid-cols-12 items-baseline gap-x-4 py-6 transition-colors duration-500 hover:bg-[color:var(--color-navy-mid)] -mx-4 px-4"
                >
                  <span className="mono num col-span-2 text-[11px] tracking-[0.16em] text-paper/35">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="col-span-9">
                    <span className="block text-[17px] font-medium tracking-[-0.012em] text-paper transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-1">
                      {d.label}
                    </span>
                    <span className="mt-1 block text-[13.5px] text-paper/55">{d.desc}</span>
                  </span>
                  <span className="col-span-1 flex justify-end self-center text-paper/45 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[color:var(--color-amber)]">
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <ArrowCta to="/" tone="paper">Return to the front page</ArrowCta>
          </div>
        </motion.nav>
      </div>
    </section>
  );
}
