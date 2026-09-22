import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch, ApiError } from '../lib/api';
import OnboardingShell, { IssuedStrip, type ShellStatus } from '../components/OnboardingShell';
import { PasswordField } from '../components/RuleField';

const EASE = [0.25, 1, 0.5, 1] as const;

type AccountKind = 'client' | 'staff';

type Issued = {
  kind: AccountKind;
  client: { name: string; email: string; username: string | null };
  expiresAt: string | null;
};

/** What the link cannot do, by status: spent or expired (410), suspended
    (403), unknown (404), or unreachable. Each renders its own copy. */
type LinkFault = { code: 'spent' | 'suspended' | 'unknown' | 'offline'; message: string };

function faultOf(e: unknown): LinkFault {
  if (e instanceof ApiError) {
    if (e.status === 410) return { code: 'spent', message: e.message };
    if (e.status === 403) return { code: 'suspended', message: e.message };
    if (e.status === 404) return { code: 'unknown', message: e.message || 'This link is not recognised.' };
    return { code: 'offline', message: e.message };
  }
  return { code: 'offline', message: 'The reset service is unreachable. Try again shortly.' };
}

/** Everything that differs between the client and staff doors. */
const DOOR: Record<AccountKind, {
  code: string; title: string; done: string; signIn: string; cta: string; idLabel: string;
}> = {
  client: {
    code: '004 / Password reset',
    title: 'Choose a new password.',
    done: 'Every device that was signed in to your portal account has been signed out. Use your new password to sign back in.',
    signIn: '/login',
    cta: 'Sign in to the portal →',
    idLabel: 'User id',
  },
  staff: {
    code: '004 / Staff password',
    title: 'Set your staff password.',
    done: 'Every device that was signed in to your staff account has been signed out. Use your new password at the CMS door.',
    signIn: '/login/cms',
    cta: 'Sign in to the CMS →',
    idLabel: 'Account',
  },
};

/** The page behind a password-reset link, for clients (/portal/reset/…) and
    staff (/cms/reset/…) alike. One use, then the link is spent. */
