import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Field } from '../components/PortalAuth';
import { apiFetch, ApiError } from '../lib/api';

const EASE = [0.25, 1, 0.5, 1] as const;

export type ForgotKind = 'client' | 'staff';

/**
 * Self-service "forgot password" for either door. Both endpoints answer
 * the same neutral 200 whether or not the account exists, and this page
 * shows the same copy either way — it can never confirm an account.
 *
 *   /forgot-password        → POST /api/portal/forgot-password {identity}
 *   /forgot-password/staff  → POST /api/cms/forgot-password {email}
 *
 * The emailed link lands on /portal/reset/{token} (clients) or
 * /cms/reset/{token} (staff), which finish the flow.
 */
const KINDS: Record<ForgotKind, {
  code: string;
  eyebrow: string;
  heading: string;
  lead: string;
  label: string;
  placeholder: string;
  type: string;
  path: string;
  field: 'identity' | 'email';
  back: { to: string; label: string };
  cta: string;
  other: { to: string; label: string };
}> = {
  client: {
    code: '001 / Reset',
    eyebrow: 'Client portal',
    heading: 'Reset your password.',
    lead: 'Enter the Regis user id or the email address on your portal account. If it matches an account, a single-use link will be on its way within a minute.',
    label: 'User ID / Email',
    placeholder: 'Your Regis user id, or you@firm.com',
    type: 'text',
    path: '/portal/forgot-password',
    field: 'identity',
    back: { to: '/login', label: 'Back to client login' },
    cta: 'Send reset link',
    other: { to: '/forgot-password/staff', label: 'Regis staff? Reset a staff password' },
  },
  staff: {
    code: '002 / Reset',
    eyebrow: 'Staff access',
    heading: 'Reset your staff password.',
    lead: 'Enter the email address on your Regis staff account. If it matches, a single-use link will be sent there. Imported accounts that have never had a password set can be reset the same way.',
    label: 'Staff email',
    placeholder: 'name@regis.ph',
    type: 'email',
    path: '/cms/forgot-password',
    field: 'email',
    back: { to: '/login/cms', label: 'Back to staff login' },
    cta: 'Send reset link',
    other: { to: '/forgot-password', label: 'Client? Reset a portal password' },
  },
};

const NEUTRAL = 'If an account matches, a link to reset your password is on its way to its email address.';

export default function ForgotPassword({ kind = 'client' }: { kind?: ForgotKind }) {
  const cfg = KINDS[kind];
  const [identity, setIdentity] = useState('');
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Reset password — Regis Partners';
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const value = identity.trim();
    if (!value) { setError(`Enter your ${cfg.label.toLowerCase()}.`); return; }
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; message?: string }>(cfg.path, {
        method: 'POST',
        body: { [cfg.field]: value },
      });
      setDone(res.message || NEUTRAL);
    } catch (err) {
      // A 422 is the only non-neutral answer (malformed email); anything else
      // is an outage and says so without hinting whether the account exists.
      if (err instanceof ApiError && err.status === 422) setError(err.message);
      else setError('The request could not be sent just now. Please try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative min-h-[calc(100vh-6.25rem)] overflow-hidden bg-white text-[#0d0d0d]">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(13,13,13,0.07) 1px, transparent 1.4px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 40%, transparent 35%, rgba(255,255,255,0.9) 100%)' }}
      />

      <div className="container-fluid relative grid grid-cols-12 items-center gap-x-6 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="col-span-12 lg:col-span-5"
        >
          <span className="mono inline-flex items-center gap-2.5 text-[10px] uppercase tracking-[0.24em] text-black/45">
            <span aria-hidden className="block h-[2px] w-5" style={{ background: 'var(--color-amber)' }} />
            {cfg.eyebrow}
          </span>
          <h1 className="mt-7 max-w-[14ch] text-[clamp(2rem,4.2vw,3.6rem)] font-medium leading-[1.06] tracking-[-0.024em]">
            {cfg.heading}
          </h1>
          <p className="mt-7 max-w-[48ch] text-[15px] leading-[1.7] text-black/55">{cfg.lead}</p>
          <Link to={cfg.back.to} className="mt-9 inline-flex items-center gap-3 text-[13.5px] text-black/60 transition-colors hover:text-black">
            <span aria-hidden>←</span> {cfg.back.label}
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE, delay: 0.2 }}
          className="col-span-12 mt-14 lg:col-span-5 lg:col-start-8 lg:mt-0"
        >
          <div className="relative overflow-hidden rounded-[20px] border border-black/[0.07] bg-white/55 p-7 backdrop-blur-2xl md:p-10 [box-shadow:0_30px_90px_-32px_rgba(13,13,13,0.28),0_1px_0_rgba(255,255,255,0.9)_inset]">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(13,13,13,0.18), transparent)' }}
            />
            <div className="mb-9 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-black/40">
              <span>Recovery</span>
              <span>{cfg.code}</span>
            </div>

            {done ? (
              <div role="status" className="space-y-7">
                <span aria-hidden className="block h-[2px] w-8" style={{ background: 'var(--color-amber)' }} />
                <p className="text-[17px] font-medium leading-[1.35] tracking-[-0.012em]">Check your inbox.</p>
                <p className="text-[13.5px] leading-relaxed text-black/60">{done}</p>
                <p className="text-[12.5px] leading-relaxed text-black/45">
                  The link is single-use and expires within a day. If nothing arrives, check the address you entered and your junk folder, then try again.
                </p>
                <div className="h-px bg-black/10" />
                <Link to={cfg.back.to} className="inline-flex items-center gap-2.5 text-[13.5px] text-[#0d0d0d] underline-offset-4 hover:underline">
                  {cfg.back.label} <span aria-hidden>→</span>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-9" noValidate>
                <Field
                  id="identity"
                  label={cfg.label}
                  value={identity}
                  setValue={setIdentity}
                  focus={focus}
                  setFocus={setFocus}
                  type={cfg.type}
                  placeholder={cfg.placeholder}
                />

                {error && (
                  <p role="alert" className="border-l-2 pl-3.5 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
                    {error}
                  </p>
                )}

                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  type="submit"
                  disabled={busy}
                  className="group relative w-full overflow-hidden rounded-full bg-[navy] py-4 text-[13.5px] tracking-[0.005em] text-white disabled:cursor-wait"
                >
                  <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
                    {busy ? (
                      <>
                        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--color-amber)' }} />
                        Sending
                      </>
                    ) : (
                      <>
                        {cfg.cta}
                        <span className="transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-1">→</span>
                      </>
                    )}
                  </span>
                  <span aria-hidden className="absolute inset-0 -translate-y-full bg-[#1d1d1f] transition-transform duration-[450ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-y-0" />
                </motion.button>

                <div className="h-px bg-black/10" />

                <p className="text-[12.5px] leading-relaxed text-black/50">
                  <Link to={cfg.other.to} className="text-[#0d0d0d] underline-offset-4 hover:underline">{cfg.other.label}</Link>
                  . Still stuck?{' '}
                  <Link to="/contact" className="text-[#0d0d0d] underline-offset-4 hover:underline">Contact the desk</Link>.
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
