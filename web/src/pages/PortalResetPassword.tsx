import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch, ApiError } from '../lib/api';
import OnboardingShell, { IssuedStrip, type ShellStatus } from '../components/OnboardingShell';
import { PasswordField } from '../components/RuleField';

const EASE = [0.25, 1, 0.5, 1] as const;

type Issued = { client: { name: string; email: string; username: string | null } };

/** The page behind a password-reset link. One use, then the link is spent. */
export default function PortalResetPassword() {
  const { token = '' } = useParams();
  const [status, setStatus] = useState<ShellStatus>('loading');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<Issued>(`/portal/reset/${token}`)
      .then((data) => {
        if (!alive) return;
        setIssued(data);
        setStatus('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setLinkError(e instanceof ApiError ? e.message : 'The reset service is unreachable. Try again shortly.');
        setStatus('error');
      });
    return () => { alive = false; };
  }, [token]);

  async function submit() {
    if (pwd.length < 8) { setError('Choose a password of at least 8 characters.'); return; }
    if (pwd !== pwd2) { setError('The two passwords do not match.'); return; }

    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/portal/reset/${token}`, {
        method: 'POST',
        body: { password: pwd, password_confirmation: pwd2 },
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The password could not be changed. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <OnboardingShell
        code="004 / Password reset"
        title="Your password is changed."
        intro="Every device that was signed in to your account has been signed out. Use your new password to sign back in."
        status="ready"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="space-y-8"
        >
          {issued && (
            <IssuedStrip
              rows={[
                { label: 'User id', value: issued.client.username ?? '—' },
                { label: 'Email', value: issued.client.email },
              ]}
            />
          )}
          <Link
            to="/login"
            className="mono inline-flex items-center gap-2.5 bg-navy px-6 py-3.5 text-[11px] uppercase tracking-[0.16em] text-paper transition-colors duration-300 hover:bg-[color:var(--color-amber-deep)]"
          >
            Sign in to the portal →
          </Link>
        </motion.div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      code="004 / Password reset"
      title="Choose a new password."
      intro="This link works once. Setting a password signs your account out of every device it is currently open on."
      status={status}
      error={linkError}
    >
      <div className="space-y-9">
        {issued && (
          <IssuedStrip
            rows={[
              { label: 'User id', value: issued.client.username ?? '—' },
              { label: 'Email', value: issued.client.email },
            ]}
          />
        )}

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
              {busy ? 'Saving…' : 'Set new password'}
              {!busy && <span className="transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-1">→</span>}
            </span>
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