export default function PortalResetPassword() {
  const { token = '' } = useParams();
  const [status, setStatus] = useState<ShellStatus>('loading');
  const [fault, setFault] = useState<LinkFault | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The kind the POST confirmed — the redirect target after success. */
  const [done, setDone] = useState<AccountKind | null>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<Issued>(`/portal/reset/${token}`)
      .then((data) => {
        if (!alive) return;
        setIssued({ ...data, kind: data.kind === 'staff' ? 'staff' : 'client' });
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setFault(faultOf(e));
        setStatus('error');
      });
    return () => { alive = false; };
  }, [token]);

  const kind: AccountKind = issued?.kind ?? (window.location.pathname.startsWith('/cms/') ? 'staff' : 'client');
  const door = DOOR[kind];

  async function submit() {
    if (pwd.length < 8) { setError('Choose a password of at least 8 characters.'); return; }
    if (pwd !== pwd2) { setError('The two passwords do not match.'); return; }

    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; kind?: AccountKind }>(`/portal/reset/${token}`, {
        method: 'POST',
        body: { password: pwd, password_confirmation: pwd2 },
      });
      setDone(res.kind === 'staff' ? 'staff' : kind);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 410 || e.status === 403 || e.status === 404)) {
        // The link died between opening the page and submitting — show the link state, not a field error.
        setFault(faultOf(e));
        setStatus('error');
        return;
      }
      setError(e instanceof ApiError ? e.message : 'The password could not be changed. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  const strip = issued && (
    <IssuedStrip
      rows={[
        { label: door.idLabel, value: kind === 'staff' ? issued.client.name : (issued.client.username ?? '—') },
        { label: 'Email', value: issued.client.email },
      ]}
    />
  );

  if (done) {
    const finished = DOOR[done];
    return (
      <OnboardingShell
        code={finished.code}
        title="Your password is changed."
        intro={finished.done}
        status="ready"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="space-y-8"
        >
          {strip}
          <Link
            to={finished.signIn}
            className="mono inline-flex items-center gap-2.5 bg-navy px-6 py-3.5 text-[11px] uppercase tracking-[0.16em] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)]"
          >
            {finished.cta}
          </Link>
        </motion.div>
      </OnboardingShell>
    );
  }

  if (status === 'error' && fault) {
    return (
      <OnboardingShell
        code={door.code}
        title={
          fault.code === 'spent' ? 'This link has been used up.'
            : fault.code === 'suspended' ? 'This account is suspended.'
              : fault.code === 'unknown' ? 'This link is not recognised.'
                : 'The reset service is unreachable.'
        }
        intro={
          fault.code === 'spent'
            ? 'Reset links work once and expire on their own. Ask for a fresh one and open it straight away.'
            : fault.code === 'suspended'
              ? 'Passwords cannot be changed on a suspended account. Access has to be restored first.'
              : fault.code === 'unknown'
                ? 'Check that the whole link was copied from the email. A link that was retyped or trimmed will not open.'
                : 'Nothing about your account has changed. Try the link again in a moment.'
        }
        status="ready"
      >
        <div className="border bg-white px-7 py-10" style={{ borderColor: 'color-mix(in oklab, var(--color-warn) 40%, transparent)' }}>
          <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-warn)' }} />
          <p role="alert" className="mt-5 max-w-[46ch] text-[14px] leading-relaxed text-ink">{fault.message}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {fault.code === 'offline' ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mono inline-flex items-center gap-2.5 bg-navy px-6 py-3.5 text-[11px] uppercase tracking-[0.16em] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)]"
            >
              Try again →
            </button>
          ) : (
            <Link
              to={door.signIn}
              className="mono inline-flex items-center gap-2.5 bg-navy px-6 py-3.5 text-[11px] uppercase tracking-[0.16em] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)]"
            >
              {fault.code === 'suspended' ? 'Back to sign-in →' : 'Request a new link →'}
            </Link>
          )}
          <Link to="/contact" className="mono text-[10.5px] uppercase tracking-[0.16em] text-graphite underline-offset-4 hover:text-ink hover:underline">
            Contact Regis
          </Link>
        </div>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      code={door.code}
      title={door.title}
      intro={
        kind === 'staff'
          ? 'This link works once. Setting a password signs your staff account out of every device it is currently open on, CMS and CRMS alike.'
          : 'This link works once. Setting a password signs your account out of every device it is currently open on.'
      }
      status={status}
      error={fault?.message}
    >
      <div className="space-y-9">
        {strip}

        <div className="space-y-8 border bg-white px-6 py-8 md:px-8" style={{ borderColor: 'rgba(13,13,13,0.12)' }}>
          <div className="mono flex items-center gap-2.5 text-[9.5px] uppercase tracking-[0.22em] text-graphite">
            <span aria-hidden className="block h-[2px] w-5" style={{ background: 'var(--color-amber)' }} />
            New password
          </div>

          <PasswordField size="lg" label="Password" value={pwd} onChange={setPwd} placeholder="At least 8 characters" autoComplete="new-password" />
          <PasswordField size="lg" label="Confirm password" value={pwd2} onChange={setPwd2} placeholder="Repeat it" autoComplete="new-password" onEnter={() => void submit()} />

          {error && (
            <p role="alert" className="border-l-2 pl-3.5 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="group relative w-full overflow-hidden bg-navy py-4 text-[13.5px] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)] active:translate-y-px disabled:cursor-wait disabled:opacity-70"
          >
            <span className="inline-flex items-center justify-center gap-2.5">
              {busy ? 'Saving…' : kind === 'staff' ? 'Set staff password' : 'Set new password'}
              {!busy && <span className="transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-1">→</span>}
            </span>
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
