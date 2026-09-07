import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE } from '../../cms/ui';

/* ─────────────────────────────────────────────────────────────
   Toasts replace the legacy alert() calls. Bottom-right stack,
   one amber dot for a live outcome, warn tone for failures; each
   clears itself after a few seconds.
   ───────────────────────────────────────────────────────────── */

type Tone = 'ok' | 'warn' | 'info';
type Toast = { id: number; message: string; tone: Tone };

type ToastContextValue = { notify: (message: string, tone?: Tone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE: Record<Tone, string> = {
  ok: 'var(--color-signal)',
  warn: 'var(--color-warn)',
  info: 'var(--color-amber-deep)',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const notify = useCallback((message: string, tone: Tone = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message, tone }].slice(-4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'warn' ? 6000 : 3600);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.2 } }}
              transition={{ duration: 0.32, ease: EASE }}
              className="pointer-events-auto flex items-start gap-3 border rule bg-paper px-4 py-3 shadow-[0_18px_40px_-24px_rgba(13,13,13,0.45)]"
            >
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE[t.tone] }} />
              <p className="text-[13px] leading-relaxed text-ink">{t.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/** The message a failed request should show. */
export function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
