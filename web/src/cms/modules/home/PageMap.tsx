import { motion, useReducedMotion } from 'framer-motion';
import { Chip, EASE, Switch } from '../../ui';
import { HOME_SECTIONS, headlineLines, type HomeCopy, type HomeSectionKey } from '../../data';

/* ─────────────────────────────────────────────────────────────
   The page map: every landing-page section in the order it stacks,
   one ruled row each. Pick a row to edit it; the switch pulls the
   section from the page without losing its copy. The segment strip
   above is the same page as eight marks — one per section, lit
   when it is shown, amber where the editor is.
   ───────────────────────────────────────────────────────────── */

/** The line the desk would recognise the section by. */
export function sectionSummary(copy: HomeCopy, key: HomeSectionKey): string {
  switch (key) {
    case 'hero': return headlineLines(copy.hero.headline).join(' ') || 'No headline yet';
    case 'numbers': return copy.numbers.heading || 'No heading yet';
    case 'services': return copy.services.heading || 'No heading yet';
    case 'insights': return copy.insights.heading || 'No heading yet';
    case 'culture': return copy.culture.heading || 'No heading yet';
    case 'community': return copy.community.heading || 'No heading yet';
    case 'quote': return copy.quote.quote || 'No quote yet';
    case 'careers': return copy.careers.heading || 'No heading yet';
  }
}

export default function PageMap({
  copy, selected, edited, onSelect, onToggle,
}: {
  copy: HomeCopy;
  selected: HomeSectionKey;
  edited: Set<HomeSectionKey>;
  onSelect: (key: HomeSectionKey) => void;
  onToggle: (key: HomeSectionKey) => void;
}) {
  const reduce = useReducedMotion();
  const shown = HOME_SECTIONS.filter((s) => copy[s.key].enabled).length;

  return (
    <section className="border rule bg-paper">
      <header className="flex flex-col gap-4 border-b rule px-6 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">/ · page map</div>
            <h3 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-ink">Sections, top to bottom</h3>
          </div>
          <span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">
            {shown}/{HOME_SECTIONS.length} shown
          </span>
        </div>

        {/* Segment strip — one mark per section. */}
        <div className="flex items-center gap-1" role="tablist" aria-label="Landing page sections">
          {HOME_SECTIONS.map((s) => {
            const on = s.key === selected;
            const enabled = copy[s.key].enabled;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={`${s.label}${enabled ? '' : ', hidden'}`}
                title={s.label}
                onClick={() => onSelect(s.key)}
                className="group relative h-4 flex-1"
              >
                <motion.span
                  layout={!reduce}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="absolute inset-x-0 top-1/2 block h-[6px] -translate-y-1/2 transition-colors duration-300"
                  style={{
                    background: on
                      ? 'var(--color-amber-deep)'
                      : enabled
                        ? 'var(--color-navy)'
                        : 'color-mix(in oklab, var(--color-ink) 10%, transparent)',
                    outline: enabled ? 'none' : '1px dashed color-mix(in oklab, var(--color-ink) 25%, transparent)',
                    outlineOffset: -1,
                  }}
                />
              </button>
            );
          })}
        </div>
      </header>

      <ul className="divide-y rule">
        {HOME_SECTIONS.map((s, i) => {
          const on = s.key === selected;
          const enabled = copy[s.key].enabled;
          const isEdited = edited.has(s.key);
          return (
            <li key={s.key} className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pr-5">
              {on && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[2px]"
                  style={{ background: 'var(--color-amber-deep)' }}
                />
              )}
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(s.key)}
                className={`grid min-w-0 grid-cols-[34px_minmax(0,1fr)] items-baseline gap-x-4 py-3.5 pl-6 text-left transition-colors duration-300 ${
                  on ? 'bg-white' : 'hover:bg-white/70'
                }`}
              >
                <span className={`mono num text-[10.5px] tracking-[0.14em] ${on ? 'text-ink' : 'text-graphite'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className={`text-[13.5px] ${enabled ? 'text-ink' : 'text-graphite line-through decoration-[color:var(--color-silver)]'}`}>
                      {s.label}
                    </span>
                    <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-silver">{s.hint}</span>
                    {isEdited && <Chip tone="amber">Edited</Chip>}
                    {!enabled && <Chip tone="muted">Hidden</Chip>}
                  </span>
                  <span className={`mt-1 block truncate text-[12px] ${enabled ? 'text-slate' : 'text-silver'}`}>
                    {sectionSummary(copy, s.key)}
                  </span>
                </span>
              </button>
              <Switch
                on={enabled}
                onToggle={() => onToggle(s.key)}
                label={enabled ? `Hide ${s.label} from the page` : `Show ${s.label} on the page`}
              />
            </li>
          );
        })}
      </ul>

      <p className="border-t rule px-6 py-3 text-[11.5px] leading-relaxed text-graphite">
        A hidden section keeps its copy and photos; it just leaves the page. Visibility publishes with the rest of the draft.
      </p>
    </section>
  );
}
