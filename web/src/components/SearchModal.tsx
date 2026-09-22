import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { computeResults, TRENDING, type SearchEntry } from '../lib/searchContent';

const ease = [0.25, 1, 0.5, 1] as const;

/* ─────────────────────────────────────────────────────────────
   The site search dropdown. The index it ranks comes from
   GET /api/content/search (people, service lines, published notes,
   static pages), fetched once per session by the navbar through
   `useSearchIndex()` and handed in as `index`; during an outage the
   navbar passes the bundled index built from the same fallback
   documents the pages render. Nothing here is hardcoded.
   ───────────────────────────────────────────────────────────── */

export type { SearchEntry } from '../lib/searchContent';
export { computeResults, TRENDING, useSearchIndex } from '../lib/searchContent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const re = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark
            key={i}
            style={{
              background: 'var(--color-amber)',
              color: 'var(--color-navy-deep)',
              fontWeight: 600,
              borderRadius: '2px',
              padding: '0 1px',
            }}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// ─── Category icon ────────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: string }) {
  const paths: Record<string, React.ReactNode> = {
    Pages: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    Services: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
    About: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>,
    People: <><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></>,
    Contact: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z" /></>,
    Insights: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></>,
  };
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[category] ?? <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

// ─── Width ────────────────────────────────────────────────────────────────────

export const SEARCH_PANEL_WIDTH = 320;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  /** The index to rank: the live one from `useSearchIndex()`, or a stub in tests. */
  index: SearchEntry[];
  query: string;
  onQueryChange: (q: string) => void;
  activeIndex: number;
  onActiveIndex: (i: number) => void;
  onSelect: (href: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchModal({ open, index, query, onQueryChange, activeIndex, onActiveIndex, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLButtonElement>('[data-active="true"]');
    // Optional call: jsdom (tests) has no scrollIntoView.
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  const results = useMemo<SearchEntry[]>(() => computeResults(query, index), [query, index]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchEntry[]>();
    for (const entry of results) {
      if (!map.has(entry.category)) map.set(entry.category, []);
      map.get(entry.category)!.push(entry);
    }
    return map;
  }, [results]);

  const empty = query.trim() === '';
  const noResults = !empty && results.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease }}
          className="absolute right-0 z-50 overflow-hidden shadow-2xl"
          style={{
            top: 'calc(100% + 1px)',
            width: SEARCH_PANEL_WIDTH,
            background: '#ffffff',
            border: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)',
          }}
        >
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '68vh' }}>

            {/* Default — trending only */}
            {empty && (
              <div className="py-4 px-4">
                <div className="mono text-[10px] tracking-[0.2em] uppercase mb-2.5" style={{ color: 'var(--color-graphite)' }}>
                  Trending
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TRENDING.map((t) => (
                    <button
                      key={t}
                      onClick={() => onQueryChange(t)}
                      className="flex items-center gap-1 mono text-[10.5px] tracking-[0.06em] px-2.5 py-1 border rule transition-colors duration-150"
                      style={{ color: 'var(--color-slate)', background: 'var(--color-bone)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklab, var(--color-amber) 12%, var(--color-bone))';
                        (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in oklab, var(--color-amber) 35%, transparent)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--color-bone)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--color-slate)';
                        (e.currentTarget as HTMLElement).style.borderColor = '';
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                      </svg>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {noResults && (
              <div className="px-4 py-10 text-center">
                <p className="text-[13.5px]" style={{ color: 'var(--color-graphite)' }}>
                  No results for{' '}
                  <span className="font-medium" style={{ color: 'var(--color-ink)' }}>"{query}"</span>
                </p>
                <p className="text-[11.5px] mt-1" style={{ color: 'var(--color-silver)' }}>
                  Try a page, service, person, or topic.
                </p>
              </div>
            )}

            {/* Results */}
            {!empty && !noResults && (
              <div className="py-1">
                {Array.from(grouped.entries()).map(([cat, entries]) => (
                  <div key={cat}>
                    <div
                      className="mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 flex items-center gap-1.5"
                      style={{ color: 'var(--color-graphite)' }}
                    >
                      <CategoryIcon category={cat} />
                      {cat}
                    </div>
                    {entries.map((entry) => {
                      const idx = results.indexOf(entry);
                      const isActive = idx === activeIndex;
                      return (
                        <button
                          key={`${entry.href}-${entry.title}`}
                          data-active={isActive}
                          onClick={() => onSelect(entry.href)}
                          onMouseEnter={() => onActiveIndex(idx)}
                          className="w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors duration-100"
                          style={{
                            background: isActive
                              ? 'color-mix(in oklab, var(--color-amber) 8%, var(--color-bone))'
                              : 'transparent',
                          }}
                        >
                          <span
                            className="mt-0.5 flex-shrink-0 transition-colors duration-100"
                            style={{ color: isActive ? 'var(--color-amber)' : 'var(--color-silver)' }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[13px] tracking-[-0.005em] leading-snug"
                              style={{ color: isActive ? 'var(--color-ink)' : 'var(--color-slate)' }}
                            >
                              <Highlight text={entry.title} query={query} />
                            </div>
                            <div className="text-[11px] leading-snug mt-0.5 truncate" style={{ color: 'var(--color-graphite)' }}>
                              <Highlight text={entry.desc} query={query} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-3 px-4 py-2"
            style={{ borderTop: '1px solid color-mix(in oklab, var(--color-ink) 8%, transparent)' }}
          >
            <span className="mono text-[9.5px] tracking-[0.1em] uppercase flex items-center gap-1" style={{ color: 'var(--color-silver)' }}>
              <kbd className="px-1 border rule" style={{ background: 'var(--color-bone)' }}>↑↓</kbd>
              nav
            </span>
            <span className="mono text-[9.5px] tracking-[0.1em] uppercase flex items-center gap-1" style={{ color: 'var(--color-silver)' }}>
              <kbd className="px-1 border rule" style={{ background: 'var(--color-bone)' }}>↵</kbd>
              go
            </span>
            <span className="mono text-[9.5px] tracking-[0.1em] uppercase flex items-center gap-1" style={{ color: 'var(--color-silver)' }}>
              <kbd className="px-1 border rule" style={{ background: 'var(--color-bone)' }}>esc</kbd>
              close
            </span>
          </div>

          {/* Amber conviction line */}
          <div
            className="h-[2px]"
            style={{ background: 'linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-deep) 55%, transparent 100%)' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
