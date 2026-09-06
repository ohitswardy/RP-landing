import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import {
  BtnGhost, BtnPrimary, Chip, DateField, Drawer, EmptyState, ModuleHeader,
  RowAction, SelectField, SkeletonRows, Stat, Switch, TextField, useConfirm, EASE,
} from '../ui';
import {
  IconArrowDown, IconArrowUp, IconBookmark, IconBookmarkFilled, IconCheck,
  IconExternal, IconPen, IconPlus, IconSearch, IconTrash, IconX,
} from '../icons';
import { ARTICLE_TAGS, fmtDate, type Article, type ArticleStatus, type InsightsPage } from '../data';
import { Field, MiniBtn, Panel, TinyBtn } from '../kit/parts';
import ImagePicker from '../kit/ImagePicker';
import { PreviewFrame } from './services/PagePreview';
import JournalPreview from './insights/JournalPreview';

const STATUS_TONE = { published: 'live', review: 'amber' } as const;
const FILTERS: Array<'all' | ArticleStatus> = ['all', 'published', 'review'];

type Tab = 'notes' | 'page';

type DraftForm = {
  tag: string; title: string; author: string; excerpt: string;
  status: ArticleStatus; date: string; featured: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

const BLANK = (): DraftForm => ({
  tag: ARTICLE_TAGS[0], title: '', author: '', excerpt: '',
  status: 'review', date: today(), featured: false,
});

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Everything the API would reject, phrased the way an editor thinks about it. */
function validatePage(p: InsightsPage): string | null {
  if (!p.hero.title.trim()) return 'The journal page needs a headline.';
  if (p.filters.enabled && !p.filters.allLabel.trim()) return 'The unfiltered rail button needs a label.';
  if (!p.list.noteHref.trim()) return 'Notes need somewhere to link to.';
  if (!p.list.emptyText.trim()) return 'Write the line readers see when a sector has no notes.';
  if (p.cta.enabled && !p.cta.label.trim()) return 'The sign-in prompt is on but has no label.';
  if (p.cta.enabled && !p.cta.href.trim()) return 'The sign-in prompt needs a destination.';
  return null;
}

export default function InsightsModule() {
  const {
    articles, insightsPage, status,
    createArticle, updateArticle, deleteArticle, updateInsightsPage,
  } = useCms();

  const [tab, setTab] = useState<Tab>('notes');

  /* ── Notes ledger ───────────────────────────────────────── */
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Article | 'new' | null>(null);
  const [form, setForm] = useState<DraftForm>(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [armed, confirm] = useConfirm();

  /* ── Page composition ───────────────────────────────────── */
  const [page, setPage] = useState<InsightsPage>(insightsPage);
  const [pageError, setPageError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [picking, setPicking] = useState(false);
  const savedTimer = useRef<number | null>(null);

  const loading = status === 'loading';

  useEffect(() => { setPage(insightsPage); }, [insightsPage]);
  useEffect(() => () => { if (savedTimer.current) window.clearTimeout(savedTimer.current); }, []);

  const dirty = !same(page, insightsPage);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const published = useMemo(() => articles.filter((a) => a.status === 'published'), [articles]);
  const reads = useMemo(() => published.reduce((sum, a) => sum + a.reads, 0), [published]);
  const lead = useMemo(() => published.find((a) => a.featured) ?? null, [published]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles
      .filter((a) => filter === 'all' || a.status === filter)
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q));
  }, [articles, filter, query]);

  /* ── Note actions ───────────────────────────────────────── */

  function openEditor(target: Article | 'new') {
    setFormError(null);
    if (target === 'new') setForm(BLANK());
    else setForm({
      tag: target.tag, title: target.title, author: target.author, excerpt: target.excerpt,
      status: target.status, date: target.date.slice(0, 10), featured: target.featured,
    });
    setEditing(target);
  }

  async function saveNote() {
    if (!form.title.trim()) { setFormError('A working title is required before saving.'); return; }
    if (!form.author.trim()) { setFormError('Attribute the note to an analyst.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) { setFormError('Give the note a publication date.'); return; }

    const payload = {
      tag: form.tag, title: form.title.trim(), author: form.author.trim(),
      excerpt: form.excerpt.trim(), status: form.status, date: form.date, featured: form.featured,
    };
    setSaving(true);
    try {
      if (editing === 'new') await createArticle(payload);
      else if (editing) await updateArticle(editing.id, payload);
      setEditing(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function advance(a: Article) {
    void updateArticle(a.id, { status: 'published' });
  }

  /** A note only leads once it is public — the API demotes every other note. */
  function toggleLead(a: Article) {
    void updateArticle(a.id, { featured: !a.featured, status: a.featured ? a.status : 'published' });
  }

  /* ── Page actions ───────────────────────────────────────── */

  const setHero = <K extends keyof InsightsPage['hero']>(k: K, v: InsightsPage['hero'][K]) =>
    { setPageError(null); setPage((p) => ({ ...p, hero: { ...p.hero, [k]: v } })); };
  const setFilters = <K extends keyof InsightsPage['filters']>(k: K, v: InsightsPage['filters'][K]) =>
    { setPageError(null); setPage((p) => ({ ...p, filters: { ...p.filters, [k]: v } })); };
  const setList = <K extends keyof InsightsPage['list']>(k: K, v: InsightsPage['list'][K]) =>
    { setPageError(null); setPage((p) => ({ ...p, list: { ...p.list, [k]: v } })); };
  const setCta = <K extends keyof InsightsPage['cta']>(k: K, v: InsightsPage['cta'][K]) =>
    { setPageError(null); setPage((p) => ({ ...p, cta: { ...p.cta, [k]: v } })); };

  async function publishPage() {
    const problem = validatePage(page);
    if (problem) { setPageError(problem); setTab('page'); return; }

    setPublishing(true);
    setPageError(null);
    try {
      await updateInsightsPage(page);
      setJustSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setJustSaved(false), 2600);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Saving failed. Try again.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="02 / Insights"
        title="Research journal"
        blurb="Every note that reaches the public Insights page and the client archive, and the page itself — its header, filter rail, ledger, and sign-in prompt. Notes start in review and stay internal until published."
        actions={
          <>
            <a
              href="/insights"
              target="_blank"
              rel="noreferrer"
              className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
            >
              View live page <IconExternal size={12} />
            </a>
            <BtnPrimary onClick={() => { setTab('notes'); openEditor('new'); }}><IconPlus size={14} /> New note</BtnPrimary>
          </>
        }
      />

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b rule pb-4">
        <TabButton active={tab === 'notes'} onClick={() => setTab('notes')} count={articles.length}>
          Notes
        </TabButton>
        <TabButton active={tab === 'page'} onClick={() => setTab('page')} dot={dirty}>
          Page composition
        </TabButton>
        {tab === 'page' && (
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-pressed={showPreview}
            className={`mono ml-auto border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 ${
              showPreview ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
            }`}
          >
            Preview
          </button>
        )}
      </div>

      {/* ── Notes ────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <div className="space-y-8">
          {!loading && articles.length > 0 && (
            <div className="grid grid-cols-2 gap-6 border-b rule pb-8 md:grid-cols-3">
              <Stat value={String(published.length)} label="Published" />
              <Stat value={String(articles.filter((a) => a.status === 'review').length)} label="In review" />
              <Stat value={reads.toLocaleString('en-PH')} label="Reads" />
            </div>
          )}

          {/* Lead note banner */}
          {!loading && (
            <div className="flex flex-col gap-3 border rule bg-bone px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">Lead note</div>
                <p className="mt-1 truncate text-[13.5px] text-ink">
                  {lead ? lead.title : 'No note is leading the journal — the page opens straight into the ledger.'}
                </p>
              </div>
              {lead && (
                <TinyBtn onClick={() => toggleLead(lead)}>
                  <IconX size={11} /> Clear lead
                </TinyBtn>
              )}
            </div>
          )}

          {/* Filter rail */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`mono border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
                    filter === f ? 'border-navy bg-navy text-paper' : 'rule bg-transparent text-graphite hover:text-ink'
                  }`}
                >
                  {f}
                  <span className="ml-2 opacity-50">
                    {f === 'all' ? articles.length : articles.filter((a) => a.status === f).length}
                  </span>
                </button>
              ))}
            </div>
            <label className="relative block w-full md:w-[260px]">
              <span className="sr-only">Search notes</span>
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, analyst, sector…"
                className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
              />
            </label>
          </div>

          {/* Ledger */}
          {loading ? (
            <SkeletonRows rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={query ? 'Nothing matches that search.' : 'No notes in this state.'}
              hint={query ? 'Try a shorter fragment — search covers titles, analysts, and sector tags.' : 'Start a note and it will appear in this ledger with its full production history.'}
              action={<BtnGhost onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</BtnGhost>}
            />
          ) : (
            <ul className="divide-y rule border-y rule">
              <AnimatePresence initial={false}>
                {rows.map((a, i) => (
                  <motion.li
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: Math.min(i * 0.04, 0.3) } }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
                    className="group"
                  >
                    <div className="grid grid-cols-12 items-center gap-x-4 gap-y-2 py-5">
                      <span className="mono col-span-6 order-1 text-[10.5px] uppercase tracking-[0.16em] text-graphite md:col-span-1">{a.tag}</span>
                      <div className="col-span-12 order-3 md:col-span-6 md:order-2 lg:col-span-4">
                        <p className="flex items-center gap-2 text-[15px] leading-snug text-ink">
                          {a.featured && (
                            <span className="shrink-0" style={{ color: 'var(--color-amber-deep)' }} title="Lead note">
                              <IconBookmarkFilled size={13} />
                            </span>
                          )}
                          {a.title}
                        </p>
                        {a.excerpt && <p className="mt-1 line-clamp-1 text-[12.5px] text-graphite">{a.excerpt}</p>}
                      </div>
                      <span className="col-span-4 order-4 hidden text-[13px] text-slate lg:col-span-2 lg:block">{a.author}</span>
                      <span className="mono num col-span-3 order-5 hidden whitespace-nowrap text-[12px] text-graphite lg:col-span-1 lg:block">{fmtDate(a.date)}</span>
                      <span className="mono num col-span-2 order-6 hidden text-right text-[12px] text-graphite xl:col-span-1 xl:block">
                        {a.status === 'published' ? a.reads.toLocaleString('en-PH') : '—'}
                      </span>
                      <span className="col-span-6 order-2 md:col-span-2 md:order-7 md:justify-self-end lg:col-span-1">
                        <Chip tone={STATUS_TONE[a.status]}>{a.status}</Chip>
                      </span>
                      <div className="col-span-12 order-8 flex items-center gap-1.5 md:col-span-3 md:justify-end md:justify-self-end xl:col-span-2">
                        <RowAction
                          label={a.featured ? 'Clear lead note' : 'Lead the journal with this note'}
                          onClick={() => toggleLead(a)}
                        >
                          {a.featured ? <IconBookmarkFilled /> : <IconBookmark />}
                        </RowAction>
                        {a.status !== 'published' && (
                          <RowAction label="Publish" onClick={() => advance(a)}>
                            <IconCheck />
                          </RowAction>
                        )}
                        <RowAction label="Edit note" onClick={() => openEditor(a)}><IconPen /></RowAction>
                        <RowAction label={armed === a.id ? 'Confirm delete' : 'Delete note'} danger onClick={() => confirm(a.id, () => void deleteArticle(a.id))}>
                          {armed === a.id ? <IconCheck /> : <IconTrash />}
                        </RowAction>
                        {armed === a.id && (
                          <span className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--color-warn)' }}>sure?</span>
                        )}
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      )}

      {/* ── Page composition ─────────────────────────────────── */}
      {tab === 'page' && (
        <div className={`grid gap-6 ${showPreview ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
          <div className="min-w-0 space-y-6">
            <Panel
              code="/insights"
              title="Page header"
              hint="The band readers land on, above everything else on the journal."
            >
              <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="flex flex-col gap-3">
                  <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Header photo</span>
                  <div className="group relative aspect-[16/9] overflow-hidden border rule bg-bone">
                    {page.hero.image ? (
                      <img src={page.hero.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-blueprint">
                        <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-paper/60">Blueprint fallback</span>
                      </div>
                    )}
                    <div
                      className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 p-2"
                      style={{ background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.85), transparent)' }}
                    >
                      <TinyBtn onClick={() => setPicking(true)} tone="accent">
                        <IconPen size={11} /> {page.hero.image ? 'Replace' : 'Add photo'}
                      </TinyBtn>
                      {page.hero.image && (
                        <TinyBtn onClick={() => setHero('image', '')}>
                          <IconTrash size={11} /> Clear
                        </TinyBtn>
                      )}
                    </div>
                  </div>
                  <p className="mono truncate text-[9.5px] tracking-[0.06em] text-graphite">{page.hero.image || '— none —'}</p>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Field label="Eyebrow" value={page.hero.eyebrow} max={60} onChange={(v) => setHero('eyebrow', v)} hint="The small mono line above the headline." />
                    <Field label="Headline" value={page.hero.title} max={120} onChange={(v) => setHero('title', v)} />
                  </div>
                  <Field
                    label="Standfirst"
                    value={page.hero.dek}
                    max={1000}
                    multiline
                    rows={2}
                    onChange={(v) => setHero('dek', v)}
                    hint="Optional. Leave empty and the header runs headline-only."
                  />
                </div>
              </div>
            </Panel>

            <Panel
              code="Filters"
              title="Sector rail"
              hint="The row of sector buttons under the header. A tag with no published notes is dropped from the rail automatically."
              actions={<Switch on={page.filters.enabled} onToggle={() => setFilters('enabled', !page.filters.enabled)} label="Show the sector rail" />}
            >
              <div className={`flex flex-col gap-6 transition-opacity duration-300 ${page.filters.enabled ? '' : 'pointer-events-none opacity-40'}`}>
                <div className="max-w-[240px]">
                  <Field label="Unfiltered label" value={page.filters.allLabel} max={40} onChange={(v) => setFilters('allLabel', v)} />
                </div>
                <TagRail
                  tags={page.filters.tags}
                  notes={published}
                  onChange={(next) => setFilters('tags', next)}
                />
              </div>
            </Panel>

            <Panel
              code="Ledger"
              title="Note list"
              hint="How each published note is presented, and how many of them the page carries."
            >
              <div className="flex flex-col gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ToggleRow
                    label="Lead note"
                    hint="Promote the flagged note into a full-width block above the ledger."
                    on={page.list.featureLead}
                    onToggle={() => setList('featureLead', !page.list.featureLead)}
                  />
                  <ToggleRow
                    label="Standfirsts"
                    hint="Show each note's summary line under its title."
                    on={page.list.showExcerpt}
                    onToggle={() => setList('showExcerpt', !page.list.showExcerpt)}
                  />
                  <ToggleRow
                    label="Bylines"
                    hint="Attribute each note to its analyst."
                    on={page.list.showAuthor}
                    onToggle={() => setList('showAuthor', !page.list.showAuthor)}
                  />
                  <ToggleRow
                    label="Dates"
                    hint="Show the publication date column."
                    on={page.list.showDate}
                    onToggle={() => setList('showDate', !page.list.showDate)}
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <NumberField
                    label="Notes shown"
                    value={page.list.limit}
                    max={200}
                    onChange={(v) => setList('limit', v)}
                    hint={page.list.limit === 0
                      ? `No cap — all ${published.length} published notes render.`
                      : `Only the newest ${page.list.limit} render; the rest sit behind sign-in.`}
                  />
                  <Field
                    label="Note destination"
                    value={page.list.noteHref}
                    max={200}
                    onChange={(v) => setList('noteHref', v)}
                    hint="Where a headline links. /login sends readers to the client portal."
                  />
                </div>

                <Field
                  label="Empty-sector line"
                  value={page.list.emptyText}
                  max={300}
                  multiline
                  rows={2}
                  onChange={(v) => setList('emptyText', v)}
                  hint="Read when a filtered sector has nothing published in it."
                />
              </div>
            </Panel>

            <Panel
              code="Footer"
              title="Sign-in prompt"
              hint="The single line under the ledger that points at the full archive."
              actions={<Switch on={page.cta.enabled} onToggle={() => setCta('enabled', !page.cta.enabled)} label="Show the sign-in prompt" />}
            >
              <div className={`grid gap-5 transition-opacity duration-300 sm:grid-cols-2 ${page.cta.enabled ? '' : 'pointer-events-none opacity-40'}`}>
                <Field label="Label" value={page.cta.label} max={120} onChange={(v) => setCta('label', v)} />
                <Field label="Destination" value={page.cta.href} max={200} onChange={(v) => setCta('href', v)} />
              </div>
            </Panel>

            <Panel
              code="Footer"
              title="Newsletter band"
              hint="The subscribe block that closes the page. Subscribers land in the Newsletter module either way."
              actions={
                <Switch
                  on={page.newsletter.enabled}
                  onToggle={() => { setPageError(null); setPage((p) => ({ ...p, newsletter: { enabled: !p.newsletter.enabled } })); }}
                  label="Show the newsletter band"
                />
              }
            >
              <p className="text-[12.5px] leading-relaxed text-graphite">
                {page.newsletter.enabled
                  ? 'The journal closes with the subscribe band, as it does on every other marketing page.'
                  : 'The journal ends at the sign-in prompt — readers reach the subscribe form from the footer instead.'}
              </p>
            </Panel>
          </div>

          {showPreview && (
            <aside className="min-w-0 xl:sticky xl:top-[92px] xl:self-start">
              <div className="mb-3 flex items-center justify-between">
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Live preview</span>
                <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">Updates as you type</span>
              </div>
              <PreviewFrame url="/insights">
                <JournalPreview page={page} notes={published} />
              </PreviewFrame>
              <p className="mt-3 text-[11.5px] leading-relaxed text-graphite">
                Drawn from the {published.length} published note{published.length === 1 ? '' : 's'} in the ledger — drafts and notes in review never appear.
              </p>
            </aside>
          )}
        </div>
      )}

      {/* ── Sticky save bar ──────────────────────────────────── */}
      <SaveBar
        dirty={dirty}
        saving={publishing}
        justSaved={justSaved}
        error={pageError}
        onReview={() => setTab('page')}
        showReview={tab !== 'page'}
        onDiscard={() => { setPageError(null); setPage(insightsPage); }}
        onSave={() => void publishPage()}
      />

      {/* Header photo picker */}
      <ImagePicker
        open={picking}
        title="Journal header photo"
        usedBy="Insights"
        scope="insights"
        onPick={(path) => setHero('image', path)}
        onClose={() => setPicking(false)}
      />

      {/* Note editor */}
      <Drawer
        open={editing !== null}
        title={editing === 'new' ? 'New research note' : 'Edit research note'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <BtnGhost onClick={() => setEditing(null)}>Discard</BtnGhost>
            <BtnPrimary onClick={() => void saveNote()} disabled={saving}>
              {saving ? 'Saving…' : editing === 'new' ? 'Create note' : 'Save changes'}
            </BtnPrimary>
          </>
        }
      >
        <div className="space-y-6">
          <TextField label="Working title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="The thesis in one declarative sentence." error={formError ?? undefined} />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Sector tag" value={form.tag} onChange={(v) => setForm((f) => ({ ...f, tag: v }))} options={ARTICLE_TAGS} />
            <SelectField label="Status" value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v as ArticleStatus }))} options={['review', 'published']} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DateField label="Publication date" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
            <TextField label="Analyst" value={form.author} onChange={(v) => setForm((f) => ({ ...f, author: v }))} placeholder="C. Sy" />
          </div>
          <TextField label="Standfirst" value={form.excerpt} onChange={(v) => setForm((f) => ({ ...f, excerpt: v }))} multiline placeholder="Two sentences a PM reads before deciding to open the note." helper="Appears in the archive list, the lead block, and the newsletter digest." />

          <div className="border-t rule pt-6">
            <ToggleRow
              label="Lead the journal"
              hint="Promotes this note to the block above the ledger and publishes it. Any other lead steps down."
              on={form.featured}
              onToggle={() => setForm((f) => ({
                ...f,
                featured: !f.featured,
                status: !f.featured ? 'published' : f.status,
              }))}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}

/* ── Tab button ────────────────────────────────────────────── */

function TabButton({ active, onClick, children, count, dot }: {
  active: boolean; onClick: () => void; children: ReactNode; count?: number; dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`mono relative border px-4 py-2 text-[10.5px] uppercase tracking-[0.16em] transition-colors duration-300 active:translate-y-px ${
        active ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
    >
      {children}
      {count !== undefined && <span className="num ml-2 opacity-50">{count}</span>}
      {dot && (
        <span
          aria-label="unsaved changes"
          className="absolute right-1 top-1 block h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--color-amber-deep)' }}
        />
      )}
    </button>
  );
}

/* ── Toggle row ────────────────────────────────────────────── */

function ToggleRow({ label, hint, on, onToggle }: {
  label: string; hint: string; on: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border rule bg-white px-4 py-3.5">
      <div className="min-w-0">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">{label}</div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate">{hint}</p>
      </div>
      <div className="pt-0.5">
        <Switch on={on} onToggle={onToggle} label={label} />
      </div>
    </div>
  );
}

/* ── Number field ──────────────────────────────────────────── */

function NumberField({ label, value, max, onChange, hint }: {
  label: string; value: number; max: number; onChange: (v: number) => void; hint?: string;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(max, n));
  return (
    <div className="flex flex-col gap-1.5">
      <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">{label}</label>
      <div className="flex items-center gap-2">
        <MiniBtn label="Fewer notes" disabled={value <= 0} onClick={() => onChange(clamp(value - 1))}>
          <IconArrowDown size={13} />
        </MiniBtn>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          className="mono num w-20 border rule bg-white px-3 py-2 text-center text-[13px] text-ink outline-none transition-colors focus:border-[color:var(--color-amber-deep)]"
        />
        <MiniBtn label="More notes" disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>
          <IconArrowUp size={13} />
        </MiniBtn>
        {value !== 0 && <TinyBtn onClick={() => onChange(0)}>No cap</TinyBtn>}
      </div>
      {hint && <p className="text-[11.5px] leading-relaxed text-graphite">{hint}</p>}
    </div>
  );
}

/* ── Date field ────────────────────────────────────────────── */


/* ── Sector rail editor ────────────────────────────────────── */

function TagRail({ tags, notes, onChange }: {
  tags: string[]; notes: Article[]; onChange: (next: string[]) => void;
}) {
  const tally = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of notes) m.set(a.tag, (m.get(a.tag) ?? 0) + 1);
    return m;
  }, [notes]);

  const available = ARTICLE_TAGS.filter((t) => !tags.includes(t));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= tags.length) return;
    const next = tags.slice();
    const [t] = next.splice(from, 1);
    next.splice(to, 0, t);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Rail order</span>
        <span className="mono num text-[10px] text-silver">{tags.length} / {ARTICLE_TAGS.length}</span>
      </div>

      {tags.length === 0 ? (
        <p className="border rule border-dashed px-4 py-6 text-[12px] text-graphite">
          No sectors on the rail — readers would see the unfiltered list only.
        </p>
      ) : (
        <ul className="divide-y rule border-y rule">
          {tags.map((t, i) => {
            const live = tally.get(t) ?? 0;
            return (
              <li key={t} className="flex items-center gap-3 py-2.5">
                <span className="mono num w-6 shrink-0 text-[10.5px] text-graphite">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{t}</span>
                <span
                  className="mono num shrink-0 text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: live > 0 ? 'var(--color-graphite)' : 'var(--color-silver)' }}
                >
                  {live > 0 ? `${live} live` : 'none yet'}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <MiniBtn label={`Move ${t} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <IconArrowUp size={13} />
                  </MiniBtn>
                  <MiniBtn label={`Move ${t} down`} disabled={i === tags.length - 1} onClick={() => move(i, i + 1)}>
                    <IconArrowDown size={13} />
                  </MiniBtn>
                  <MiniBtn label={`Remove ${t} from the rail`} danger onClick={() => onChange(tags.filter((x) => x !== t))}>
                    <IconX size={13} />
                  </MiniBtn>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Add</span>
          {available.map((t) => (
            <TinyBtn key={t} onClick={() => onChange([...tags, t])}>
              <IconPlus size={11} /> {t}
            </TinyBtn>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Save bar ──────────────────────────────────────────────── */

function SaveBar({
  dirty, saving, justSaved, error, showReview, onReview, onDiscard, onSave,
}: {
  dirty: boolean; saving: boolean; justSaved: boolean; error: string | null;
  showReview: boolean; onReview: () => void; onDiscard: () => void; onSave: () => void;
}) {
  const show = dirty || saving || justSaved || Boolean(error);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="sticky bottom-4 z-30 border rule bg-paper/95 shadow-[0_10px_30px_-12px_oklch(0.165_0.040_260_/_0.4)] backdrop-blur-md"
        >
          <div className="flex w-full flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {error ? (
                <p className="text-[13px] leading-snug" style={{ color: 'var(--color-warn)' }}>{error}</p>
              ) : justSaved && !dirty ? (
                <Chip tone="live">Published to the live site</Chip>
              ) : (
                <p className="truncate text-[13px] text-slate">
                  <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-amber-deep)' }}>
                    Unsaved
                  </span>
                  Insights page composition
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {showReview && dirty && <BtnGhost onClick={onReview}>Review changes</BtnGhost>}
              <BtnGhost onClick={onDiscard}>Discard</BtnGhost>
              <BtnPrimary onClick={onSave} disabled={saving || !dirty}>
                {saving ? 'Publishing…' : 'Save & publish'}
              </BtnPrimary>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
