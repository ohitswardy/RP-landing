import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCms } from '../store';
import { ModuleHeader, SkeletonRows, EASE } from '../ui';
import { IconExternal } from '../icons';
import { HOME_SECTIONS, headlineLines, type HomeCopy, type HomeSectionKey } from '../data';
import ImagePicker from '../kit/ImagePicker';
import SaveBar from '../kit/SaveBar';
import PageMap from './home/PageMap';
import HomePreview from './home/HomePreview';
import { ROUTES_LIST_ID, SITE_ROUTES, type PickRequest } from './home/fields';
import {
  CareersEditor, CommunityEditor, CultureEditor, HeroEditor, InsightsEditor,
  LIMITS, NumbersEditor, QuoteEditor, ServicesEditor,
} from './home/sections';

/* ─────────────────────────────────────────────────────────────
   Landing page. The whole home page is one document, eight
   sections of copy and photography in page order, edited here
   and published with one save. The page map on the left is the
   page as a list; the miniature on the right is the page as it
   will look. Both follow the section being edited.
   ───────────────────────────────────────────────────────────── */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = (c: HomeCopy): HomeCopy => JSON.parse(JSON.stringify(c)) as HomeCopy;

const SELECTED_KEY = 'regis-cms-home-section';

const isSection = (v: string | null): v is HomeSectionKey => HOME_SECTIONS.some((s) => s.key === v);

function readSelected(): HomeSectionKey {
  try {
    const v = sessionStorage.getItem(SELECTED_KEY);
    return isSection(v) ? v : 'hero';
  } catch {
    return 'hero';
  }
}

/* ── Tidy and validate ─────────────────────────────────────── */

const trim = (v: string) => v.trim();
const link = (l: HomeCopy['services']['cta']) => ({ label: trim(l.label), href: trim(l.href) });

/** Trim every string; drop list rows that are entirely empty. */
function tidy(c: HomeCopy): HomeCopy {
  return {
    hero: {
      enabled: c.hero.enabled, eyebrow: trim(c.hero.eyebrow),
      headline: headlineLines(c.hero.headline).join('\n'),
      dek: trim(c.hero.dek), image: trim(c.hero.image),
    },
    numbers: {
      enabled: c.numbers.enabled, eyebrow: trim(c.numbers.eyebrow), heading: trim(c.numbers.heading), intro: trim(c.numbers.intro),
      stats: c.numbers.stats
        .map((s) => ({ value: Math.max(0, Math.round(Number(s.value) || 0)), suffix: trim(s.suffix), label: trim(s.label) }))
        .filter((s) => s.label || s.value > 0),
    },
    services: {
      enabled: c.services.enabled, eyebrow: trim(c.services.eyebrow), heading: trim(c.services.heading), cta: link(c.services.cta),
      rows: c.services.rows
        .map((r) => ({ title: trim(r.title), blurb: trim(r.blurb), href: trim(r.href), image: trim(r.image) }))
        .filter((r) => r.title || r.blurb || r.image),
    },
    insights: {
      enabled: c.insights.enabled, eyebrow: trim(c.insights.eyebrow), heading: trim(c.insights.heading), intro: trim(c.insights.intro), cta: link(c.insights.cta),
      featured: c.insights.featured
        .map((f) => ({ kicker: trim(f.kicker), title: trim(f.title), blurb: trim(f.blurb), meta: trim(f.meta), href: trim(f.href), image: trim(f.image) }))
        .filter((f) => f.title || f.blurb || f.image || f.kicker),
      rows: c.insights.rows
        .map((r) => ({ kicker: trim(r.kicker), title: trim(r.title), meta: trim(r.meta), href: trim(r.href) }))
        .filter((r) => r.title || r.kicker || r.meta),
    },
    culture: {
      enabled: c.culture.enabled, eyebrow: trim(c.culture.eyebrow), heading: trim(c.culture.heading), cta: link(c.culture.cta),
      image: trim(c.culture.image), imageAlt: trim(c.culture.imageAlt),
    },
    community: {
      enabled: c.community.enabled, eyebrow: trim(c.community.eyebrow), heading: trim(c.community.heading), body: trim(c.community.body),
      cta: link(c.community.cta), image: trim(c.community.image), imageAlt: trim(c.community.imageAlt),
    },
    quote: {
      enabled: c.quote.enabled, eyebrow: trim(c.quote.eyebrow), quote: trim(c.quote.quote), name: trim(c.quote.name), role: trim(c.quote.role),
      cta: link(c.quote.cta), image: trim(c.quote.image),
    },
    careers: {
      enabled: c.careers.enabled, eyebrow: trim(c.careers.eyebrow), heading: trim(c.careers.heading), body: trim(c.careers.body),
      cta: link(c.careers.cta), image: trim(c.careers.image), imageAlt: trim(c.careers.imageAlt),
    },
  };
}

type Problem = { section: HomeSectionKey; message: string };

const badPath = (href: string) => href !== '' && !href.startsWith('/');

