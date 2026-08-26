import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../../store';
import { BtnGhost, BtnPrimary, Chip, EASE } from '../../ui';
import { IconArrowDown, IconArrowUp, IconExternal, IconPen, IconPlus, IconTrash } from '../../icons';
import type { AboutAwardGroup, AboutCopy, AboutPair, AboutTimelineEntry } from '../../data';
import ImagePicker from '../../kit/ImagePicker';
import { Field, MiniBtn, Panel, TinyBtn, move } from '../../kit/parts';

/* ─────────────────────────────────────────────────────────────
   Everything the About page says outside the roster cards — the
   hero, the Company Overview prose and registry, the heritage
   timeline, the leadership heading, and the awards wall — edited
   as one document and published with one save.
   ───────────────────────────────────────────────────────────── */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = (c: AboutCopy): AboutCopy => JSON.parse(JSON.stringify(c)) as AboutCopy;

const LIMITS = { paragraphs: 8, profile: 10, timeline: 12, groups: 8, items: 10 } as const;

/** Trim every string; drop rows that are entirely empty. */
function tidy(c: AboutCopy): AboutCopy {
  const t = (v: string) => v.trim();
  return {
    hero: { eyebrow: t(c.hero.eyebrow), title: t(c.hero.title), image: t(c.hero.image) },
    overview: {
      heading: t(c.overview.heading),
      paragraphs: c.overview.paragraphs.map(t).filter(Boolean),
      profile: c.overview.profile
        .map((r) => ({ label: t(r.label), value: t(r.value) }))
        .filter((r) => r.label || r.value),
    },
    heritage: {
      eyebrow: t(c.heritage.eyebrow),
      heading: t(c.heritage.heading),
      timeline: c.heritage.timeline
        .map((e) => ({ year: t(e.year), title: t(e.title), body: t(e.body) }))
        .filter((e) => e.year || e.title || e.body),
    },
    leadership: { heading: t(c.leadership.heading) },
    awards: {
      eyebrow: t(c.awards.eyebrow),
      heading: t(c.awards.heading),
      groups: c.awards.groups
        .map((g) => ({
          org: t(g.org),
          items: g.items
            .map((i) => ({ name: t(i.name), years: t(i.years) }))
            .filter((i) => i.name || i.years),
        }))
        .filter((g) => g.org || g.items.length > 0),
    },
  };
}

/** Everything the API would reject, phrased the way an editor thinks about it. */
function validateCopy(c: AboutCopy): string | null {
  if (!c.hero.title) return 'The hero needs a headline.';
  if (!c.overview.heading) return 'The company overview needs a heading.';
  if (c.overview.profile.some((r) => !r.label || !r.value)) return 'Every company-profile row needs both a label and a value.';
  if (!c.heritage.heading) return 'The heritage section needs a heading.';
  if (c.heritage.timeline.some((e) => !e.year || !e.title || !e.body)) return 'Every milestone needs a year, a title, and a description.';
  if (!c.leadership.heading) return 'The leadership section needs a heading.';
  if (!c.awards.heading) return 'The awards section needs a heading.';
  for (const g of c.awards.groups) {
    if (!g.org) return 'Every award group needs the awarding organization.';
    if (g.items.length === 0) return `“${g.org}” lists no awards — add one or remove the group.`;
    if (g.items.some((i) => !i.name || !i.years)) return `An award under “${g.org}” is missing its name or years.`;
  }
  return null;
}

