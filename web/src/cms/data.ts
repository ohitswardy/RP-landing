/* ─────────────────────────────────────────────────────────────
   Shared CMS/portal types and format helpers. All content now
   lives in the Laravel API (MySQL) — these shapes are the wire
   contract returned by /api endpoints.
   ───────────────────────────────────────────────────────────── */

export type ArticleStatus = 'published' | 'review' | 'draft';

export type Article = {
  id: string;
  tag: string;
  title: string;
  author: string;
  date: string;        // ISO
  status: ArticleStatus;
  reads: number;
  excerpt: string;
  /** The one note promoted to the lead block on /insights. */
  featured: boolean;
};

/* ── Insights page copy ────────────────────────────── */

/** Everything on /insights outside the notes themselves. */
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

export const EMPTY_INSIGHTS: InsightsPage = {
  hero: { eyebrow: '', title: '', dek: '', image: '' },
  filters: { enabled: true, allLabel: 'All', tags: [] },
  list: {
    limit: 0, showExcerpt: true, showAuthor: true, showDate: true,
    featureLead: true, noteHref: '/login', emptyText: '',
  },
  cta: { enabled: true, label: '', href: '/login' },
  newsletter: { enabled: true },
};

export type StaffTeam = 'Board of Directors' | 'Research' | 'Sales & Trading' | 'Operations';

export type StaffMember = {
  id: string;
  name: string;
  /** Stacked titles — directors carry two (e.g. Managing Director / Head of Research). */
  roles: string[];
  /** First title. Convenience mirror of roles[0] for lists and cards. */
  role: string;
  /** Profile summary, one entry per paragraph. */
  bio: string[];
  /** Sector coverage chips, shown on research profiles. */
  sectors: string[];
  phone: string;
  email: string;
  team: StaffTeam;
  img: string;
  visible: boolean;
  position: number;
};

/* ── About page copy ───────────────────────────────────────── */

export type AboutPair = { label: string; value: string };
export type AboutTimelineEntry = { year: string; title: string; body: string };
export type AboutAwardItem = { name: string; years: string };
export type AboutAwardGroup = { org: string; items: AboutAwardItem[] };

/** Every text block on /about outside the people roster. */
export type AboutCopy = {
  hero: { eyebrow: string; title: string; image: string };
  overview: { heading: string; paragraphs: string[]; profile: AboutPair[] };
  heritage: { eyebrow: string; heading: string; timeline: AboutTimelineEntry[] };
  leadership: { heading: string };
  awards: { eyebrow: string; heading: string; groups: AboutAwardGroup[] };
};

export const EMPTY_ABOUT: AboutCopy = {
  hero: { eyebrow: '', title: '', image: '' },
  overview: { heading: '', paragraphs: [], profile: [] },
  heritage: { eyebrow: '', heading: '', timeline: [] },
  leadership: { heading: '' },
  awards: { eyebrow: '', heading: '', groups: [] },
};

/* ── Contact page copy ─────────────────────────────────────── */

/** One row in the office ledger's contact column — TEL, FAX, and so on. */
export type ContactChannel = { label: string; value: string };

/** Every text block on /contact. The enquiry form's plumbing stays in code. */
export type ContactCopy = {
  hero: { eyebrow: string; title: string; image: string };
  inquiry: {
    eyebrow: string;
    /** A newline here breaks the heading on the page. */
    heading: string;
    blurb: string;
    deskLabel: string;
    deskName: string;
    deskPhone: string;
    /** The chips above the message box; the first is selected by default. */
    interests: string[];
    submitLabel: string;
    successHeading: string;
    /** Supports the {email} and {desk} tokens. */
    successBody: string;
  };
  offices: {
    eyebrow: string;
    heading: string;
    addressLabel: string;
    /** One line of the postal address per entry. */
    address: string[];
    contactLabel: string;
    channels: ContactChannel[];
    emailLabel: string;
    email: string;
  };
  newsletter: { enabled: boolean };
};

export const EMPTY_CONTACT: ContactCopy = {
  hero: { eyebrow: '', title: '', image: '' },
  inquiry: {
    eyebrow: '', heading: '', blurb: '', deskLabel: '', deskName: '', deskPhone: '',
    interests: [], submitLabel: '', successHeading: '', successBody: '',
  },
  offices: {
    eyebrow: '', heading: '', addressLabel: '', address: [],
    contactLabel: '', channels: [], emailLabel: '', email: '',
  },
  newsletter: { enabled: true },
};

/** One numbered row in the "what the practice delivers" ledger. */
export type ServicePillar = { title: string; body: string };

/** One figure in the proof strip under the hero. */
export type ServiceProof = { value: string; label: string };

export type ServiceLine = {
  id: string;
  slug: string;
  eyebrow: string;
  title: string;
  dek: string;
  introHeading: string;
  /** Card image on /services and in the CMS list. */
  img: string;
  /** Hero backdrop — more than one turns the header into a slideshow. */
  heroImages: string[];
  pillars: ServicePillar[];
  proof: ServiceProof[];
  live: boolean;
  position: number;
};