/** Everything the API would reject, phrased the way an editor thinks about it, with the section to open. */
function validate(c: HomeCopy): Problem | null {
  const p = (section: HomeSectionKey, message: string): Problem => ({ section, message });
  const over = (section: HomeSectionKey, what: string, value: string, max: number) =>
    value.length > max ? p(section, `${what} is over ${max} characters.`) : null;
  const path = (section: HomeSectionKey, what: string, l: { label: string; href: string }) =>
    badPath(l.href) ? p(section, `${what} must be a site path that starts with “/”.`) : null;

  if (!c.hero.headline) return p('hero', 'The hero needs a headline.');
  const hero = over('hero', 'The headline', c.hero.headline, 200) ?? over('hero', 'The hero standfirst', c.hero.dek, 400) ?? over('hero', 'The hero eyebrow', c.hero.eyebrow, 80);
  if (hero) return hero;

  if (!c.numbers.heading) return p('numbers', 'The numbers rail needs a heading.');
  if (c.numbers.stats.length < LIMITS.stats.min) return p('numbers', 'The numbers rail needs at least one figure.');
  if (c.numbers.stats.some((s) => !s.label)) return p('numbers', 'Every figure needs a label.');
  const numbers = over('numbers', 'The numbers heading', c.numbers.heading, 120) ?? over('numbers', 'The numbers intro', c.numbers.intro, 600);
  if (numbers) return numbers;

  if (!c.services.heading) return p('services', 'The services index needs a heading.');
  if (c.services.rows.length < LIMITS.serviceRows.min) return p('services', 'The services index needs at least one row.');
  if (c.services.rows.some((r) => !r.title)) return p('services', 'Every services row needs a title.');
  const services = over('services', 'The services heading', c.services.heading, 160)
    ?? path('services', 'The services link', c.services.cta)
    ?? c.services.rows.map((r, i) => badPath(r.href) ? p('services', `Row ${i + 1} must link to a site path that starts with “/”.`) : null).find(Boolean) ?? null;
  if (services) return services;

  if (!c.insights.heading) return p('insights', 'The insights block needs a heading.');
  if (c.insights.featured.some((f) => !f.title)) return p('insights', 'Every featured note needs a title.');
  if (c.insights.rows.some((r) => !r.title)) return p('insights', 'Every further-reading row needs a title.');
  const insights = over('insights', 'The insights heading', c.insights.heading, 120)
    ?? over('insights', 'The insights intro', c.insights.intro, 600)
    ?? path('insights', 'The insights link', c.insights.cta)
    ?? c.insights.featured.map((f, i) => badPath(f.href) ? p('insights', `Featured note ${i + 1} must link to a site path that starts with “/”.`) : over('insights', `Featured note ${i + 1}'s summary`, f.blurb, 400)).find(Boolean)
    ?? c.insights.rows.map((r, i) => badPath(r.href) ? p('insights', `Further-reading row ${i + 1} must link to a site path that starts with “/”.`) : null).find(Boolean) ?? null;
  if (insights) return insights;

  if (!c.culture.heading) return p('culture', 'The Our story panel needs a heading.');
  const culture = over('culture', 'The Our story heading', c.culture.heading, 160) ?? path('culture', 'The Our story link', c.culture.cta);
  if (culture) return culture;

  if (!c.community.heading) return p('community', 'The community panel needs a heading.');
  const community = over('community', 'The community heading', c.community.heading, 160) ?? over('community', 'The community body', c.community.body, 500) ?? path('community', 'The community link', c.community.cta);
  if (community) return community;

  if (!c.quote.quote) return p('quote', 'The President’s word needs a quote.');
  const quote = over('quote', 'The quote', c.quote.quote, 500) ?? path('quote', 'The quote footer link', c.quote.cta);
  if (quote) return quote;

  if (!c.careers.heading) return p('careers', 'The careers banner needs a heading.');
  const careers = over('careers', 'The careers heading', c.careers.heading, 120) ?? over('careers', 'The careers body', c.careers.body, 500) ?? path('careers', 'The careers link', c.careers.cta);
  if (careers) return careers;

  return null;
}

/* ── Module ────────────────────────────────────────────────── */

