import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const nav = [
  { to: '/services', label: 'Our Services' },
  { to: '/insights', label: 'Our Insights' },
  { to: '/about',    label: 'About' },
  { to: '/contact',  label: 'Investor Relations' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b rule">
      <div className="container-fluid flex items-center justify-between h-16">
        <Link to="/" className="flex items-center shrink-0">
          <img
            src="/RegisFULL.png"
            alt="Regis Partners"
            style={{ height: '56px', width: 'auto' }}
            draggable={false}
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `text-[13.5px] tracking-[-0.005em] transition-colors ${
                  isActive ? 'text-ink' : 'text-slate hover:text-ink'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-5">
          <button className="text-slate hover:text-ink transition-colors" aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <span className="h-4 w-px bg-ink/15" />
          <Link to="/login" className="mono text-[11px] tracking-[0.18em] uppercase text-slate hover:text-ink">
            Client Login
          </Link>
        </div>

        <button
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
        >
          <span className={`block h-px w-5 bg-ink transition-transform ${open ? 'translate-y-[3px] rotate-45' : ''}`} />
          <span className={`block h-px w-5 bg-ink transition-transform ${open ? '-translate-y-[3px] -rotate-45' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className="md:hidden overflow-hidden bg-paper border-t rule"
          >
            <div className="container-fluid py-6 flex flex-col gap-4">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} className="text-2xl tracking-[-0.02em]">{n.label}</NavLink>
              ))}
              <div className="h-px bg-ink/10 my-2" />
              <Link to="/login" className="mono text-[11px] tracking-[0.18em] uppercase text-slate">Client Login</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
