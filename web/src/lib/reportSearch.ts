import { useMemo } from 'react';
import type { Report } from '../cms/data';

/* ─────────────────────────────────────────────────────────────
   One search engine for every report list — the portal catalog,
   the CMS module, the bookmarks shelf.

   Search behaves the way people expect a search box to behave:
   several words are ANDed in any order, "quoted phrases" stay
   together, a leading minus excludes, and `field:value` narrows
   to one column. Everything a report carries is searchable —
   title, description, analyst, sector, company, ticker, type,
   rating and the publication date in whatever form it is typed
   (2026-08-22, 22/08/2026, aug 2026, August, 2026).
   ───────────────────────────────────────────────────────────── */

export type SearchField =
  | 'title' | 'summary' | 'analyst' | 'sector' | 'company'
  | 'ticker' | 'type' | 'rating' | 'date' | 'file';

/** What a user may type before the colon to narrow to one column. */
const FIELD_ALIASES: Record<string, SearchField> = {
  title: 'title', headline: 'title',
  summary: 'summary', description: 'summary', desc: 'summary', about: 'summary',
  analyst: 'analyst', author: 'analyst', by: 'analyst', byline: 'analyst',
  sector: 'sector', category: 'sector', industry: 'sector',
  company: 'company', name: 'company', co: 'company', firm: 'company',
  ticker: 'ticker', symbol: 'ticker', sym: 'ticker', stock: 'ticker',
  type: 'type', kind: 'type', classification: 'type',
  rating: 'rating', call: 'rating', recommendation: 'rating', rec: 'rating',
  date: 'date', published: 'date', year: 'date', month: 'date', on: 'date',
  file: 'file', pdf: 'file', filename: 'file',
};

/** How much a hit in each column counts toward relevance. */
const FIELD_WEIGHT: Record<SearchField, number> = {
  ticker: 60, title: 40, company: 26, type: 20,
  sector: 18, analyst: 18, rating: 14, date: 12, summary: 8, file: 4,
};

const MONTHS_LONG = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Field separator inside the combined haystack. Stripped from queries, so
    a phrase can never match across two columns. */
const SEP = '¦';

/** Lowercase, unaccent, and flatten punctuation to spaces, so "Macro /
    Strategy", "macro-strategy" and "macro strategy" all normalise alike. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(new RegExp(`[^a-z0-9${SEP}]+`, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalizeQuery = (value: string) => normalize(value).split(SEP).join(' ').replace(/\s+/g, ' ').trim();

/** Every written form of one ISO date, so any of them can be typed. */
function dateForms(iso: string): string[] {
  const [y, m, d] = (iso ?? '').split('-');
  if (!y || !m || !d) return [];
  const day = String(Number(d));
  const month = String(Number(m));
  const long = MONTHS_LONG[Number(m) - 1] ?? '';
  const short = long.slice(0, 3);
  return [
    `${y}-${m}-${d}`, `${d}/${m}/${y}`, `${m}/${d}/${y}`,
    `${y}-${m}`, `${m}/${y}`, `${month}/${y}`,
    `${long} ${day} ${y}`, `${short} ${day} ${y}`,
    `${day} ${long} ${y}`, `${day} ${short} ${y}`,
    `${long} ${y}`, `${short} ${y}`,
    y, long, short, day,
  ];
}

/** One report flattened into searchable columns. */
export type ReportDoc = {
  id: string;
  fields: Record<SearchField, string>;
  all: string;
};

export function buildDoc(r: Report): ReportDoc {
  const fields: Record<SearchField, string> = {
    title: normalize(r.title),
    summary: normalize(r.summary),
    analyst: normalize(r.analyst),
    sector: normalize(r.category ?? 'general'),
    company: normalize(
      r.companyName ? `${r.companyName} ${r.company ?? ''}` : 'macro multi name unlinked',
    ),
    ticker: normalize(r.companySymbol ?? ''),
    type: normalize(r.reportType ?? 'unclassified'),
    rating: normalize(r.rating ?? 'unrated not rated'),
    date: normalize(dateForms(r.date).join(` ${SEP} `)),
    file: normalize(r.fileName),
  };
  return { id: r.id, fields, all: Object.values(fields).join(` ${SEP} `) };
}

type Term = {
  value: string;
  field: SearchField | null;
  negated: boolean;
};

