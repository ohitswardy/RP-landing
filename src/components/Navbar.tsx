import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.25, 1, 0.5, 1] as const;

// ─── Menu content ───────────────────────────────────────────────────────────

type MenuLink = { label: string; desc?: string; href: string };
type MenuColumn = { heading: string; links: MenuLink[] };
type MenuDef = {
  feature: { href: string; image: string };
  columns: MenuColumn[];
};

const MENUS: Record<string, MenuDef> = {
  services: {
    feature: { href: '/services', image: '/Services Hero.png' },
    columns: [
      {
        heading: 'What We Do',
        links: [
          { label: 'Research Advisory',    desc: 'Original equity research across 120+ PSE names.',      href: '/services/research' },
          { label: 'Sales Advisory',       desc: 'High-touch institutional sales and idea generation.',  href: '/services/sales' },
          { label: 'Trading & Execution',  desc: 'Block, agency, and algorithmic execution on the PSE.', href: '/services/trading' },
          { label: 'Corporate Access',     desc: 'Conferences, NDRs, and C-suite engagement.',           href: '/services/corporate' },
          { label: 'Capital Markets',      desc: 'Equity issuance, follow-ons, and placements.',         href: '/services' },
          { label: 'Advisory',             desc: 'Strategic and corporate finance counsel.',              href: '/services' },
        ],
      },
    ],
  },
  insights: {
    feature: { href: '/insights', image: '/InsightsBG.png' },
    columns: [
      {
        heading: 'Insights',
        links: [
          { label: 'All Research',          desc: 'Full archive of published work.',                href: '/insights' },
          { label: 'Client Login',          desc: 'Access the full research portal.',               href: '/login' },
        ],
      },
    ],
  },
  about: {
    feature: { href: '/about', image: '/lobby.jpg' },
    columns: [
      {
        heading: 'About',
        links: [
          { label: 'Our Heritage',          desc: 'Founded 1999. Twenty-five years of milestones.',   href: '/about#heritage' },
          { label: 'Leadership',            desc: 'Senior partners who run the desk.',                href: '/about#leadership' },
          { label: 'Awards & Rankings',     desc: 'Asiamoney, II, and FinanceAsia recognition.',     href: '/about#awards' },
        ],
      },
    ],
  },
  contact: {
    feature: { href: '/contact', image: '/sunray.jpg' },
    columns: [
      {
        heading: 'Get in Touch',
        links: [
          { label: 'Send an Enquiry',       desc: 'Qualified institutional inquiries welcome.',      href: '/contact#enquiry' },
          { label: 'Our Offices',           desc: 'Makati HQ and regional locations.',               href: '/contact#offices' },
          { label: 'Compliance & KYC',      desc: 'Regulatory and compliance contact.',              href: '/contact#compliance' },
        ],
      },
    ],
  },
};

