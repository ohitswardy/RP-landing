import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { IconX } from './icons';

export const EASE = [0.25, 1, 0.5, 1] as const;
export const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

/* ── Module header ─────────────────────────────────────────── */

export function ModuleHeader({
  code, title, blurb, actions,
}: {
  code: string; title: string; blurb: string; actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 border-b rule pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="eyebrow mb-4">{code}</div>
        <h1 className="text-[clamp(1.6rem,2.6vw,2.3rem)]">{title}</h1>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-slate">{blurb}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/* ── Status chip ───────────────────────────────────────────── */

const CHIP_TONES = {
  live:    { dot: 'var(--color-signal)',    text: 'var(--color-signal)' },
  amber:   { dot: 'var(--color-amber-deep)', text: 'var(--color-amber-deep)' },
  muted:   { dot: 'var(--color-silver)',    text: 'var(--color-graphite)' },
  warn:    { dot: 'var(--color-warn)',      text: 'var(--color-warn)' },
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export function Chip({ tone, children, pulse = false }: { tone: ChipTone; children: ReactNode; pulse?: boolean }) {
  const t = CHIP_TONES[tone];
  return (
    <span className="mono inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[10.5px] uppercase tracking-[0.14em]" style={{ color: t.text }}>
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: t.dot }}
          />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
      </span>
      {children}
    </span>
  );
}

/* ── Buttons ───────────────────────────────────────────────── */

export function BtnPrimary({ children, onClick, disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 bg-navy px-4 py-2.5 text-[13px] text-paper transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-[color:var(--color-amber-deep)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function BtnGhost({ children, onClick, danger = false, disabled = false }: {
  children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 border px-4 py-2.5 text-[13px] transition-colors duration-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'border-[color:var(--color-warn)]/40 text-[color:var(--color-warn)] hover:bg-[color:var(--color-warn)]/8'
          : 'rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/** Icon-only row action. */
export function RowAction({ label, onClick, children, danger = false, disabled = false }: {
  label: string; onClick?: () => void; children: ReactNode; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-8 w-8 shrink-0 place-items-center border rule transition-colors duration-200 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? 'text-graphite hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)]'
               : 'text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/* ── Switch ────────────────────────────────────────────────── */

export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300"
      style={{ background: on ? 'var(--color-signal)' : 'var(--color-silver)' }}
    >
      <motion.span
        layout
        transition={SPRING}
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
        style={{ left: on ? 'calc(100% - 18px)' : '2px' }}
      />
    </button>
  );
}

/* ── Form fields (label above input, per house form rules) ─── */

export function TextField({
  label, value, onChange, placeholder, helper, error, multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; helper?: string; error?: string; multiline?: boolean;
}) {
  const cls =
    'w-full border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]';
  return (
    <div className="flex flex-col gap-2">
      <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{label}</label>
      {multiline ? (
        <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} resize-y leading-relaxed`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
      {helper && !error && <p className="text-[12px] text-graphite">{helper}</p>}
      {error && <p className="text-[12px]" style={{ color: 'var(--color-warn)' }}>{error}</p>}
    </div>
  );
}

export function DateField({ label, value, onChange, helper }: {
  label: string; value: string; onChange: (v: string) => void; helper?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
      />
      {helper && <p className="text-[12px] text-graphite">{helper}</p>}
    </div>
  );
}

export function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ── Edit drawer ───────────────────────────────────────────── */

export function Drawer({ open, title, onClose, children, footer }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Portalled to <body> so the backdrop is always sized to the real viewport —
  // nested inside the page it could get clipped to whatever ancestor happens
  // to establish a containing block (transform/overflow), leaving bits of the
  // rail undimmed.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'oklch(0.165 0.040 260 / 0.45)' }}
          />
          <motion.aside
            role="dialog"
            aria-label={title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: EASE }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-paper shadow-2xl"
          >
            <div className="flex items-center justify-between border-b rule px-7 py-5">
              <h2 className="text-[16px] font-medium tracking-[-0.01em]">{title}</h2>
              <button
                type="button"
                aria-label="Close panel"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center text-graphite transition-colors hover:text-ink"
              >
                <IconX />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-7 py-7">{children}</div>
            {footer && <div className="flex items-center justify-end gap-3 border-t rule px-7 py-4">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Empty & loading states ────────────────────────────────── */

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border rule border-dashed px-8 py-14">
      <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="max-w-[48ch] text-[13.5px] leading-relaxed text-graphite">{hint}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Layout-matched skeleton rows with a shimmer sweep. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y rule border-y rule" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 items-center gap-4 py-5">
          <div className="col-span-2 h-3 skeleton-bar" style={{ animationDelay: `${i * 90}ms` }} />
          <div className="col-span-6 h-3.5 skeleton-bar" style={{ animationDelay: `${i * 90 + 40}ms`, width: `${88 - i * 7}%` }} />
          <div className="col-span-2 h-3 skeleton-bar" style={{ animationDelay: `${i * 90 + 80}ms` }} />
          <div className="col-span-2 h-3 skeleton-bar" style={{ animationDelay: `${i * 90 + 120}ms` }} />
        </div>
      ))}
    </div>
  );
}

/* ── Confirm inline (two-step destructive action) ──────────── */

export function useConfirm(timeoutMs = 3000): [string | null, (id: string, fn: () => void) => void] {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), timeoutMs);
    return () => clearTimeout(t);
  }, [armed, timeoutMs]);
  const fire = (id: string, fn: () => void) => {
    if (armed === id) { setArmed(null); fn(); }
    else setArmed(id);
  };
  return [armed, fire];
}

/* ── Stat block (dashboard) ────────────────────────────────── */

export function Stat({ value, label, delta }: { value: string; label: string; delta?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="mono num text-[clamp(1.7rem,2.6vw,2.4rem)] leading-none tracking-[-0.02em] text-ink">{value}</div>
      <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{label}</div>
      {delta && <div className="mono text-[11px]" style={{ color: 'var(--color-signal)' }}>{delta}</div>}
    </div>
  );
}
