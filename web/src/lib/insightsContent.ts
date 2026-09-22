import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from './api';
import { reportContentFailure, usePublicContent } from './publicContent';

/* ─────────────────────────────────────────────────────────────
   /insights content, authored in the CMS and served by the API.
   The bundled copy below is the last-known-good fallback: if the
   API is unreachable the journal still renders rather than
   collapsing to an empty shell.

   Every note is readable at /insights/{slug}; the summary carries
   the slug and the article endpoint returns the sanitized body.
   ───────────────────────────────────────────────────────────── */

export type JournalNote = {
  id: string;
  slug: string;
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
    emptyText: string;
  };
  cta: { enabled: boolean; label: string; href: string };
};

export type InsightsContent = { page: InsightsPage; articles: JournalNote[] };

/** A note in full, as GET /content/insights/{slug} returns it. */
export type InsightArticle = JournalNote & { body: string };

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
      emptyText: 'No notes published under this sector yet.',
    },
    cta: { enabled: true, label: 'Sign in for the full archive', href: '/login' },
  },
  articles: [
    { id: 'f1', slug: 'beyond-the-rate-cycle', tag: 'Macro', title: 'Beyond the rate cycle: why Philippine consumption is the durable trade for 2026–2028.', author: 'M. Bautista', date: '2026-05-24', excerpt: '', featured: false },
    { id: 'f2', slug: 'nims-have-peaked', tag: 'Banks', title: 'NIMs have peaked. What survives the compression.', author: 'M. Bautista', date: '2026-05-21', excerpt: '', featured: false },
    { id: 'f3', slug: 'ict-manila-port-optionality', tag: 'Single name', title: 'ICT: an underappreciated optionality on Manila Port volumes.', author: 'J. Reyes', date: '2026-05-19', excerpt: '', featured: false },
    { id: 'f4', slug: 'bsp-quiet-pivot', tag: 'Policy', title: "BSP's quiet pivot, in five charts.", author: 'M. Bautista', date: '2026-05-16', excerpt: '', featured: false },
    { id: 'f5', slug: 'office-vacancy-has-bottomed', tag: 'Property', title: 'Office vacancy has bottomed. Why the next leg is selective.', author: 'A. Lim', date: '2026-05-13', excerpt: '', featured: false },
    { id: 'f6', slug: 'mid-cap-consumer-re-rating', tag: 'Consumer', title: 'Mid-cap consumer: where the re-rating is just starting.', author: 'P. Cruz', date: '2026-05-09', excerpt: '', featured: false },
    { id: 'f7', slug: 'after-malampaya', tag: 'Power', title: 'After Malampaya: the LNG transition the market is mispricing.', author: 'A. Lim', date: '2026-05-06', excerpt: '', featured: false },
    { id: 'f8', slug: 'q2-2026-strategy-update', tag: 'Strategy', title: 'PSEi targets, sector weights, conviction list — Q2 2026 update.', author: 'M. Bautista', date: '2026-05-02', excerpt: '', featured: false },
  ],
};

/** URL-safe key from a title, for notes that arrive without a slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Where a note is read. */
export function noteHref(note: Pick<JournalNote, 'slug'>): string {
  return `/insights/${note.slug}`;
}

/** Normalise one summary, tolerating a missing slug or excerpt. */
export function normalizeNote(raw: unknown): JournalNote {
  const a = (raw ?? {}) as Partial<JournalNote>;
  const title = String(a.title ?? '');
  return {
    id: String(a.id ?? ''),
    slug: a.slug ? String(a.slug) : slugify(title),
    tag: String(a.tag ?? ''),
    title,
    author: String(a.author ?? ''),
    date: String(a.date ?? ''),
    excerpt: a.excerpt ?? '',
    featured: Boolean(a.featured),
  };
}

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
    },
    // An empty published set is a legitimate answer — only a missing key falls back.
    articles: (raw.articles ?? INSIGHTS_FALLBACK.articles).map(normalizeNote),
  };
}

/** Published /insights content, or null until the first response lands. */
export function useInsightsContent(): InsightsContent | null {
  const { data, ready } = usePublicContent('/content/insights', INSIGHTS_FALLBACK, normalize);
  return ready ? data : null;
}

/**
 * The published notes only, with the bundled set standing in before the
 * request lands and after it fails. For components that resolve a title
 * to a readable URL (the home page's insight cards).
 */
export function useInsightNotes(): JournalNote[] {
  const { data } = usePublicContent('/content/insights', INSIGHTS_FALLBACK, normalize);
  return data.articles;
}

/* ── One note in full ──────────────────────────────────────── */

export type InsightArticleState =
  | { status: 'loading' }
  | { status: 'found'; article: InsightArticle; related: JournalNote[]; cached: boolean }
  | { status: 'missing' }
  | { status: 'unavailable'; note: JournalNote | null };

const articleCache = new Map<string, { article: InsightArticle; related: JournalNote[] }>();

/**
 * GET /content/insights/{slug}. A 404 is a real answer (the note is
 * unpublished or never existed) and surfaces as `missing`; any other
 * failure is an outage, in which case the bundled summary stands in
 * when it knows the slug (`found`, `cached`), otherwise `unavailable`.
 */
export function useInsightArticle(slug: string | undefined): InsightArticleState {
  const [state, setState] = useState<InsightArticleState>(() => {
    const hit = slug ? articleCache.get(slug) : undefined;
    return hit ? { status: 'found', ...hit, cached: false } : { status: 'loading' };
  });

  useEffect(() => {
    if (!slug) { setState({ status: 'missing' }); return; }
    const hit = articleCache.get(slug);
    if (hit) { setState({ status: 'found', ...hit, cached: false }); return; }

    let alive = true;
    setState({ status: 'loading' });

    const path = `/content/insights/${encodeURIComponent(slug)}`;
    apiFetch<{ article?: unknown; related?: unknown[] }>(path)
      .then((raw) => {
        const summary = normalizeNote(raw.article);
        const body = String((raw.article as { body?: unknown } | undefined)?.body ?? '');
        const article: InsightArticle = { ...summary, body };
        const related = Array.isArray(raw.related) ? raw.related.map(normalizeNote).slice(0, 3) : [];
        articleCache.set(slug, { article, related });
        if (alive) setState({ status: 'found', article, related, cached: false });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: 'missing' });
          return;
        }
        reportContentFailure(path, err);
        // Outage: the bundled journal knows a handful of notes by slug.
        const note = INSIGHTS_FALLBACK.articles.find((n) => n.slug === slug) ?? null;
        if (note) {
          const related = INSIGHTS_FALLBACK.articles.filter((n) => n.slug !== slug).slice(0, 3);
          setState({ status: 'found', article: { ...note, body: '' }, related, cached: true });
        } else {
          setState({ status: 'unavailable', note: null });
        }
      });

    return () => { alive = false; };
  }, [slug]);

  return state;
}

/** "May 24, 2026" — the format the journal ledger has always used. */
export function fmtNoteDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
}
