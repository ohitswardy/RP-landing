import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE } from '../../ui';
import { IconCheck, IconCopy, IconExternal } from '../../icons';
import { fill, segments, type Placeholders } from './templates';
import { writeClipboard } from '../../../lib/clipboard';

export { RuleField, PasswordField } from '../../../components/RuleField';

/* ─────────────────────────────────────────────────────────────
   Shared pieces for the onboarding panels. The register is the
   house one (ink on paper, amber as the only accent, 90-degree
   corners) with an exposed, instrument-like structure: dot-matrix
   plates, numbered steps, monospace metadata.
   ───────────────────────────────────────────────────────────── */

/** Perforated dot plate. Decorative only. */
export function DotPlate({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle, color-mix(in oklab, var(--color-ink) 15%, transparent) 1px, transparent 1.3px)',
        backgroundSize: '13px 13px',
      }}
    />
  );
}

/** Short amber rule. The house mark for "this is the live thing". */
export function Tick({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block h-[2px] w-6 ${className}`} style={{ background: 'var(--color-amber)' }} />;
}

/** Numbered section head: 01 / IDENTITY. */
export function StepHead({
  step, title, note, trailing, done = false,
}: {
  step: string; title: string; note?: string; trailing?: ReactNode; done?: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b rule pb-4">
      <div className="min-w-0">
        <div className="mono mb-2.5 flex items-center gap-2.5 text-[9.5px] uppercase tracking-[0.22em]">
          <span
            className="grid h-[18px] min-w-[18px] place-items-center px-1 text-[9px]"
            style={
              done
                ? { background: 'var(--color-amber-deep)', color: 'var(--color-paper)' }
                : { border: '1px solid color-mix(in oklab, var(--color-ink) 22%, transparent)', color: 'var(--color-graphite)' }
            }
          >
            {done ? <IconCheck size={10} /> : step}
          </span>
          <span className="text-graphite">{title}</span>
        </div>
        {note && <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-graphite">{note}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </header>
  );
}

/* ── Copy ──────────────────────────────────────────────────── */

export function CopyButton({
  text, label = 'Copy', copiedLabel = 'Copied', disabled = false, tone = 'ghost',
}: {
  text: string; label?: string; copiedLabel?: string; disabled?: boolean; tone?: 'ghost' | 'solid';
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const run = useCallback(async () => {
    const ok = await writeClipboard(text);
    setState(ok ? 'ok' : 'fail');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  }, [text]);

  const solid = tone === 'solid';

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={disabled}
      className={`mono inline-flex items-center gap-2 px-3.5 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors duration-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${
        solid
          ? 'bg-navy text-paper hover:bg-[color:var(--color-amber-deep)]'
          : 'border rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
      style={state === 'ok' && !solid ? { borderColor: 'var(--color-amber-deep)', color: 'var(--color-amber-deep)' } : undefined}
    >
      {state === 'ok' ? <IconCheck size={12} /> : <IconCopy size={12} />}
      {state === 'ok' ? copiedLabel : state === 'fail' ? 'Copy failed' : label}
    </button>
  );
}

/* ── Email preview ─────────────────────────────────────────── */

export function EmailPreview({
  title, body, values, hint, disabled = false,
}: {
  title: string;
  body: string;
  values: Placeholders;
  /** Shown under the header when the email is not ready to send. */
  hint?: string;
  disabled?: boolean;
}) {
  const text = fill(body, values);
  const runs = segments(text);
  const unresolved = runs.some((r) => r.pending);

  return (
    <div className="border rule bg-white">
      <div className="relative flex items-center justify-between gap-4 overflow-hidden border-b rule bg-bone px-4 py-3">
        <DotPlate className="opacity-50" />
        <span className="mono relative z-10 flex items-center gap-2.5 text-[9.5px] uppercase tracking-[0.22em] text-graphite">
          <Tick />
          {title}
        </span>
        <span className="relative z-10">
          <CopyButton
            text={text}
            label="Copy email"
            copiedLabel="Copied"
            disabled={disabled || unresolved}
            tone="solid"
          />
        </span>
      </div>

      {(hint || unresolved) && (
        <p className="border-b rule px-4 py-2.5 text-[12px] leading-relaxed text-graphite">
          {hint ?? 'Fields still marked in amber are filled in once the account is provisioned.'}
        </p>
      )}

      <pre className="mono max-h-[420px] overflow-auto whitespace-pre-wrap break-words px-4 py-5 text-[12px] leading-[1.75] text-ink">
        {runs.map((r, i) =>
          r.pending ? (
            <span key={i} style={{ color: 'var(--color-amber-deep)' }}>{r.text}</span>
          ) : (
            <span key={i}>{r.text}</span>
          ),
        )}
      </pre>
    </div>
  );
}

/* ── Generated link ────────────────────────────────────────── */

export function LinkBox({ url, expiresAt, label = 'Single-use link' }: { url: string; expiresAt?: string | null; label?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="border rule bg-white"
      style={{ borderColor: 'color-mix(in oklab, var(--color-amber-deep) 45%, transparent)' }}
    >
      <div className="flex items-center justify-between gap-3 border-b rule px-4 py-2.5">
        <span className="mono flex items-center gap-2.5 text-[9.5px] uppercase tracking-[0.22em]" style={{ color: 'var(--color-amber-deep)' }}>
          <Tick />
          {label}
        </span>
        {expiresAt && (
          <span className="mono num text-[10px] uppercase tracking-[0.12em] text-graphite">
            Expires {new Date(expiresAt).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="mono min-w-0 flex-1 break-all text-[11.5px] leading-relaxed text-slate">{url}</p>
        <div className="flex shrink-0 items-center gap-2">
          <CopyButton text={url} label="Copy link" />
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Open the client's page"
            aria-label="Open the client's page"
            className="grid h-[34px] w-[34px] place-items-center border rule text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
          >
            <IconExternal size={13} />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Small bits ────────────────────────────────────────────── */

export function Detail({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">{label}</dt>
      <dd className={`mt-1.5 truncate text-[13.5px] text-ink ${mono ? 'mono text-[12.5px]' : ''}`}>
        {value || <span className="text-silver">Not given</span>}
      </dd>
    </div>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  /** null leaves every segment unlit — "not set yet" reads as exactly that. */
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`mono border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
              on ? 'border-navy bg-navy text-paper' : 'rule bg-transparent text-graphite hover:text-ink'
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className={`ml-2 ${on ? 'opacity-60' : 'text-silver'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Placeholder body for a panel with nothing selected yet. */
export function PickPrompt({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="relative grid min-h-[280px] place-items-center overflow-hidden border border-dashed rule bg-white px-8 py-14 text-center">
      <DotPlate className="opacity-40" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <Tick />
        <p className="text-[15px] font-medium text-ink">{title}</p>
        <p className="max-w-[44ch] text-[13px] leading-relaxed text-graphite">{hint}</p>
      </div>
    </div>
  );
}

/** Inline success or failure note under a form. */
export function Note({ tone, children }: { tone: 'warn' | 'ok'; children: ReactNode }) {
  const color = tone === 'warn' ? 'var(--color-warn)' : 'var(--color-amber-deep)';
  return (
    <AnimatePresence initial={false}>
      <motion.p
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="border-l-2 pl-3 text-[12.5px] leading-relaxed"
        style={{ borderColor: color, color }}
      >
        {children}
      </motion.p>
    </AnimatePresence>
  );
}
