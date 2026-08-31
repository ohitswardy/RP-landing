import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import {
  BtnGhost, BtnPrimary, Chip, EmptyState, ModuleHeader, SkeletonRows, Switch, EASE,
} from '../ui';
import {
  IconArrowDown, IconArrowUp, IconCheck, IconExternal, IconPen, IconPlus, IconTrash,
} from '../icons';
import type { ServiceLine, ServicePage, ServicePillar, ServiceProof } from '../data';
import ImagePicker from '../kit/ImagePicker';
import HeroGallery from './services/HeroGallery';
import PillarList from './services/PillarList';
import { LandingPreview, PreviewFrame, ServicePreview } from './services/PagePreview';
import { Field, MiniBtn, Modal, Panel, TinyBtn, move } from '../kit/parts';

/* ── Draft model ───────────────────────────────────────────── */

type Draft = Pick<ServiceLine, 'eyebrow' | 'title' | 'dek' | 'introHeading' | 'img' | 'heroImages' | 'pillars' | 'proof'>;

const BLANK: Draft = {
  eyebrow: '', title: '', dek: '', introHeading: '', img: '', heroImages: [], pillars: [], proof: [],
};

function toDraft(s: ServiceLine): Draft {
  return {
    eyebrow: s.eyebrow,
    title: s.title,
    dek: s.dek,
    introHeading: s.introHeading,
    img: s.img,
    heroImages: s.heroImages,
    pillars: s.pillars,
    proof: s.proof,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Everything the API would reject, phrased the way an editor thinks about it. */
function validate(d: Draft): string | null {
  if (!d.title.trim()) return 'The page needs a title.';
  if (!d.dek.trim()) return 'The standfirst under the title cannot be empty.';
  if (!d.introHeading.trim()) return 'The section heading above the ledger cannot be empty.';
  if (d.pillars.some((p) => !p.title.trim() || !p.body.trim())) return 'Every ledger row needs both a heading and a description.';
  if (d.proof.some((p) => !p.value.trim() || !p.label.trim())) return 'Every proof stat needs both a figure and a label.';
  if (d.title.length > 120) return 'The title is over 120 characters.';
  if (d.dek.length > 1000) return 'The standfirst is over 1,000 characters.';
  return null;
}

function validatePage(p: ServicePage): string | null {
  if (!p.title.trim()) return 'The landing page needs a title.';
  if (!p.cardCta.trim()) return 'The card link label cannot be empty.';
  return null;
}

/* ── Module ────────────────────────────────────────────────── */

export default function ServicesModule() {
  const {
    services, servicePage, status,
    updateService, reorderServices, updateServicePage,
  } = useCms();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [pageDraft, setPageDraft] = useState<ServicePage>(servicePage);
  const [pending, setPending] = useState<string | null>(null);   // tab waiting on a discard decision
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pickingCard, setPickingCard] = useState(false);
  const [pickingHero, setPickingHero] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const savedTimer = useRef<number | null>(null);

  const loading = status === 'loading' && services.length === 0;
  const selected = useMemo(
    () => services.find((s) => s.id === selectedId) ?? services[0] ?? null,
    [services, selectedId],
  );

  // Load the draft only when the selection changes — saving and reordering
  // both replace the underlying records, and neither should wipe an edit.
  useEffect(() => {
    if (selected) setDraft(toDraft(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => { setPageDraft(servicePage); }, [servicePage]);

  const dirtyService = Boolean(selected) && !same(draft, selected ? toDraft(selected) : null);
  const dirtyPage = !same(pageDraft, servicePage);
  const dirty = dirtyService || dirtyPage;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => () => { if (savedTimer.current) window.clearTimeout(savedTimer.current); }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const setPage = <K extends keyof ServicePage>(key: K, value: ServicePage[K]) => {
    setError(null);
    setPageDraft((p) => ({ ...p, [key]: value }));
  };

  function selectService(id: string) {
    if (id === selected?.id) return;
    if (dirtyService) { setPending(id); return; }
    setError(null);
    setSelectedId(id);
  }

  function discard() {
    setError(null);
    if (selected) setDraft(toDraft(selected));
    setPageDraft(servicePage);
  }

  async function saveAll() {
    const pageProblem = dirtyPage ? validatePage(pageDraft) : null;
    if (pageProblem) { setError(pageProblem); return; }
    const problem = dirtyService ? validate(draft) : null;
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError(null);
    try {
      if (dirtyPage) await updateServicePage(pageDraft);
      if (dirtyService && selected) await updateService(selected.id, draft);
      setJustSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setJustSaved(false), 2600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleLive(s: ServiceLine) {
    setError(null);
    void updateService(s.id, { live: !s.live }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'The publish state could not be changed.');
    });
  }

  function reorder(from: number, to: number) {
    const next = move(services, from, to);
    void reorderServices(next.map((s) => s.id));
  }

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="03 / Services"
        title="Service pages"
        blurb="Everything visitors read and see under /services — the landing page, the four practice briefs, their header photography, and the ledger of what each practice delivers."
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
              href="/services"
              target="_blank"
              rel="noreferrer"
              className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
            >
              View live pages <IconExternal size={12} />
            </a>
          </>
        }
      />

      {loading && <SkeletonRows rows={4} />}

      {!loading && services.length === 0 && (
        <EmptyState
          title="No service lines are configured."
          hint="The four practice pages are provisioned with the database. Ask systems administration to run the content seeder."
        />
      )}

      {!loading && services.length > 0 && (
        <>
          {/* ── /services landing page ───────────────────────── */}
          <Panel
            code="/services"
            title="Landing page"
            hint="The header everyone lands on, and the order the practice cards appear in below it."
          >
            <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="flex flex-col gap-3">
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Header photo</span>
                <div className="group relative aspect-[16/9] overflow-hidden border rule bg-bone">
                  {pageDraft.heroImage ? (
                    <img src={pageDraft.heroImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-blueprint">
                      <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-paper/60">Blueprint fallback</span>
                    </div>
                  )}
                  <div
                    className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 p-2"
                    style={{ background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.85), transparent)' }}
                  >
                    <TinyBtn onClick={() => setPickingHero(true)} tone="accent">
                      <IconPen size={11} /> {pageDraft.heroImage ? 'Replace' : 'Add photo'}
                    </TinyBtn>
                    {pageDraft.heroImage && (
                      <TinyBtn onClick={() => setPage('heroImage', '')}>
                        <IconTrash size={11} /> Clear
                      </TinyBtn>
                    )}
                  </div>
                </div>
                <p className="mono truncate text-[9.5px] tracking-[0.06em] text-graphite">{pageDraft.heroImage || '— none —'}</p>
              </div>

              <div className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Eyebrow" value={pageDraft.eyebrow} max={60} onChange={(v) => setPage('eyebrow', v)} hint="The small mono line above the title." />
                  <Field label="Title" value={pageDraft.title} max={120} onChange={(v) => setPage('title', v)} />
                </div>
                <Field
                  label="Standfirst"
                  value={pageDraft.dek}
                  max={1000}
                  multiline
                  rows={2}
                  onChange={(v) => setPage('dek', v)}
                  hint="Optional. Leave empty and the header runs title-only."
                />
                <Field
                  label="Card link label"
                  value={pageDraft.cardCta}
                  max={80}
                  onChange={(v) => setPage('cardCta', v)}
                  hint="The line under every practice card that links through to its brief."
                />
              </div>
            </div>

            <div className="mt-8 border-t rule pt-6">
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Card order</span>
              <ul className="mt-3 divide-y rule border-y rule">
                {services.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-4 py-2.5">
                    <span className="mono num w-6 shrink-0 text-[10.5px] text-graphite">{String(i + 1).padStart(2, '0')}</span>
                    <span className="h-8 w-12 shrink-0 overflow-hidden bg-bone">
                      {s.img && <img src={s.img} alt="" className={`h-full w-full object-cover ${s.live ? '' : 'opacity-40 grayscale'}`} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{s.title}</span>
                    <Chip tone={s.live ? 'live' : 'muted'}>{s.live ? 'Live' : 'Hidden'}</Chip>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <MiniBtn label={`Move ${s.title} up`} disabled={i === 0} onClick={() => reorder(i, i - 1)}>
                        <IconArrowUp size={13} />
                      </MiniBtn>
                      <MiniBtn label={`Move ${s.title} down`} disabled={i === services.length - 1} onClick={() => reorder(i, i + 1)}>
                        <IconArrowDown size={13} />
                      </MiniBtn>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11.5px] leading-relaxed text-graphite">
                Order applies immediately — it is structure, not copy, so it is not held with the draft below.
              </p>
            </div>
          </Panel>

          {/* ── Practice selector ────────────────────────────── */}
          <div>
            <div className="mono mb-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-graphite">
              <span>Practice pages</span>
              <span className="h-px flex-1" style={{ background: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }} />
            </div>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {services.map((s) => {
                const on = s.id === selected?.id;
                const edited = on && dirtyService;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => selectService(s.id)}
                      className="group block w-full border text-left transition-colors duration-300"
                      style={{ borderColor: on ? 'var(--color-navy)' : 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}
                    >
                      <span className="relative block aspect-[16/9] overflow-hidden bg-bone">
                        {s.img && (
                          <img
                            src={s.img}
                            alt=""
                            loading="lazy"
                            className={`h-full w-full object-cover transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.04] ${s.live ? '' : 'opacity-40 grayscale'}`}
                          />
                        )}
                        {!on && <span aria-hidden className="absolute inset-0 bg-paper/35 transition-opacity duration-300 group-hover:opacity-0" />}
                        {edited && (
                          <span className="mono absolute right-0 top-0 px-2 py-1 text-[8.5px] uppercase tracking-[0.16em] text-paper" style={{ background: 'var(--color-amber-deep)' }}>
                            Edited
                          </span>
                        )}
                      </span>
                      <span className="block px-3 py-2.5">
                        <span className="mono block text-[9.5px] uppercase tracking-[0.16em] text-graphite">/{s.slug}</span>
                        <span className={`mt-1 block truncate text-[13.5px] ${on ? 'text-ink' : 'text-slate'}`}>{s.title}</span>
                        <span className="mt-1.5 block"><Chip tone={s.live ? 'live' : 'muted'}>{s.live ? 'Live' : 'Hidden'}</Chip></span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Editor + preview ─────────────────────────────── */}
          {selected && (
            <div className={`grid gap-6 ${showPreview ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
              <div className="min-w-0 space-y-6">
                <Panel
                  code={`/services/${selected.slug}`}
                  title="Page header"
                  hint="The eyebrow, headline, and standfirst that open the brief."
                  actions={
                    <div className="flex items-center gap-3">
                      <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">
                        {selected.live ? 'Published' : 'Hidden'}
                      </span>
                      <Switch on={selected.live} onToggle={() => toggleLive(selected)} label={`Publish ${selected.title}`} />
                    </div>
                  }
                >
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
                      <Field label="Eyebrow" value={draft.eyebrow} max={60} onChange={(v) => set('eyebrow', v)} />
                      <Field label="Page title" value={draft.title} max={120} onChange={(v) => set('title', v)} />
                    </div>
                    <Field
                      label="Standfirst"
                      value={draft.dek}
                      max={1000}
                      multiline
                      rows={3}
                      onChange={(v) => set('dek', v)}
                      hint="Also the summary on the /services landing card. Around 160 characters reads best in both places."
                    />
                  </div>
                </Panel>

                <Panel
                  code="Photography"
                  title="Header photos"
                  hint="Drop in new photography or reuse the media library. The first photo leads."
                >
                  <HeroGallery
                    images={draft.heroImages}
                    onChange={(v) => set('heroImages', v)}
                    usedBy={`Services / ${selected.title}`}
                  />
                </Panel>

                <Panel
                  code="Proof"
                  title="Proof stats"
                  hint="The three figures that sit directly under the header. Keep the figure short and the label plain."
                >
                  <ProofEditor proof={draft.proof} onChange={(v) => set('proof', v)} />
                </Panel>

                <Panel code="Body" title="What the practice delivers" hint="The numbered ledger that carries the page.">
                  <div className="flex flex-col gap-6">
                    <Field
                      label="Section heading"
                      value={draft.introHeading}
                      max={160}
                      onChange={(v) => set('introHeading', v)}
                    />
                    <PillarList pillars={draft.pillars} onChange={(v) => set('pillars', v)} />
                  </div>
                </Panel>

                <Panel
                  code="Landing card"
                  title="Card image"
                  hint="Used on the /services index and to identify this practice across the workspace."
                >
                  <div className="flex flex-wrap items-end gap-5">
                    <div className="group relative aspect-[16/9] w-[240px] overflow-hidden border rule bg-bone">
                      {draft.img ? (
                        <img src={draft.img} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="mono grid h-full w-full place-items-center text-[9.5px] uppercase tracking-[0.16em] text-graphite">
                          No image
                        </span>
                      )}
                      <div
                        className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 p-2"
                        style={{ background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.85), transparent)' }}
                      >
                        <TinyBtn onClick={() => setPickingCard(true)} tone="accent">
                          <IconPen size={11} /> {draft.img ? 'Replace' : 'Choose'}
                        </TinyBtn>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Path</span>
                      <p className="mono truncate text-[11.5px] tracking-[0.04em] text-slate">{draft.img || '— none —'}</p>
                      {draft.heroImages[0] && draft.heroImages[0] !== draft.img && (
                        <TinyBtn onClick={() => set('img', draft.heroImages[0])}>
                          <IconCheck size={11} /> Match the header photo
                        </TinyBtn>
                      )}
                    </div>
                  </div>
                </Panel>
              </div>

              {showPreview && (
                <aside className="min-w-0 xl:sticky xl:top-[92px] xl:self-start">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Live preview</span>
                    <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">Updates as you type</span>
                  </div>
                  <div className="space-y-5">
                    <PreviewFrame url={`/services/${selected.slug}`}>
                      <ServicePreview draft={draft} />
                    </PreviewFrame>
                    <PreviewFrame url="/services">
                      <LandingPreview
                        page={pageDraft}
                        services={services.map((s) =>
                          s.id === selected.id
                            ? { id: s.id, title: draft.title, dek: draft.dek, live: s.live }
                            : { id: s.id, title: s.title, dek: s.dek, live: s.live },
                        )}
                      />
                    </PreviewFrame>
                  </div>
                </aside>
              )}

            </div>
          )}

          {/* ── Sticky save bar ──────────────────────────────── */}
          <SaveBar
            dirty={dirty}
            saving={saving}
            justSaved={justSaved}
            error={error}
            scopes={[dirtyPage && 'landing page', dirtyService && selected?.title].filter(Boolean) as string[]}
            onDiscard={discard}
            onSave={() => void saveAll()}
          />
        </>
      )}

      {/* Card image picker */}
      <ImagePicker
        open={pickingCard}
        title="Card image"
        usedBy={selected ? `Services / ${selected.title}` : 'Services'}
        scope="services"
        onPick={(path) => set('img', path)}
        onClose={() => setPickingCard(false)}
      />

      {/* Landing hero picker */}
      <ImagePicker
        open={pickingHero}
        title="Landing header photo"
        usedBy="Services"
        scope="services"
        onPick={(path) => setPage('heroImage', path)}
        onClose={() => setPickingHero(false)}
      />

      {/* Leaving an edited practice behind */}
      <Modal
        open={pending !== null}
        title="Unsaved changes"
        onClose={() => setPending(null)}
        footer={
          <>
            <BtnGhost onClick={() => setPending(null)}>Stay here</BtnGhost>
            <BtnPrimary
              onClick={() => {
                if (selected) setDraft(toDraft(selected));
                setSelectedId(pending);
                setPending(null);
                setError(null);
              }}
            >
              Discard and switch
            </BtnPrimary>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate">
          {selected?.title} has edits that have not been published. Switching pages now throws them away.
        </p>
      </Modal>
    </div>
  );
}

/* ── Proof stats ───────────────────────────────────────────── */

const MAX_PROOF = 3;

function ProofEditor({ proof, onChange }: { proof: ServiceProof[]; onChange: (next: ServiceProof[]) => void }) {
  const set = (i: number, patch: Partial<ServiceProof>) =>
    onChange(proof.map((p, x) => (x === i ? { ...p, ...patch } : p)));

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 sm:grid-cols-3">
        {proof.map((p, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-col gap-3 border rule bg-white px-3.5 py-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">Stat {i + 1}</span>
              <MiniBtn label={`Remove stat ${i + 1}`} danger onClick={() => onChange(proof.filter((_, x) => x !== i))}>
                <IconTrash size={13} />
              </MiniBtn>
            </div>
            <Field label="Figure" value={p.value} max={40} size="sm" onChange={(v) => set(i, { value: v })} />
            <Field label="Label" value={p.label} max={60} size="sm" onChange={(v) => set(i, { label: v })} />
          </motion.li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <TinyBtn onClick={() => onChange([...proof, { value: '', label: '' }])} disabled={proof.length >= MAX_PROOF}>
          <IconPlus size={12} /> Add stat
        </TinyBtn>
        <span className="mono num text-[10px] uppercase tracking-[0.14em] text-graphite">{proof.length} / {MAX_PROOF}</span>
      </div>
    </div>
  );
}

/* ── Save bar ──────────────────────────────────────────────── */

function SaveBar({
  dirty, saving, justSaved, error, scopes, onDiscard, onSave,
}: {
  dirty: boolean; saving: boolean; justSaved: boolean; error: string | null;
  scopes: string[]; onDiscard: () => void; onSave: () => void;
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
                  {scopes.length > 0 ? scopes.join(' · ') : 'Draft changes'}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
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
