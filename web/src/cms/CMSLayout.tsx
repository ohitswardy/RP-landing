import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { useCms } from './store';
import { Chip } from './ui';
import RailBrandLogo from './RailBrandLogo';
import { usePublishedHeight } from './kit/stickyOffset';
import UserBlobatar from './kit/UserBlobatar';
import RailOrb from './kit/RailOrb';
import { useAppTheme } from '@/lib/theme';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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
  FileIcon, NewspaperIcon, EnvelopeSimpleIcon, LogIcon, FingerprintIcon, HouseLineIcon,
  BriefcaseIcon, ChartLineUpIcon, ImagesIcon, ArrowsClockwiseIcon,
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
  { to: '/cms/home', label: 'Landing page', code: '01', icon: (p) => <HouseLineIcon {...p} weight="bold" />, perm: 'home.manage' },
  { to: '/cms/insights', label: 'Insights', code: '02', icon: (p) => <ArticleIcon {...p} weight="bold" />, perm: 'insights.manage' },
  { to: '/cms/reports', label: 'Reports', code: '03', icon: (p) => <ScrollIcon {...p} weight="bold" />, perm: 'reports.manage' },
  { to: '/cms/services', label: 'Services', code: '04', icon: (p) => <SuitcaseIcon {...p} weight="bold" />, perm: 'services.manage' },
  { to: '/cms/people', label: 'People', code: '05', icon: (p) => <UsersThreeIcon {...p} weight="bold" />, perm: 'people.manage' },
  { to: '/cms/pages', label: 'Pages', code: '06', icon: (p) => <FileIcon {...p} weight="bold" />, perm: 'pages.manage' },
  { to: '/cms/careers', label: 'Careers', code: '11', icon: (p) => <BriefcaseIcon {...p} weight="bold" />, perm: 'careers.manage' },
];

const SITE_NAV: NavItem[] = [
  { to: '/cms/newsletter', label: 'Newsletter', code: '07', icon: (p) => <NewspaperIcon {...p} weight="bold" />, perm: 'newsletter.manage' },
  { to: '/cms/email', label: 'Email desk', code: '08', icon: (p) => <EnvelopeSimpleIcon {...p} weight="bold" />, perm: 'email.manage' },
  { to: '/cms/access', label: 'Users & access', code: '09', icon: (p) => <LogIcon {...p} weight="bold" />, perm: 'access.manage' },
  { to: '/cms/logs', label: 'Client logs', code: '10', icon: (p) => <FingerprintIcon {...p} weight="bold" />, perm: 'logs.view' },
  { to: '/cms/market', label: 'Market ribbon', code: '12', icon: (p) => <ChartLineUpIcon {...p} weight="bold" />, perm: 'market.manage' },
  { to: '/cms/media', label: 'Media', code: '13', icon: (p) => <ImagesIcon {...p} weight="bold" />, perm: 'media.manage' },
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
      <RailOrb />
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

function RailLogo({ pinned, onTogglePin }: {
  pinned: boolean; onTogglePin: () => void;
}) {
  const { session, signOut, refresh, refreshing } = useAuth();
  const navigate = useNavigate();
  const { expanded, surface } = useSidebar();
  const [refreshNote, setRefreshNote] = useState<'ok' | 'fail' | null>(null);

  useEffect(() => {
    if (!refreshNote) return;
    const t = window.setTimeout(() => setRefreshNote(null), 2400);
    return () => window.clearTimeout(t);
  }, [refreshNote]);

  async function refreshPermissions() {
    if (refreshing) return;
    const err = await refresh();
    setRefreshNote(err ? 'fail' : 'ok');
  }

  const refreshTitle = refreshing
    ? 'Refreshing…'
    : refreshNote === 'ok' ? 'Permissions up to date'
      : refreshNote === 'fail' ? 'Refresh failed'
        : 'Refresh permissions';
  const refreshTone = refreshNote === 'ok'
    ? 'text-[color:var(--color-signal)]'
    : refreshNote === 'fail' ? 'text-[color:var(--color-warn)]'
      : 'text-graphite hover:text-ink';

  return (
    <div
      className="shrink-0 border-t"
      style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
    >
      <RailBrandLogo />

      {/* User info: the name opens the account page (profile, grants, session, password) */}
      <div className="flex items-center gap-3.5 pb-2 pl-[26px] pr-5 pt-3">
        <NavLink
          to="/cms/account"
          title="Your account"
          className={({ isActive }) => `flex min-w-0 flex-1 items-center gap-3.5 transition-colors duration-300 ${isActive ? 'text-[color:var(--color-amber-deep)]' : 'text-ink hover:text-[color:var(--color-amber-deep)]'}`}
        >
          <UserBlobatar name={session?.name} size={26} />
          <span className="flex min-w-0 flex-1 flex-col">
            <SidebarLabel className="max-w-[140px] truncate text-[12.5px]">
              {session?.name ?? 'Signed out'}
            </SidebarLabel>
            <SidebarLabel className="mono max-w-[140px] truncate text-[9px] uppercase tracking-[0.16em] text-graphite">
              {session?.role ?? '—'}
            </SidebarLabel>
          </span>
        </NavLink>

        {expanded && (
          <span className="flex shrink-0 items-center">
            {/* Re-read this account's role and grants from the API without signing out */}
            <button
              type="button"
              onClick={() => { void refreshPermissions(); }}
              disabled={refreshing}
              aria-label={refreshTitle}
              title={refreshTitle}
              className={`grid h-7 w-7 place-items-center transition-colors duration-300 active:scale-95 disabled:opacity-60 ${refreshTone}`}
            >
              <ArrowsClockwiseIcon size={15} weight="bold" className={refreshing ? 'animate-spin' : ''} />
            </button>
            {surface === 'desktop' && (
              <button
                type="button"
                onClick={onTogglePin}
                aria-pressed={pinned}
                title={pinned ? 'Unpin rail' : 'Keep rail open'}
                className={`grid h-7 w-7 place-items-center transition-colors duration-300 active:scale-95 ${
                  pinned ? 'text-[color:var(--color-amber)]' : 'text-graphite hover:text-ink'
                }`}
              >
                <IconPin size={15} />
              </button>
            )}
          </span>
        )}
      </div>

      {/* Account actions: the same account serves the CMS and the CRMS */}
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

function RailContent({ pinned, onTogglePin }: {
  pinned: boolean; onTogglePin: () => void;
}) {
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
  const { theme, toggle: toggleTheme } = useAppTheme();

  const togglePin = () => {
    setPinned((v) => {
      const next = !v;
      try { localStorage.setItem(PIN_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      // Hovering never sets `open` while pinned, so unpinning would otherwise
      // slam the rail shut under the cursor. Hand it back already open and let
      // the pointer leaving collapse it.
      if (!next) setOpen(true);
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
    location.pathname.startsWith('/cms/account')
      ? { ...OVERVIEW, to: '/cms/account', label: 'Account', code: '—' }
      : all.filter((i) => location.pathname === i.to || (i.to !== '/cms' && location.pathname.startsWith(i.to))).pop() ??
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
                className="mono inline-flex items-center gap-1.5 whitespace-nowrap text-[10.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
              >
                View site <IconExternal size={12} />
              </a>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
