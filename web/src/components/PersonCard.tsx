import { useState } from 'react';
import { motion } from 'framer-motion';
import PersonModal from './PersonModal';

export interface Person {
  n: string;
  /** One title string, or an array for dual-title directors */
  r: string | string[];
  /** One paragraph string, or an array of up to three paragraphs */
  e: string | string[];
  /** Optional sector coverage tags (displayed as chips) */
  sectors?: string[];
  phone?: string;
  email?: string;
  img?: string;
}

interface PersonCardProps {
  person: Person;
  index?: number;
}

export default function PersonCard({ person, index = 0 }: PersonCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const initials = person.n
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('');

  const roles = Array.isArray(person.r) ? person.r : [person.r];
  const teaser = Array.isArray(person.e) ? person.e[0] : person.e;
  const primaryRole = roles[0];

  return (
    <>
    <motion.div
      className="group cursor-pointer"
      onClick={() => setModalOpen(true)}
      role="button"
      tabIndex={0}
      aria-label={`View profile of ${person.n}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalOpen(true); }
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.65,
        ease: [0.25, 1, 0.5, 1],
        delay: index * 0.07,
      }}
    >
      {/* Portrait card */}
      <div
        className="aspect-4/5 bg-navy relative overflow-hidden mb-5
          transition-transform duration-380 ease-quart
          group-hover:scale-[1.018] group-hover:-translate-y-0.5"
      >
        {/* Layer 1 — Initials fallback (always present, covered by photo when img loads) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
        >
          <span className="text-paper/10 text-[10rem] leading-none tracking-tighter font-medium">
            {initials}
          </span>
        </div>

        {/* Layer 2 — Photo */}
        {person.img && (
          <img
            src={person.img}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        )}

        {/* Layer 3 — Permanent bottom vignette: keeps amber badge legible over any photo */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-navy/80 to-transparent pointer-events-none"
        />

        {/* Layer 4 — Hover overlay: stacked roles + teaser + cta */}
        <div
          className="absolute inset-0 flex flex-col justify-end p-6 gap-3
            bg-navy-deep/90
            opacity-0 group-hover:opacity-100
            transition-opacity duration-300 ease-quart"
        >
          <div className="flex flex-col gap-1">
            {roles.map((role) => (
              <span
                key={role}
                className="mono text-[10px] tracking-[0.16em] uppercase leading-snug"
                style={{ color: 'var(--color-amber)' }}
              >
                {role}
              </span>
            ))}
          </div>

          <p className="text-paper/80 text-[13px] leading-relaxed line-clamp-3">
            {teaser}
          </p>

          <span className="mono text-[10px] tracking-[0.14em] uppercase text-paper/35">
            View profile →
          </span>
        </div>

        {/* Default: amber role badge (fades out on hover) */}
        <div
          className="absolute left-5 bottom-5 right-5
            transition-all duration-200 ease-quart
            group-hover:opacity-0 group-hover:translate-y-1"
        >
          <span
            className="mono text-[11px] tracking-[0.16em] uppercase"
            style={{ color: 'var(--color-amber)' }}
          >
            {primaryRole}
          </span>
        </div>
      </div>

      <h3 className="text-xl tracking-[-0.012em] font-medium">{person.n}</h3>
      <p className="text-slate mt-1.5 text-[13.5px]">{primaryRole}</p>

      {/* Sector chips */}
      {person.sectors && person.sectors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {person.sectors.map((s) => (
            <span
              key={s}
              className="mono text-[9.5px] tracking-[0.12em] uppercase px-2 py-0.5
                border text-graphite"
              style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 30%, transparent)' }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </motion.div>

    <PersonModal
      person={modalOpen ? person : null}
      onClose={() => setModalOpen(false)}
    />
    </>
  );
}
