import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { useCms } from './store';
import { Chip } from './ui';
import RailBrandCanvas from './RailBrandCanvas';
import { usePublishedHeight } from './kit/stickyOffset';
import {
  Sidebar,
  SidebarBody,
  SidebarLabel,
  SidebarRow,
  SidebarSection,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  IconSignOut, IconMenu, IconX, IconExternal, IconPin,
} from './icons';
import {
  ChalkboardSimpleIcon, ArticleIcon, ScrollIcon, SuitcaseIcon, UsersThreeIcon,
  FileIcon, NewspaperIcon, EnvelopeSimpleIcon, LogIcon, FingerprintIcon,
} from '@phosphor-icons/react';

type NavItem = {
  to: string;
  label: string;
  code: string;
  icon: (p: { size?: number; className?: string }) => JSX.Element;
  end?: boolean;
  /** Permission key that unlocks this module; omitted = always visible. */
  perm?: string;
};

const OVERVIEW: NavItem = {
  to: '/cms', label: 'Overview', code: '00',
  icon: (p) => <ChalkboardSimpleIcon {...p} weight="bold" />, end: true,
};

const CONTENT_NAV: NavItem[] = [
  { to: '/cms/insights', label: 'Insights', code: '01', icon: (p) => <ArticleIcon {...p} weight="bold" />, perm: 'insights.manage' },
  { to: '/cms/reports', label: 'Reports', code: '02', icon: (p) => <ScrollIcon {...p} weight="bold" />, perm: 'reports.manage' },
  { to: '/cms/services', label: 'Services', code: '03', icon: (p) => <SuitcaseIcon {...p} weight="bold" />, perm: 'services.manage' },
  { to: '/cms/people', label: 'People', code: '04', icon: (p) => <UsersThreeIcon {...p} weight="bold" />, perm: 'people.manage' },
  { to: '/cms/pages', label: 'Pages', code: '05', icon: (p) => <FileIcon {...p} weight="bold" />, perm: 'pages.manage' },
];

const SITE_NAV: NavItem[] = [
  { to: '/cms/newsletter', label: 'Newsletter', code: '06', icon: (p) => <NewspaperIcon {...p} weight="bold" />, perm: 'newsletter.manage' },
  { to: '/cms/email', label: 'Email desk', code: '07', icon: (p) => <EnvelopeSimpleIcon {...p} weight="bold" />, perm: 'email.manage' },
  { to: '/cms/access', label: 'Users & access', code: '08', icon: (p) => <LogIcon {...p} weight="bold" />, perm: 'access.manage' },
  { to: '/cms/logs', label: 'Client logs', code: '09', icon: (p) => <FingerprintIcon {...p} weight="bold" />, perm: 'logs.view' },
];

const PIN_KEY = 'regis-cms-rail-pinned';

function ManilaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="mono num text-[11px] tracking-[0.08em] text-graphite">
      {now.toLocaleTimeString('en-PH', { hour12: false, timeZone: 'Asia/Manila' })}
      <span className="ml-1.5 text-silver">PHT</span>
    </span>
  );
}

/* ── Rail pieces ───────────────────────────────────────────── */

function RailBrand() {
  return (
    <div
      className="relative flex h-[76px] shrink-0 items-center overflow-hidden border-b pl-[26px] pr-4"
      style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
    >
      <RailBrandCanvas />
    </div>
  );
}

function RailLink({ item }: { item: NavItem }) {
  // Only the mobile drawer dismisses on navigate — collapsing the desktop rail
  // out from under the cursor would leave it stuck until the pointer re-enters.
  const { surface, setOpen } = useSidebar();

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={() => { if (surface === 'mobile') setOpen(false); }}
      title={item.label}
      className="block"
    >
      {({ isActive }) => (
        <SidebarRow
          link={{ label: item.label, code: item.code, icon: <item.icon size={17} /> }}
          active={isActive}
        />
      )}
    </NavLink>
  );
}

