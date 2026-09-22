import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { getTokenExpiry } from '../../lib/api';
import { useAppTheme } from '../../lib/theme';
import { ThemeToggle } from '../../components/ui/theme-toggle';
import { BtnGhost, Chip, ModuleHeader } from '../ui';
import { Panel } from '../kit/parts';
import ChangePasswordForm from '../kit/ChangePasswordForm';
import UserBlobatar from '../kit/UserBlobatar';
import { IconSignOut } from '../icons';

/* ─────────────────────────────────────────────────────────────
   /cms/account and /crms/account — the signed-in staff member's
   own page. One account serves both shells, so one module serves
   both routes: who you are, what the role grants (live from the
   API), this session, the theme, and the password.
   ───────────────────────────────────────────────────────────── */

/** Permission key → the module it opens, for the grant list. */
const PERMISSION_LABELS: Record<string, string> = {
  'home.manage': 'Landing page',
  'insights.manage': 'Insights',
  'reports.manage': 'Reports',
  'services.manage': 'Services',
  'people.manage': 'People',
  'pages.manage': 'Pages',
  'careers.manage': 'Careers',
  'market.manage': 'Market ribbon',
  'media.manage': 'Media',
  'newsletter.manage': 'Newsletter',
  'email.manage': 'Email desk',
  'access.manage': 'Users & access',
  'logs.view': 'Client logs',
  'crms.access': 'CRMS · sign in',
  'crms.contacts.manage': 'CRMS · contacts',
  'crms.interactions.manage': 'CRMS · interactions',
  'crms.events.manage': 'CRMS · events',
  'crms.reports.generate': 'CRMS · reports',
  'crms.admin': 'CRMS · administration',
};

function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AccountModule() {
  const { session, signOut, refresh, refreshing, remembered } = useAuth();
  const { theme, toggle: toggleTheme } = useAppTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inCrms = pathname.startsWith('/crms');
  const [refreshNote, setRefreshNote] = useState<'ok' | 'fail' | null>(null);

  useEffect(() => {
    if (!refreshNote) return;
    const t = window.setTimeout(() => setRefreshNote(null), 2800);
    return () => window.clearTimeout(t);
  }, [refreshNote]);

  const expiry = getTokenExpiry('cms');
  const grants = useMemo(() => {
    const keys = [...(session?.permissions ?? [])].sort();
    return keys.map((key) => ({ key, label: PERMISSION_LABELS[key] ?? key }));
  }, [session?.permissions]);

  async function refreshPermissions() {
    if (refreshing) return;
    const err = await refresh();
    setRefreshNote(err ? 'fail' : 'ok');
  }

  function leave() {
    signOut();
    navigate(inCrms ? '/login/crms' : '/login/cms');
  }

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="Account"
        title={session?.name ?? 'Account'}
        blurb="Your own record: the role and grants the API holds for you right now, this session, and your password. The same account signs in to the CMS and the CRMS."
        actions={
          <button
            type="button"
            onClick={leave}
            className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
          >
            <IconSignOut size={13} /> Sign out
          </button>
        }
      />

      {/* ── Profile ─────────────────────────────────────────── */}
      <Panel code="Profile" title="Who the system thinks you are" hint="Name, address and mailbox come from Users & access; only an administrator changes them.">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <UserBlobatar name={session?.name} size={56} />
          <dl className="grid flex-1 grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
            <Row label="Name" value={session?.name ?? '—'} />
            <Row label="Sign-in address" value={session?.email ?? '—'} mono />
            <Row label="Role" value={session?.role ?? '—'} />
            <Row label="Sending mailbox" value={session?.outlookEmail || 'Shared sender (noreply@regis.ph)'} mono />
            <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
              {session?.superAdmin && <Chip tone="amber">Super admin</Chip>}
              {remembered ? <Chip tone="live">Remembered session</Chip> : <Chip tone="muted">Tab session</Chip>}
            </div>
          </dl>
        </div>
      </Panel>

      {/* ── Grants ──────────────────────────────────────────── */}
      <Panel
        code="Grants"
        title="What this role opens"
        hint="Read live from the API on every sign-in and on boot. If an administrator changed your role a moment ago, refresh to pick it up without signing out."
        actions={
          <div className="flex items-center gap-3">
            {refreshNote === 'ok' && <Chip tone="live">Up to date</Chip>}
            {refreshNote === 'fail' && <Chip tone="warn">Refresh failed</Chip>}
            <BtnGhost onClick={() => { void refreshPermissions(); }} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh permissions'}
            </BtnGhost>
          </div>
        }
      >
        {grants.length === 0 ? (
          <p className="text-[13px] text-graphite">No module grants on this role.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {grants.map((g) => (
              <li key={g.key} className="flex items-baseline justify-between gap-3 border-b rule py-2 last:border-b-0 sm:last:border-b">
                <span className="text-[13px] text-ink">{g.label}</span>
                <span className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">{g.key}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── Session ─────────────────────────────────────────── */}
      <Panel code="Session" title="This sign-in" hint="A tab session ends when the tab closes. A remembered session keeps its token for 30 days, on this browser only.">
        <dl className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-3">
          <Row label="Signed in" value={fmtStamp(session?.signedInAt)} mono />
          <Row label="Remembered until" value={remembered ? fmtStamp(expiry ?? session?.expiresAt) : 'Not remembered'} mono />
          <div className="flex flex-col gap-2">
            <dt className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Appearance</dt>
            <dd className="flex items-center gap-3 text-[13px] text-ink">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <span className="capitalize">{theme}</span>
            </dd>
          </div>
        </dl>
      </Panel>

      {/* ── Password ────────────────────────────────────────── */}
      <Panel code="Password" title="Change your password" hint="Forgotten it? Sign out and use “Forgot password” on the staff door; a reset link is emailed to your sign-in address.">
        <ChangePasswordForm />
      </Panel>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{label}</dt>
      <dd className={`${mono ? 'mono text-[12.5px] tracking-[0.02em]' : 'text-[14px]'} break-words text-ink`}>{value}</dd>
    </div>
  );
}
