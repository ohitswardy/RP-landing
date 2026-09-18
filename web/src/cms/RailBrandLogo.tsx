import { motion, useReducedMotion } from 'framer-motion';
import { RAIL_EXPANDED, useSidebar } from '@/components/ui/sidebar';

/* ─────────────────────────────────────────────────────────────
   Rail brand plate.

   Collapsed rail  → the square `Regis Logo.PNG` mark, parked on
                     the 72px icon column so its centre never drifts.
   Expanded rail   → the full `RegisFULL.png` lockup, centred in
                     the open rail.

   The lockup does not cross-fade in: it is revealed by a window
   that widens left-to-right, so the brand unfolds in the same
   direction the rail itself is opening. The mark dissolves under
   it a beat earlier, and the plate's own height eases between the
   two states — it grows upward into the nav, so the user row and
   the sign-out row below never move.
   ───────────────────────────────────────────────────────────── */

/* `RegisFULL.png` is a 1536×1024 canvas with the lockup floating in
   the middle of it; everything outside this rect is transparent
   padding (max alpha 4/255). Cropping it here keeps the asset
   untouched while letting the rail treat it as a tight 939×358
   lockup. */
const SRC_W = 1536;
const SRC_H = 1024;
const CROP = { x: 272, y: 292, w: 939, h: 358 };

const ICON_COL = 72;        // RAIL_COLLAPSED — the mark's home column
const LOCKUP_W = 172;

const SCALE = LOCKUP_W / CROP.w;
const LOCKUP_H = CROP.h * SCALE;

/* The mark keeps its own 248×273 canvas ratio rather than being
   forced square, so the F sits on its real proportions. */
const MARK_H = 38;
const MARK_W = (MARK_H * 248) / 273;

const PLATE_SHUT = 64;
const PLATE_OPEN = Math.round(LOCKUP_H) + 26;

const EASE = [0.25, 1, 0.5, 1] as const;

export default function RailBrandLogo() {
  const { expanded, surface } = useSidebar();

  // The desktop rail's width is mid-animation whenever the lockup is, so it is
  // centred on the rail's final open width rather than on the live one — the
  // reveal then opens from a fixed left edge instead of sliding. The mobile
  // drawer never animates width, so it can simply centre on itself.
  const lockupLeft = surface === 'mobile'
    ? `calc(50% - ${LOCKUP_W / 2}px)`
    : (RAIL_EXPANDED - LOCKUP_W) / 2;
  const reduced = useReducedMotion();

  const t = (duration: number, delay = 0) =>
    (reduced ? { duration: 0 } : { duration, delay, ease: EASE });

  return (
    <motion.div
      className="relative shrink-0 overflow-hidden border-b"
      style={{ borderColor: 'color-mix(in oklab, var(--color-ink) 8%, transparent)' }}
      animate={{ height: expanded ? PLATE_OPEN : PLATE_SHUT }}
      transition={t(0.34)}
    >
      {/* Square mark — pinned to the icon column, so it holds the same
          optical centre at every rail width. */}
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-0 grid place-items-center"
        style={{ width: ICON_COL }}
        animate={{
          opacity: expanded ? 0 : 1,
          scale: expanded ? 1.08 : 1,
          filter: expanded ? 'blur(1.5px)' : 'blur(0px)',
        }}
        transition={expanded ? t(0.16) : t(0.22, 0.12)}
      >
        <img
          src="/Regis Logo.PNG"
          alt=""
          aria-hidden
          draggable={false}
          className="brand-mark object-contain"
          style={{ width: MARK_W, height: MARK_H }}
        />
      </motion.div>

      {/* Full lockup — revealed by a widening window rather than a fade,
          so it unfurls with the rail. */}
      <motion.div
        className="pointer-events-none absolute overflow-hidden"
        style={{ left: lockupLeft, top: '50%', marginTop: -LOCKUP_H / 2, height: LOCKUP_H }}
        animate={{ width: expanded ? LOCKUP_W : 0, opacity: expanded ? 1 : 0 }}
        transition={expanded ? t(0.38, 0.04) : t(0.2)}
      >
        <div className="relative shrink-0 overflow-hidden" style={{ width: LOCKUP_W, height: LOCKUP_H }}>
          <img
            src="/RegisFULL.png"
            alt="Regis Partners"
            draggable={false}
            className="brand-mark absolute max-w-none"
            style={{
              width: SRC_W * SCALE,
              height: SRC_H * SCALE,
              left: -CROP.x * SCALE,
              top: -CROP.y * SCALE,
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