/** The /services landing page itself. */
export type ServicePage = {
  eyebrow: string;
  title: string;
  dek: string;
  heroImage: string;
  cardCta: string;
};

/* ── Newsletter issues ─────────────────────────────────────── */

export type NewsletterCadence = 'daily' | 'weekly' | 'monthly';

/** One story block in an issue. `aside` fills the right column of the
    two-column rows used by the weekly template; images stack under the
    body exactly like the pasted chart strips in the legacy mailer. */
export type NewsletterSection = {
  badge: string;
  title: string;
  body: string;
  aside: string;
  images: string[];
};

export type NewsletterIssue = {
  id: string;
  cadence: NewsletterCadence;
  date: string;        // ISO (yyyy-mm-dd)
  subject: string;
  intro: string;
  sections: NewsletterSection[];
  updated: string;     // ISO
};

export const NEWSLETTER_CADENCES: Array<{ value: NewsletterCadence; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/** Section badges the desk already uses; the field stays free text. */
export const NEWSLETTER_BADGES = [
  'MARKET', 'MACRO', 'BANKS/DIGITAL FINANCE', 'CONSUMER', 'MINING', 'PROPERTY',
  'POWER & UTILITIES', 'TELCOS', 'TRANSPORT', 'RESEARCH', 'CORPORATE NEWS', 'MACRO NEWS',
];

/** House naming for each mailer, derived from the issue date. */
export function defaultNewsletterSubject(cadence: NewsletterCadence, iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const monShort = d.toLocaleDateString('en-PH', { month: 'short' }).toUpperCase();
  const monLong = d.toLocaleDateString('en-PH', { month: 'long' });
  const year = d.getFullYear();
  if (cadence === 'daily') return `REGIS REPORT (${day} ${monShort})`;
  if (cadence === 'weekly') return `REGIS Week in Review ${monLong} ${day} ${year}`;
  return `REGIS: Month in Review - ${monLong.toUpperCase()} ${year}`;
}

export type Subscriber = {
  id: string;
  email: string;
  firm: string;
  joined: string;      // ISO
  source: 'Insights page' | 'Footer' | 'Conference' | 'Referral';
  verified: boolean;
};

export type PageBlock = {
  id: string;
  /** The legal document this block belongs to, used as its heading. */
  page: string;
  field: string;
  position: number;
  value: string;
  updated: string;     // ISO
  editor: string;
};

export type MediaAsset = {
  id: string;
  path: string;
  label: string;
  kind: 'photo' | 'graphic' | 'portrait';
  usedBy: string;
};

export type ReportCategory =
  | 'Banks' | 'Conglomerates' | 'Consumer' | 'Hotels / Leisure / Gaming'
  | 'Industrials' | 'Infrastructure' | 'Macro / Strategy' | 'Mining'
  | 'Oil and Gas' | 'Power' | 'Property' | 'Retail'
  | 'Telecommunications' | 'Transportation' | 'Utilities';

/** Local vs Foreign company classification, used as a portal filter. */
export type ReportCompany = 'Local' | 'Foreign';

/** A covered company in the registry. Reports link to one, and the portal
    groups the registry into local / foreign filter lists. */
export type Company = {
  id: string;
  name: string;
  type: ReportCompany;
};

export type Report = {
  id: string;
  title: string;
  /** Sector filing; null = general / cross-sector research. */
  category: ReportCategory | null;
  /** Linked registry company; null for macro / multi-name reports. */
  companyId: string | null;
  companyName: string | null;
  /** Classification derived from the linked company; null when unlinked. */
  company: ReportCompany | null;
  analyst: string;
  date: string;        // ISO (yyyy-mm-dd)
  pages: number;       // 0 when unknown
  summary: string;
  /** The one report showcased on the portal dashboard's Spotlight card. */
  spotlight: boolean;
  fileName: string;
  fileSize: number;    // bytes
  /** Public URL for catalog PDFs; null when the PDF is stored behind the API. */
  fileUrl: string | null;
};

/* ── Trending Content ──────────────────────────────────────── */

/** What counts as a "read" when the portal ranks Trending Content. */
export type TrendingMetric = 'views' | 'downloads' | 'engagement';

/** One rung of the portal's most-read ladder. */
export type TrendingEntry = {
  reportId: string;
  count: number;
};

/** The ranking + the rules it was computed under, as /portal/reports sends it. */
export type TrendingBlock = {
  metric: TrendingMetric;
  /** 0 = all time. */
  windowMonths: number;
  entries: TrendingEntry[];
};

/** How the portal ranks Trending Content — edited in the CMS Reports module. */
export type TrendingRules = {
  enabled: boolean;
  metric: TrendingMetric;
  /** 0 = all time. */
  windowMonths: number;
  /** How many rungs the ladder shows (1–6). */
  limit: number;
  /** A report needs at least this many events to qualify. */
  minEvents: number;
};

export const EMPTY_TRENDING_RULES: TrendingRules = {
  enabled: true, metric: 'views', windowMonths: 3, limit: 3, minEvents: 1,
};

export const TRENDING_METRICS: Array<{ value: TrendingMetric; label: string; heading: string; unit: [string, string] }> = [
  { value: 'views', label: 'Viewer opens', heading: 'Most viewed', unit: ['view', 'views'] },
  { value: 'downloads', label: 'Downloads', heading: 'Most downloaded', unit: ['download', 'downloads'] },
  { value: 'engagement', label: 'Opens + downloads', heading: 'Most read', unit: ['read', 'reads'] },
];

export const TRENDING_WINDOWS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Trailing month' },
  { value: 3, label: 'Trailing 3 months' },
  { value: 6, label: 'Trailing 6 months' },
  { value: 12, label: 'Trailing 12 months' },
  { value: 0, label: 'All time' },
];

