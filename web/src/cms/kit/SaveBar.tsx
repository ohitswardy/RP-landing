import { AnimatePresence, motion } from 'framer-motion';
import { BtnGhost, BtnPrimary, Chip, EASE } from '../ui';

/* ─────────────────────────────────────────────────────────────
   The publish bar shared by the single-document editors (Pages,
   Landing page). It rides the bottom of the scroll container and
   only exists while there is something to publish, discard, or
   report.
   ───────────────────────────────────────────────────────────── */

export default function SaveBar({
  dirty, saving, justSaved, error, scope, onDiscard, onSave,
}: {
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
  error: string | null;
  /** What is about to be published, named the way the editor thinks of it. */
  scope: string;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const show = dirty || saving || justSaved || Boolean(error);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="sticky bottom-4 z-30 border rule bg-paper/95 shadow-[0_10px_30px_-12px_oklch(0.165_0.040_260_/_0.4)] backdrop-blur-md"
        >
          <div className="flex w-full flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {error ? (
                <p className="text-[13px] leading-snug" style={{ color: 'var(--color-warn)' }}>{error}</p>
              ) : justSaved && !dirty ? (
                <Chip tone="live">Published to the live site</Chip>
              ) : (
                <p className="truncate text-[13px] text-slate">
                  <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-amber-deep)' }}>
                    Unsaved
                  </span>
                  {scope}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <BtnGhost onClick={onDiscard}>Discard</BtnGhost>
              <BtnPrimary onClick={onSave} disabled={saving || !dirty}>
                {saving ? 'Publishing…' : 'Save & publish'}
              </BtnPrimary>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
