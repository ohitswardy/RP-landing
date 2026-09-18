import {
  useCallback, useEffect, useLayoutEffect, useState,
  type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE } from '../../ease';

/* ─────────────────────────────────────────────────────────────
   Shared chrome for the picker kit: the anchored popover every
   dropdown, calendar and clock opens into, plus the field shell
   (label / hint / helper / error) and the trigger class strings.

   The popover is portalled to <body> and positioned with fixed
   coordinates read from the anchor, so it is never clipped by a
   scrolling modal body or drawer, and it flips above the anchor
   when the viewport runs out of room below.
   ───────────────────────────────────────────────────────────── */

export type Placement = 'below' | 'above';

type Pos = { top: number; left: number; width: number | undefined; placement: Placement; maxHeight: number };

const GUTTER = 8;
const GAP = 4;
export const POPOVER_Z = 70;

export function useAnchoredPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  popRef: RefObject<HTMLElement | null>,
  { minWidth = 0, matchWidth = true, align = 'start' }: { minWidth?: number; matchWidth?: boolean; align?: 'start' | 'end' } = {},
) {
  const [pos, setPos] = useState<Pos | null>(null);

  const compute = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popH = popRef.current?.offsetHeight ?? 320;
    const popW = popRef.current?.offsetWidth ?? Math.max(r.width, minWidth);
    const roomBelow = vh - r.bottom - GAP - GUTTER;
    const roomAbove = r.top - GAP - GUTTER;
    const placement: Placement = roomBelow >= popH || roomBelow >= roomAbove ? 'below' : 'above';
    const width = matchWidth ? Math.max(r.width, minWidth) : undefined;
    const effW = width ?? popW;
    let left = align === 'end' ? r.right - effW : r.left;
    left = Math.min(Math.max(GUTTER, left), Math.max(GUTTER, vw - effW - GUTTER));
    const top = placement === 'below' ? r.bottom + GAP : Math.max(GUTTER, r.top - GAP - popH);
    const maxHeight = Math.max(160, placement === 'below' ? roomBelow : roomAbove);
    setPos((p) =>
      p && p.top === top && p.left === left && p.width === width && p.placement === placement && p.maxHeight === maxHeight
        ? p
        : { top, left, width, placement, maxHeight },
    );
  }, [anchorRef, popRef, minWidth, matchWidth, align]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    compute();
    window.addEventListener('scroll', compute, { capture: true, passive: true });
    window.addEventListener('resize', compute);
    const ro = typeof ResizeObserver !== 'undefined' && popRef.current ? new ResizeObserver(compute) : null;
    if (ro && popRef.current) ro.observe(popRef.current);
    return () => {
      window.removeEventListener('scroll', compute, { capture: true });
      window.removeEventListener('resize', compute);
      ro?.disconnect();
    };
  }, [open, compute, popRef]);

  return pos;
}

/** Close when a pointer lands outside every ref given. */
export function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (refs.some((r) => r.current?.contains(t))) return;
      onDismiss();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, refs, onDismiss]);
}

export function AnchoredPopover({
  open, anchorRef, popRef, children, minWidth, matchWidth = true, align, className = '',
  onKeyDown, onMouseDown, role, id, ariaLabel,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  popRef: RefObject<HTMLDivElement>;
  children: ReactNode;
  minWidth?: number;
  matchWidth?: boolean;
  align?: 'start' | 'end';
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  onMouseDown?: (e: MouseEvent<HTMLDivElement>) => void;
  role?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const pos = useAnchoredPosition(open, anchorRef, popRef, { minWidth, matchWidth, align });
  const up = pos?.placement === 'above';

  const style: CSSProperties = {
    position: 'fixed',
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
    width: pos?.width,
    minWidth: matchWidth ? undefined : minWidth,
    maxHeight: pos?.maxHeight,
    zIndex: POPOVER_Z,
    visibility: pos ? 'visible' : 'hidden',
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popRef}
          id={id}
          role={role}
          aria-label={ariaLabel}
          initial={{ opacity: 0, y: up ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: up ? 4 : -4, transition: { duration: 0.14 } }}
          transition={{ duration: 0.2, ease: EASE }}
          style={style}
          onKeyDown={onKeyDown}
          onMouseDown={onMouseDown}
          className={`flex flex-col overflow-hidden border rule bg-paper text-ink shadow-[0_24px_50px_-28px_rgba(13,13,13,0.45)] ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Field shell ───────────────────────────────────────────── */

export function FieldShell({
  id, label, hint, helper, error, children, className = '',
}: {
  id?: string; label?: string; hint?: string; helper?: string; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={id} className="mono flex items-baseline justify-between gap-3 text-[10.5px] uppercase tracking-[0.18em] text-graphite">
          <span>{label}</span>
          {hint && <span className="truncate normal-case tracking-normal text-silver">{hint}</span>}
        </label>
      )}
      {children}
      {helper && !error && <p className="text-[12px] leading-relaxed text-graphite">{helper}</p>}
      {error && <p role="alert" className="text-[12px] leading-relaxed" style={{ color: 'var(--color-warn)' }}>{error}</p>}
    </div>
  );
}

/* ── Trigger chrome ────────────────────────────────────────── */

export type FieldSize = 'sm' | 'md';
export type FieldVariant = 'field' | 'compact';

/** The bordered box every picker opens from. `open` and `error` are visual states. */
export function triggerClass({
  size = 'md', variant = 'field', open = false, error = false, disabled = false, accent = false,
}: { size?: FieldSize; variant?: FieldVariant; open?: boolean; error?: boolean; disabled?: boolean; accent?: boolean }) {
  const base = 'relative flex w-full items-center gap-2 border bg-white text-left outline-none transition-colors duration-300';
  const pad = variant === 'compact'
    ? 'mono uppercase tracking-[0.12em] py-2.5 pl-3.5 pr-3 text-[10.5px]'
    : size === 'sm' ? 'px-3 py-2 text-[13px]' : 'px-3.5 py-2.5 text-[14px]';
  const edge = error
    ? 'border-[color:var(--color-warn)]'
    : open
      ? 'border-[color:var(--color-amber-deep)]'
      : accent
        ? 'border-[color:var(--color-amber-deep)] text-[color:var(--color-amber-deep)]'
        : 'rule hover:border-[color:var(--color-amber-deep)] focus-within:border-[color:var(--color-amber-deep)]';
  const state = disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';
  return `${base} ${pad} ${edge} ${state}`;
}

/** Small icon-only affordance inside a trigger (clear ×, calendar, clock). */
export const TRIGGER_ICON_BTN =
  'grid h-6 w-6 shrink-0 place-items-center text-graphite transition-colors duration-200 hover:text-ink';

/** House mono text button used in popover footers. */
export const FOOT_BTN =
  'mono inline-flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-graphite transition-colors duration-200 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40';
