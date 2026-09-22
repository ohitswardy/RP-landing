import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch, ApiError, getTokenExpiry } from '../lib/api';
import { fmtDate, REPORT_CATEGORIES, REPORT_COMPANIES } from '../cms/data';
import { usePortal } from './auth';
import { useAppTheme } from '../lib/theme';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { Select, type SelectOption } from '../cms/kit/pickers';
import { notify } from './notice';
import { usePreferences, DEFAULT_PREFERENCES, type DefaultView } from './preferences';
import { IconSignOut, IconArrowRight, IconEye, IconEyeOff, IconCheck } from '../cms/icons';

const EASE = [0.25, 1, 0.5, 1] as const;

/* ─────────────────────────────────────────────────────────────
   /portal/account — the client's own page: who the mandate is,
   what it covers, a password change, the theme, and the per-
   viewer conveniences the dashboard reads on load.
   ───────────────────────────────────────────────────────────── */

type Profile = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  firm: string | null;
  clientType: string | null;
  sectorPrefs: string[];
  preferredAnalysts: string[];
  memberSince: string | null;
};

const VIEW_OPTIONS: SelectOption[] = [
  { id: 'latest', label: 'Latest reports', hint: 'Newest first, with the featured card' },
  { id: 'all', label: 'All reports', hint: 'The whole catalog as a grid' },
  ...REPORT_CATEGORIES.map((c) => ({ id: c, label: c, group: 'Sector' })),
];

const COMPANY_OPTIONS: SelectOption[] = [
  { id: 'none', label: 'No filter', hint: 'Local and foreign together' },
  ...REPORT_COMPANIES.map((c) => ({ id: c.value, label: c.label })),
];

export default function PortalAccount() {
  const { client, signOut } = usePortal();
  const { theme, toggle: toggleTheme } = useAppTheme();

  return (
    <div className="min-h-[100dvh] bg-bone text-ink">
      {/* ── Top bar — same geometry as the dashboard's ────────── */}
      <header className="sticky top-0 z-30 border-b rule bg-white">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-5 h-16 md:px-8">
          <Link to="/portal" className="flex items-center shrink-0">
            <img src="/Banner.png" alt="Regis Partners" className="brand-banner" style={{ height: '56px', width: 'auto' }} draggable={false} />
          </Link>
          <div className="ml-auto flex items-center gap-5">
            <Link
              to="/portal"
              className="mono inline-flex h-9 items-center gap-2 border rule px-3.5 text-[10.5px] uppercase tracking-[0.16em] text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
            >
              <IconArrowRight size={12} className="rotate-180" /> Research
            </Link>
            <div className="hidden text-right sm:block">
              <div className="text-[13px] leading-tight text-ink">{client?.name}</div>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">{client?.firm}</div>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 shrink-0 place-items-center border rule text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:scale-[0.94]"
            >
              <IconSignOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="border-b rule pb-9"
        >
          <div className="eyebrow mb-4">Account</div>
          <h1 className="text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] tracking-[-0.03em]">Your mandate.</h1>
          <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-slate">
            The identity Regis issued, the coverage you are provisioned to read, and the few things
            you can set for yourself. Anything about the mandate itself changes through your coverage.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
          <div className="min-w-0 space-y-8">
            <ProfileCard />
            <PreferencesCard />
          </div>
          <div className="min-w-0 space-y-8">
            <PasswordCard />
            <SessionCard theme={theme} onToggleTheme={toggleTheme} onSignOut={signOut} />
          </div>
        </div>
      </main>

      <footer className="mono border-t rule bg-paper px-5 py-5 text-[10px] uppercase tracking-[0.18em] text-graphite md:px-8">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Regis Partners · Institutional research, provisioned by mandate</span>
          <span>Redistribution outside your firm is prohibited</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Card chrome ─────────────────────────────────────────────── */

function Card({ eyebrow, title, aside, delay = 0, children }: {
  eyebrow: string; title: string; aside?: ReactNode; delay?: number; children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
      className="relative border rule bg-white"
    >
      <span aria-hidden className="absolute left-0 top-0 block h-[2px] w-8" style={{ background: 'var(--color-amber)' }} />
      <div className="flex items-start justify-between gap-4 border-b rule px-6 py-5 md:px-7">
        <div>
          <div className="mono text-[9.5px] uppercase tracking-[0.22em] text-graphite">{eyebrow}</div>
          <h2 className="mt-1.5 text-[17px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
        </div>
        {aside}
      </div>
      <div className="px-6 py-6 md:px-7">{children}</div>
    </motion.section>
  );
}

function Row({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[150px_1fr] sm:gap-6">
      <dt className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite sm:pt-0.5">{label}</dt>
      <dd className={`min-w-0 text-[13.5px] text-ink ${mono ? 'mono tracking-[0.02em]' : ''}`}>{children}</dd>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="mono inline-flex items-center border rule bg-bone px-2.5 py-1 text-[10.5px] uppercase tracking-[0.12em] text-slate">
      {children}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[150px_1fr] gap-6">
          <div className="h-3 w-20 skeleton-bar" style={{ animationDelay: `${i * 80}ms` }} />
          <div className="h-3 skeleton-bar" style={{ width: `${60 - i * 6}%`, animationDelay: `${i * 80 + 40}ms` }} />
        </div>
      ))}
    </div>
  );
}