function RailLogo({ pinned, onTogglePin }: { pinned: boolean; onTogglePin: () => void }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const { expanded, surface } = useSidebar();

  const initials = (session?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div
      className="shrink-0 border-t"
      style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center border-b py-4" style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 8%, transparent)' }}>
        <img
          src="/Regis Logo.PNG"
          alt="Regis Partners"
          className="object-contain transition-all duration-300"
          style={{ width: expanded ? 44 : 28, height: expanded ? 44 : 28 }}
        />
      </div>

      {/* User info */}
      <div className="flex items-center gap-3.5 pb-2 pl-[26px] pr-5 pt-3">
        <span
          className="mono grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border text-[9.5px] tracking-[0.04em] text-ink"
          style={{ background: 'var(--color-bone)', borderColor: 'color-mix(in oklab, var(--color-ink) 15%, transparent)' }}
        >
          {initials || '—'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <SidebarLabel className="max-w-[140px] truncate text-[12.5px] text-ink">
            {session?.name ?? 'Signed out'}
          </SidebarLabel>
          <SidebarLabel className="mono max-w-[140px] truncate text-[9px] uppercase tracking-[0.16em] text-graphite">
            {session?.role ?? '—'}
          </SidebarLabel>
        </span>

        {surface === 'desktop' && expanded && (
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={pinned}
            title={pinned ? 'Unpin rail' : 'Keep rail open'}
            className={`grid h-7 w-7 shrink-0 place-items-center transition-colors duration-300 active:scale-95 ${
              pinned ? 'text-[color:var(--color-amber)]' : 'text-graphite hover:text-ink'
            }`}
          >
            <IconPin size={15} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => { signOut(); navigate('/login/cms'); }}
        title="Sign out"
        className="block w-full text-left"
      >
        <SidebarRow link={{ label: 'Sign out', icon: <IconSignOut size={17} /> }} />
      </button>
    </div>
  );
}

function RailContent({ pinned, onTogglePin }: { pinned: boolean; onTogglePin: () => void }) {
  const { can } = useAuth();
  const content = CONTENT_NAV.filter((i) => !i.perm || can(i.perm));
  const site = SITE_NAV.filter((i) => !i.perm || can(i.perm));

  return (
    <>
      <RailBrand />

      <nav
        className="flex flex-1 flex-col gap-7 overflow-y-auto overflow-x-hidden py-7"
        aria-label="CMS modules"
      >
        <RailLink item={OVERVIEW} />
        {content.length > 0 && (
          <SidebarSection heading="Site content">
            {content.map((item) => (
              <RailLink key={item.to} item={item} />
            ))}
          </SidebarSection>
        )}
        {site.length > 0 && (
          <SidebarSection heading="Systems">
            {site.map((item) => (
              <RailLink key={item.to} item={item} />
            ))}
          </SidebarSection>
        )}
      </nav>

      <RailLogo pinned={pinned} onTogglePin={onTogglePin} />
    </>
  );
}

/* ── Shell ─────────────────────────────────────────────────── */

export default function CMSLayout() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(PIN_KEY) === '1'; } catch { return false; }
  });
  const location = useLocation();
  const { audit, status, error, reload } = useCms();

  const togglePin = () => {
    setPinned((v) => {
      const next = !v;
      try { localStorage.setItem(PIN_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // The header is sticky and modules park their own sticky toolbars under it,
  // so its live height is published as --cms-header-h rather than hard-coded —
  // it changes with the breakpoint (the rail toggle is lg:hidden) and wraps.
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  usePublishedHeight(headerRef, shellRef, '--cms-header-h');

  const all = [OVERVIEW, ...CONTENT_NAV, ...SITE_NAV];
  const current =
    all.filter((i) => location.pathname === i.to || (i.to !== '/cms' && location.pathname.startsWith(i.to))).pop() ??
    all[0];

  const lastEdit = audit[0];

  return (
    <div ref={shellRef} className="cms-scope flex min-h-[100dvh] bg-bone">
      {/* Rail — hover-expands on desktop, drawer on mobile */}
      <Sidebar open={open} setOpen={setOpen} animate={!pinned}>
        <SidebarBody>
          <RailContent pinned={pinned} onTogglePin={togglePin} />
        </SidebarBody>
      </Sidebar>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header ref={headerRef} className="sticky top-0 z-30 border-b rule bg-paper/90 backdrop-blur-md">
          <div className="flex items-center gap-4 px-5 py-3.5 md:px-9">
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center border rule text-slate lg:hidden"
            >
              {open ? <IconX size={18} /> : <IconMenu size={18} />}
            </button>

            <div className="mono hidden items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-graphite md:flex">
              <span>CMS</span>
              <span className="text-silver">/</span>
              <span className="text-ink">{current.label}</span>
            </div>

            <div className="ml-auto flex items-center gap-5">
              {lastEdit && (
                <span className="mono hidden max-w-[300px] truncate text-[10.5px] tracking-[0.06em] text-graphite xl:block">
                  Last change · {lastEdit.actor} — {lastEdit.action.toLowerCase()}
                </span>
              )}
              <Chip tone="live" pulse>ONLINE</Chip>
              <ManilaClock />
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
              >
                View site <IconExternal size={12} />
              </a>
            </div>
          </div>
        </header>

        <main key={location.pathname} className="flex-1 px-5 py-9 md:px-9 md:py-11">
          <div className="mx-auto w-full max-w-[1180px]">
            {status === 'error' && (
              <div className="mb-8 flex flex-col gap-3 border-l-2 pl-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--color-warn)' }}>
                <div>
                  <p className="text-[14px] font-medium text-ink">The workspace could not reach the API.</p>
                  <p className="mt-0.5 text-[12.5px] text-graphite">{error ?? 'Check that the backend is running, then retry.'}</p>
                </div>
                <button
                  type="button"
                  onClick={reload}
                  className="mono self-start border rule px-4 py-2 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink sm:self-auto"
                >
                  Retry
                </button>
              </div>
            )}
            <Outlet />
          </div>
        </main>

        <footer className="mono border-t rule px-5 py-4 text-[10px] uppercase tracking-[0.18em] text-graphite md:px-9">
          <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between">
            <span>Regis Partners · Internal systems</span>
            <span className="hidden sm:block">All actions are logged</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
