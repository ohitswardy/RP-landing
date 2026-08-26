import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch, ApiError } from '../lib/api';
import OnboardingShell, { IssuedStrip, type ShellStatus } from '../components/OnboardingShell';
import { PasswordField, RuleField } from '../components/RuleField';

const EASE = [0.25, 1, 0.5, 1] as const;

type Issued = {
  client: { name: string; email: string; username: string | null; firm: string | null; position: string | null; phone: string | null };
  alreadySubmitted: boolean;
};

/**
 * The page behind [CREATE_PASSWORD_LINK]. The client confirms the details
 * Regis holds, adds their own, and sets a password. The account then waits
 * on an administrator's approval before it can sign in.
 */
export default function PortalRegister() {
  const { token = '' } = useParams();
  const [status, setStatus] = useState<ShellStatus>('loading');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  const [form, setForm] = useState({ name: '', firm: '', position: '', phone: '' });
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<Issued>(`/portal/register/${token}`)
      .then((data) => {
        if (!alive) return;
        setIssued(data);
        setForm({
          name: data.client.name ?? '',
          firm: data.client.firm ?? '',
          position: data.client.position ?? '',
          phone: data.client.phone ?? '',
        });
        setStatus('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setLinkError(e instanceof ApiError ? e.message : 'The registration service is unreachable. Try again shortly.');
        setStatus('error');
      });
    return () => { alive = false; };
  }, [token]);

  async function submit() {
    if (!form.name.trim()) { setError('Enter your full name.'); return; }
    if (!form.firm.trim()) { setError('Enter the firm you represent.'); return; }
    if (pwd.length < 8) { setError('Choose a password of at least 8 characters.'); return; }
    if (pwd !== pwd2) { setError('The two passwords do not match.'); return; }

    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/portal/register/${token}`, {
        method: 'POST',
        body: {
          name: form.name.trim(),
          firm: form.firm.trim(),
          position: form.position.trim() || null,
          phone: form.phone.trim() || null,
          password: pwd,
          password_confirmation: pwd2,
        },
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Your registration could not be submitted. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  /* ── Submitted ──────────────────────────────────────────── */
  if (done || (issued?.alreadySubmitted && status === 'ready')) {
    return (
      <OnboardingShell
        code="003 / Registration"
        title={done ? 'Registration received.' : 'This registration is already in.'}
        intro="Thank you for registering. We will review your application. If your sign-up is approved, you will receive an email with your user id and a link to access Regis Partners Research."
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
          <div className="border-l-2 pl-4" style={{ borderColor: 'var(--color-amber)' }}>
            <p className="text-[13.5px] leading-relaxed text-slate">
              Your password is set. Sign-in opens once an administrator approves the account, and we will email you when
              that happens. There is nothing further to do here.
            </p>
          </div>
          <Link
            to="/"
            className="mono inline-block border px-5 py-3 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"
            style={{ borderColor: 'rgba(13,13,13,0.14)' }}
          >
            Back to regis.ph
          </Link>
        </motion.div>
      </OnboardingShell>
    );
  }

  /* ── Form ───────────────────────────────────────────────── */
  return (
    <OnboardingShell
      code="003 / Registration"
      title="Complete your registration."
      intro={
        <>
          Confirm the details we hold, add anything missing, and choose the password you will use to reach Regis Partners
          Research. Your user id is issued by Regis and cannot be changed here.
        </>
      }
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
            Your details
          </div>

          <RuleField size="lg" label="Full name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="As it should appear on your account" autoComplete="name" />
          <RuleField size="lg" label="Firm" value={form.firm} onChange={(v) => setForm((f) => ({ ...f, firm: v }))} placeholder="The institution you represent" autoComplete="organization" />
          <RuleField size="lg" label="Position" value={form.position} onChange={(v) => setForm((f) => ({ ...f, position: v }))} placeholder="Portfolio Manager" hint="Optional." autoComplete="organization-title" />
          <RuleField size="lg" label="Telephone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+63 917 000 0000" hint="Optional. Used by your coverage team only." autoComplete="tel" />

          <div className="mono flex items-center gap-2.5 border-t pt-8 text-[9.5px] uppercase tracking-[0.22em] text-graphite" style={{ borderColor: 'rgba(13,13,13,0.10)' }}>
            <span aria-hidden className="block h-[2px] w-5" style={{ background: 'var(--color-amber)' }} />
            Your password
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
              {busy ? 'Submitting…' : 'Submit registration'}
              {!busy && <span className="transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-1">→</span>}
            </span>
          </button>

          <p className="text-[12px] leading-relaxed text-graphite">
            Submitting sends your application to Regis for review. You will receive an email once it is approved.
          </p>
        </div>
      </div>
    </OnboardingShell>
  );
}