/* ── Profile ─────────────────────────────────────────────────── */

function ProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    apiFetch<{ profile: Profile }>('/portal/profile', { audience: 'portal' })
      .then((data) => { if (alive) setProfile(data.profile); })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return;
        setError(e instanceof Error ? e.message : 'Your profile could not be loaded.');
      });
    return () => { alive = false; };
  }, [attempt]);

  const wholeCatalog = profile && profile.sectorPrefs.length === 0 && profile.preferredAnalysts.length === 0;

  return (
    <Card eyebrow="Profile" title="Who this mandate is">
      {error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-[13.5px] text-graphite">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mono border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"
          >
            Retry
          </button>
        </div>
      ) : !profile ? (
        <SkeletonRows />
      ) : (
        <dl className="divide-y rule">
          <Row label="Name">{profile.name}</Row>
          <Row label="User id" mono>{profile.username ?? <span className="text-silver">Not issued</span>}</Row>
          <Row label="Email" mono>{profile.email}</Row>
          <Row label="Firm">{profile.firm ?? <span className="text-silver">—</span>}</Row>
          <Row label="Client type">
            {profile.clientType ? <Tag>{profile.clientType}</Tag> : <span className="text-silver">—</span>}
          </Row>
          <Row label="Coverage">
            {wholeCatalog ? (
              <span className="inline-flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-amber)' }} />
                Whole catalog
              </span>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="mono mb-1.5 text-[9.5px] uppercase tracking-[0.18em] text-silver">Sectors</div>
                  {profile.sectorPrefs.length ? (
                    <div className="flex flex-wrap gap-1.5">{profile.sectorPrefs.map((s) => <Tag key={s}>{s}</Tag>)}</div>
                  ) : <span className="text-[13px] text-graphite">Every sector</span>}
                </div>
                <div>
                  <div className="mono mb-1.5 text-[9.5px] uppercase tracking-[0.18em] text-silver">Preferred analysts</div>
                  {profile.preferredAnalysts.length ? (
                    <div className="flex flex-wrap gap-1.5">{profile.preferredAnalysts.map((a) => <Tag key={a}>{a}</Tag>)}</div>
                  ) : <span className="text-[13px] text-graphite">Every analyst</span>}
                </div>
              </div>
            )}
          </Row>
          <Row label="Member since" mono>
            {profile.memberSince ? fmtDate(profile.memberSince.slice(0, 10)) : <span className="text-silver">—</span>}
          </Row>
        </dl>
      )}
      <p className="mono mt-5 text-[10px] uppercase tracking-[0.16em] text-silver">
        To widen coverage or change these details, contact your Regis coverage.
      </p>
    </Card>
  );
}

/* ── Preferences (this browser only) ─────────────────────────── */

function PreferencesCard() {
  const [prefs, setPrefs] = usePreferences();
  const dirty = prefs.defaultView !== DEFAULT_PREFERENCES.defaultView || prefs.defaultCompany !== DEFAULT_PREFERENCES.defaultCompany;

  return (
    <Card
      eyebrow="Preferences"
      title="How the research page opens"
      delay={0.06}
      aside={dirty ? (
        <button
          type="button"
          onClick={() => setPrefs({ ...DEFAULT_PREFERENCES })}
          className="mono shrink-0 border rule px-3 py-1.5 text-[9.5px] uppercase tracking-[0.14em] text-graphite transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"
        >
          Reset
        </button>
      ) : undefined}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Select
          label="Default view"
          options={VIEW_OPTIONS}
          value={prefs.defaultView}
          onChange={(id) => setPrefs({ defaultView: (id ?? 'latest') as DefaultView })}
          searchable
        />
        <Select
          label="Default company filter"
          options={COMPANY_OPTIONS}
          value={prefs.defaultCompany ?? 'none'}
          onChange={(id) => setPrefs({ defaultCompany: id === 'Local' || id === 'Foreign' ? id : null })}
        />
      </div>
      <p className="mt-5 text-[12.5px] leading-relaxed text-graphite">
        Stored in this browser only — they follow the device, not the account. Filters you set while
        reading still win for that visit.
      </p>
    </Card>
  );
}

