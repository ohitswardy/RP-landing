import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import {
  EMPTY_ABOUT, EMPTY_CONTACT, EMPTY_HOME, EMPTY_INSIGHTS, EMPTY_TRENDING_RULES,
  type AboutCopy, type ContactCopy, type HomeCopy, type Article, type ArticleStatus, type InsightsPage, type StaffMember, type ServiceLine,
  type ServicePage, type ServicePillar, type ServiceProof,
  type Subscriber, type PageBlock, type AuditEntry, type Report, type MediaAsset, type ReportCategory, type ReportCompany, type Company,
  type ReportType, type ReportRating,
  type NewsletterCadence, type NewsletterIssue, type NewsletterRailBlock, type NewsletterSection, type TrendingRules,
} from './data';

/* ─────────────────────────────────────────────────────────────
   API-backed CMS store. State is hydrated from /api/cms/bootstrap
   and every mutation goes through the Laravel backend, which owns
   the audit trail. Local state mirrors the server response.
   ───────────────────────────────────────────────────────────── */

type CmsState = {
  articles: Article[];
  reports: Report[];
  companies: Company[];
  /** The editable registry of report types (Results, Rating Change, …). */
  reportTypes: ReportType[];
  /** How the portal dashboard ranks Trending Content. */
  trendingRules: TrendingRules;
  people: StaffMember[];
  services: ServiceLine[];
  servicePage: ServicePage;
  aboutPage: AboutCopy;
  contactPage: ContactCopy;
  homePage: HomeCopy;
  insightsPage: InsightsPage;
  newsletters: NewsletterIssue[];
  subscribers: Subscriber[];
  pages: PageBlock[];
  media: MediaAsset[];
  audit: AuditEntry[];
};

export type CmsStatus = 'loading' | 'ready' | 'error';

type ItemResponse<T> = { item: T; audit?: AuditEntry };
type DeleteResponse = { audit?: AuditEntry };
type ListResponse<T> = { items: T[]; audit?: AuditEntry };

export type ArticlePayload = {
  tag: string; title: string; author: string; excerpt: string; status: ArticleStatus;
  /** ISO yyyy-mm-dd. Omitted on create means today. */
  date?: string;
  featured?: boolean;
};
export type ReportPayload = {
  title: string;
  category: ReportCategory | null;
  reportTypeId: string | null;
  companyId: string | null;
  analyst: string;
  rating: ReportRating | null;
  /** Publication date, ISO yyyy-mm-dd. */
  date: string;
  pages: number;
  summary: string;
};
export type CompanyPayload = { name: string; symbol: string | null; type: ReportCompany };
export type PersonPayload = {
  name: string;
  team: StaffMember['team'];
  roles: string[];
  bio: string[];
  sectors: string[];
  phone: string;
  email: string;
  img: string;
  /** Publish straight away. Omitted on create means the profile starts hidden. */
  visible?: boolean;
};

export type NewsletterPayload = {
  cadence: NewsletterCadence;
  /** ISO yyyy-mm-dd. */
  date: string;
  subject: string;
  intro: string;
  sections: NewsletterSection[];
  /** The monthly right-hand rail; empty on the daily and weekly. */
  rail: NewsletterRailBlock[];
};

/** Which module's upload route a picker posts to — permissions differ per module. */
export type UploadScope = 'services' | 'people' | 'insights' | 'newsletters' | 'contact' | 'home';
export type ServicePayload = Partial<{
  eyebrow: string; title: string; dek: string; introHeading: string;
  img: string; heroImages: string[]; pillars: ServicePillar[]; proof: ServiceProof[]; live: boolean;
}>;

