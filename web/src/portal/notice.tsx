import { useEffect, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IconX } from '../cms/icons';

/* ─────────────────────────────────────────────────────────────
   Portal notices — a small, non-blocking strip in the corner.

   One external store, so code outside the React tree (beacons,
   the download stamper, the auth listener) can raise a notice
   without prop-drilling. Nothing here ever blocks the reading:
   a notice is a line of copy, an optional action, and a timer.
   ───────────────────────────────────────────────────────────── */

export type NoticeTone = 'info' | 'warn' | 'ok';

export type Notice = {
  id: number;
  message: string;
  tone: NoticeTone;
  action?: { label: string; onClick: () => void };
  /** ms until it slides away; 0 keeps it until dismissed. */
  ttl: number;
};

type Options = { tone?: NoticeTone; action?: Notice['action']; ttl?: number };

const EASE = [0.25, 1, 0.5, 1] as const;

let seq = 0;
let notices: Notice[] = [];
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function dismissNotice(id: number) {
  if (!notices.some((n) => n.id === id)) return;
  notices = notices.filter((n) => n.id !== id);
  emit();
}

/** Raise a notice. Returns its id so a caller can withdraw it early. */
export function notify(message: string, opts: Options = {}): number {
  const id = ++seq;
  // Same copy twice in a row reads as one problem, not two.
  notices = [...notices.filter((n) => n.message !== message), {
    id, message, tone: opts.tone ?? 'info', action: opts.action, ttl: opts.ttl ?? (opts.action ? 9000 : 6000),
  }].slice(-4);
  emit();
  return id;
}

/** Drop everything on screen (sign-out, route change). */
export function clearNotices() {
  if (notices.length === 0) return;
  notices = [];
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => notices;

export function useNotices(): Notice[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const TONE: Record<NoticeTone, string> = {
  info: 'var(--color-silver)',
  warn: 'var(--color-warn)',
  ok: 'var(--color-amber)',
};

function NoticeRow({ notice }: { notice: Notice }) {
  useEffect(() => {
    if (!notice.ttl) return;
    const t = setTimeout(() => dismissNotice(notice.id), notice.ttl);
    return () => clearTimeout(t);
  }, [notice.id, notice.ttl]);

  return (
    <motion.div
      layout
      role={notice.tone === 'warn' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.18 } }}
      transition={{ duration: 0.32, ease: EASE }}
      className="pointer-events-auto relative flex w-full items-start gap-3 border rule bg-paper py-3 pl-4 pr-3 text-ink shadow-lg"
    >
      <span aria-hidden className="absolute left-0 top-0 h-full w-[2px]" style={{ background: TONE[notice.tone] }} />
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-slate">{notice.message}</p>
      {notice.action && (
        <button
          type="button"
          onClick={() => { dismissNotice(notice.id); notice.action?.onClick(); }}
          className="mono shrink-0 border px-2.5 py-1 text-[9.5px] uppercase tracking-[0.16em] transition-colors duration-300 hover:text-ink"
          style={{ borderColor: 'color-mix(in oklab, var(--color-amber-deep) 55%, transparent)', color: 'var(--color-amber-deep)' }}
        >
          {notice.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissNotice(notice.id)}
        className="grid h-6 w-6 shrink-0 place-items-center text-graphite transition-colors hover:text-ink"
      >
        <IconX size={12} />
      </button>
    </motion.div>
  );
}

/** Mount once, high in the tree. Renders nothing until something notifies. */
export function NoticeHost() {
  const list = useNotices();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[70] mx-auto flex w-auto max-w-[420px] flex-col gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]"
    >
      <AnimatePresence initial={false}>
        {list.map((n) => <NoticeRow key={n.id} notice={n} />)}
      </AnimatePresence>
    </div>
  );
}
