import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { EASE } from '../../ui';
import { IconArrowDown, IconArrowUp, IconPen, IconPlus, IconTrash } from '../../icons';
import type { HomeLink } from '../../data';
import { Field, MiniBtn, TinyBtn } from '../../kit/parts';

/* ─────────────────────────────────────────────────────────────
   Field pieces shared by the landing-page section editors: the
   photo tile with its replace/clear overlay, the label + path pair
   behind every CTA, and the numbered row shell for editable lists.
   ───────────────────────────────────────────────────────────── */

export const INPUT =
  'w-full border rule bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]';

/** Site paths the CTA fields offer as suggestions; free text still wins. */
export const SITE_ROUTES = [
  '/', '/about', '/about#leadership', '/services', '/services/research', '/services/sales',
  '/services/trading', '/services/corporate', '/insights', '/contact', '/login',
];

export const ROUTES_LIST_ID = 'home-site-routes';

/** What an editor asks the module to open the image picker for. */
export type PickRequest = {
  title: string;
  aspect?: string;
  hint?: string;
  kind?: 'photo' | 'portrait' | 'graphic';
  onPick: (path: string) => void;
};

/* ── Photo tile ────────────────────────────────────────────── */

export function PhotoTile({
  image, aspect = '16/9', label, empty = 'No photo', onPick, onClear, className = '', objectPosition,
}: {
  image: string;
  aspect?: string;
  label: string;
  /** What the tile says when no photo is set — what the page does instead. */
  empty?: string;
  onPick: () => void;
  onClear: () => void;
  className?: string;
  objectPosition?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className="group relative w-full overflow-hidden border rule bg-bone"
        style={{ aspectRatio: aspect }}
      >
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" style={{ objectPosition }} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-blueprint px-4 text-center">
            <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-paper/60">{empty}</span>
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 p-2"
          style={{ background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.85), transparent)' }}
        >
          <TinyBtn onClick={onPick} tone="accent">
            <IconPen size={11} /> {image ? 'Replace' : 'Add photo'}
          </TinyBtn>
          {image && (
            <TinyBtn onClick={onClear}>
              <IconTrash size={11} /> Clear
            </TinyBtn>
          )}
        </div>
      </div>
      <p className="mono truncate text-[9.5px] tracking-[0.06em] text-graphite" title={image}>
        {label} · {image || '— none —'}
      </p>
    </div>
  );
}

/* ── CTA pair ──────────────────────────────────────────────── */

export function LinkFields({
  link, onChange, hint, defaultHref, labelMax = 60,
}: {
  link: HomeLink;
  onChange: (next: HomeLink) => void;
  hint?: string;
  /** Where the link goes if the path is left empty. */
  defaultHref: string;
  labelMax?: number;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field
          label="Link label"
          value={link.label}
          max={labelMax}
          size="sm"
          placeholder="Read more"
          onChange={(v) => onChange({ ...link, label: v })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Link path</label>
          <input
            value={link.href}
            list={ROUTES_LIST_ID}
            placeholder={defaultHref}
            onChange={(e) => onChange({ ...link, href: e.target.value })}
            className={`${INPUT} mono`}
            spellCheck={false}
          />
        </div>
      </div>
      <p className="text-[11.5px] leading-relaxed text-graphite">
        {hint ?? 'Clear the label to drop the link from the page.'} Paths start with “/”; an empty path falls back to {defaultHref}.
      </p>
    </div>
  );
}

/* ── Editable lists ────────────────────────────────────────── */

export function ListHeader({ label, count, max, min = 0 }: { label: string; count: number; max: number; min?: number }) {
  const short = count < min;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">{label}</span>
      <span
        className="mono num text-[10px] tracking-[0.14em]"
        style={{ color: short ? 'var(--color-warn)' : 'var(--color-silver)' }}
      >
        {count} / {max}
      </span>
    </div>
  );
}

/** One numbered row of an editable list: index, the row's fields, and its controls. */
export function RowShell({
  index, count, onMove, onRemove, label, children, aside,
}: {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  label: string;
  children: ReactNode;
  /** Sits left of the fields — a photo tile, usually. */
  aside?: ReactNode;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
      className="border rule bg-white"
    >
      <div className="flex items-center justify-between gap-3 border-b rule px-3.5 py-2">
        <span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">
          {String(index + 1).padStart(2, '0')} · {label}
        </span>
        <div className="flex items-center gap-1.5">
          <MiniBtn label={`Move ${label} ${index + 1} up`} disabled={index === 0} onClick={() => onMove(-1)}>
            <IconArrowUp size={13} />
          </MiniBtn>
          <MiniBtn label={`Move ${label} ${index + 1} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
            <IconArrowDown size={13} />
          </MiniBtn>
          <MiniBtn label={`Remove ${label} ${index + 1}`} danger onClick={onRemove}>
            <IconTrash size={13} />
          </MiniBtn>
        </div>
      </div>
      <div className={`p-3.5 ${aside ? 'grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]' : ''}`}>
        {aside}
        <div className="flex min-w-0 flex-col gap-3.5">{children}</div>
      </div>
    </motion.li>
  );
}

export function AddRow({ label, onAdd, disabled }: { label: string; onAdd: () => void; disabled: boolean }) {
  return (
    <TinyBtn onClick={onAdd} disabled={disabled}>
      <IconPlus size={12} /> {label}
    </TinyBtn>
  );
}
