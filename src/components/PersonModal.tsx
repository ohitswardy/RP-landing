import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Person } from './PersonCard';

interface PersonModalProps {
  person: Person | null;
  onClose: () => void;
}

export default function PersonModal({ person, onClose }: PersonModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll and focus close button when open
  useEffect(() => {
    if (!person) return;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = ''; };
  }, [person]);

  // Escape key closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <AnimatePresence>
      {person && (
        <motion.div
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-label={person.n}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-navy-deep/65 backdrop-blur-sm" />

          {/* Panel */}
          <motion.div
            className="relative bg-bone w-full max-w-3xl max-h-[90dvh] overflow-y-auto z-10"
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close profile"
              className="absolute top-5 right-5 z-20 w-9 h-9 flex items-center justify-center
                text-slate hover:text-ink transition-colors duration-150
                outline-none focus-visible:ring-2 focus-visible:ring-amber rounded-sm"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-0">
              {/* Portrait column */}
              <PortraitBlock person={person} />

              {/* Content column */}
              <ContentBlock person={person} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- sub-components ---------- */

function PortraitBlock({ person }: { person: Person }) {
  const initials = person.n
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="bg-navy relative overflow-hidden min-h-55 md:min-h-full">
      {/* Initials fallback */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
      >
        <span className="text-paper/[0.07] text-[7rem] leading-none tracking-tighter font-medium">
          {initials}
        </span>
      </div>

      {/* Photo */}
      {person.img && (
        <img
          src={person.img}
          alt={person.n}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      )}

      {/* Name overlay at bottom (mobile only — portrait block is short) */}
      <div className="absolute left-5 bottom-5 right-5 md:hidden">
        <h2 className="text-paper text-xl tracking-[-0.018em] font-medium leading-tight drop-shadow-md">
          {person.n}
        </h2>
      </div>
    </div>
  );
}

function ContentBlock({ person }: { person: Person }) {
  const roles = Array.isArray(person.r) ? person.r : [person.r];
  const paragraphs = Array.isArray(person.e) ? person.e : [person.e];

  return (
    <div className="p-8 md:p-10 flex flex-col">
      {/* Name (desktop only) */}
      <h2 className="hidden md:block text-[1.6rem] tracking-[-0.022em] font-medium leading-tight mb-5">
        {person.n}
      </h2>

      {/* Roles */}
      <ul className="flex flex-col gap-1.5 mb-5">
        {roles.map((role) => (
          <li key={role}>
            <span
              className="mono text-[11px] tracking-[0.16em] uppercase"
              style={{ color: 'var(--color-amber)' }}
            >
              {role}
            </span>
          </li>
        ))}
      </ul>

      {/* Sector Coverage (optional) */}
      {person.sectors && person.sectors.length > 0 && (
        <div className="mb-7">
          <div className="eyebrow mb-3">Sector Coverage</div>
          <div className="flex flex-wrap gap-2">
            {person.sectors.map((s) => (
              <span
                key={s}
                className="mono text-[10px] tracking-[0.12em] uppercase px-2.5 py-1 border"
                style={{
                  background: 'color-mix(in oklab, var(--color-amber) 8%, transparent)',
                  borderColor: 'color-mix(in oklab, var(--color-amber) 28%, transparent)',
                  color: 'var(--color-amber)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t rule mb-7" />

      {/* Bio paragraphs */}
      <div className="flex flex-col gap-4 flex-1">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-slate text-[14.5px] leading-[1.72]">
            {para}
          </p>
        ))}
      </div>

      {/* Contact */}
      {(person.phone || person.email) && (
        <div className="border-t rule mt-8 pt-7 flex flex-col gap-3">
          {person.phone && (
            <ContactRow
              label="Phone"
              value={person.phone}
              href={`tel:${person.phone.replace(/\s/g, '')}`}
            />
          )}
          {person.email && (
            <ContactRow
              label="Email"
              value={person.email}
              href={`mailto:${person.email}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="mono text-[10px] tracking-[0.18em] uppercase text-graphite w-10 shrink-0">
        {label}
      </span>
      <a
        href={href}
        className="text-[13.5px] text-slate hover:text-ink transition-colors duration-150
          underline decoration-silver underline-offset-2 hover:decoration-amber"
      >
        {value}
      </a>
    </div>
  );
}
