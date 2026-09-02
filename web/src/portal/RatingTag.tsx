import { ratingDef, type ReportRating } from '../cms/data';

/** The house call on a covered name — a unit square plus the word, in the
    rating's colour. Renders nothing for unrated research (macro, strategy).
    `dark` lifts Hold off the navy Spotlight card, where graphite disappears. */
export default function RatingTag({ rating, dark = false }: { rating: ReportRating | null; dark?: boolean }) {
  if (!rating) return null;
  const def = ratingDef(rating);
  const color = dark && rating === 'Hold' ? 'color-mix(in oklab, var(--color-paper) 78%, transparent)' : def.color;
  return (
    <span
      className="mono inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] uppercase tracking-[0.16em]"
      style={{ color }}
      title={`${def.label} rating`}
    >
      <span aria-hidden className="block h-[5px] w-[5px]" style={{ background: color }} />
      {def.label}
    </span>
  );
}
