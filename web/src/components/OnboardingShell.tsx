import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const EASE = [0.25, 1, 0.5, 1] as const;

/* ─────────────────────────────────────────────────────────────
   Standalone frame for the two pages a client reaches from an
   emailed link. Carries the same perforated dot canvas as the
   sign-in page so the flow reads as one system.
   ───────────────────────────────────────────────────────────── */

export type ShellStatus = 'loading' | 'error' | 'ready';

export default function OnboardingShell({
  code, title, intro, status, error, children,
}: {
  code: string;
  title: string;
  intro: ReactNode;
  status: ShellStatus;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-white text-ink">
      {/* Perforated dot-matrix canvas */}
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
        style={{ background: 'radial-gradient(120% 80% at 50% 30%, transparent 30%, rgba(255,255,255,0.92) 100%)' }}
      />

      {/* Header */}
      <header className="relative border-b" style={{ borderColor: 'rgba(13,13,13,0.08)' }}>
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-5 py-4 md:px-8">
          <Link to="/" className="flex items-center">
            <img src="/Banner.png" alt="Regis Partners" style={{ height: '44px', width: 'auto' }} draggable={false} />
          </Link>
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-graphite">{code}</span>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[620px] px-5 pb-24 pt-14 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span aria-hidden className="block h-[2px] w-7" style={{ background: 'var(--color-amber)' }} />
          <h1 className="mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-medium leading-[1.06] tracking-[-0.03em]">
            {title}
          </h1>
          <div className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-slate">{intro}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
          className="mt-10"
        >
          {status === 'loading' ? (
            <div className="grid min-h-[220px] place-items-center border border-dashed" style={{ borderColor: 'rgba(13,13,13,0.14)' }}>
              <span className="mono text-[10.5px] uppercase tracking-[0.24em] text-graphite">Verifying link…</span>
            </div>
          ) : status === 'error' ? (
            <div className="border bg-white px-7 py-10" style={{ borderColor: 'color-mix(in oklab, var(--color-warn) 40%, transparent)' }}>
              <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-warn)' }} />
              <p className="mt-5 text-[16px] font-medium text-ink">This link cannot be opened.</p>
              <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-graphite">
                {error ?? 'The link is no longer valid.'}
              </p>
              <Link
                to="/contact"
                className="mono mt-6 inline-block border px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"
                style={{ borderColor: 'rgba(13,13,13,0.14)' }}
              >
                Contact Regis
              </Link>
            </div>
          ) : (
            children
          )}
        </motion.div>
      </main>

      <footer className="mono relative border-t px-5 py-5 text-[10px] uppercase tracking-[0.18em] text-graphite md:px-8" style={{ borderColor: 'rgba(13,13,13,0.08)' }}>
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Regis Partners · Institutional research</span>
          <span>Provisioned by mandate</span>
        </div>
      </footer>
    </div>
  );
}

/** Read-only identity strip: the details Regis issued, not editable here. */
export function IssuedStrip({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid grid-cols-1 gap-px border sm:grid-cols-2" style={{ borderColor: 'rgba(13,13,13,0.12)', background: 'rgba(13,13,13,0.12)' }}>
      {rows.map((r) => (
        <div key={r.label} className="bg-white px-5 py-4">
          <dt className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">{r.label}</dt>
          <dd className="mono mt-1.5 truncate text-[13.5px] text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
