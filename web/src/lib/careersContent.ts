import { usePublicContent } from './publicContent';

/* ─────────────────────────────────────────────────────────────
   Open roles for /careers, served by GET /api/content/careers and
   managed through the CMS careers API. The bundled copy below is the
   last-known-good fallback so the page still reads as a careers page
   when the API is unreachable — one standing invitation rather than
   an empty ledger.
   ───────────────────────────────────────────────────────────── */

export type CareerType = 'Full-time' | 'Contract' | 'Internship';

export type CareerPost = {
  id: string;
  title: string;
  dept: string;
  type: CareerType;
  location: string;
  summary: string;
  /** Sanitized HTML from the CMS. */
  body: string;
  /** ISO yyyy-mm-dd. */
  posted: string;
};

export type CareersContent = { careers: CareerPost[] };

export const CAREERS_PAGE = {
  eyebrow: 'Careers',
  title: 'We also invest in people.',
  dek: 'Regis is a partnership. Analysts, salespeople, traders and operations staff build a craft here that compounds — and stay long enough to see it pay.',
  image: '/CareersBG.png',
  emptyHeading: 'No open roles right now.',
  emptyBody: 'We hire deliberately and a little ahead of need. If you believe you belong on this desk, write to us anyway — every serious note gets a serious reply.',
  applyLabel: 'Apply for this role',
  /** Where "apply" lands: the contact form, pre-set to the role. */
  applyHref: (post: CareerPost) => `/contact?topic=${encodeURIComponent(`Careers: ${post.title}`)}`,
  speculativeLabel: 'Send a speculative application',
  speculativeHref: '/contact?topic=Careers',
} as const;

export const CAREERS_FALLBACK: CareersContent = {
  careers: [
    {
      id: 'f1',
      title: 'Equity Research Associate',
      dept: 'Research',
      type: 'Full-time',
      location: 'Makati City',
      summary: 'Support senior analysts on single-name and sector coverage across the PSE, from model maintenance to first-draft notes.',
      body: '<p>You will own the models and the data behind two to three sector analysts, draft initiations and quarterly updates, and sit in on management meetings from your first month. We look for two or more years in research, audit or corporate finance, a working knowledge of Philippine listed companies, and writing that is clear without being dull.</p>',
      posted: '2026-08-01',
    },
  ],
};

const TYPES: CareerType[] = ['Full-time', 'Contract', 'Internship'];

/** Tolerate a partial row; drop anything without a title. */
export function normalizeCareer(raw: unknown): CareerPost | null {
  const r = (raw ?? {}) as Partial<CareerPost> & { status?: string };
  const title = String(r.title ?? '').trim();
  if (!title) return null;
  if (r.status && r.status !== 'open') return null;
  const type = TYPES.includes(r.type as CareerType) ? (r.type as CareerType) : 'Full-time';
  return {
    id: String(r.id ?? title),
    title,
    dept: String(r.dept ?? ''),
    type,
    location: String(r.location ?? ''),
    summary: String(r.summary ?? ''),
    body: String(r.body ?? ''),
    posted: String(r.posted ?? ''),
  };
}

function normalize(raw: unknown): CareersContent {
  const r = raw as Partial<CareersContent>;
  // An empty list is a real answer (nothing open); only a missing key falls back.
  if (!Array.isArray(r?.careers)) return CAREERS_FALLBACK;
  return {
    careers: r.careers.map(normalizeCareer).filter((c): c is CareerPost => c !== null),
  };
}

/** Open roles, or null until the first response lands. */
export function useCareersContent(): CareersContent | null {
  const { data, ready } = usePublicContent('/content/careers', CAREERS_FALLBACK, normalize);
  return ready ? data : null;
}

/** "01 Aug 2026" — the ledger's posted-date format. */
export function fmtPosted(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
