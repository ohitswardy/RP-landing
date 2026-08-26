import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { parseLegalBody, useLegalContent } from '../lib/legalContent';

const ease = [0.25, 1, 0.5, 1] as const;

// ─── Component ───────────────────────────────────────────────────────────────

type ModalType = 'terms' | 'privacy' | null;

interface LegalModalProps {
  open: ModalType;
  onClose: () => void;
}

export default function LegalModal({ open, onClose }: LegalModalProps) {
  // The documents are CMS-authored; fetch them the first time one is opened.
  const [primed, setPrimed] = useState(open !== null);
  const { data: documents } = useLegalContent(primed);
  const content = open ? documents.find((d) => d.key === open) ?? null : null;
  const sections = useMemo(() => (content ? parseLegalBody(content.body) : []), [content]);

  useEffect(() => {
    if (open) setPrimed(true);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && content && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(10, 12, 20, 0.72)', backdropFilter: 'blur(4px)' }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.32, ease }}
            role="dialog"
            aria-modal="true"
            aria-label={content.title}
            className="fixed inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[720px] lg:w-[800px] top-[5vh] bottom-[5vh] z-50 flex flex-col"
            style={{
              background: 'var(--color-paper)',
              border: '1px solid color-mix(in oklab, var(--color-ink) 12%, transparent)',
              boxShadow: '0 24px 64px rgba(10,12,20,0.18)',
            }}
          >
            {/* Amber conviction bar */}
            <div
              className="h-[2px] shrink-0"
              style={{ background: 'linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-deep) 55%, transparent 100%)' }}
            />

            {/* Header */}
            <div
              className="shrink-0 flex items-start justify-between px-8 pt-8 pb-6"
              style={{ borderBottom: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)' }}
            >
              <div>
                <p className="mono text-[10px] tracking-[0.22em] uppercase mb-2" style={{ color: 'var(--color-amber-deep)' }}>
                  Legal · Regis Partners
                </p>
                <h2 className="text-[1.45rem] tracking-[-0.025em] font-medium leading-tight" style={{ color: 'var(--color-ink)' }}>
                  {content.title}
                </h2>
                {content.effective && (
                  <p className="mono text-[10px] tracking-[0.14em] uppercase mt-1.5" style={{ color: 'var(--color-graphite)' }}>
                    {content.effective}
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 ml-6 mt-0.5 w-8 h-8 flex items-center justify-center transition-colors duration-150"
                style={{
                  border: '1px solid color-mix(in oklab, var(--color-ink) 18%, transparent)',
                  color: 'var(--color-graphite)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-amber)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-amber-deep)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'color-mix(in oklab, var(--color-ink) 18%, transparent)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-graphite)';
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-8 py-7 space-y-8" style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in oklab, var(--color-ink) 15%, transparent) transparent' }}>
              {sections.map((sec, i) => (
                <div key={i}>
                  {sec.heading && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="shrink-0 block h-[1.5px] w-5" style={{ background: 'var(--color-amber)' }} />
                      <h3 className="mono text-[10.5px] tracking-[0.18em] uppercase" style={{ color: 'var(--color-navy)' }}>
                        {sec.heading}
                      </h3>
                    </div>
                  )}
                  <div
                    className={`text-[13.5px] leading-[1.8] whitespace-pre-line ${sec.heading ? 'pl-8' : ''}`}
                    style={{ color: 'var(--color-slate)' }}
                  >
                    {sec.body}
                  </div>
                </div>
              ))}

              {/* Bottom padding so last item isn't flush */}
              <div className="h-4" />
            </div>

            {/* Footer bar */}
            <div
              className="shrink-0 flex items-center justify-between px-8 py-4"
              style={{
                borderTop: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)',
                background: 'var(--color-bone)',
              }}
            >
              <span className="mono text-[10px] tracking-[0.14em] uppercase" style={{ color: 'var(--color-silver)' }}>
                © 1999–2026 Regis Partners, Inc.
              </span>
              <button
                onClick={onClose}
                className="mono text-[10px] tracking-[0.16em] uppercase transition-colors duration-150"
                style={{ color: 'var(--color-graphite)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-amber-deep)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-graphite)')}
              >
                Close ↑
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export type { ModalType };
