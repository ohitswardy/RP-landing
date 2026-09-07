import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../cms/auth';
import { useCrms } from './store';
import { Chip } from '../cms/ui';
import RailBrandCanvas from '../cms/RailBrandCanvas';
import { usePublishedHeight } from '../cms/kit/stickyOffset';
import { ToastProvider } from './kit/toast';
import { Sidebar, SidebarBody, SidebarLabel, SidebarRow, SidebarSection, useSidebar } from '@/components/ui/sidebar';
import { IconSignOut, IconMenu, IconX, IconExternal, IconPin } from '../cms/icons';
import {
  ChalkboardSimpleIcon, ChatsCircleIcon, AirplaneTiltIcon, CalendarBlankIcon, BuildingsIcon, AddressBookIcon,
  ChartLineUpIcon, UsersThreeIcon, TreeStructureIcon, FileXlsIcon, MagnifyingGlassIcon, TagIcon, ListChecksIcon, LogIcon,
} from '@phosphor-icons/react';

/* ─────────────────────────────────────────────────────────────
   CRMS shell. The same rail-and-header chassis as the CMS, with
   the CRMS module map: the desk's day-to-day (interactions,
   events, calendar), master data, output, and administration.
   Items show only when the role holds their permission.
   ───────────────────────────────────────────────────────────── */

type NavItem = {
  to: string;
  label: string;
  code: string;
  icon: (p: { size?: number; className?: string }) => JSX.Element;
  end?: boolean;
  perm?: string;
};

const HOME: NavItem = { to: '/crms', label: 'Dashboard', code: '00', icon: (p) => <ChalkboardSimpleIcon {...p} weight="bold" />, end: true };

const DESK_NAV: NavItem[] = [
  { to: '/crms/interactions', label: 'Interactions', code: '01', icon: (p) => <ChatsCircleIcon {...p} weight="bold" /> },
  { to: '/crms/events/roadshows', label: 'Events', code: '02', icon: (p) => <AirplaneTiltIcon {...p} weight="bold" /> },
  { to: '/crms/events/calendar', label: 'Calendar', code: '03', icon: (p) => <CalendarBlankIcon {...p} weight="bold" /> },
];

const DATA_NAV: NavItem[] = [
  { to: '/crms/clients', label: 'Clients', code: '04', icon: (p) => <BuildingsIcon {...p} weight="bold" /> },
  { to: '/crms/client-contacts', label: 'Client contacts', code: '05', icon: (p) => <AddressBookIcon {...p} weight="bold" /> },
  { to: '/crms/corporates', label: 'Corporates', code: '06', icon: (p) => <ChartLineUpIcon {...p} weight="bold" /> },
  { to: '/crms/sellside-contacts', label: 'Regis directory', code: '07', icon: (p) => <UsersThreeIcon {...p} weight="bold" /> },
  { to: '/crms/distribution-list', label: 'Distribution list', code: '08', icon: (p) => <TreeStructureIcon {...p} weight="bold" /> },
];

const OUTPUT_NAV: NavItem[] = [
  { to: '/crms/reports', label: 'Reports', code: '09', icon: (p) => <FileXlsIcon {...p} weight="bold" />, perm: 'crms.reports.generate' },
  { to: '/crms/ticker-search', label: 'Ticker search', code: '10', icon: (p) => <MagnifyingGlassIcon {...p} weight="bold" /> },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/crms/interaction-types', label: 'Interaction types', code: '11', icon: (p) => <TagIcon {...p} weight="bold" />, perm: 'crms.admin' },
  { to: '/crms/form-builder', label: 'Form builder', code: '12', icon: (p) => <ListChecksIcon {...p} weight="bold" />, perm: 'crms.admin' },
  { to: '/crms/logs', label: 'Logs', code: '13', icon: (p) => <LogIcon {...p} weight="bold" />, perm: 'crms.admin' },
];

const PIN_KEY = 'regis-crms-rail-pinned';

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

function RailLink({ item }: { item: NavItem }) {
  const { surface, setOpen } = useSidebar();
  const { pathname } = useLocation();
  // Every event type lives under /crms/events/{type}; the Events item owns all of them but the calendar.
  const eventsActive = item.to === '/crms/events/roadshows' && pathname.startsWith('/crms/events/') && !pathname.startsWith('/crms/events/calendar');
  return (
    <NavLink to={item.to} end={item.end} onClick={() => { if (surface === 'mobile') setOpen(false); }} title={item.label} className="block">
      {({ isActive }) => (
        <SidebarRow link={{ label: item.label, code: item.code, icon: <item.icon size={17} /> }} active={isActive || eventsActive} />
      )}
    </NavLink>
  );
}

