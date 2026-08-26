import { useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { EASE } from '../../ui';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash, IconX } from '../../icons';
import { Field, MiniBtn, TinyBtn, move, useDragReorder } from '../../kit/parts';

/* ── Stacked job titles ────────────────────────────────────── */

const MAX_ROLES = 3;

/**
 * Titles stack on the card, so order is meaningful: the first is the one
 * the roster list and the card badge show.
 */
export function RoleList({ roles, onChange }: { roles: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {roles.map((role, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="mono w-14 shrink-0 text-[9.5px] uppercase tracking-[0.14em] text-graphite">
            {i === 0 ? 'Primary' : `Title ${i + 1}`}
          </span>
          <input
            value={role}
            onChange={(e) => onChange(roles.map((r, x) => (x === i ? e.target.value : r)))}
            placeholder="Managing Director"
            className="w-full border rule bg-white px-3.5 py-2 text-[13px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
          <MiniBtn label={`Move title ${i + 1} up`} disabled={i === 0} onClick={() => onChange(move(roles, i, i - 1))}>
            <IconArrowUp size={13} />
          </MiniBtn>
          <MiniBtn
            label={`Remove title ${i + 1}`}
            danger
            disabled={roles.length === 1}
            onClick={() => onChange(roles.filter((_, x) => x !== i))}
          >
            <IconTrash size={13} />
          </MiniBtn>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <TinyBtn onClick={() => onChange([...roles, ''])} disabled={roles.length >= MAX_ROLES}>
          <IconPlus size={12} /> Add title
        </TinyBtn>
        <span className="text-[11.5px] text-graphite">
          {roles.length > 1 ? 'Both titles stack on the card and in the profile.' : 'Directors often carry a second title.'}
        </span>
      </div>
    </div>
  );
}

/* ── Bio paragraphs ────────────────────────────────────────── */

const MAX_PARAS = 6;

/** The summary shown in the profile dialog, one block per paragraph. */
export function BioEditor({ bio, onChange }: { bio: string[]; onChange: (next: string[]) => void }) {
  const { dragging, over, handle, target } = useDragReorder(bio, onChange);
  const words = bio.join(' ').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      {bio.length === 0 && (
        <div className="border border-dashed rule px-6 py-8 text-center">
          <p className="text-[13px] text-ink">No summary yet.</p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-[12px] leading-relaxed text-graphite">
            Without one the card shows no hover teaser and the profile dialog opens straight onto contact details.
          </p>
        </div>
      )}

      {bio.map((para, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
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
              <span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">
                Paragraph {i + 1}
                {i === 0 && <span className="ml-2 text-silver">· card teaser</span>}
              </span>
              <div className="flex items-center gap-1.5">
                <MiniBtn label="Move up" disabled={i === 0} onClick={() => onChange(move(bio, i, i - 1))}>
                  <IconArrowUp size={13} />
                </MiniBtn>
                <MiniBtn label="Move down" disabled={i === bio.length - 1} onClick={() => onChange(move(bio, i, i + 1))}>
                  <IconArrowDown size={13} />
                </MiniBtn>
                <MiniBtn label="Remove paragraph" danger onClick={() => onChange(bio.filter((_, x) => x !== i))}>
                  <IconTrash size={13} />
                </MiniBtn>
              </div>
            </div>
            <div className="px-3.5 py-3.5">
              <Field
                label={i === 0 ? 'Opening paragraph' : `Paragraph ${i + 1}`}
                value={para}
                max={3000}
                multiline
                rows={5}
                onChange={(v) => onChange(bio.map((b, x) => (x === i ? v : b)))}
              />
            </div>
          </div>
        </motion.div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <TinyBtn onClick={() => onChange([...bio, ''])} disabled={bio.length >= MAX_PARAS}>
          <IconPlus size={12} /> Add paragraph
        </TinyBtn>
        <span className="mono num text-[10px] uppercase tracking-[0.14em] text-graphite">
          {bio.length} / {MAX_PARAS} · {words} words
        </span>
      </div>
    </div>
  );
}

/* ── Sector coverage chips ─────────────────────────────────── */

const MAX_SECTORS = 8;

/** Coverage tags, entered one at a time — they render as chips. */
export function SectorEditor({ sectors, onChange }: { sectors: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function commit() {
    const value = draft.trim();
    if (!value || sectors.length >= MAX_SECTORS) return;
    if (sectors.some((s) => s.toLowerCase() === value.toLowerCase())) { setDraft(''); return; }
    onChange([...sectors, value]);
    setDraft('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !draft && sectors.length > 0) onChange(sectors.slice(0, -1));
  }

  return (
    <div className="flex flex-col gap-3">
      {sectors.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {sectors.map((s, i) => (
            <motion.li
              key={s}
              layout
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.24, ease: EASE }}
              className="mono inline-flex items-center gap-2 border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em]"
              style={{
                background: 'color-mix(in oklab, var(--color-amber) 8%, transparent)',
                borderColor: 'color-mix(in oklab, var(--color-amber) 30%, transparent)',
                color: 'var(--color-amber-deep)',
              }}
            >
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => onChange(sectors.filter((_, x) => x !== i))}
                className="transition-opacity hover:opacity-60"
              >
                <IconX size={11} />
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          disabled={sectors.length >= MAX_SECTORS}
          placeholder={sectors.length >= MAX_SECTORS ? 'Maximum of eight sectors' : 'Type a sector, then Enter'}
          className="w-full border rule bg-white px-3.5 py-2 text-[13px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)] disabled:bg-bone"
        />
        <TinyBtn onClick={commit} disabled={!draft.trim() || sectors.length >= MAX_SECTORS}>
          <IconPlus size={12} /> Add
        </TinyBtn>
      </div>
      <p className="text-[11.5px] leading-relaxed text-graphite">
        Coverage chips sit under the name on the card. Research profiles use them; most others leave this empty.
      </p>
    </div>
  );
}
