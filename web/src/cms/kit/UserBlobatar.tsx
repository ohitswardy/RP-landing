import { Blobatar } from '@blobatar/react';

type Props = {
  /** The person this avatar stands for; the same name always renders the same blobatar. */
  name?: string | null;
  size?: number;
  /** Idle motion (breath, blink, glance). "always" by default; false renders a static image. */
  animate?: 'always' | 'hover' | false;
  className?: string;
};

/**
 * Identity mark for the CMS and CRMS: a blobatar seeded from a person's name,
 * framed by the same hairline ring the old initials badge used. Falls back to
 * an em dash when there is no name yet. The idle animation needs the global
 * `blobatar/motion.css`, which main.tsx loads once.
 */
export default function UserBlobatar({ name, size = 26, animate = 'always', className = '' }: Props) {
  const seed = (name ?? '').trim();
  const frame = `grid shrink-0 place-items-center overflow-hidden rounded-full border ${className}`;
  const frameStyle = {
    width: size,
    height: size,
    background: 'var(--color-bone)',
    borderColor: 'color-mix(in oklab, var(--color-ink) 15%, transparent)',
  } as const;

  if (!seed) {
    return (
      <span className={`mono text-[9.5px] tracking-[0.04em] text-ink ${frame}`} style={frameStyle}>
        —
      </span>
    );
  }

  return (
    <span className={frame} style={frameStyle} aria-hidden="true">
      {animate ? (
        <Blobatar name={seed} size={size} background="circle" title={seed} animate={animate} style={{ display: 'block' }} />
      ) : (
        <Blobatar name={seed} size={size} background="circle" title={seed} style={{ display: 'block' }} />
      )}
    </span>
  );
}
