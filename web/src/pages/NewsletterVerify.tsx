import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ArrowCta from '../components/ArrowCta';
import { apiFetch, ApiError } from '../lib/api';

const EASE = [0.25, 1, 0.5, 1] as const;

type VerifyState =
  | { status: 'checking' }
  | { status: 'confirmed'; email: string }
  | { status: 'invalid'; message: string }
  | { status: 'error' };

/**
 * /newsletter/verify/:token — the double opt-in landing. One call to the
 * verify endpoint; 200 confirms the address, 404 means the link is dead.
 */
export default function NewsletterVerify() {
  const { token } = useParams();
  const [state, setState] = useState<VerifyState>({ status: 'checking' });

  useEffect(() => {
    document.title = 'Newsletter confirmation — Regis Partners';
    if (!token) { setState({ status: 'invalid', message: 'That confirmation link is not valid.' }); return; }
    let alive = true;
    apiFetch<{ ok: boolean; email?: string; message?: string }>(`/newsletter/verify/${encodeURIComponent(token)}`)
      .then((res) => {
        if (!alive) return;
        if (res.ok && res.email) setState({ status: 'confirmed', email: res.email });
        else setState({ status: 'invalid', message: res.message ?? 'That confirmation link is not valid.' });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: 'invalid', message: err.message || 'That confirmation link is not valid.' });
        } else {
          setState({ status: 'error' });
        }
      });
    return () => { alive = false; };
  }, [token]);

  const copy = COPY[state.status];

  return (
    <section className="relative overflow-hidden bg-navy text-paper">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 4%, transparent) 1px, transparent 1px),' +
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />
      <div
        aria-hidden
        className="absolute -right-40 -bottom-40 h-[640px] w-[640px] rounded-full pointer-events-none opacity-[0.16]"
        style={{ background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)' }}
      />

      <div className="container-fluid relative pt-20 pb-24 md:pt-28 md:pb-32">
        <motion.div
          key={state.status}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="max-w-3xl"
        >
          <div className="eyebrow eyebrow-paper mb-10">
            {state.status === 'checking' && (
              <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--color-amber)' }} />
            )}
            {copy.eyebrow}
          </div>
          <h1 className="max-w-[18ch] text-[clamp(2.2rem,5vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.026em]">
            {copy.title}
          </h1>
          <p className="mt-9 max-w-[56ch] text-[17px] leading-[1.6] text-paper/72">
            {state.status === 'confirmed' ? (
              <>
                <span className="text-paper">{state.email}</span> {copy.body}
              </>
            ) : state.status === 'invalid' ? (
              state.message
            ) : (
              copy.body
            )}
          </p>

          {state.status !== 'checking' && (
            <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-5">
              <ArrowCta to={state.status === 'confirmed' ? '/insights' : '/'} tone="paper">
                {state.status === 'confirmed' ? 'Read the latest notes' : 'Return to the front page'}
              </ArrowCta>
              {state.status !== 'confirmed' && (
                <Link to="/#newsletter" className="mono text-[10.5px] uppercase tracking-[0.2em] text-paper/55 hover:text-paper">
                  Subscribe again
                </Link>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

const COPY: Record<VerifyState['status'], { eyebrow: string; title: string; body: string }> = {
  checking: {
    eyebrow: 'Newsletter',
    title: 'Confirming your address.',
    body: 'One moment while we check the link.',
  },
  confirmed: {
    eyebrow: 'Newsletter · Confirmed',
    title: 'You are on the list.',
    body: 'will receive the Regis Partners newsletter from the next issue. Every mail carries a one-click unsubscribe link.',
  },
  invalid: {
    eyebrow: 'Newsletter · Link not valid',
    title: 'This confirmation link does not work.',
    body: '',
  },
  error: {
    eyebrow: 'Newsletter · Try again',
    title: 'We could not confirm the address just now.',
    body: 'The link looks fine but the server did not answer. Please open it again in a moment; it stays valid.',
  },
};
