import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SearchModal, { computeResults, SEARCH_PANEL_WIDTH, TRENDING } from './SearchModal';

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
          { label: 'Corporate Access',     desc: 'Conferences, NDRs, and C-suite engagement.',           href: '/services/corporate' }
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
          { label: 'Awards',     desc: 'Asiamoney, II, and FinanceAsia recognition.',     href: '/about#awards' },
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
          { label: 'Contact Us',           desc: 'Address, Contact Numbers, and Email.',               href: '/contact#offices' }
        ],
      },
    ],
  },
};

// Secondary access points revealed by the portal chevron beside "Client Login"
const PORTALS = [
  { code: '002', label: 'Regis Partners CMS',  desc: 'Content management system.',      href: '/login/cms'  },
  { code: '003', label: 'Regis Partners CRMS', desc: 'Client relationship management.', href: '/login/crms' },
] as const;

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileQuery, setMobileQuery] = useState('');
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalCycle, setPortalCycle] = useState(0);
  const [portalHover, setPortalHover] = useState<number | null>(null);
  const [mobilePortalOpen, setMobilePortalOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const headerRef = useRef<HTMLElement | null>(null);
  const pointerIsTouch = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setOpen(null); setMobileOpen(false); setPortalOpen(false); }, [loc.pathname]);

  // Portal dropdown: while open on desktop, the two portals auto-toggle their
  // highlight so both read as live options without the user moving the cursor.
  useEffect(() => {
    if (!portalOpen) { setPortalCycle(0); return; }
    const id = setInterval(() => setPortalCycle((i) => (i + 1) % PORTALS.length), 1700);
    return () => clearInterval(id);
  }, [portalOpen]);

  useEffect(() => { if (!mobileOpen) setMobilePortalOpen(false); }, [mobileOpen]);

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

  // Reset mobile search when drawer closes
  useEffect(() => {
    if (!mobileOpen) {
      setMobileQuery('');
      setMobileActiveIndex(0);
    }
  }, [mobileOpen]);

  const mobileResults = useMemo(() => computeResults(mobileQuery), [mobileQuery]);

  // Focus + reset on open
  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  // Ctrl+K / ⌘K + Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Click-outside to close search
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const results = computeResults(query);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      const href = results[activeIndex]?.href ?? results[0].href;
      setSearchOpen(false);
      navigate(href);
    }
  };

  const scheduleClose = () => {
    // Skip hover-close when the last interaction was a touch — click-outside handles it
    if (pointerIsTouch.current) return;
    closeTimer.current = setTimeout(() => setOpen(null), 150);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const openPortals = () => {
    if (portalTimer.current) clearTimeout(portalTimer.current);
    cancelClose();
    setOpen(null);
    setPortalOpen(true);
  };
  const schedulePortalClose = () => {
    if (pointerIsTouch.current) return;
    portalTimer.current = setTimeout(() => { setPortalOpen(false); setPortalHover(null); }, 180);
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
            {/* Search — inline expanding input */}
            <div ref={searchWrapRef} className="relative self-stretch flex items-center">
              <AnimatePresence mode="wait">
                {searchOpen ? (
                  <motion.div
                    key="search-input"
                    initial={{ width: 32, opacity: 0 }}
                    animate={{ width: SEARCH_PANEL_WIDTH, opacity: 1 }}
                    exit={{ width: 32, opacity: 0 }}
                    transition={{ duration: 0.22, ease }}
                    className="flex items-center gap-2 overflow-hidden"
                    style={{ borderBottom: '1.5px solid var(--color-amber)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ flexShrink: 0, color: 'var(--color-graphite)' }}>
                      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search…"
                      className="flex-1 py-1 text-[13.5px] tracking-[-0.01em] outline-none bg-transparent"
                      style={{ color: 'var(--color-ink)', minWidth: 0 }}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {query && (
                      <button
                        onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                        style={{ color: 'var(--color-graphite)', flexShrink: 0 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-graphite)')}
                        aria-label="Clear"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => setSearchOpen(false)}
                      className="mono text-[9.5px] tracking-[0.12em] uppercase ml-1 transition-colors"
                      style={{ color: 'var(--color-silver)', flexShrink: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-graphite)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-silver)')}
                    >
                      esc
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="search-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setSearchOpen(true)}
                    className="flex items-center gap-2 text-slate hover:text-ink transition-colors"
                    aria-label="Search"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Dropdown — anchored below this wrapper */}
              <SearchModal
                open={searchOpen}
                query={query}
                onQueryChange={(q) => { setQuery(q); setActiveIndex(0); inputRef.current?.focus(); }}
                activeIndex={activeIndex}
                onActiveIndex={setActiveIndex}
                onSelect={(href) => { setSearchOpen(false); navigate(href); }}
              />
            </div>

            <span className="h-4 w-px bg-ink/15" />

            {/* Client Login + portal switcher */}
            <div
              className="relative self-stretch flex items-center gap-2"
              onMouseEnter={cancelClose}
              onMouseLeave={schedulePortalClose}
            >
              <Link
                to="/login"
                className="mono text-[11px] tracking-[0.18em] uppercase transition-colors"
                style={{ color: portalOpen ? 'var(--color-ink)' : 'var(--color-slate)' }}
              >
                Client Login
              </Link>

              {/* Premium chevron — hover opens, click toggles */}
              <button
                onMouseEnter={openPortals}
                onFocus={openPortals}
                onClick={() => (portalOpen ? setPortalOpen(false) : openPortals())}
                aria-expanded={portalOpen}
                aria-label={`${portalOpen ? 'Close' : 'Open'} portal switcher`}
                className="relative grid h-[22px] w-[22px] place-items-center rounded-full transition-colors duration-300"
                style={{
                  border: `1px solid ${portalOpen
                    ? 'var(--color-amber)'
                    : 'color-mix(in oklab, var(--color-ink) 16%, transparent)'}`,
                  background: portalOpen
                    ? 'color-mix(in oklab, var(--color-amber) 10%, transparent)'
                    : 'transparent',
                  color: portalOpen ? 'var(--color-amber-deep)' : 'var(--color-graphite)',
                }}
              >
                {/* Halo that blooms out of the ring on open */}
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ border: '1px solid var(--color-amber)' }}
                  animate={portalOpen ? { scale: [1, 1.65], opacity: [0.45, 0] } : { scale: 1, opacity: 0 }}
                  transition={portalOpen
                    ? { duration: 1.7, ease: 'easeOut', repeat: Infinity }
                    : { duration: 0.2 }}
                />
                <motion.svg
                  width="9" height="9" viewBox="0 0 10 10" fill="none"
                  animate={{ rotate: portalOpen ? 180 : 0 }}
                  transition={{ duration: 0.32, ease }}
                >
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </button>

              {/* Portal dropdown */}
              <AnimatePresence>
                {portalOpen && (
                  <motion.div
                    key="portals"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24, ease }}
                    onMouseEnter={openPortals}
                    className="absolute right-0 z-50 w-[302px] shadow-2xl"
                    style={{
                      top: 'calc(100% + 1px)',
                      background: '#ffffff',
                      border: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)',
                    }}
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3 border-b"
                      style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 8%, transparent)' }}
                    >
                      <span className="mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--color-graphite)' }}>
                        Other Portals
                      </span>
                      <span className="mono text-[10px] tracking-[0.16em]" style={{ color: 'var(--color-silver)' }}>
                        02
                      </span>
                    </div>

                    <ul>
                      {PORTALS.map((p, i) => {
                        const active = (portalHover ?? portalCycle) === i;
                        return (
                          <li key={p.href}>
                            <Link
                              to={p.href}
                              onClick={() => setPortalOpen(false)}
                              onMouseEnter={() => setPortalHover(i)}
                              onMouseLeave={() => setPortalHover(null)}
                              className="relative flex items-start gap-3 px-4 py-3.5 transition-colors duration-300"
                              style={{ background: active ? 'var(--color-bone)' : 'transparent' }}
                            >
                              {/* Amber rail that slides between the two entries */}
                              <motion.span
                                aria-hidden
                                className="absolute left-0 top-0 bottom-0 w-[2px]"
                                style={{ background: 'var(--color-amber)', transformOrigin: 'top' }}
                                animate={{ scaleY: active ? 1 : 0 }}
                                transition={{ duration: 0.32, ease }}
                              />
                              <span className="mono text-[10px] tracking-[0.14em] pt-[3px]" style={{ color: 'var(--color-silver)' }}>
                                {p.code}
                              </span>
                              <span className="flex-1">
                                <span className="flex items-center gap-2 text-[13.5px] tracking-[-0.005em] text-ink">
                                  {p.label}
                                  <motion.span
                                    className="block h-px"
                                    style={{ background: 'var(--color-amber)' }}
                                    animate={{ width: active ? 16 : 0 }}
                                    transition={{ duration: 0.32, ease }}
                                  />
                                </span>
                                <span className="block text-[12px] leading-snug mt-0.5" style={{ color: 'var(--color-graphite)' }}>
                                  {p.desc}
                                </span>
                              </span>
                              <motion.span
                                className="mono text-[11px] pt-[2px]"
                                style={{ color: 'var(--color-amber-deep)' }}
                                animate={{ opacity: active ? 1 : 0, x: active ? 0 : -4 }}
                                transition={{ duration: 0.32, ease }}
                              >
                                →
                              </motion.span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-deep) 55%, transparent 100%)' }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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

              {/* ── Mobile Search ── */}
              <div className="border-b rule pb-5 mb-1">
                {/* Input */}
                <div
                  className="flex items-center gap-2.5 px-3 py-3 rounded-sm"
                  style={{
                    background: 'var(--color-bone)',
                    border: '1px solid color-mix(in oklab, var(--color-ink) 8%, transparent)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ flexShrink: 0, color: 'var(--color-graphite)' }}>
                    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    ref={mobileInputRef}
                    value={mobileQuery}
                    onChange={(e) => { setMobileQuery(e.target.value); setMobileActiveIndex(0); }}
                    placeholder="Search…"
                    className="flex-1 text-[15px] tracking-[-0.01em] outline-none bg-transparent"
                    style={{ color: 'var(--color-ink)' }}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {mobileQuery && (
                    <button
                      onClick={() => { setMobileQuery(''); mobileInputRef.current?.focus(); }}
                      aria-label="Clear search"
                      style={{ color: 'var(--color-graphite)', flexShrink: 0 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Trending / Results / Empty */}
                <AnimatePresence mode="wait">
                  {mobileQuery.trim() === '' ? (
                    <motion.div
                      key="trending"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mt-3.5"
                    >
                      <div className="mono text-[10px] tracking-[0.18em] uppercase mb-2.5" style={{ color: 'var(--color-graphite)' }}>
                        Trending
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {TRENDING.map((t) => (
                          <button
                            key={t}
                            onClick={() => { setMobileQuery(t); mobileInputRef.current?.focus(); }}
                            className="px-2.5 py-1 text-[12px] tracking-[-0.005em] rounded-sm border rule transition-colors duration-150"
                            style={{ background: 'var(--color-paper)', color: 'var(--color-slate)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-slate)')}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : mobileResults.length > 0 ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="mt-2 max-h-60 overflow-y-auto"
                    >
                      {mobileResults.map((r, i) => (
                        <button
                          key={r.href + r.title}
                          onClick={() => { setMobileOpen(false); navigate(r.href); }}
                          onMouseEnter={() => setMobileActiveIndex(i)}
                          className="w-full flex items-center justify-between px-2 py-3 text-left rounded-sm transition-colors duration-150"
                          style={{
                            background: i === mobileActiveIndex ? 'var(--color-bone)' : 'transparent',
                            borderBottom: i < mobileResults.length - 1
                              ? '1px solid color-mix(in oklab, var(--color-ink) 6%, transparent)'
                              : 'none',
                          }}
                        >
                          <span className="text-[14px] tracking-[-0.01em]" style={{ color: 'var(--color-ink)' }}>
                            {r.title}
                          </span>
                          <span className="mono text-[10px] tracking-[0.12em] uppercase ml-3 shrink-0" style={{ color: 'var(--color-silver)' }}>
                            {r.category}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mt-3 text-[13px]"
                      style={{ color: 'var(--color-graphite)' }}
                    >
                      No results for &ldquo;{mobileQuery}&rdquo;
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Nav links ── */}
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

              {/* ── Client Login + portal switcher ── */}
              <div className="py-5">
                <div className="flex items-center justify-between">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="mono text-[11px] tracking-[0.18em] uppercase text-slate"
                  >
                    Client Login
                  </Link>

                  {/* Premium chevron — tap toggles the portal list */}
                  <button
                    onClick={() => setMobilePortalOpen(v => !v)}
                    aria-expanded={mobilePortalOpen}
                    aria-label={`${mobilePortalOpen ? 'Hide' : 'Show'} other portals`}
                    className="relative grid h-8 w-8 place-items-center rounded-full transition-colors duration-300"
                    style={{
                      border: `1px solid ${mobilePortalOpen
                        ? 'var(--color-amber)'
                        : 'color-mix(in oklab, var(--color-ink) 16%, transparent)'}`,
                      background: mobilePortalOpen
                        ? 'color-mix(in oklab, var(--color-amber) 10%, transparent)'
                        : 'transparent',
                      color: mobilePortalOpen ? 'var(--color-amber-deep)' : 'var(--color-graphite)',
                    }}
                  >
                    <motion.svg
                      width="11" height="11" viewBox="0 0 10 10" fill="none"
                      animate={{ rotate: mobilePortalOpen ? 180 : 0 }}
                      transition={{ duration: 0.32, ease }}
                    >
                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  </button>
                </div>

                <AnimatePresence>
                  {mobilePortalOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="overflow-hidden"
                    >
                      <ul
                        className="mt-4 border-t"
                        style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 8%, transparent)' }}
                      >
                        {PORTALS.map((p, i) => (
                          <motion.li
                            key={p.href}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.32, ease, delay: 0.06 + i * 0.08 }}
                          >
                            <Link
                              to={p.href}
                              onClick={() => setMobileOpen(false)}
                              className="relative flex items-start gap-3 py-3.5 pl-3 pr-1"
                            >
                              <span
                                aria-hidden
                                className="absolute left-0 top-2 bottom-2 w-[2px]"
                                style={{ background: 'var(--color-amber)' }}
                              />
                              <span className="mono text-[10px] tracking-[0.14em] pt-[3px]" style={{ color: 'var(--color-silver)' }}>
                                {p.code}
                              </span>
                              <span className="flex-1">
                                <span className="block text-[15px] tracking-[-0.01em] text-ink">{p.label}</span>
                                <span className="block text-[12.5px] leading-snug mt-0.5" style={{ color: 'var(--color-graphite)' }}>
                                  {p.desc}
                                </span>
                              </span>
                              <span className="mono text-[12px] pt-[2px]" style={{ color: 'var(--color-amber-deep)' }}>→</span>
                            </Link>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
