import { useLayoutEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const LABELS: Record<string, string> = {
  about:     'About Us',
  services:  'Services',
  insights:  'Insights',
  contact:   'Contact',
  login:     'Client Login',
  research:  'Research Advisory',
  sales:     'Sales Advisory',
  trading:   'Trading & Execution',
  corporate: 'Corporate Access',
};

function useStickyTop() {
  const [top, setTop] = useState(101);

  useLayoutEffect(() => {
    const measure = () => {
      const navbar = document.getElementById('site-navbar');
      if (navbar) {
        const navTop = parseFloat(getComputedStyle(navbar).top) || 0;
        setTop(Math.ceil(navTop + navbar.getBoundingClientRect().height));
      }
    };

    measure();

    const ro = new ResizeObserver(measure);
    const ribbon = document.getElementById('market-ribbon');
    const navbar = document.getElementById('site-navbar');
    if (ribbon) ro.observe(ribbon);
    if (navbar) ro.observe(navbar);

    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return top;
}

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const stickyTop = useStickyTop();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = [
    { label: 'Home', href: '/' },
    ...segments.map((seg, i) => ({
      label: LABELS[seg.toLowerCase()] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
      href: '/' + segments.slice(0, i + 1).join('/'),
    })),
  ];

  return (
    <div
      className="z-30 bg-paper border-b"
      style={{
        position: 'sticky',
        top: stickyTop,
        borderColor: 'color-mix(in oklab, var(--color-ink) 10%, transparent)',
      }}
    >
      <div className="container-fluid">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center h-9 flex-wrap gap-y-1">
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <li key={crumb.href} className="flex items-center">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className="mx-2 select-none"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-amber)' }}
                    >
                      ›
                    </span>
                  )}
                  {isLast ? (
                    <span
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-slate)' }}
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.href}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-graphite)', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-graphite)')}
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
