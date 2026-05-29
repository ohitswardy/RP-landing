import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.25, 1, 0.5, 1] as const;

// ─── Inline SVG feature visuals ────────────────────────────────────────────

function VisualServices() {
  return (
    <svg viewBox="0 0 300 160" fill="none" className="w-full h-full">
      {([
        [20, 120], [68, 90], [116, 105], [164, 65], [212, 80], [260, 45],
      ] as [number, number][]).map(([x, top], i) => (
        <rect key={i} x={x} y={top} width={30} height={160 - top}
          fill="var(--color-paper)" fillOpacity={0.06 + i * 0.025} />
      ))}
      {([
        [20, 120], [68, 90], [116, 105], [164, 65], [212, 80], [260, 45],
      ] as [number, number][]).map(([x, top], i) => (
        <rect key={`t-${i}`} x={x} y={top} width={30} height={3}
          fill="var(--color-amber)" fillOpacity={i === 5 ? 0.9 : 0.35} />
      ))}
      <line x1="0" y1="158" x2="300" y2="158" stroke="var(--color-amber)" strokeWidth="1" strokeOpacity="0.5" />
    </svg>
  );
}

function VisualInsights() {
  const points = [300, 260, 280, 220, 240, 190, 200, 170, 160, 150, 120, 130, 80, 110, 40, 95];
  const poly = points.map((v, i) => (i % 2 === 0 ? `${v},` : `${v} `)).join('').trim();
  return (
    <svg viewBox="0 0 300 160" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1="0" y1={30 + i * 30} x2="300" y2={30 + i * 30}
          stroke="var(--color-paper)" strokeOpacity="0.05" />
      ))}
      <polyline points={poly} stroke="var(--color-amber)" strokeWidth="1.5" fill="url(#chartFill)" />
      {points.filter((_, i) => i % 2 === 0).map((x, i) => (
        <circle key={i} cx={x} cy={points[i * 2 + 1]} r={i === 7 ? 3.5 : 2}
          fill={i === 7 ? 'var(--color-amber)' : 'var(--color-paper)'} fillOpacity={0.6} />
      ))}
    </svg>
  );
}