const NAV = [
  { label: 'Our Services',       key: 'services', href: '/services' },
  { label: 'Our Insights',       key: 'insights', href: '/insights' },
  { label: 'About',              key: 'about',    href: '/about'    },
  { label: 'Contact Us', key: 'contact',  href: '/contact'  },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

export default function Navbar() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [menuLeft, setMenuLeft] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const headerRef = useRef<HTMLElement | null>(null);
  const pointerIsTouch = useRef(false);
  const loc = useLocation();

  useEffect(() => { setOpen(null); setMobileOpen(false); }, [loc.pathname]);

  // Close mega menu when tapping outside on touch devices
  useEffect(() => {
    if (!open) return;
    const handleTouchOutside = (e: TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener('touchstart', handleTouchOutside, { passive: true });
    return () => document.removeEventListener('touchstart', handleTouchOutside);
  }, [open]);

  const scheduleClose = () => {
    // Skip hover-close when the last interaction was a touch — click-outside handles it
    if (pointerIsTouch.current) return;
    closeTimer.current = setTimeout(() => setOpen(null), 150);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <header id="site-navbar" ref={headerRef} className="sticky top-9 z-40" style={{ background: '#ffffff' }} onPointerDown={(e) => { pointerIsTouch.current = e.pointerType === 'touch'; }} onMouseLeave={scheduleClose}>
      {/* ── Main bar ── */}
      <div className="border-b rule">
        <div className="container-fluid flex items-center justify-between h-16">
          <Link to="/" className="flex items-center shrink-0" onClick={() => setOpen(null)}>
            <img src="/Banner.png" alt="Regis Partners" style={{ height: '56px', width: 'auto' }} draggable={false} />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center">
            {NAV.map((n) => {
              const isActive = open === n.key;
              const openMenu = () => {
                cancelClose();
                const el = navItemRefs.current[n.key];
                if (el) {
                  const rect = el.getBoundingClientRect();
                  const center = rect.left + rect.width / 2;
                  const menuWidth = window.innerWidth * 0.4;
                  setMenuLeft(Math.max(0, Math.min(center - menuWidth / 2, window.innerWidth - menuWidth)));
                }
                setOpen(n.key);
              };
              return (
                <div
                  key={n.key}
                  ref={(el) => { navItemRefs.current[n.key] = el; }}
                  className="relative flex items-center h-16"
                  onMouseEnter={openMenu}
                >
                  {/* Label — always navigates on click */}
                  <Link
                    to={n.href}
                    onClick={() => setOpen(null)}
                    className="flex items-center pl-4 h-full text-[13.5px] tracking-[-0.005em] transition-colors"
                    style={{ color: isActive ? 'var(--color-ink)' : 'var(--color-slate)' }}
                  >
                    {n.label}
                  </Link>
                  {/* Chevron — separate button so touch can toggle menu without navigating */}
                  <button
                    onClick={() => { if (open === n.key) setOpen(null); else openMenu(); }}
                    aria-label={`${isActive ? 'Close' : 'Open'} ${n.label} menu`}
                    className="flex items-center justify-center h-full px-4 pl-2"
                    style={{ color: isActive ? 'var(--color-amber)' : 'var(--color-slate)' }}
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none"
                      className="transition-transform duration-250"
                      style={{ transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {/* Amber underline */}
                  <motion.span
                    className="absolute bottom-0 left-4 right-4 h-[2px]"
                    style={{ background: 'var(--color-amber)', transformOrigin: 'left' }}
                    animate={{ scaleX: isActive ? 1 : 0 }}
                    transition={{ duration: 0.28, ease }}
                  />
                </div>
              );
            })}
          </nav>

          {/* Right cluster */}
          <div className="hidden md:flex items-center gap-5">
            <button className="text-slate hover:text-ink transition-colors" aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <span className="h-4 w-px bg-ink/15" />
            <Link to="/login" className="mono text-[11px] tracking-[0.18em] uppercase text-slate hover:text-ink transition-colors">
              Client Login
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            aria-label="Menu"
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
          >
            <span className={`block h-px w-5 bg-ink transition-transform duration-300 ${mobileOpen ? 'translate-y-[3px] rotate-45' : ''}`} />
            <span className={`block h-px w-5 bg-ink transition-transform duration-300 ${mobileOpen ? '-translate-y-[3px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Mega menu panel ── */}
      <AnimatePresence>
        {open && MENUS[open] && (
          <motion.div
            key={open}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease }}
            onMouseEnter={cancelClose}
            className="hidden md:block absolute shadow-2xl w-[40%]"
            style={{
              left: menuLeft,
              background: '#ffffff',
              borderBottom: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)',
            }}
          >
            <div className="container-fluid">
              <div className="grid grid-cols-12">

                {/* Left: feature panel — hero image */}
                <Link
                  to={MENUS[open].feature.href}
                  onClick={() => setOpen(null)}
                  className="group/feat col-span-4 relative overflow-hidden block min-h-[340px]"
                  style={{ background: 'var(--color-navy)' }}
                >
                  <img
                    src={MENUS[open].feature.image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-[1100ms] ease-out group-hover/feat:scale-[1.05]"
                    draggable={false}
                  />
                  {/* Navy gradient overlay for brand cohesion */}
                  <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
                    background: 'linear-gradient(to top right, oklch(0.14 0.040 260 / 0.62) 0%, oklch(0.14 0.040 260 / 0.20) 55%, oklch(0.14 0.040 260 / 0.34) 100%)',
                  }} />
                  {/* Amber accent line at base */}
                  <div aria-hidden className="absolute bottom-0 left-0 right-0 h-[2px]" style={{
                    background: 'linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-deep) 50%, transparent 100%)',
                  }} />
                </Link>

                {/* Right: link columns */}
                <div
                  className="col-span-8 flex flex-col py-9 px-10"
                >
                  <div
                    className="flex-1 grid gap-x-10"
                    style={{ gridTemplateColumns: `repeat(${MENUS[open].columns.length}, 1fr)` }}
                  >
                    {MENUS[open].columns.map((col) => (
                      <div key={col.heading}>
                        <div
                          className="mono text-[10px] tracking-[0.2em] uppercase pb-3 mb-3 border-b"
                          style={{ color: 'var(--color-graphite)', borderColor: 'color-mix(in oklab, var(--color-ink) 10%, transparent)' }}
                        >
                          {col.heading}
                        </div>
                        <ul className="space-y-0.5">
                          {col.links.map((lnk) => (
                            <li key={lnk.label}>
                              <Link
                                to={lnk.href}
                                onClick={() => setOpen(null)}
                                className="group/lnk block py-2.5 rounded-sm transition-colors duration-150 hover:bg-bone px-2 -mx-2"
                              >
                                <span className="flex items-center gap-2 text-[13.5px] tracking-[-0.005em] text-ink">
                                  {lnk.label}
                                  <span
                                    className="block h-px w-0 group-hover/lnk:w-4 transition-all duration-300"
                                    style={{ background: 'var(--color-amber)' }}
                                  />
                                </span>
                                {lnk.desc && (
                                  <span className="block text-[12px] leading-snug mt-0.5" style={{ color: 'var(--color-graphite)' }}>
                                    {lnk.desc}
                                  </span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between pt-6 mt-4 border-t" style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 8%, transparent)' }}>
                    <span className="mono text-[10px] tracking-[0.16em] uppercase" style={{ color: 'var(--color-silver)' }}>
                      Regis Partners · Est. 1999 · Makati
                    </span>
                    <Link
                      to={MENUS[open].feature.href}
                      onClick={() => setOpen(null)}
                      className="mono text-[10px] tracking-[0.16em] uppercase transition-colors duration-150"
                      style={{ color: 'var(--color-graphite)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-amber)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-graphite)')}
                    >
                      View all →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Amber conviction line at the bottom */}
            <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-deep) 55%, transparent 100%)' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="md:hidden overflow-hidden border-t rule" style={{ background: '#ffffff' }}
          >
            <div className="container-fluid py-4 flex flex-col">
              {NAV.map((n) => (
                <div key={n.key} className="border-b rule">
                  <div className="w-full flex items-center justify-between py-4">
                    <Link
                      to={n.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 text-left text-lg tracking-[-0.02em] text-ink"
                    >
                      {n.label}
                    </Link>
                    <button
                      onClick={() => setMobileExpanded(mobileExpanded === n.key ? null : n.key)}
                      aria-label={`Expand ${n.label}`}
                      className="p-2 -mr-2"
                    >
                      <svg width="12" height="12" viewBox="0 0 10 10" fill="none"
                        className="transition-transform duration-200"
                        style={{ transform: mobileExpanded === n.key ? 'rotate(180deg)' : 'none' }}>
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <AnimatePresence>
                    {mobileExpanded === n.key && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.22, ease }}
                        className="overflow-hidden"
                      >
                        <div className="pb-4 space-y-0.5">
                          {MENUS[n.key]?.columns.flatMap(col =>
                            col.links.map(lnk => ({ ...lnk, _col: col.heading }))
                          ).map((lnk) => (
                            <Link
                              key={lnk.label}
                              to={lnk.href}
                              onClick={() => setMobileOpen(false)}
                              className="flex items-center justify-between px-3 py-2.5 text-[15px] text-slate hover:text-ink hover:bg-bone rounded transition-colors duration-150"
                            >
                              {lnk.label}
                              <span className="mono text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--color-silver)' }}>
                                {lnk._col}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              <div className="py-5">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="mono text-[11px] tracking-[0.18em] uppercase text-slate">
                  Client Login
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