export const trendingMetricDef = (m: TrendingMetric) =>
  TRENDING_METRICS.find((x) => x.value === m) ?? TRENDING_METRICS[0];

/** "last 3 months" / "last month" / "all time", for portal-facing copy. */
export function trendingWindowLabel(months: number): string {
  if (months === 0) return 'all time';
  return months === 1 ? 'last month' : `last ${months} months`;
}

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;          // ISO
};

/* ── Client activity ledger ────────────────────────────────── */

export type ClientActivityEvent = 'view' | 'download' | 'click';

/** One consumption event on the client portal, sealed into the
    tamper-evident hash chain the Client Logs module verifies. */
export type ClientActivity = {
  id: string;
  userId: string | null;
  actor: string;
  email: string;
  firm: string | null;
  event: ClientActivityEvent;
  reportId: string | null;
  target: string;
  context: string;
  ip: string | null;
  at: string;          // ISO
  /** HMAC seal over this entry plus the previous entry's hash. */
  hash: string;
};

export const CLIENT_EVENTS: Record<ClientActivityEvent, { label: string; tone: 'live' | 'amber' | 'muted' }> = {
  view: { label: 'View', tone: 'live' },
  download: { label: 'Download', tone: 'amber' },
  click: { label: 'Click', tone: 'muted' },
};

/* ── Users & access ────────────────────────────────────────── */

export type AccountKind = 'staff' | 'client';

/** Where a portal client sits in onboarding. Staff are always approved. */
export type ClientStatus = 'invited' | 'pending' | 'approved' | 'declined';

export type Account = {
  id: string;
  name: string;
  email: string;
  /** Regis-issued user id. Portal clients sign in with this or their email. */
  username: string | null;
  kind: AccountKind;
  status: ClientStatus;
  /** Role name for staff accounts; null for portal clients. */
  role: string | null;
  roleId: string | null;
  /** Institutional firm for portal clients; null for staff. */
  firm: string | null;
  position: string | null;
  phone: string | null;
  lastActive: string | null;  // ISO
  registeredAt: string | null;
  approvedAt: string | null;
  suspended: boolean;
  createdAt: string;          // ISO
};

export const CLIENT_STATUS: Record<ClientStatus, { label: string; tone: 'live' | 'amber' | 'muted' | 'warn' }> = {
  invited: { label: 'Invited', tone: 'muted' },
  pending: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'live' },
  declined: { label: 'Declined', tone: 'warn' },
};

export type RoleDef = {
  id: string;
  name: string;
  description: string;
  /** Permission keys granted to this role. */
  permissions: string[];
  /** Number of staff accounts currently on this role. */
  users: number;
  /** System roles (Administrator) cannot be deleted or stripped of access control. */
  system: boolean;
};

export type PermissionDef = {
  key: string;
  label: string;
  group: string;
};

/* ── UI constants (mirror API enums) ───────────────────────── */

export const ARTICLE_TAGS = ['Macro', 'Banks', 'Consumer', 'Property', 'Power', 'Single name', 'Policy', 'Strategy'];

export const REPORT_CATEGORIES: ReportCategory[] = [
  'Banks', 'Conglomerates', 'Consumer', 'Hotels / Leisure / Gaming', 'Industrials',
  'Infrastructure', 'Macro / Strategy', 'Mining', 'Oil and Gas', 'Power',
  'Property', 'Retail', 'Telecommunications', 'Transportation', 'Utilities',
];

export const REPORT_COMPANIES: Array<{ value: ReportCompany; label: string }> = [
  { value: 'Local', label: 'Local Companies' },
  { value: 'Foreign', label: 'Foreign Companies' },
];

export const TEAMS = ['Board of Directors', 'Research', 'Sales & Trading', 'Operations'] as const;

/* ── Helpers ───────────────────────────────────────────────── */

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

export function fmtBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