export default function AboutCopyEditor({
  onDirty, onOpenRoster,
}: {
  onDirty: (dirty: boolean) => void;
  onOpenRoster: () => void;
}) {
  const { aboutPage, updateAboutPage } = useCms();
  const [draft, setDraft] = useState<AboutCopy>(() => clone(aboutPage));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pickingHero, setPickingHero] = useState(false);
  const savedTimer = useRef<number | null>(null);

  // Follow the store when an untouched editor's baseline changes
  // (bootstrap landing late). A dirty draft is never overwritten.
  const baseline = useRef(aboutPage);
  useEffect(() => {
    setDraft((d) => (same(d, baseline.current) ? clone(aboutPage) : d));
    baseline.current = aboutPage;
  }, [aboutPage]);

  const dirty = !same(draft, aboutPage);

  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => () => { onDirty(false); }, [onDirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => () => { if (savedTimer.current) window.clearTimeout(savedTimer.current); }, []);

  /** Clone-and-mutate keeps the nested updates readable. */
  const patch = (fn: (c: AboutCopy) => void) => {
    setError(null);
    setDraft((d) => { const next = clone(d); fn(next); return next; });
  };

  async function save() {
    const trimmed = tidy(draft);
    const problem = validateCopy(trimmed);
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError(null);
    try {
      const saved = await updateAboutPage(trimmed);
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

  return (
    <div className="space-y-6">
      <Panel
        code="/about · hero"
        title="Hero"
        hint="The headline at the very top of the page. The eyebrow is optional — leave it empty and the header runs headline-only."
        actions={<LiveLink hash="" />}
      >
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Hero photo</span>
            <div className="group relative aspect-[16/9] overflow-hidden border rule bg-bone">
              {draft.hero.image ? (
                <>
                  <img src={draft.hero.image} alt="" className="h-full w-full object-cover" />
                  {/* The seam the live hero paints over the photo's left edge. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(to right, oklch(0.215 0.048 260 / 0.96) 0%, oklch(0.215 0.048 260 / 0.55) 26%, transparent 62%)',
                    }}
                  />
                </>
              ) : (
                <div className="grid h-full w-full place-items-center bg-blueprint">
                  <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-paper/60">Navy only</span>
                </div>
              )}
              <div
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 p-2 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100"
                style={{ background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.85), transparent)' }}
              >
                <TinyBtn onClick={() => setPickingHero(true)} tone="accent">
                  <IconPen size={11} /> {draft.hero.image ? 'Replace' : 'Add photo'}
                </TinyBtn>
                {draft.hero.image && (
                  <TinyBtn onClick={() => patch((c) => { c.hero.image = ''; })}>
                    <IconTrash size={11} /> Clear
                  </TinyBtn>
                )}
              </div>
            </div>
            <p className="mono truncate text-[9.5px] tracking-[0.06em] text-graphite" title={draft.hero.image}>
              {draft.hero.image || '— no photo —'}
            </p>
            <p className="text-[11.5px] leading-relaxed text-graphite">
              Fills the right panel on desktop and sits full-bleed behind the headline on mobile — both crop tall
              from the centre, so keep the subject off the far left where the navy seam falls.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
              <Field label="Eyebrow" value={draft.hero.eyebrow} max={60} onChange={(v) => patch((c) => { c.hero.eyebrow = v; })} />
              <Field label="Headline" value={draft.hero.title} max={60} onChange={(v) => patch((c) => { c.hero.title = v; })} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        code="Company overview"
        title="Overview prose"
        hint="The navy narrative section. An amber tick separates the paragraphs automatically."
      >
        <div className="flex flex-col gap-6">
          <Field label="Section heading" value={draft.overview.heading} max={120} onChange={(v) => patch((c) => { c.overview.heading = v; })} />
          <ParagraphList
            items={draft.overview.paragraphs}
            onChange={(v) => patch((c) => { c.overview.paragraphs = v; })}
          />
        </div>
      </Panel>

      <Panel
        code="Company overview"
        title="Company profile registry"
        hint="The label-and-value ledger beside the prose — established, membership, partners."
      >
        <PairList
          rows={draft.overview.profile}
          onChange={(v) => patch((c) => { c.overview.profile = v; })}
        />
      </Panel>

      <Panel
        code="Heritage"
        title="Timeline"
        hint="The year-by-year history ledger."
        actions={<LiveLink hash="#heritage" />}
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
            <Field label="Eyebrow" value={draft.heritage.eyebrow} max={60} onChange={(v) => patch((c) => { c.heritage.eyebrow = v; })} />
            <Field label="Section heading" value={draft.heritage.heading} max={120} onChange={(v) => patch((c) => { c.heritage.heading = v; })} />
          </div>
          <TimelineList
            rows={draft.heritage.timeline}
            onChange={(v) => patch((c) => { c.heritage.timeline = v; })}
          />
        </div>
      </Panel>

      <Panel
        code="Leadership"
        title="Roster heading"
        hint="The heading above the People of Regis cards. The cards themselves are managed in the team roster."
        actions={<LiveLink hash="#leadership" />}
      >
        <div className="flex flex-col gap-4">
          <Field label="Section heading" value={draft.leadership.heading} max={160} onChange={(v) => patch((c) => { c.leadership.heading = v; })} />
          <div>
            <TinyBtn onClick={onOpenRoster}>Manage the roster</TinyBtn>
          </div>
        </div>
      </Panel>

      <Panel
        code="Recognition"
        title="Awards"
        hint="Awarding organizations and their citations, in display order."
        actions={<LiveLink hash="#awards" />}
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
            <Field label="Eyebrow" value={draft.awards.eyebrow} max={60} onChange={(v) => patch((c) => { c.awards.eyebrow = v; })} />
            <Field label="Section heading" value={draft.awards.heading} max={160} onChange={(v) => patch((c) => { c.awards.heading = v; })} />
          </div>
          <AwardsEditor
            groups={draft.awards.groups}
            onChange={(v) => patch((c) => { c.awards.groups = v; })}
          />
        </div>
      </Panel>

      <ImagePicker
        open={pickingHero}
        title="About hero photo"
        usedBy="About page"
        scope="people"
        kind="photo"
        hint="JPG, PNG, WebP, or AVIF up to 8 MB. The hero crops tall, so a roomy landscape shot with headroom works best."
        onPick={(path) => patch((c) => { c.hero.image = path; })}
        onClose={() => setPickingHero(false)}
      />

      {/* Sticky save bar */}
      <AnimatePresence>
        {(dirty || saving || justSaved || Boolean(error)) && (
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
                    About page copy
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <BtnGhost onClick={() => { setError(null); setDraft(clone(aboutPage)); }}>Discard</BtnGhost>
                <BtnPrimary onClick={() => void save()} disabled={saving || !dirty}>
                  {saving ? 'Publishing…' : 'Save & publish'}
                </BtnPrimary>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Shared bits ───────────────────────────────────────────── */

const INPUT =
  'w-full border rule bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]';

function LiveLink({ hash }: { hash: string }) {
  return (
    <a
      href={`/about${hash}`}
      target="_blank"
      rel="noreferrer"
      className="mono inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
    >
      Live section <IconExternal size={11} />
    </a>
  );
}

function RowControls({
  index, count, onMove, onRemove, label,
}: {
  index: number; count: number; onMove: (dir: -1 | 1) => void; onRemove: () => void; label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <MiniBtn label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)}>
        <IconArrowUp size={13} />
      </MiniBtn>
      <MiniBtn label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
        <IconArrowDown size={13} />
      </MiniBtn>
      <MiniBtn label={`Remove ${label}`} danger onClick={onRemove}>
        <IconTrash size={13} />
      </MiniBtn>
    </div>
  );
}

function AddRow({ label, onAdd, count, max }: { label: string; onAdd: () => void; count: number; max: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <TinyBtn onClick={onAdd} disabled={count >= max}>
        <IconPlus size={12} /> {label}
      </TinyBtn>
      <span className="mono num text-[10px] uppercase tracking-[0.14em] text-graphite">{count} / {max}</span>
    </div>
  );
}

/* ── Overview paragraphs ───────────────────────────────────── */

function ParagraphList({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((para, i) => (
        <div key={i} className="border rule bg-white">
          <div className="flex items-center justify-between gap-3 border-b rule bg-bone px-3 py-1.5">
            <span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">Paragraph {i + 1}</span>
            <RowControls
              index={i}
              count={items.length}
              label={`paragraph ${i + 1}`}
              onMove={(dir) => onChange(move(items, i, i + dir))}
              onRemove={() => onChange(items.filter((_, x) => x !== i))}
            />
          </div>
          <div className="px-3.5 py-3.5">
            <Field label="Copy" value={para} max={2000} multiline rows={4} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
          </div>
        </div>
      ))}
      <AddRow label="Add paragraph" count={items.length} max={LIMITS.paragraphs} onAdd={() => onChange([...items, ''])} />
    </div>
  );
}

/* ── Company profile rows ──────────────────────────────────── */

function PairList({ rows, onChange }: { rows: AboutPair[]; onChange: (v: AboutPair[]) => void }) {
  const set = (i: number, p: Partial<AboutPair>) => onChange(rows.map((r, x) => (x === i ? { ...r, ...p } : r)));

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_1.6fr_auto]">
          <input
            value={row.label}
            onChange={(e) => set(i, { label: e.target.value })}
            placeholder="Label"
            aria-label={`Row ${i + 1} label`}
            className={INPUT}
          />
          <input
            value={row.value}
            onChange={(e) => set(i, { value: e.target.value })}
            placeholder="Value"
            aria-label={`Row ${i + 1} value`}
            className={`${INPUT} col-span-2 sm:col-span-1 sm:order-none order-3`}
          />
          <RowControls
            index={i}
            count={rows.length}
            label={`row ${i + 1}`}
            onMove={(dir) => onChange(move(rows, i, i + dir))}
            onRemove={() => onChange(rows.filter((_, x) => x !== i))}
          />
        </div>
      ))}
      <AddRow label="Add row" count={rows.length} max={LIMITS.profile} onAdd={() => onChange([...rows, { label: '', value: '' }])} />
    </div>
  );
}