function RailFoot({ pinned, onTogglePin }: { pinned: boolean; onTogglePin: () => void }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const { expanded, surface } = useSidebar();
  const initials = (session?.name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  return (
    <div className="shrink-0 border-t" style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}>
      <div className="flex items-center justify-center border-b py-4" style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 8%, transparent)' }}>
        <img src="/Regis Logo.PNG" alt="Regis Partners" className="object-contain transition-all duration-300" style={{ width: expanded ? 44 : 28, height: expanded ? 44 : 28 }} />
      </div>
      <div className="flex items-center gap-3.5 pb-2 pl-[26px] pr-5 pt-3">
        <span className="mono grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border text-[9.5px] tracking-[0.04em] text-ink" style={{ background: 'var(--color-bone)', borderColor: 'color-mix(in oklab, var(--color-ink) 15%, transparent)' }}>
          {initials || '—'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <SidebarLabel className="max-w-[140px] truncate text-[12.5px] text-ink">{session?.name ?? 'Signed out'}</SidebarLabel>
          <SidebarLabel className="mono max-w-[140px] truncate text-[9px] uppercase tracking-[0.16em] text-graphite">{session?.role ?? '—'}</SidebarLabel>
        </span>
        {surface === 'desktop' && expanded && (
          <button type="button" onClick={onTogglePin} aria-pressed={pinned} title={pinned ? 'Unpin rail' : 'Keep rail open'} className={`grid h-7 w-7 shrink-0 place-items-center transition-colors duration-300 active:scale-95 ${pinned ? 'text-[color:var(--color-amber)]' : 'text-graphite hover:text-ink'}`}>
            <IconPin size={15} />
          </button>
        )}
      </div>
      <button type="button" onClick={() => { signOut(); navigate('/login/crms'); }} title="Sign out" className="block w-full text-left">
        <SidebarRow link={{ label: 'Sign out', icon: <IconSignOut size={17} /> }} />
      </button>
    </div>
  );
}

function RailContent({ pinned, onTogglePin }: { pinned: boolean; onTogglePin: () => void }) {
  const { can } = useAuth();
  const allowed = (items: NavItem[]) => items.filter((i) => !i.perm || can(i.perm));
  const sections: [string, NavItem[]][] = [
    ['Desk', allowed(DESK_NAV)], ['Master data', allowed(DATA_NAV)], ['Output', allowed(OUTPUT_NAV)], ['Administration', allowed(ADMIN_NAV)],
  ];

  return (
    <>
      <div className="relative flex h-[76px] shrink-0 items-center overflow-hidden border-b pl-[26px] pr-4" style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}>
        <RailBrandCanvas />
      </div>
      <nav className="flex flex-1 flex-col gap-7 overflow-y-auto overflow-x-hidden py-7" aria-label="CRMS modules">
        <RailLink item={HOME} />
        {sections.map(([heading, items]) => items.length > 0 && (
          <SidebarSection key={heading} heading={heading}>
            {items.map((item) => <RailLink key={item.to} item={item} />)}
          </SidebarSection>
        ))}
      </nav>
      <RailFoot pinned={pinned} onTogglePin={onTogglePin} />
    </>
  );
}

export default function CRMSLayout() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(() => { try { return localStorage.getItem(PIN_KEY) === '1'; } catch { return false; } });
  const location = useLocation();
  const { audit, status, error, reload } = useCrms();

  const togglePin = () => setPinned((v) => { const next = !v; try { localStorage.setItem(PIN_KEY, next ? '1' : '0'); } catch { /* ignore */ } return next; });

  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  usePublishedHeight(headerRef, shellRef, '--cms-header-h');

  const all = [HOME, ...DESK_NAV, ...DATA_NAV, ...OUTPUT_NAV, ...ADMIN_NAV];
  const current = all.filter((i) => location.pathname === i.to || (i.to !== '/crms' && location.pathname.startsWith(i.to.replace('/roadshows', '')))).pop() ?? all[0];
  const lastEdit = audit[0];

  return (
    <ToastProvider>
      <div ref={shellRef} className="cms-scope flex min-h-[100dvh] bg-bone">
        <Sidebar open={open} setOpen={setOpen} animate={!pinned}>
          <SidebarBody>
            <RailContent pinned={pinned} onTogglePin={togglePin} />
          </SidebarBody>
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header ref={headerRef} className="sticky top-0 z-30 border-b rule bg-paper/90 backdrop-blur-md">
            <div className="flex items-center gap-4 px-5 py-3.5 md:px-9">
              <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)} className="grid h-9 w-9 place-items-center border rule text-slate lg:hidden">
                {open ? <IconX size={18} /> : <IconMenu size={18} />}
              </button>
              <div className="mono hidden items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-graphite md:flex">
                <span>CRMS</span>
                <span className="text-silver">/</span>
                <span className="text-ink">{current.label}</span>
              </div>
              <div className="ml-auto flex items-center gap-5">
                {lastEdit && (
                  <span className="mono hidden max-w-[300px] truncate text-[10.5px] tracking-[0.06em] text-graphite xl:block">
                    Last change · {lastEdit.actor} — {lastEdit.action.replace(/^CRMS · /, '').toLowerCase()}
                  </span>
                )}
                <Chip tone="live" pulse>ONLINE</Chip>
                <ManilaClock />
                <a href="/cms" target="_blank" rel="noreferrer" className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink">
                  Open CMS <IconExternal size={12} />
                </a>
              </div>
            </div>
          </header>

          <main key={location.pathname} className="flex-1 px-5 py-9 md:px-9 md:py-11">
            <div className="mx-auto w-full max-w-[1240px]">
              {status === 'error' && (
                <div className="mb-8 flex flex-col gap-3 border-l-2 pl-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--color-warn)' }}>
                  <div>
                    <p className="text-[14px] font-medium text-ink">The CRMS could not reach the API.</p>
                    <p className="mt-0.5 text-[12.5px] text-graphite">{error ?? 'Check that the backend is running and the crms database exists, then retry.'}</p>
                  </div>
                  <button type="button" onClick={reload} className="mono self-start border rule px-4 py-2 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink sm:self-auto">
                    Retry
                  </button>
                </div>
              )}
              <Outlet />
            </div>
          </main>

          <footer className="mono border-t rule px-5 py-4 text-[10px] uppercase tracking-[0.18em] text-graphite md:px-9">
            <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between">
              <span>Regis Partners · Client Relationship Management</span>
              <span className="hidden sm:block">Restricted · every action is logged</span>
            </div>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}
