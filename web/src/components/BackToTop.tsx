/**
 * GIC's closing gesture: a full-width hairline strip that returns the
 * reader to the top before the footer.
 */
export default function BackToTop() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="group block w-full bg-bone border-t rule text-left cursor-pointer"
    >
      <div className="container-fluid py-6 flex items-center justify-between">
        <span className="mono text-[10px] tracking-[0.24em] uppercase text-graphite transition-colors group-hover:text-[color:var(--color-amber-deep)]">
          Back to top
        </span>
        <svg
          width="12"
          height="14"
          viewBox="0 0 12 14"
          fill="none"
          aria-hidden
          className="text-graphite transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:text-[color:var(--color-amber-deep)] group-hover:-translate-y-1"
        >
          <path d="M6 13V1M6 1L1 6M6 1l5 5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </button>
  );
}
