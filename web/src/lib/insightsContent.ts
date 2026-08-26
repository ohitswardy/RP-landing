import { usePublicContent } from './publicContent';

/* ─────────────────────────────────────────────────────────────
   /insights content, authored in the CMS and served by the API.
   The bundled copy below is the last-known-good fallback: if the
   API is unreachable the journal still renders rather than
   collapsing to an empty shell.
   ───────────────────────────────────────────────────────────── */

export type JournalNote = {
  id: string;
  tag: string;
  title: string;
  author: string;
  date: string;       // ISO yyyy-mm-dd
  excerpt: string;
  featured: boolean;
};

export type InsightsPage = {
  hero: { eyebrow: string; title: string; dek: string; image: string };
  filters: { enabled: boolean; allLabel: string; tags: string[] };
  list: {
    /** 0 = every published note. */
    limit: number;
    showExcerpt: boolean;
    showAuthor: boolean;
    showDate: boolean;
    featureLead: boolean;
    noteHref: string;
    emptyText: string;
  };
  cta: { enabled: boolean; label: string; href: string };
  newsletter: { enabled: boolean };
};

export type InsightsContent = { page: InsightsPage; articles: JournalNote[] };

export const INSIGHTS_FALLBACK: InsightsContent = {
  page: {
    hero: {
      eyebrow: 'The journal',
      title: 'Research worth being early on.',
      dek: '',
      image: '/InsightsBG.png',
    },
    filters: {
      enabled: true,
      allLabel: 'All',
      tags: ['Macro', 'Banks', 'Consumer', 'Property', 'Power', 'Single name', 'Policy', 'Strategy'],
    },
    list: {
      limit: 0,
      showExcerpt: true,
      showAuthor: true,
      showDate: true,
      featureLead: true,
      noteHref: '/login',
      emptyText: 'No notes published under this sector yet.',
    },
    cta: { enabled: true, label: 'Sign in for the full archive', href: '/login' },
    newsletter: { enabled: true },
  },
  articles: [
    { id: 'f1', tag: 'Macro', title: 'Beyond the rate cycle: why Philippine consumption is the durable trade for 2026–2028.', author: 'M. Bautista', date: '2026-05-24', excerpt: '', featured: false },
    { id: 'f2', tag: 'Banks', title: 'NIMs have peaked. What survives the compression.', author: 'M. Bautista', date: '2026-05-21', excerpt: '', featured: false },
    { id: 'f3', tag: 'Single name', title: 'ICT: an underappreciated optionality on Manila Port volumes.', author: 'J. Reyes', date: '2026-05-19', excerpt: '', featured: false },
    { id: 'f4', tag: 'Policy', title: "BSP's quiet pivot, in five charts.", author: 'M. Bautista', date: '2026-05-16', excerpt: '', featured: false },
    { id: 'f5', tag: 'Property', title: 'Office vacancy has bottomed. Why the next leg is selective.', author: 'A. Lim', date: '2026-05-13', excerpt: '', featured: false },
    { id: 'f6', tag: 'Consumer', title: 'Mid-cap consumer: where the re-rating is just starting.', author: 'P. Cruz', date: '2026-05-09', excerpt: '', featured: false },
    { id: 'f7', tag: 'Power', title: 'After Malampaya: the LNG transition the market is mispricing.', author: 'A. Lim', date: '2026-05-06', excerpt: '', featured: false },
    { id: 'f8', tag: 'Strategy', title: 'PSEi targets, sector weights, conviction list — Q2 2026 update.', author: 'M. Bautista', date: '2026-05-02', excerpt: '', featured: false },
  ],
};

/** Tolerate a partial payload rather than letting one missing key blank the page. */
function normalize(rawIn: unknown): InsightsContent {
  const raw = rawIn as Partial<InsightsContent>;
  const base = INSIGHTS_FALLBACK.page;
  const page = raw.page ?? ({} as Partial<InsightsPage>);

  return {
    page: {
      hero: { ...base.hero, ...(page.hero ?? {}) },
      filters: { ...base.filters, ...(page.filters ?? {}) },
      list: { ...base.list, ...(page.list ?? {}) },
      cta: { ...base.cta, ...(page.cta ?? {}) },
      newsletter: { ...base.newsletter, ...(page.newsletter ?? {}) },
    },
    // An empty published set is a legitimate answer — only a missing key falls back.
    articles: (raw.articles ?? INSIGHTS_FALLBACK.articles).map((a) => ({
      ...a,
      excerpt: a.excerpt ?? '',
      featured: Boolean(a.featured),
    })),
  };
}

/** Published /insights content, or null until the first response lands. */
export function useInsightsContent(): InsightsContent | null {
  const { data, ready } = usePublicContent('/content/insights', INSIGHTS_FALLBACK, normalize);
  return ready ? data : null;
}

/** "May 24, 2026" — the format the journal ledger has always used. */
export function fmtNoteDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
}
