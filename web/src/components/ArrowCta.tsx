import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * The house CTA: label + amber hairline that extends into a chevron on hover.
 * Ported from the Ariel `ar-cta` grammar into the Regis token system.
 */
export default function ArrowCta({
  to,
  children,
  tone = 'ink',
  className = '',
}: {
  to: string;
  children: ReactNode;
  tone?: 'ink' | 'paper';
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={[
        'group inline-flex items-center gap-4',
        tone === 'paper' ? 'text-paper' : 'text-ink',
        className,
      ].join(' ')}
    >
      <span className="text-[13.5px] tracking-[-0.005em]">{children}</span>
      <span aria-hidden className="relative flex items-center text-[color:var(--color-amber)]">
        <span className="block h-px w-8 bg-current transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:w-14" />
        <svg
          width="7"
          height="12"
          viewBox="0 0 7 12"
          fill="none"
          className="-ml-[1px] shrink-0"
        >
          <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    </Link>
  );
}
