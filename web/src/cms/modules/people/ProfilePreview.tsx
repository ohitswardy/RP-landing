import { useState } from 'react';
import { motion } from 'framer-motion';
import { EASE } from '../../ui';
import type { StaffMember } from '../../data';

type Draft = Pick<StaffMember, 'name' | 'roles' | 'bio' | 'sectors' | 'phone' | 'email' | 'img'>;

type Mode = 'card' | 'hover' | 'profile';

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'card', label: 'Card' },
  { value: 'hover', label: 'On hover' },
  { value: 'profile', label: 'Profile' },
];

function initialsOf(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * The three states a visitor actually sees: the roster card, its hover
 * overlay, and the profile dialog. The hover state carries the teaser, so
 * it is worth being able to inspect without chasing it with a mouse.
 */
export default function ProfilePreview({ draft }: { draft: Draft }) {
  const [mode, setMode] = useState<Mode>('card');

  const roles = draft.roles.filter((r) => r.trim());
  const paragraphs = draft.bio.filter((p) => p.trim());
  const name = draft.name.trim() || 'Unnamed profile';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={mode === m.value}
            onClick={() => setMode(m.value)}
            className={`mono border px-2.5 py-1.5 text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-300 ${
              mode === m.value ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:text-ink'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="border rule bg-bone p-5">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {mode === 'profile' ? (
            <ProfileDialog name={name} roles={roles} paragraphs={paragraphs} draft={draft} />
          ) : (
            <RosterCard
              name={name}
              roles={roles}
              paragraphs={paragraphs}
              sectors={draft.sectors}
              img={draft.img}
              hovered={mode === 'hover'}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* ── Roster card, default and hovered ──────────────────────── */

function RosterCard({
  name, roles, paragraphs, sectors, img, hovered,
}: {
  name: string; roles: string[]; paragraphs: string[]; sectors: string[]; img: string; hovered: boolean;
}) {
  const teaser = paragraphs[0] ?? '';

  return (
    <div className="mx-auto w-full max-w-[230px]">
      <div className="relative mb-4 aspect-[4/5] overflow-hidden bg-navy">
        {/* Initials fallback, covered by the photo when one is set */}
        <div aria-hidden className="absolute inset-0 grid place-items-center">
          <span className="text-[5rem] font-medium leading-none tracking-tighter text-paper/10">
            {initialsOf(name)}
          </span>
        </div>

        {img && <img src={img} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-top" />}

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(to top, oklch(0.215 0.048 260 / 0.8), transparent)' }}
        />

        {hovered ? (
          <div
            className="absolute inset-0 flex flex-col justify-end gap-2 p-4"
            style={{ background: 'oklch(0.165 0.040 260 / 0.9)' }}
          >
            <div className="flex flex-col gap-0.5">
              {roles.map((role, i) => (
                <span key={i} className="mono text-[8.5px] uppercase leading-snug tracking-[0.16em]" style={{ color: 'var(--color-amber)' }}>
                  {role}
                </span>
              ))}
            </div>
            <p className="line-clamp-3 text-[10.5px] leading-relaxed text-paper/80">
              {teaser || <span className="italic text-paper/40">No summary — this space stays empty.</span>}
            </p>
            <span className="mono text-[8.5px] uppercase tracking-[0.14em] text-paper/35">View profile →</span>
          </div>
        ) : (
          <div className="absolute inset-x-4 bottom-4">
            <span className="mono text-[9.5px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-amber)' }}>
              {roles[0] ?? '—'}
            </span>
          </div>
        )}
      </div>

      <h3 className="text-[15px] font-medium tracking-[-0.012em] text-ink">{name}</h3>
      <p className="mt-1 text-[11.5px] text-slate">{roles[0] ?? '—'}</p>

      {sectors.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {sectors.map((s) => (
            <span
              key={s}
              className="mono border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] text-graphite"
              style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 30%, transparent)' }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Profile dialog (stacked, as it renders on a narrow screen) ── */

function ProfileDialog({
  name, roles, paragraphs, draft,
}: {
  name: string; roles: string[]; paragraphs: string[]; draft: Draft;
}) {
  return (
    <div className="bg-bone">
      <div className="relative h-36 overflow-hidden bg-navy">
        <div aria-hidden className="absolute inset-0 grid place-items-center">
          <span className="text-[4rem] font-medium leading-none tracking-tighter text-paper/[0.07]">
            {initialsOf(name)}
          </span>
        </div>
        {draft.img && <img src={draft.img} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />}
      </div>

      <div className="px-5 py-5">
        <h3 className="text-[17px] font-medium leading-tight tracking-[-0.022em] text-ink">{name}</h3>

        <ul className="mt-3 flex flex-col gap-1">
          {roles.map((role, i) => (
            <li key={i} className="mono text-[9.5px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-amber)' }}>
              {role}
            </li>
          ))}
        </ul>

        {draft.sectors.length > 0 && (
          <div className="mt-5">
            <div className="eyebrow mb-2" style={{ fontSize: 9 }}>Sector Coverage</div>
            <div className="flex flex-wrap gap-1.5">
              {draft.sectors.map((s) => (
                <span
                  key={s}
                  className="mono border px-2 py-0.5 text-[8.5px] uppercase tracking-[0.12em]"
                  style={{
                    background: 'color-mix(in oklab, var(--color-amber) 8%, transparent)',
                    borderColor: 'color-mix(in oklab, var(--color-amber) 28%, transparent)',
                    color: 'var(--color-amber-deep)',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 border-t rule pt-5">
          {paragraphs.length > 0 ? (
            <div className="flex flex-col gap-3">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-[11px] leading-[1.7] text-slate">{p}</p>
              ))}
            </div>
          ) : (
            <p className="text-[11px] italic leading-relaxed text-graphite">
              No summary yet — the dialog goes straight from the titles to contact details.
            </p>
          )}
        </div>

        {(draft.phone || draft.email) && (
          <div className="mt-5 flex flex-col gap-2 border-t rule pt-5">
            {draft.phone && <ContactRow label="Phone" value={draft.phone} />}
            {draft.email && <ContactRow label="Email" value={draft.email} />}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="mono w-9 shrink-0 text-[8.5px] uppercase tracking-[0.18em] text-graphite">{label}</span>
      <span className="truncate text-[11px] text-slate underline decoration-silver underline-offset-2">{value}</span>
    </div>
  );
}
