import { INSIGHTS_FALLBACK, slugify } from './insightsContent';
import { PEOPLE_FALLBACK } from './peopleContent';
import { usePublicContent } from './publicContent';
import { SERVICES_FALLBACK } from './servicesContent';

/* ─────────────────────────────────────────────────────────────
   The index behind the site search. GET /api/content/search returns
   visible people, live service lines, published notes and the static
   page list, cached a minute server-side; the modal fetches it once
   per session. The bundled fallback is assembled from the same
   fallback documents the pages themselves render from, so a search
   during an outage still finds what the site is showing.
   ───────────────────────────────────────────────────────────── */

export type SearchCategory = 'Pages' | 'Services' | 'People' | 'Insights';

export type SearchEntry = {
  title: string;
  desc: string;
  href: string;
  category: SearchCategory;
  keywords: string[];
};

/** Fixed routes the index always offers, whatever the CMS holds. */
export const STATIC_PAGES: { title: string; desc: string; path: string; keywords: string[] }[] = [
  { title: 'Home', desc: "The Philippines' pure-play institutional brokerage and research house.", path: '/', keywords: ['regis', 'partners', 'home', 'brokerage', 'philippines'] },
  { title: 'Our Services', desc: 'Research, sales, trading and corporate access.', path: '/services', keywords: ['services', 'what we do', 'practice'] },
  { title: 'Our Insights', desc: 'Research worth being early on — the Regis journal.', path: '/insights', keywords: ['insights', 'journal', 'research', 'notes', 'archive'] },
  { title: 'About Regis Partners', desc: 'Heritage, leadership, team and awards.', path: '/about', keywords: ['about', 'heritage', 'history', 'team', 'leadership', 'awards'] },
  { title: 'Careers', desc: 'Open roles across research, sales, trading and operations.', path: '/careers', keywords: ['careers', 'jobs', 'hiring', 'work', 'roles', 'vacancies'] },
  { title: 'Contact Us', desc: 'Address, contact numbers, email and the enquiry form.', path: '/contact', keywords: ['contact', 'enquiry', 'inquiry', 'address', 'phone', 'email', 'office', 'makati'] },
  { title: 'Client Login', desc: 'Sign in to the research portal.', path: '/login', keywords: ['login', 'sign in', 'portal', 'client', 'password'] },
];

const PAGE_DESCS = new Map(STATIC_PAGES.map((p) => [p.path, p]));

function pageEntry(title: string, path: string): SearchEntry {
  const known = PAGE_DESCS.get(path);
  return {
    title: known?.title ?? title,
    desc: known?.desc ?? '',
    href: path,
    category: 'Pages',
    keywords: known?.keywords ?? [title.toLowerCase()],
  };
}

type RawIndex = {
  people?: { id?: string; name?: string; role?: string; team?: string; sectors?: string[]; anchor?: string }[];
  services?: { id?: string; title?: string; slug?: string; summary?: string; path?: string }[];
  insights?: { id?: string; title?: string; slug?: string; tag?: string; date?: string; path?: string }[];
  pages?: { title?: string; path?: string }[];
};

/** Flatten the API's grouped index into scored entries, in a stable group order. */
export function normalizeSearchIndex(raw: unknown): SearchEntry[] {
  const r = (raw ?? {}) as RawIndex;
  const out: SearchEntry[] = [];

  const pages = Array.isArray(r.pages) && r.pages.length > 0
    ? r.pages.map((p) => pageEntry(String(p.title ?? ''), String(p.path ?? '/')))
    : STATIC_PAGES.map((p) => pageEntry(p.title, p.path));
  out.push(...pages.filter((p) => p.title));

  for (const s of r.services ?? []) {
    const title = String(s.title ?? '').trim();
    if (!title) continue;
    const slug = String(s.slug ?? slugify(title));
    out.push({
      title,
      desc: String(s.summary ?? ''),
      href: String(s.path ?? `/services/${slug}`),
      category: 'Services',
      keywords: [slug, 'service', 'practice'],
    });
  }

  for (const p of r.people ?? []) {
    const name = String(p.name ?? '').trim();
    if (!name) continue;
    const role = String(p.role ?? '');
    const team = String(p.team ?? '');
    out.push({
      title: name,
      desc: [role, team].filter(Boolean).join(' · '),
      href: String(p.anchor ?? `/about#${slugify(name)}`),
      category: 'People',
      keywords: [role.toLowerCase(), team.toLowerCase(), ...(p.sectors ?? []).map((s) => String(s).toLowerCase())],
    });
  }

  for (const a of r.insights ?? []) {
    const title = String(a.title ?? '').trim();
    if (!title) continue;
    const slug = String(a.slug ?? slugify(title));
    const tag = String(a.tag ?? '');
    out.push({
      title,
      desc: [tag, String(a.date ?? '')].filter(Boolean).join(' · '),
      href: String(a.path ?? `/insights/${slug}`),
      category: 'Insights',
      keywords: [tag.toLowerCase(), 'note', 'research', 'insight'],
    });
  }

  return out;
}

/** The bundled index: the same documents the pages fall back to. */
export const SEARCH_FALLBACK: SearchEntry[] = normalizeSearchIndex({
  pages: STATIC_PAGES.map((p) => ({ title: p.title, path: p.path })),
  services: SERVICES_FALLBACK.services.map((s) => ({ id: s.id, title: s.title, slug: s.slug, summary: s.dek, path: `/services/${s.slug}` })),
  people: PEOPLE_FALLBACK.map((p) => ({ id: p.id, name: p.name, role: p.role, team: p.team, sectors: p.sectors, anchor: `/about#${slugify(p.name)}` })),
  insights: INSIGHTS_FALLBACK.articles.map((a) => ({ id: a.id, title: a.title, slug: a.slug, tag: a.tag, date: a.date, path: `/insights/${a.slug}` })),
});

/** The live index, or the bundled one until it lands / if it fails. */
export function useSearchIndex(enabled = true): SearchEntry[] {
  const { data } = usePublicContent('/content/search', SEARCH_FALLBACK, normalizeSearchIndex, enabled);
  return data;
}

/** Suggestions shown before the first keystroke. */
export const TRENDING = [
  'Research Advisory',
  'Corporate Access',
  'Leadership',
  'Careers',
  'Client Login',
];

/** Rank the index against a query. Title matches lead, then description, keywords, category. */
export function computeResults(query: string, index: SearchEntry[]): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return index
    .map((entry) => {
      let score = 0;
      const tl = entry.title.toLowerCase();
      const dl = entry.desc.toLowerCase();
      if (tl === q) score += 20;
      else if (tl.startsWith(q)) score += 12;
      else if (tl.includes(q)) score += 6;
      if (dl.includes(q)) score += 3;
      if (entry.keywords.some((k) => k.includes(q))) score += 2;
      if (entry.category.toLowerCase().includes(q)) score += 1;
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry);
}