/* ── Password ────────────────────────────────────────────────── */

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 5000);
    return () => clearTimeout(t);
  }, [saved]);

  async function submit() {
    const errs: Record<string, string> = {};
    if (!current) errs.current = 'Enter your current password.';
    if (next.length < 8) errs.password = 'Choose a password of at least 8 characters.';
    else if (next === current) errs.password = 'Choose a password different from the current one.';
    if (next !== confirm) errs.password_confirmation = 'The two new passwords do not match.';
    setFieldErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await apiFetch<{ ok: boolean }>('/portal/password', {
        method: 'PUT',
        audience: 'portal',
        body: { current, password: next, password_confirmation: confirm },
      });
      setCurrent(''); setNext(''); setConfirm('');
      setSaved(true);
      notify('Password changed. Every other device has been signed out.', { tone: 'ok' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.errors)) if (v?.[0]) mapped[k] = v[0];
        setFieldErrors(mapped);
        if (!Object.keys(mapped).length) setFormError(e.message);
      } else if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        /* the auth listener is taking the client to the door */
      } else {
        setFormError(e instanceof Error ? e.message : 'The password could not be changed. Try again shortly.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      eyebrow="Security"
      title="Change password"
      delay={0.04}
      aside={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          className="mono inline-flex shrink-0 items-center gap-1.5 border rule px-3 py-1.5 text-[9.5px] uppercase tracking-[0.14em] text-graphite transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"
        >
          {show ? <IconEyeOff size={12} /> : <IconEye size={12} />} {show ? 'Hide' : 'Show'}
        </button>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <PasswordInput label="Current password" value={current} onChange={setCurrent} show={show} autoComplete="current-password" error={fieldErrors.current} />
        <PasswordInput label="New password" value={next} onChange={setNext} show={show} autoComplete="new-password" placeholder="At least 8 characters" error={fieldErrors.password} />
        <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} show={show} autoComplete="new-password" placeholder="Repeat it" error={fieldErrors.password_confirmation} />

        {formError && (
          <p role="alert" className="border-l-2 pl-3.5 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
            {formError}
          </p>
        )}

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center gap-2.5 bg-navy px-5 text-[13px] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)] active:translate-y-px disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? 'Saving…' : 'Update password'}
            {!busy && <IconArrowRight size={13} />}
          </button>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]"
              style={{ color: 'var(--color-amber-deep)' }}
            >
              <IconCheck size={12} /> Changed
            </motion.span>
          )}
        </div>
        <p className="text-[12.5px] leading-relaxed text-graphite">
          Changing it signs out every other device but keeps this one.
        </p>
      </form>
    </Card>
  );
}

function PasswordInput({ label, value, onChange, show, error, placeholder, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; error?: string; placeholder?: string; autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mono mb-2 block text-[9.5px] uppercase tracking-[0.2em] text-graphite">{label}</span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••••••'}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error) || undefined}
        className="w-full border bg-white px-4 py-3 text-[14px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
        style={{ borderColor: error ? 'var(--color-warn)' : 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
      />
      {error && (
        <span role="alert" className="mt-1.5 block text-[12px] leading-relaxed" style={{ color: 'var(--color-warn)' }}>{error}</span>
      )}
    </label>
  );
}

/* ── Session ─────────────────────────────────────────────────── */

function SessionCard({ theme, onToggleTheme, onSignOut }: { theme: 'light' | 'dark'; onToggleTheme: () => void; onSignOut: () => void }) {
  const { client } = usePortal();
  const expiry = useMemo(() => getTokenExpiry('portal'), []);
  const rememberedUntil = expiry ? fmtDate(expiry.slice(0, 10)) : null;

  return (
    <Card eyebrow="Session" title="This device" delay={0.08}>
      <dl className="divide-y rule">
        <Row label="Appearance">
          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <span className="text-[13px] text-slate">{theme === 'dark' ? 'Dark' : 'Light'} · shared with every Regis sign-in on this browser</span>
          </div>
        </Row>
        <Row label="Signed in" mono>
          {client?.signedInAt ? fmtDate(client.signedInAt.slice(0, 10)) : '—'}
        </Row>
        <Row label="Remembered">
          {rememberedUntil ? (
            <span>Until <span className="mono">{rememberedUntil}</span> on this device</span>
          ) : (
            <span className="text-graphite">This tab only — closing it signs you out</span>
          )}
        </Row>
      </dl>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-6 inline-flex h-11 items-center gap-2.5 border rule px-5 text-[13px] text-slate transition-colors duration-300 hover:border-[color:var(--color-warn)] hover:text-ink active:translate-y-px"
      >
        <IconSignOut size={15} /> Sign out
      </button>
    </Card>
  );
}