/** Split the raw box into terms: bare words, "quoted phrases", -exclusions
    and field:value pairs. A bare word that flattens to several words (a
    date, a hyphenated name) is kept together as a phrase. */
export function parseQuery(raw: string): Term[] {
  const terms: Term[] = [];
  const pattern = /(-?)(?:([a-z]+):)?(?:"([^"]*)"|(\S+))/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const [, minus, rawField, quoted, bare] = match;
    const alias = rawField ? FIELD_ALIASES[rawField.toLowerCase()] ?? null : null;
    // An unknown prefix is not an operator — search the whole thing as text.
    const source = quoted ?? (rawField && !alias ? `${rawField}:${bare ?? ''}` : bare ?? '');
    const value = normalizeQuery(source);
    if (!value) continue;
    terms.push({ value, field: alias, negated: minus === '-' });
  }
  return terms;
}

const hit = (hay: string, needle: string) => hay.includes(needle);

function matches(doc: ReportDoc, terms: Term[]): boolean {
  return terms.every((t) => {
    const found = t.field ? hit(doc.fields[t.field], t.value) : hit(doc.all, t.value);
    return t.negated ? !found : found;
  });
}

/** Relevance for one document: strongest column wins per term, with a bonus
    for an exact column match and for a hit at the start of the column. */
function score(doc: ReportDoc, terms: Term[]): number {
  let total = 0;
  for (const t of terms) {
    if (t.negated) continue;
    const columns = t.field ? [t.field] : (Object.keys(doc.fields) as SearchField[]);
    let best = 0;
    for (const column of columns) {
      const hay = doc.fields[column];
      if (!hay || !hay.includes(t.value)) continue;
      let value = FIELD_WEIGHT[column];
      if (hay === t.value) value += 40;
      else if (hay.startsWith(t.value)) value += 15;
      best = Math.max(best, value);
    }
    total += best;
  }
  return total;
}

/** The words worth marking up in a result title. */
function highlightWords(terms: Term[]): string[] {
  const words = new Set<string>();
  for (const t of terms) {
    if (t.negated) continue;
    for (const word of t.value.split(' ')) {
      if (word.length >= 2) words.add(word);
    }
  }
  return [...words];
}

export type ReportSearch = {
  /** True once the box holds something searchable. */
  active: boolean;
  /** Keep a report: every term has to land somewhere. */
  match: (r: Report) => boolean;
  /** Re-order by relevance. Returns the list untouched with no query, so
      the caller's own sort (newest first) stands. */
  rank: <T extends Report>(list: T[]) => T[];
  /** Words to mark up inside result titles. */
  words: string[];
};

/** Example queries shown under the box — the vocabulary is the same on
    every surface, so learning it once is enough. */
export const SEARCH_EXAMPLES = ['sector:banks', 'type:results', 'rating:buy', 'aug 2026', '-macro'];

/** One-shot search, for callers outside a React render. */
export function searchReports<T extends Report>(list: T[], query: string): T[] {
  const terms = parseQuery(query);
  if (terms.length === 0) return list;
  return list
    .map((r, i) => ({ r, i, doc: buildDoc(r) }))
    .filter((x) => matches(x.doc, terms))
    .map((x) => ({ ...x, s: score(x.doc, terms) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r);
}

export function useReportSearch(source: Report[], query: string): ReportSearch {
  const docs = useMemo(() => {
    const m = new Map<string, ReportDoc>();
    for (const r of source) m.set(r.id, buildDoc(r));
    return m;
  }, [source]);

  const terms = useMemo(() => parseQuery(query), [query]);

  return useMemo(() => {
    const docFor = (r: Report) => docs.get(r.id) ?? buildDoc(r);
    return {
      active: terms.length > 0,
      match: (r: Report) => terms.length === 0 || matches(docFor(r), terms),
      rank: <T extends Report>(list: T[]): T[] => {
        if (terms.length === 0) return list;
        // Stable sort: equal relevance keeps the caller's date order.
        return list
          .map((r, i) => ({ r, i, s: score(docFor(r), terms) }))
          .sort((a, b) => b.s - a.s || a.i - b.i)
          .map((x) => x.r);
      },
      words: highlightWords(terms),
    };
  }, [docs, terms]);
}
