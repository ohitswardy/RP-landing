import { type Article, type InsightsPage, fmtDate } from '../../data';

/* ─────────────────────────────────────────────────────────────
   A scaled-down /insights, driven by the draft document and the
   real published notes. It mirrors the public page's own rules:
   the lead only shows unfiltered, and a sector tag with no notes
   never reaches the rail.
   ───────────────────────────────────────────────────────────── */

const OVERLAY =
  'linear-gradient(to top, oklch(0.14 0.040 260 / 0.88) 0%, oklch(0.14 0.040 260 / 0.70) 50%, oklch(0.14 0.040 260 / 0.55) 100%)';

export default function JournalPreview({ page, notes }: { page: InsightsPage; notes: Article[] }) {
  const counts = new Map<string, number>();
  for (const n of notes) counts.set(n.tag, (counts.get(n.tag) ?? 0) + 1);
  const rail = page.filters.tags.filter((t) => (counts.get(t) ?? 0) > 0);

  const lead = page.list.featureLead ? notes.find((n) => n.featured) : undefined;
  const rest = lead ? notes.filter((n) => n.id !== lead.id) : notes;
  const ledger = page.list.limit > 0 ? rest.slice(0, page.list.limit) : rest;
  const hidden = rest.length - ledger.length;

  return (
    <div className="bg-paper">
      {/* Header band */}
      <div className={`relative overflow-hidden px-5 py-8 text-paper ${page.hero.image ? '' : 'bg-blueprint'}`}>
        {page.hero.image && (
          <>
            <img src={page.hero.image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-center" />
            <div aria-hidden className="absolute inset-0" style={{ background: OVERLAY }} />
          </>
        )}
        <div className="relative">
          {page.hero.eyebrow && <div className="eyebrow eyebrow-paper mb-4" style={{ fontSize: 9 }}>{page.hero.eyebrow}</div>}
          <h2 className="max-w-[18ch] text-[22px] font-medium leading-[1.06] tracking-[-0.025em]">
            {page.hero.title || 'Untitled page'}
          </h2>
          {page.hero.dek && <p className="mt-4 max-w-[46ch] text-[11.5px] leading-[1.6] text-paper/70">{page.hero.dek}</p>}
        </div>
      </div>

      {/* Lead note */}
      {lead && (
        <div className="border-b rule bg-bone px-5 py-6">
          <span aria-hidden className="mb-3 block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
          <div className="eyebrow !mb-0" style={{ fontSize: 9 }}>{lead.tag}</div>
          <h3 className="mt-2.5 max-w-[26ch] text-[15px] font-medium leading-[1.2] tracking-[-0.02em] text-ink">{lead.title}</h3>
          {lead.excerpt && <p className="mt-2.5 max-w-[52ch] text-[11px] leading-relaxed text-slate">{lead.excerpt}</p>}
          <div className="mt-4 flex items-center gap-3 text-[10.5px] text-ink">
            Read the note <span className="block h-px w-6 bg-ink/30" />
          </div>
        </div>
      )}

      {/* Filter rail */}
      {page.filters.enabled && rail.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b rule px-5 py-4">
          <span className="mono border border-navy bg-navy px-2 py-1 text-[8.5px] uppercase tracking-[0.14em] text-paper">
            {page.filters.allLabel} <span className="num opacity-50">{notes.length}</span>
          </span>
          {rail.map((t) => (
            <span key={t} className="mono border rule px-2 py-1 text-[8.5px] uppercase tracking-[0.14em] text-slate">
              {t} <span className="num opacity-50">{counts.get(t)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Ledger */}
      <div className="px-5">
        {ledger.length === 0 ? (
          <p className="py-10 text-center text-[11.5px] text-graphite">
            {notes.length === 0
              ? 'No notes are published — the ledger would render empty.'
              : page.list.emptyText}
          </p>
        ) : (
          <ul className="divide-y rule">
            {ledger.map((n) => (
              <li key={n.id} className="grid grid-cols-12 items-baseline gap-x-3 py-4">
                <div className="eyebrow col-span-4 !mb-0" style={{ fontSize: 8.5 }}>{n.tag}</div>
                {page.list.showDate && (
                  <div className="mono col-span-4 text-[9px] text-graphite">{fmtDate(n.date)}</div>
                )}
                <div className={page.list.showDate ? 'col-span-4' : 'col-span-8'} />
                <div className="col-span-12 mt-1.5">
                  <div className="text-[12.5px] font-medium leading-snug tracking-[-0.01em] text-ink">{n.title}</div>
                  {page.list.showExcerpt && n.excerpt && (
                    <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-slate">{n.excerpt}</p>
                  )}
                  {page.list.showAuthor && <div className="mt-1.5 text-[10px] text-graphite">{n.author}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && (
          <p className="mono border-t rule py-3 text-center text-[9px] uppercase tracking-[0.14em] text-graphite">
            {hidden} more note{hidden === 1 ? '' : 's'} held back by the cap
          </p>
        )}
      </div>

      {/* Sign-in prompt */}
      {page.cta.enabled && page.cta.label && (
        <div className="px-5 py-8 text-center">
          <span className="inline-flex items-center gap-2 text-[11px] text-slate">
            {page.cta.label}
            <span style={{ color: 'var(--color-amber-deep)' }}>&rarr;</span>
          </span>
        </div>
      )}

      {/* Newsletter band */}
      {page.newsletter.enabled && (
        <div className="border-t rule bg-white px-5 py-7 text-center">
          <div className="text-[13px] font-medium tracking-[-0.02em] text-navy-deep">Stay current with updates.</div>
          <div className="mx-auto mt-3 h-6 w-[70%] border border-gray-300 bg-white" />
        </div>
      )}
    </div>
  );
}