function VisualAbout() {
  const years = [1999, 2004, 2009, 2014, 2019, 2026];
  return (
    <svg viewBox="0 0 300 160" fill="none" className="w-full h-full">
      <line x1="20" y1="80" x2="280" y2="80" stroke="var(--color-paper)" strokeOpacity="0.12" />
      {years.map((y, i) => {
        const x = 20 + i * 52;
        const isLast = i === years.length - 1;
        return (
          <g key={y}>
            <circle cx={x} cy={80} r={isLast ? 6 : 3.5}
              fill={isLast ? 'var(--color-amber)' : 'var(--color-paper)'}
              fillOpacity={isLast ? 1 : 0.55} />
            {isLast && <circle cx={x} cy={80} r={11} stroke="var(--color-amber)" strokeOpacity="0.25" strokeWidth="1" fill="none" />}
            <text x={x} y={104} textAnchor="middle"
              fill={isLast ? 'var(--color-amber)' : 'var(--color-paper)'}
              fillOpacity={isLast ? 0.8 : 0.3}
              fontFamily="var(--font-mono)" fontSize="8">
              {y}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function VisualContact() {
  const buildings: [number, number, number][] = [
    [20, 60, 28], [56, 40, 22], [86, 75, 32], [126, 35, 24],
    [158, 55, 20], [186, 28, 26], [220, 65, 30], [258, 45, 22],
  ];
  return (
    <svg viewBox="0 0 300 160" fill="none" className="w-full h-full">
      {buildings.map(([x, top, w], i) => (
        <g key={i}>
          <rect x={x} y={top} width={w} height={160 - top}
            fill="var(--color-paper)" fillOpacity={0.05 + (i % 3) * 0.03} />
          {Array.from({ length: Math.floor((160 - top) / 18) }).map((_, r) =>
            Array.from({ length: Math.floor(w / 9) }).map((_, c) => (
              <rect key={`w-${r}-${c}`}
                x={x + 4 + c * 9} y={top + 6 + r * 18} width={4} height={6}
                fill="var(--color-paper)" fillOpacity={(r + c) % 3 === 0 ? 0.18 : 0.04} />
            ))
          )}
        </g>
      ))}
      <line x1="0" y1="158" x2="300" y2="158" stroke="var(--color-amber)" strokeWidth="1" strokeOpacity="0.5" />
    </svg>
  );
}

// ─── Menu content ───────────────────────────────────────────────────────────

type MenuLink = { label: string; desc?: string; href: string };
type MenuColumn = { heading: string; links: MenuLink[] };
type MenuDef = {
  feature: { headline: string; sub: string; cta: string; href: string; visual: JSX.Element };
  columns: MenuColumn[];
};

const MENUS: Record<string, MenuDef> = {
  services: {
    feature: {
      headline: 'Four practices,\none mandate.',
      sub: 'Each practice run by senior partners with two decades of specialisation.',
      cta: 'View all practices',
      href: '/services',
      visual: <VisualServices />,
    },
    columns: [
      {
        heading: 'Research',
        links: [
          { label: 'Research Advisory',    desc: 'Single-name coverage across 120+ PSE names.',    href: '/services/research' },
          { label: 'Sector Deep-Dives',    desc: 'Banks, property, consumer, power, TMT.',         href: '/services/research' },
          { label: 'Macro & Strategy',     desc: 'BSP, FX, fiscal — translated into positioning.', href: '/services/research' },
          { label: 'Bespoke Mandates',     desc: 'Confidential commissioned research.',            href: '/services/research' },
        ],
      },
      {
        heading: 'Markets',
        links: [
          { label: 'Sales Advisory',       desc: 'High-touch institutional dealing desk.',         href: '/services/sales' },
          { label: 'Trading & Execution',  desc: 'Block, agency, and program on the PSE.',        href: '/services/trading' },
          { label: 'Algos & Program',      desc: 'VWAP, TWAP, IS trajectories.',                  href: '/services/trading' },
          { label: 'Cross-Border',         desc: 'DvP, omnibus, and segregated custody.',          href: '/services/trading' },
        ],
      },
      {
        heading: 'Access',
        links: [
          { label: 'Corporate Access',     desc: 'Conferences, NDRs, site visits.',               href: '/services/corporate' },
          { label: 'Manila Conference',    desc: '60+ issuers. 200+ investors annually.',         href: '/services/corporate' },
          { label: 'C-Suite NDRs',         desc: 'Asia, US, and Europe roadshows.',               href: '/services/corporate' },
          { label: 'Thematic Days',        desc: 'Banks, infra, ESG-themed calendars.',           href: '/services/corporate' },
        ],
      },
    ],
  },
  insights: {
    feature: {
      headline: 'Research worth\nbeing early on.',
      sub: 'Original, conviction-led work from the Regis desk. Full archive for institutional clients.',
      cta: 'Browse all insights',
      href: '/insights',
      visual: <VisualInsights />,
    },
    columns: [
      {
        heading: 'Latest',
        links: [
          { label: 'Beyond the rate cycle',  desc: 'Philippine consumption as the durable trade.', href: '/insights' },
          { label: 'NIMs have peaked',       desc: 'What survives the compression.',               href: '/insights' },
          { label: "BSP's quiet pivot",      desc: 'Five charts on the policy shift.',             href: '/insights' },
          { label: 'Office vacancy bottoms', desc: 'Why the next leg is selective.',               href: '/insights' },
        ],
      },
      {
        heading: 'Sectors',
        links: [
          { label: 'Macro & Strategy',       href: '/insights' },
          { label: 'Philippine Banks',       href: '/insights' },
          { label: 'Property & Infrastructure', href: '/insights' },
          { label: 'Consumer & Retail',      href: '/insights' },
          { label: 'Power & Utilities',      href: '/insights' },
        ],
      },
      {
        heading: 'Client Access',
        links: [
          { label: 'Research Portal',        desc: 'Full archive for institutional clients.', href: '/login' },
          { label: 'Morning Call Replays',   desc: 'Daily briefings on demand.',             href: '/login' },
          { label: 'Client Login',           href: '/login' },
        ],
      },
    ],
  },
  about: {
    feature: {
      headline: 'Twenty-five years,\nno shortcuts.',
      sub: 'Independent. Partner-led. Built in Makati for the long term.',
      cta: 'Read our story',
      href: '/about',
      visual: <VisualAbout />,
    },
    columns: [
      {
        heading: 'The Firm',
        links: [
          { label: 'Overview',              desc: 'Founded 1999. PSE member firm.',              href: '/about' },
          { label: 'Heritage & Timeline',   desc: 'Twenty-five years of milestones.',            href: '/about' },
          { label: 'Awards & Rankings',     desc: 'Asiamoney, II, FinanceAsia recognition.',    href: '/about' },
        ],
      },
      {
        heading: 'People',
        links: [
          { label: 'Leadership',            desc: 'Senior partners who run the desk.',           href: '/about' },
          { label: 'Research Team',         href: '/about' },
          { label: 'Sales & Trading',       href: '/about' },
          { label: 'Careers',               href: '/contact' },
        ],
      },
    ],
  },
  contact: {
    feature: {
      headline: 'Makati.\nSingapore.\nHong Kong.',
      sub: 'Get in touch with the team that knows the Philippine market.',
      cta: 'Contact us',
      href: '/contact',
      visual: <VisualContact />,
    },
    columns: [
      {
        heading: 'Engage',
        links: [
          { label: 'Request a Meeting',     desc: 'Set up a call or bespoke roadshow.',          href: '/contact' },
          { label: 'Investor Relations',    desc: 'For equity issuers and IR teams.',            href: '/contact' },
          { label: 'Research Enquiries',    desc: 'Commission bespoke research mandates.',       href: '/contact' },
        ],
      },
      {
        heading: 'Compliance',
        links: [
          { label: 'Research Portal Login', href: '/login' },
          { label: 'Regulatory Disclosures', href: '/contact' },
          { label: 'Legal & Compliance',    href: '/contact' },
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loc = useLocation();

  useEffect(() => { setOpen(null); setMobileOpen(false); }, [loc.pathname]);

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 150);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <header className="sticky top-9 z-40 bg-paper/95 backdrop-blur" onMouseLeave={scheduleClose}>
      {/* ── Main bar ── */}
      <div className="border-b rule">
        <div className="container-fluid flex items-center justify-between h-16">
          <Link to="/" className="flex items-center shrink-0" onClick={() => setOpen(null)}>
            <img src="/RegisFULL.png" alt="Regis Partners" style={{ height: '56px', width: 'auto' }} draggable={false} />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center">
            {NAV.map((n) => {
              const isActive = open === n.key;
              return (
                <Link
                  key={n.key}
                  to={n.href}
                  onMouseEnter={() => { cancelClose(); setOpen(n.key); }}
                  onClick={() => setOpen(null)}
                  className="relative flex items-center gap-1.5 px-4 h-16 text-[13.5px] tracking-[-0.005em] transition-colors"
                  style={{ color: isActive ? 'var(--color-ink)' : 'var(--color-slate)' }}
                >
                  {n.label}
                  {/* Chevron */}
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none"
                    className="transition-transform duration-250"
                    style={{ transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)', color: isActive ? 'var(--color-amber)' : 'inherit' }}>
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {/* Amber underline */}
                  <motion.span
                    className="absolute bottom-0 left-4 right-4 h-[2px]"
                    style={{ background: 'var(--color-amber)', transformOrigin: 'left' }}
                    animate={{ scaleX: isActive ? 1 : 0 }}
                    transition={{ duration: 0.28, ease }}
                  />
                </Link>
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
            className="hidden md:block absolute left-0 right-0 shadow-2xl"
            style={{
              background: 'var(--color-paper)',
              borderBottom: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)',
            }}
          >
            <div className="container-fluid">
              <div className="grid grid-cols-12">

                {/* Left: feature panel (navy) */}
                <div
                  className="col-span-4 relative overflow-hidden flex flex-col justify-between p-10 min-h-[340px]"
                  style={{ background: 'var(--color-navy)' }}
                >
                  {/* Blueprint texture */}
                  <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 2%, transparent) 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                  }} />
                  {/* Amber radial glow top-right */}
                  <div aria-hidden className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none" style={{
                    background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)',
                    opacity: 0.08,
                  }} />

                  {/* SVG visual */}
                  <div className="relative h-36 w-full mb-2">
                    {MENUS[open].feature.visual}
                  </div>

                  {/* Text content */}
                  <div className="relative">
                    <p className="mono text-[10px] tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--color-amber)' }}>
                      Regis Partners
                    </p>
                    <h3
                      className="text-[1.3rem] leading-[1.15] tracking-[-0.022em] font-medium text-paper mb-3 whitespace-pre-line max-w-[20ch]"
                    >
                      {MENUS[open].feature.headline}
                    </h3>
                    <p className="text-[13px] leading-relaxed mb-7 max-w-[32ch]" style={{ color: 'color-mix(in oklab, var(--color-paper) 52%, transparent)' }}>
                      {MENUS[open].feature.sub}
                    </p>
                    <Link
                      to={MENUS[open].feature.href}
                      onClick={() => setOpen(null)}
                      className="group/cta inline-flex items-center gap-3 text-[12.5px] font-medium text-paper"
                    >
                      <span className="block h-px transition-all duration-300 group-hover/cta:w-8 w-5" style={{ background: 'var(--color-amber)' }} />
                      {MENUS[open].feature.cta}
                      <span className="opacity-0 group-hover/cta:opacity-100 transition-opacity duration-200 text-amber-400">→</span>
                    </Link>
                  </div>
                </div>

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
            className="md:hidden overflow-hidden bg-paper border-t rule"
          >
            <div className="container-fluid py-4 flex flex-col">
              {NAV.map((n) => (
                <div key={n.key} className="border-b rule">
                  <button
                    onClick={() => setMobileExpanded(mobileExpanded === n.key ? null : n.key)}
                    className="w-full flex items-center justify-between py-4 text-left text-lg tracking-[-0.02em]"
                  >
                    {n.label}
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="none"
                      className="transition-transform duration-200"
                      style={{ transform: mobileExpanded === n.key ? 'rotate(180deg)' : 'none' }}>
                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
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