/* ── Heritage timeline ─────────────────────────────────────── */

function TimelineList({ rows, onChange }: { rows: AboutTimelineEntry[]; onChange: (v: AboutTimelineEntry[]) => void }) {
  const set = (i: number, p: Partial<AboutTimelineEntry>) => onChange(rows.map((r, x) => (x === i ? { ...r, ...p } : r)));

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className="border rule bg-white">
          <div className="flex items-center justify-between gap-3 border-b rule bg-bone px-3 py-1.5">
            <span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">
              Milestone {String(i + 1).padStart(2, '0')}
            </span>
            <RowControls
              index={i}
              count={rows.length}
              label={`milestone ${i + 1}`}
              onMove={(dir) => onChange(move(rows, i, i + dir))}
              onRemove={() => onChange(rows.filter((_, x) => x !== i))}
            />
          </div>
          <div className="flex flex-col gap-2.5 px-3.5 py-3.5">
            <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
              <input value={row.year} onChange={(e) => set(i, { year: e.target.value })} placeholder="1999" aria-label="Year" className={`${INPUT} num`} />
              <input value={row.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Milestone title" aria-label="Title" className={INPUT} />
            </div>
            <input value={row.body} onChange={(e) => set(i, { body: e.target.value })} placeholder="One line on what happened." aria-label="Description" className={INPUT} />
          </div>
        </div>
      ))}
      <AddRow label="Add milestone" count={rows.length} max={LIMITS.timeline} onAdd={() => onChange([...rows, { year: '', title: '', body: '' }])} />
    </div>
  );
}

