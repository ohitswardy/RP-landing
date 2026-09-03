import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE } from '../ui';
import { IconX } from '../icons';

/* ── List helpers ──────────────────────────────────────────── */

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Native drag-and-drop reordering, split so a row can be grabbed by its
 * handle but dropped on anywhere. Every list that uses it also exposes
 * arrow buttons, so nothing here is the only way to move a row.
 */
export function useDragReorder<T>(items: T[], onChange: (next: T[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const reset = () => { setDragging(null); setOver(null); };

  const handle = (index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragging(index);
      e.dataTransfer.effectAllowed = 'move';
      // Firefox refuses to start a drag without a payload.
      try { e.dataTransfer.setData('text/plain', String(index)); } catch { /* ignore */ }
    },
    onDragEnd: reset,
  });

  const target = (index: number) => ({
    onDragEnter: () => setOver(index),
    onDragOver: (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragging !== null && dragging !== index) onChange(move(items, dragging, index));
      reset();
    },
  });

  return { dragging, over, handle, target };
}

/* ── Layout ────────────────────────────────────────────────── */

export function Panel({
  code, title, hint, actions, children,
}: {
  code: string; title: string; hint?: string; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="border rule bg-paper">
      <header className="flex flex-col gap-3 border-b rule px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">{code}</div>
          <h3 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-ink">{title}</h3>
          {hint && <p className="mt-1 max-w-[58ch] text-[12.5px] leading-relaxed text-graphite">{hint}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

/* ── Fields ────────────────────────────────────────────────── */

const INPUT =
  'w-full border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]';

export function Field({
  label, value, onChange, max, multiline = false, rows = 3, placeholder, hint, size = 'md',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
  size?: 'sm' | 'md';
}) {
  const over = max !== undefined && value.length > max;
  const near = max !== undefined && !over && value.length > max * 0.85;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">{label}</label>
        {max !== undefined && (
          <span
            className="mono num text-[10px] tabular-nums transition-colors"
            style={{ color: over ? 'var(--color-warn)' : near ? 'var(--color-amber-deep)' : 'var(--color-silver)' }}
          >
            {value.length}/{max}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} resize-y leading-relaxed`}
          style={over ? { borderColor: 'var(--color-warn)' } : undefined}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} ${size === 'sm' ? 'py-2 text-[13px]' : ''}`}
          style={over ? { borderColor: 'var(--color-warn)' } : undefined}
        />
      )}
      {hint && <p className="text-[11.5px] leading-relaxed text-graphite">{hint}</p>}
    </div>
  );
}

/* ── Buttons ───────────────────────────────────────────────── */

export function MiniBtn({
  label, onClick, children, disabled = false, danger = false, active = false,
}: {
  label: string; onClick: () => void; children: ReactNode;
  disabled?: boolean; danger?: boolean; active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center border transition-colors duration-200 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? 'border-navy bg-navy text-paper'
          : danger
            ? 'rule text-graphite hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)]'
            : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/** Text button in the mono/uppercase house style. */
export function TinyBtn({
  children, onClick, disabled = false, tone = 'plain',
}: {
  children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'plain' | 'accent';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`mono inline-flex items-center gap-1.5 border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'accent'
          ? 'border-navy bg-navy text-paper hover:bg-[color:var(--color-amber-deep)]'
          : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/* ── Modal ─────────────────────────────────────────────────── */

export function Modal({
  open, title, onClose, children, footer, wide = false,
}: {
  open: boolean; title: string; onClose: () => void;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* Escape closes, Tab stays inside, and the page behind stops scrolling. */
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    const focusables = () => Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      body.style.overflow = prevOverflow;
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="modal" className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4 sm:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: 'oklch(0.165 0.040 260 / 0.5)' }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.32, ease: EASE }}
            className={`relative flex max-h-full w-full flex-col bg-paper shadow-2xl outline-none ${wide ? 'max-w-[860px]' : 'max-w-[460px]'}`}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b rule px-6 py-4">
              <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-0.01em]" title={title}>{title}</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center text-graphite transition-colors hover:text-ink"
              >
                <IconX />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6" style={{ scrollbarGutter: 'stable' }}>
              {children}
            </div>
            {footer && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t rule px-6 py-4">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
