import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { IconStar, IconStarFilled } from '../../cms/icons';
import type { AuditEntry, Interaction } from '../data';

/* ─────────────────────────────────────────────────────────────
   The important mark. One endpoint toggles it without touching
   the rest of the record; the star is the same control in the
   list, on the dashboard shelf, and in the form's aside.
   ───────────────────────────────────────────────────────────── */

type ItemResponse = { item: Interaction; audit?: AuditEntry };

/** POST the mark on its own. `note` omitted keeps whatever is stored. */
export function setImportant(id: string, important: boolean, note?: string): Promise<ItemResponse> {
  return apiFetch<ItemResponse>(`/crms/interactions/${id}/important`, {
    method: 'POST', audience: 'cms',
    body: note === undefined ? { important } : { important, note: note || null },
  });
}

/**
 * An amber star. Read-only when `onToggle` is absent (viewers, or the
 * dashboard); otherwise it optimistically flips and reports the saved
 * record back so the caller can patch its own copy.
 */
export function ImportantStar({ on, size = 15, onToggle, label = 'Important' }: {
  on: boolean;
  size?: number;
  onToggle?: (next: boolean) => Promise<void> | void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const Icon = on ? IconStarFilled : IconStar;
  const color = on ? 'var(--color-amber-deep)' : 'var(--color-silver)';

  if (!onToggle) {
    return <span aria-label={on ? label : undefined} className="inline-flex shrink-0" style={{ color }}><Icon size={size} /></span>;
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Clear ${label.toLowerCase()} mark` : `Mark as ${label.toLowerCase()}`}
      title={on ? 'Important — click to clear' : 'Mark as important'}
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try { await onToggle(!on); } finally { setBusy(false); }
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full p-1 transition-[color,transform] duration-200 hover:scale-110 hover:text-[color:var(--color-amber-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-amber)] disabled:opacity-50"
      style={{ color }}
    >
      <Icon size={size} />
    </button>
  );
}