export default function HomeModule() {
  const { homePage, status, updateHomePage } = useCms();
  const reduce = useReducedMotion();

  const [draft, setDraft] = useState<HomeCopy>(() => clone(homePage));
  const [selected, setSelected] = useState<HomeSectionKey>(readSelected);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [picking, setPicking] = useState<PickRequest | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const savedTimer = useRef<number | null>(null);

  const booting = status === 'loading';

  // Follow the store while the draft is untouched (bootstrap landing late,
  // or the saved document coming back). A dirty draft is never overwritten.
  // The previous baseline is captured before the updater is queued: the
  // updater runs on the next render, after the ref has already moved on.
  const baseline = useRef(homePage);
  useEffect(() => {
    const prev = baseline.current;
    baseline.current = homePage;
    setDraft((d) => (same(d, prev) ? clone(homePage) : d));
  }, [homePage]);

  const edited = useMemo(() => {
    const out = new Set<HomeSectionKey>();
    for (const s of HOME_SECTIONS) if (!same(draft[s.key], homePage[s.key])) out.add(s.key);
    return out;
  }, [draft, homePage]);
  const dirty = edited.size > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => () => { if (savedTimer.current) window.clearTimeout(savedTimer.current); }, []);

  useEffect(() => {
    try { sessionStorage.setItem(SELECTED_KEY, selected); } catch { /* ignore */ }
  }, [selected]);

  const select = useCallback((key: HomeSectionKey) => {
    setSelected(key);
  }, []);

  const setSection = useCallback(<K extends HomeSectionKey>(key: K, next: HomeCopy[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: next }));
  }, []);

  const toggle = useCallback((key: HomeSectionKey) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: { ...d[key], enabled: !d[key].enabled } }));
  }, []);

  async function save() {
    const trimmed = tidy(draft);
    const problem = validate(trimmed);
    if (problem) {
      setSelected(problem.section);
      setError(problem.message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await updateHomePage(trimmed);
      setDraft(clone(saved));
      setJustSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setJustSaved(false), 2600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const scope = HOME_SECTIONS.filter((s) => edited.has(s.key)).map((s) => s.label).join(' · ') || 'Landing page';

  const editor = (() => {
    const pick = (req: PickRequest) => setPicking(req);
    switch (selected) {
      case 'hero': return <HeroEditor value={draft.hero} onChange={(v) => setSection('hero', v)} pick={pick} />;
      case 'numbers': return <NumbersEditor value={draft.numbers} onChange={(v) => setSection('numbers', v)} pick={pick} />;
      case 'services': return <ServicesEditor value={draft.services} onChange={(v) => setSection('services', v)} pick={pick} />;
      case 'insights': return <InsightsEditor value={draft.insights} onChange={(v) => setSection('insights', v)} pick={pick} />;
      case 'culture': return <CultureEditor value={draft.culture} onChange={(v) => setSection('culture', v)} pick={pick} />;
      case 'community': return <CommunityEditor value={draft.community} onChange={(v) => setSection('community', v)} pick={pick} />;
      case 'quote': return <QuoteEditor value={draft.quote} onChange={(v) => setSection('quote', v)} pick={pick} />;
      case 'careers': return <CareersEditor value={draft.careers} onChange={(v) => setSection('careers', v)} pick={pick} />;
    }
  })();

  const index = HOME_SECTIONS.findIndex((s) => s.key === selected);

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="01 / Landing page"
        title="Landing page"
        blurb="Everything visitors read and see on the home page: the hero, the firm figures, the practice index, featured research, the two story panels, the President’s word, and the careers banner. One document, published with one save."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              aria-pressed={showPreview}
              className={`mono inline-flex items-center gap-2 border px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] transition-colors duration-300 ${
                showPreview ? 'border-navy bg-navy text-paper' : 'rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink'
              }`}
            >
              Preview
            </button>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
            >
              View live page <IconExternal size={12} />
            </a>
          </>
        }
      />

      {booting && <SkeletonRows rows={6} />}

      {!booting && (
        <div className={`grid gap-6 ${showPreview ? 'xl:grid-cols-[minmax(0,1fr)_440px]' : ''}`}>
          <div className="min-w-0 space-y-6">
            <PageMap copy={draft} selected={selected} edited={edited} onSelect={select} onToggle={toggle} />

            {/* Section editor — one at a time, so the page stays a page and not a form wall. */}
            <div className="mono flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-graphite">
              <span className="num">{String(index + 1).padStart(2, '0')}</span>
              <span className="text-ink">{HOME_SECTIONS[index]?.label}</span>
              <span className="h-px flex-1" style={{ background: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }} />
              {edited.has(selected) && <span style={{ color: 'var(--color-amber-deep)' }}>Edited</span>}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="space-y-6"
              >
                {editor}
              </motion.div>
            </AnimatePresence>
          </div>

          {showPreview && (
            <aside className="min-w-0 xl:sticky xl:top-[calc(var(--cms-header-h,64px)+20px)] xl:self-start">
              <div className="mb-3 flex items-center justify-between">
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Live preview</span>
                <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">Click a section to edit it</span>
              </div>
              <HomePreview copy={draft} selected={selected} onSelect={select} />
            </aside>
          )}
        </div>
      )}

      {!booting && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          justSaved={justSaved}
          error={error}
          scope={scope}
          onDiscard={() => { setError(null); setDraft(clone(homePage)); }}
          onSave={() => void save()}
        />
      )}

      {/* Site paths the link fields suggest. */}
      <datalist id={ROUTES_LIST_ID}>
        {SITE_ROUTES.map((r) => <option key={r} value={r} />)}
      </datalist>

      <ImagePicker
        open={picking !== null}
        title={picking?.title ?? 'Landing page photo'}
        usedBy="Landing page"
        scope="home"
        kind={picking?.kind ?? 'photo'}
        aspect={picking?.aspect ?? '16/9'}
        hint={picking?.hint}
        onPick={(path) => picking?.onPick(path)}
        onClose={() => setPicking(null)}
      />
    </div>
  );
}