/* ── Awards ────────────────────────────────────────────────── */

function AwardsEditor({ groups, onChange }: { groups: AboutAwardGroup[]; onChange: (v: AboutAwardGroup[]) => void }) {
  const setGroup = (i: number, g: AboutAwardGroup) => onChange(groups.map((x, j) => (j === i ? g : x)));

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group, gi) => (
        <div key={gi} className="border rule bg-white">
          <div className="flex items-center justify-between gap-3 border-b rule bg-bone px-3 py-1.5">
            <span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">Organization {gi + 1}</span>
            <RowControls
              index={gi}
              count={groups.length}
              label={`organization ${gi + 1}`}
              onMove={(dir) => onChange(move(groups, gi, gi + dir))}
              onRemove={() => onChange(groups.filter((_, x) => x !== gi))}
            />
          </div>

          <div className="flex flex-col gap-4 px-3.5 py-3.5">
            <Field label="Awarding organization" value={group.org} max={120} size="sm" onChange={(v) => setGroup(gi, { ...group, org: v })} />

            <div className="flex flex-col gap-2">
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Awards</span>
              {group.items.map((item, ii) => (
                <div key={ii} className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => setGroup(gi, { ...group, items: group.items.map((x, j) => (j === ii ? { ...x, name: e.target.value } : x)) })}
                    placeholder="Award name"
                    aria-label={`Award ${ii + 1} name`}
                    className={INPUT}
                  />
                  <input
                    value={item.years}
                    onChange={(e) => setGroup(gi, { ...group, items: group.items.map((x, j) => (j === ii ? { ...x, years: e.target.value } : x)) })}
                    placeholder="Years"
                    aria-label={`Award ${ii + 1} years`}
                    className={`${INPUT} num`}
                  />
                  <RowControls
                    index={ii}
                    count={group.items.length}
                    label={`award ${ii + 1}`}
                    onMove={(dir) => setGroup(gi, { ...group, items: move(group.items, ii, ii + dir) })}
                    onRemove={() => setGroup(gi, { ...group, items: group.items.filter((_, x) => x !== ii) })}
                  />
                </div>
              ))}
              <AddRow
                label="Add award"
                count={group.items.length}
                max={LIMITS.items}
                onAdd={() => setGroup(gi, { ...group, items: [...group.items, { name: '', years: '' }] })}
              />
            </div>
          </div>
        </div>
      ))}
      <AddRow
        label="Add organization"
        count={groups.length}
        max={LIMITS.groups}
        onAdd={() => onChange([...groups, { org: '', items: [{ name: '', years: '' }] }])}
      />
    </div>
  );
}
