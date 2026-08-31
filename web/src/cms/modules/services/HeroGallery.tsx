import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { EASE } from '../../ui';
import { IconArrowRight, IconPen, IconPlus, IconTrash } from '../../icons';
import ImagePicker from '../../kit/ImagePicker';
import { move, useDragReorder } from '../../kit/parts';

const MAX = 8;

/**
 * The header photo set. One image is a still backdrop; two or more
 * cross-fade as a slideshow, so order is editorial, not decorative.
 */
export default function HeroGallery({
  images, onChange, usedBy,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  usedBy: string;
}) {
  // null = closed, -1 = appending, >= 0 = replacing that slot.
  const [picking, setPicking] = useState<number | null>(null);
  const { dragging, over, handle, target } = useDragReorder(images, onChange);

  // Keys that survive a reorder, so dragging moves the tile instead of
  // remounting it — and the photo never flashes.
  const keys = useMemo(() => {
    const seen = new Map<string, number>();
    return images.map((src) => {
      const n = seen.get(src) ?? 0;
      seen.set(src, n + 1);
      return n === 0 ? src : `${src}#${n}`;
    });
  }, [images]);

  function pick(path: string) {
    if (picking === null) return;
    onChange(picking < 0 ? [...images, path] : images.map((p, i) => (i === picking ? path : p)));
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((src, i) => (
          <motion.li
            key={keys[i]}
            layout
            transition={{ duration: 0.35, ease: EASE }}
            {...target(i)}
            className={`group relative ${dragging === i ? 'opacity-40' : ''}`}
          >
            <div
              {...handle(i)}
              className="relative aspect-[16/9] cursor-grab overflow-hidden border bg-bone transition-colors duration-200 active:cursor-grabbing"
              style={{ borderColor: over === i && dragging !== i ? 'var(--color-amber-deep)' : 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />

              <span
                className="mono absolute left-0 top-0 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-paper"
                style={{ background: i === 0 ? 'var(--color-amber-deep)' : 'oklch(0.165 0.040 260 / 0.75)' }}
              >
                {i === 0 ? 'Primary' : `0${i + 1}`}
              </span>

              <div
                className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 p-2"
                style={{ background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.85), transparent)' }}
              >
                <GhostAction label="Move earlier" disabled={i === 0} onClick={() => onChange(move(images, i, i - 1))}>
                  <span className="rotate-180"><IconArrowRight size={13} /></span>
                </GhostAction>
                <GhostAction label="Move later" disabled={i === images.length - 1} onClick={() => onChange(move(images, i, i + 1))}>
                  <IconArrowRight size={13} />
                </GhostAction>
                <GhostAction label="Replace photo" onClick={() => setPicking(i)}>
                  <IconPen size={13} />
                </GhostAction>
                <GhostAction label="Remove photo" danger onClick={() => onChange(images.filter((_, x) => x !== i))}>
                  <IconTrash size={13} />
                </GhostAction>
              </div>
            </div>
          </motion.li>
        ))}

        {images.length < MAX && (
          <li>
            <button
              type="button"
              onClick={() => setPicking(-1)}
              className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 border border-dashed rule text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
            >
              <IconPlus size={16} />
              <span className="mono text-[9.5px] uppercase tracking-[0.16em]">Add photo</span>
            </button>
          </li>
        )}
      </ul>

      <p className="text-[11.5px] leading-relaxed text-graphite">
        {images.length === 0
          ? 'With no photo the header falls back to the navy blueprint panel.'
          : images.length === 1
            ? 'A single photo sits still behind the header. Add a second to turn it into a slideshow.'
            : `${images.length} photos cross-fade behind the header, starting with the primary. Drag to re-cut the sequence.`}
      </p>

      <ImagePicker
        open={picking !== null}
        title={picking !== null && picking >= 0 ? 'Replace header photo' : 'Add header photo'}
        usedBy={usedBy}
        scope="services"
        onPick={pick}
        onClose={() => setPicking(null)}
      />
    </div>
  );
}

/** Overlay action sitting on the photo itself, so it is paper-toned. */
function GhostAction({
  label, onClick, children, disabled = false, danger = false,
}: {
  label: string; onClick: () => void; children: ReactNode; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center border text-paper backdrop-blur-sm transition-colors duration-200 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-25 ${
        danger
          ? 'border-paper/30 hover:border-[color:var(--color-warn)] hover:bg-[color:var(--color-warn)]'
          : 'border-paper/30 hover:border-[color:var(--color-amber)] hover:bg-[color:var(--color-amber-deep)]'
      }`}
    >
      {children}
    </button>
  );
}