type CmsStore = CmsState & {
  status: CmsStatus;
  error: string | null;
  reload: () => void;
  /** Prepend a server-issued audit entry (used by modules with their own endpoints). */
  appendAudit: (entry: AuditEntry | undefined) => void;

  createArticle: (p: ArticlePayload) => Promise<void>;
  updateArticle: (id: string, p: Partial<ArticlePayload>) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>;
  /** Replace the /insights page composition; resolves to the saved document. */
  updateInsightsPage: (p: InsightsPage) => Promise<InsightsPage>;

  createReport: (p: ReportPayload, file: File) => Promise<void>;
  updateReport: (id: string, p: ReportPayload, file: File | null) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  /** Flag one report as the portal dashboard's Spotlight (the API keeps a single slot). */
  setReportSpotlight: (id: string, on: boolean) => Promise<void>;
  /** Replace the Trending Content ranking rules; resolves to the saved set. */
  updateTrendingRules: (p: TrendingRules) => Promise<TrendingRules>;

  createCompany: (p: CompanyPayload) => Promise<Company>;
  updateCompany: (id: string, p: CompanyPayload) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;

  createReportType: (name: string) => Promise<ReportType>;
  renameReportType: (id: string, name: string) => Promise<void>;
  deleteReportType: (id: string) => Promise<void>;

  createPerson: (p: PersonPayload) => Promise<StaffMember>;
  updatePerson: (id: string, p: Partial<PersonPayload & { visible: boolean }>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  reorderPeople: (ids: string[]) => Promise<void>;
  /** Replace the About page copy; resolves to the saved document. */
  updateAboutPage: (p: AboutCopy) => Promise<AboutCopy>;

  updateService: (id: string, p: ServicePayload) => Promise<void>;
  reorderServices: (ids: string[]) => Promise<void>;
  updateServicePage: (p: Partial<ServicePage>) => Promise<void>;
  /** Upload a photo, file it in the media library, and return the new asset. */
  uploadImage: (file: File, meta: { label?: string; usedBy?: string; scope: UploadScope; kind?: MediaAsset['kind'] }) => Promise<MediaAsset>;

  createNewsletter: (p: NewsletterPayload) => Promise<void>;
  updateNewsletter: (id: string, p: Partial<NewsletterPayload>) => Promise<void>;
  deleteNewsletter: (id: string) => Promise<void>;

  removeSubscriber: (id: string) => Promise<void>;

  updatePage: (id: string, value: string) => Promise<void>;
  /** Replace the Contact page copy; resolves to the saved document. */
  updateContactPage: (p: ContactCopy) => Promise<ContactCopy>;
  /** Replace the landing page document; resolves to the saved document. */
  updateHomePage: (p: HomeCopy) => Promise<HomeCopy>;
};

const EMPTY_SERVICE_PAGE: ServicePage = {
  eyebrow: '', title: '', dek: '', heroImage: '', cardCta: '',
};

const EMPTY: CmsState = {
  articles: [], reports: [], companies: [], reportTypes: [], trendingRules: EMPTY_TRENDING_RULES,
  people: [], services: [], servicePage: EMPTY_SERVICE_PAGE,
  aboutPage: EMPTY_ABOUT, contactPage: EMPTY_CONTACT, homePage: EMPTY_HOME, insightsPage: EMPTY_INSIGHTS,
  newsletters: [], subscribers: [], pages: [], media: [], audit: [],
};

const CmsContext = createContext<CmsStore | null>(null);

export function CmsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CmsState>(EMPTY);
  const [status, setStatus] = useState<CmsStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const data = await apiFetch<CmsState>('/cms/bootstrap', { audience: 'cms' });
      if (!alive.current) return;
      setState(data);
      setStatus('ready');
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load the workspace.');
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Merge a mutation response into local state for one collection. */
  const apply = useCallback(<K extends keyof CmsState>(
    key: K,
    updater: (prev: CmsState[K]) => CmsState[K],
    audit?: AuditEntry,
  ) => {
    setState((s) => ({
      ...s,
      [key]: updater(s[key]),
      audit: audit ? [audit, ...s.audit].slice(0, 60) : s.audit,
    }));
  }, []);

  const appendAudit = useCallback((entry: AuditEntry | undefined) => {
    if (!entry) return;
    setState((s) => ({ ...s, audit: [entry, ...s.audit].slice(0, 60) }));
  }, []);

  const upsert = <T extends { id: string }>(list: T[], item: T, prepend = false): T[] => {
    const exists = list.some((x) => x.id === item.id);
    if (!exists) return prepend ? [item, ...list] : [...list, item];
    return list.map((x) => (x.id === item.id ? item : x));
  };

  /* ── Articles ─────────────────────────────────────────────── */

  /** The API keeps a single lead note; mirror that demotion locally. */
  const demoteOthers = (list: Article[], lead: Article): Article[] =>
    lead.featured ? list.map((a) => (a.id === lead.id ? a : { ...a, featured: false })) : list;

  const createArticle = useCallback(async (p: ArticlePayload) => {
    const res = await apiFetch<ItemResponse<Article>>('/cms/articles', { method: 'POST', body: p, audience: 'cms' });
    apply('articles', (prev) => upsert(demoteOthers(prev, res.item), res.item, true), res.audit);
  }, [apply]);

  const updateArticle = useCallback(async (id: string, p: Partial<ArticlePayload>) => {
    const res = await apiFetch<ItemResponse<Article>>(`/cms/articles/${id}`, { method: 'PUT', body: p, audience: 'cms' });
    apply('articles', (prev) => upsert(demoteOthers(prev, res.item), res.item), res.audit);
  }, [apply]);

  const deleteArticle = useCallback(async (id: string) => {
    const res = await apiFetch<DeleteResponse>(`/cms/articles/${id}`, { method: 'DELETE', audience: 'cms' });
    apply('articles', (prev) => prev.filter((x) => x.id !== id), res.audit);
  }, [apply]);

  const updateInsightsPage = useCallback(async (p: InsightsPage) => {
    const res = await apiFetch<ItemResponse<InsightsPage>>('/cms/insights/page', {
      method: 'PUT', body: p, audience: 'cms',
    });
    apply('insightsPage', () => res.item, res.audit);
    return res.item;
  }, [apply]);

  /* ── Reports ──────────────────────────────────────────────── */

  const reportForm = (p: ReportPayload, file: File | null): FormData => {
    const fd = new FormData();
    fd.append('title', p.title);
    // Empty strings reach Laravel as null (ConvertEmptyStringsToNull).
    fd.append('category', p.category ?? '');
    fd.append('report_type_id', p.reportTypeId ?? '');
    fd.append('company_id', p.companyId ?? '');
    fd.append('analyst', p.analyst);
    fd.append('rating', p.rating ?? '');
    fd.append('date', p.date);
    fd.append('pages', String(p.pages));
    fd.append('summary', p.summary);
    if (file) fd.append('file', file);
    return fd;
  };

  const createReport = useCallback(async (p: ReportPayload, file: File) => {
    const res = await apiFetch<ItemResponse<Report>>('/cms/reports', {
      method: 'POST', formData: reportForm(p, file), audience: 'cms',
    });
    apply('reports', (prev) => upsert(prev, res.item, true), res.audit);
  }, [apply]);

  const updateReport = useCallback(async (id: string, p: ReportPayload, file: File | null) => {
    const fd = reportForm(p, file);
    fd.append('_method', 'PUT'); // multipart PUT is spoofed through POST
    const res = await apiFetch<ItemResponse<Report>>(`/cms/reports/${id}`, {
      method: 'POST', formData: fd, audience: 'cms',
    });
    apply('reports', (prev) => upsert(prev, res.item), res.audit);
  }, [apply]);

  /* ── Companies ────────────────────────────────────────────── */

  const sortCompanies = (list: Company[]): Company[] =>
    list.slice().sort((a, b) => a.name.localeCompare(b.name));

  const createCompany = useCallback(async (p: CompanyPayload) => {
    const res = await apiFetch<ItemResponse<Company>>('/cms/companies', {
      method: 'POST', body: p, audience: 'cms',
    });
    apply('companies', (prev) => sortCompanies(upsert(prev, res.item)), res.audit);
    return res.item;
  }, [apply]);

  const updateCompany = useCallback(async (id: string, p: CompanyPayload) => {
    const res = await apiFetch<ItemResponse<Company>>(`/cms/companies/${id}`, {
      method: 'PUT', body: p, audience: 'cms',
    });
    // Reports carry a denormalized name/ticker/type — keep them in step locally.
    setState((s) => ({
      ...s,
      companies: sortCompanies(upsert(s.companies, res.item)),
      reports: s.reports.map((r) => r.companyId === id
        ? { ...r, companyName: res.item.name, companySymbol: res.item.symbol, company: res.item.type }
        : r),
      audit: res.audit ? [res.audit, ...s.audit].slice(0, 60) : s.audit,
    }));
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    const res = await apiFetch<DeleteResponse>(`/cms/companies/${id}`, {
      method: 'DELETE', audience: 'cms',
    });
    // The API keeps the reports and unlinks them (FK nulls on delete).
    setState((s) => ({
      ...s,
      companies: s.companies.filter((c) => c.id !== id),
      reports: s.reports.map((r) => r.companyId === id
        ? { ...r, companyId: null, companyName: null, companySymbol: null, company: null }
        : r),
      audit: res.audit ? [res.audit, ...s.audit].slice(0, 60) : s.audit,
    }));
  }, []);

  /* ── Report types ─────────────────────────────────────────── */

  const sortTypes = (list: ReportType[]): ReportType[] =>
    list.slice().sort((a, b) => a.name.localeCompare(b.name));

  const createReportType = useCallback(async (name: string) => {
    const res = await apiFetch<ItemResponse<ReportType>>('/cms/report-types', {
      method: 'POST', body: { name }, audience: 'cms',
    });
    apply('reportTypes', (prev) => sortTypes(upsert(prev, res.item)), res.audit);
    return res.item;
  }, [apply]);

  const renameReportType = useCallback(async (id: string, name: string) => {
    const res = await apiFetch<ItemResponse<ReportType>>(`/cms/report-types/${id}`, {
      method: 'PUT', body: { name }, audience: 'cms',
    });
    // Reports carry the type name denormalized — keep them in step locally.
    setState((s) => ({
      ...s,
      reportTypes: sortTypes(upsert(s.reportTypes, res.item)),
      reports: s.reports.map((r) => (r.reportTypeId === id ? { ...r, reportType: res.item.name } : r)),
      audit: res.audit ? [res.audit, ...s.audit].slice(0, 60) : s.audit,
    }));
  }, []);

  const deleteReportType = useCallback(async (id: string) => {
    const res = await apiFetch<DeleteResponse>(`/cms/report-types/${id}`, {
      method: 'DELETE', audience: 'cms',
    });
    // The API keeps the reports and unclassifies them (FK nulls on delete).
    setState((s) => ({
      ...s,
      reportTypes: s.reportTypes.filter((t) => t.id !== id),
      reports: s.reports.map((r) => (r.reportTypeId === id ? { ...r, reportTypeId: null, reportType: null } : r)),
      audit: res.audit ? [res.audit, ...s.audit].slice(0, 60) : s.audit,
    }));
  }, []);

  const deleteReport = useCallback(async (id: string) => {
    const res = await apiFetch<DeleteResponse>(`/cms/reports/${id}`, { method: 'DELETE', audience: 'cms' });
    apply('reports', (prev) => prev.filter((x) => x.id !== id), res.audit);
  }, [apply]);

  const setReportSpotlight = useCallback(async (id: string, on: boolean) => {
    const res = await apiFetch<ItemResponse<Report>>(`/cms/reports/${id}/spotlight`, {
      method: 'PUT', body: { spotlight: on }, audience: 'cms',
    });
    // The API keeps a single spotlight slot; mirror the demotion locally.
    apply('reports', (prev) => prev.map((r) => (r.id === id ? res.item : { ...r, spotlight: false })), res.audit);
  }, [apply]);

  const updateTrendingRules = useCallback(async (p: TrendingRules) => {
    const res = await apiFetch<ItemResponse<TrendingRules>>('/cms/trending', {
      method: 'PUT', body: p, audience: 'cms',
    });
    apply('trendingRules', () => res.item, res.audit);
    return res.item;
  }, [apply]);

  /* ── People ───────────────────────────────────────────────── */

  const createPerson = useCallback(async (p: PersonPayload) => {
    const res = await apiFetch<ItemResponse<StaffMember>>('/cms/people', { method: 'POST', body: p, audience: 'cms' });
    apply('people', (prev) => upsert(prev, res.item), res.audit);
    return res.item;
  }, [apply]);

  const deletePerson = useCallback(async (id: string) => {
    const res = await apiFetch<DeleteResponse>(`/cms/people/${id}`, { method: 'DELETE', audience: 'cms' });
    apply('people', (prev) => prev.filter((x) => x.id !== id), res.audit);
  }, [apply]);

  const updatePerson = useCallback(async (id: string, p: Partial<PersonPayload & { visible: boolean }>) => {
    const res = await apiFetch<ItemResponse<StaffMember>>(`/cms/people/${id}`, { method: 'PUT', body: p, audience: 'cms' });
    apply('people', (prev) => upsert(prev, res.item), res.audit);
  }, [apply]);

  const reorderPeople = useCallback(async (ids: string[]) => {
    // Optimistic — order is cosmetic and the server echoes the final list.
    setState((s) => {
      const byId = new Map(s.people.map((p) => [p.id, p]));
      const next = ids.map((id) => byId.get(id)).filter((p): p is StaffMember => Boolean(p));
      return { ...s, people: next };
    });
    const res = await apiFetch<ListResponse<StaffMember>>('/cms/people/reorder', {
      method: 'PUT', body: { ids }, audience: 'cms',
    });
    setState((s) => ({ ...s, people: res.items }));
  }, []);

  const updateAboutPage = useCallback(async (p: AboutCopy) => {
    const res = await apiFetch<ItemResponse<AboutCopy>>('/cms/about-page', {
      method: 'PUT', body: p, audience: 'cms',
    });
    apply('aboutPage', () => res.item, res.audit);
    return res.item;
  }, [apply]);

  /* ── Services ─────────────────────────────────────────────── */

  const updateService = useCallback(async (id: string, p: ServicePayload) => {
    const res = await apiFetch<ItemResponse<ServiceLine>>(`/cms/services/${id}`, { method: 'PUT', body: p, audience: 'cms' });
    apply('services', (prev) => upsert(prev, res.item), res.audit);
  }, [apply]);

  const reorderServices = useCallback(async (ids: string[]) => {
    // Optimistic — card order is cosmetic and the server echoes the final list.
    setState((s) => {
      const byId = new Map(s.services.map((x) => [x.id, x]));
      const next = ids.map((id) => byId.get(id)).filter((x): x is ServiceLine => Boolean(x));
      return { ...s, services: next };
    });
    const res = await apiFetch<ListResponse<ServiceLine>>('/cms/services/reorder', {
      method: 'PUT', body: { ids }, audience: 'cms',
    });
    apply('services', () => res.items, res.audit);
  }, [apply]);

  const updateServicePage = useCallback(async (p: Partial<ServicePage>) => {
    const res = await apiFetch<ItemResponse<ServicePage>>('/cms/services/page', {
      method: 'PUT', body: p, audience: 'cms',
    });
    apply('servicePage', () => res.item, res.audit);
  }, [apply]);

  const uploadImage = useCallback(async (file: File, meta: { label?: string; usedBy?: string; scope: UploadScope; kind?: MediaAsset['kind'] }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (meta.label) fd.append('label', meta.label);
    if (meta.usedBy) fd.append('usedBy', meta.usedBy);
    if (meta.kind) fd.append('kind', meta.kind);
    const res = await apiFetch<ItemResponse<MediaAsset>>(`/cms/${meta.scope}/upload`, {
      method: 'POST', formData: fd, audience: 'cms',
    });
    apply('media', (prev) => upsert(prev, res.item, true), res.audit);
    return res.item;
  }, [apply]);

  /* ── Newsletter issues ────────────────────────────────────── */

  /** Issues sort newest first regardless of where the server put them. */
  const byIssueDate = (list: NewsletterIssue[]): NewsletterIssue[] =>
    list.slice().sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));

  const createNewsletter = useCallback(async (p: NewsletterPayload) => {
    const res = await apiFetch<ItemResponse<NewsletterIssue>>('/cms/newsletters', { method: 'POST', body: p, audience: 'cms' });
    apply('newsletters', (prev) => byIssueDate(upsert(prev, res.item, true)), res.audit);
  }, [apply]);

  const updateNewsletter = useCallback(async (id: string, p: Partial<NewsletterPayload>) => {
    const res = await apiFetch<ItemResponse<NewsletterIssue>>(`/cms/newsletters/${id}`, { method: 'PUT', body: p, audience: 'cms' });
    apply('newsletters', (prev) => byIssueDate(upsert(prev, res.item)), res.audit);
  }, [apply]);

  const deleteNewsletter = useCallback(async (id: string) => {
    const res = await apiFetch<DeleteResponse>(`/cms/newsletters/${id}`, { method: 'DELETE', audience: 'cms' });
    apply('newsletters', (prev) => prev.filter((x) => x.id !== id), res.audit);
  }, [apply]);

  /* ── Subscribers ──────────────────────────────────────────── */

  const removeSubscriber = useCallback(async (id: string) => {
    const res = await apiFetch<DeleteResponse>(`/cms/subscribers/${id}`, { method: 'DELETE', audience: 'cms' });
    apply('subscribers', (prev) => prev.filter((x) => x.id !== id), res.audit);
  }, [apply]);

  /* ── Legal copy ───────────────────────────────────────────── */

  const updatePage = useCallback(async (id: string, valueText: string) => {
    const res = await apiFetch<ItemResponse<PageBlock>>(`/cms/pages/${id}`, {
      method: 'PUT', body: { value: valueText }, audience: 'cms',
    });
    apply('pages', (prev) => upsert(prev, res.item), res.audit);
  }, [apply]);

  const updateContactPage = useCallback(async (p: ContactCopy) => {
    const res = await apiFetch<ItemResponse<ContactCopy>>('/cms/contact-page', {
      method: 'PUT', body: p, audience: 'cms',
    });
    apply('contactPage', () => res.item, res.audit);
    return res.item;
  }, [apply]);

  /* ── Landing page ─────────────────────────────────────────── */

  const updateHomePage = useCallback(async (p: HomeCopy) => {
    const res = await apiFetch<ItemResponse<HomeCopy>>('/cms/home-page', {
      method: 'PUT', body: p, audience: 'cms',
    });
    apply('homePage', () => res.item, res.audit);
    return res.item;
  }, [apply]);

  const value = useMemo<CmsStore>(() => ({
    ...state,
    status,
    error,
    reload: () => { void load(); },
    appendAudit,
    createArticle, updateArticle, deleteArticle, updateInsightsPage,
    createReport, updateReport, deleteReport, setReportSpotlight, updateTrendingRules,
    createCompany, updateCompany, deleteCompany,
    createReportType, renameReportType, deleteReportType,
    createPerson, updatePerson, deletePerson, reorderPeople, updateAboutPage,
    updateService, reorderServices, updateServicePage, uploadImage,
    createNewsletter, updateNewsletter, deleteNewsletter,
    removeSubscriber,
    updatePage, updateContactPage, updateHomePage,
  }), [
    state, status, error, load, appendAudit,
    createArticle, updateArticle, deleteArticle, updateInsightsPage,
    createReport, updateReport, deleteReport, setReportSpotlight, updateTrendingRules,
    createCompany, updateCompany, deleteCompany,
    createReportType, renameReportType, deleteReportType,
    createPerson, updatePerson, deletePerson, reorderPeople, updateAboutPage,
    updateService, reorderServices, updateServicePage, uploadImage,
    createNewsletter, updateNewsletter, deleteNewsletter,
    removeSubscriber,
    updatePage, updateContactPage, updateHomePage,
  ]);

  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
}

export function useCms(): CmsStore {
  const ctx = useContext(CmsContext);
  if (!ctx) throw new Error('useCms must be used inside <CmsProvider>');
  return ctx;
}
