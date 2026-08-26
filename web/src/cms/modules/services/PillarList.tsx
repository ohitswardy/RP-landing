import { motion } from 'framer-motion';
import { EASE } from '../../ui';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '../../icons';
import type { ServicePillar } from '../../data';
import { Field, MiniBtn, TinyBtn, move, useDragReorder } from '../../kit/parts';

const MAX = 12;

/** The numbered "what the practice delivers" ledger, editable in place. */
export default function PillarList({
  pillars, onChange,
}: {
  pillars: ServicePillar[];
  onChange: (next: ServicePillar[]) => void;
}) {
  const { dragging, over, handle, target } = useDragReorder(pillars, onChange);

  const set = (i: number, patch: Partial<ServicePillar>) =>
    onChange(pillars.map((p, x) => (x === i ? { ...p, ...patch } : p)));

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {pillars.map((p, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            {...target(i)}
            className={dragging === i ? 'opacity-40' : ''}
          >
            <div
              className="border bg-white transition-colors duration-200"
              style={{ borderColor: over === i && dragging !== i ? 'var(--color-amber-deep)' : 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
            >
              <div
                {...handle(i)}
                className="flex cursor-grab items-center justify-between gap-3 border-b rule bg-bone px-3 py-2 active:cursor-grabbing"
              >
                <span className="mono num text-[10.5px] uppercase tracking-[0.16em] text-graphite">
                  {String(i + 1).padStart(2, '0')} · drag to reorder
                </span>
                <div className="flex items-center gap-1.5">
                  <MiniBtn label="Move up" disabled={i === 0} onClick={() => onChange(move(pillars, i, i - 1))}>
                    <IconArrowUp size={13} />
                  </MiniBtn>
                  <MiniBtn label="Move down" disabled={i === pillars.length - 1} onClick={() => onChange(move(pillars, i, i + 1))}>
                    <IconArrowDown size={13} />
                  </MiniBtn>
                  <MiniBtn label="Remove row" danger onClick={() => onChange(pillars.filter((_, x) => x !== i))}>
                    <IconTrash size={13} />
                  </MiniBtn>
                </div>
              </div>

              <div className="flex flex-col gap-4 px-3.5 py-4">
                <Field label="Heading" value={p.title} max={120} size="sm" onChange={(v) => set(i, { title: v })} />
                <Field label="Description" value={p.body} max={600} multiline rows={2} onChange={(v) => set(i, { body: v })} />
              </div>
            </div>
          </motion.li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <TinyBtn onClick={() => onChange([...pillars, { title: '', body: '' }])} disabled={pillars.length >= MAX}>
          <IconPlus size={12} /> Add row
        </TinyBtn>
        <span className="mono num text-[10px] uppercase tracking-[0.14em] text-graphite">
          {pillars.length} / {MAX} rows
        </span>
      </div>
    </div>
  );
}
