import type { ReactNode } from 'react';
import { Switch } from '../../ui';
import { IconExternal } from '../../icons';
import type { HomeCopy, HomeFeaturedNote, HomeNoteRow, HomeServiceRow, HomeStat } from '../../data';
import { Field, Panel, move } from '../../kit/parts';
import { AddRow, INPUT, LinkFields, ListHeader, PhotoTile, RowShell, type PickRequest } from './fields';

/* ─────────────────────────────────────────────────────────────
   One editor per landing-page section. Each owns its panel(s),
   carries the section's visibility switch in the panel header,
   and hands photo requests up to the module's single image picker.
   ───────────────────────────────────────────────────────────── */

type EditorProps<K extends keyof HomeCopy> = {
  value: HomeCopy[K];
  onChange: (next: HomeCopy[K]) => void;
  pick: (req: PickRequest) => void;
};

export const LIMITS = {
  stats: { min: 1, max: 6 },
  serviceRows: { min: 1, max: 8 },
  featured: { min: 0, max: 2 },
  noteRows: { min: 0, max: 6 },
} as const;

const BLANK_STAT: HomeStat = { value: 0, suffix: '', label: '' };
const BLANK_SERVICE: HomeServiceRow = { title: '', blurb: '', href: '', image: '' };
const BLANK_FEATURED: HomeFeaturedNote = { kicker: '', title: '', blurb: '', meta: '', href: '', image: '' };
const BLANK_NOTE: HomeNoteRow = { kicker: '', title: '', meta: '', href: '' };

/* ── Shared header bits ────────────────────────────────────── */

function Shown({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">{on ? 'Shown' : 'Hidden'}</span>
      <Switch on={on} onToggle={onToggle} label={on ? `Hide the ${label} section` : `Show the ${label} section`} />
    </div>
  );
}

function LiveLink() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      className="mono inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
    >
      Live page <IconExternal size={11} />
    </a>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-5">{children}</div>;
}

/** Trim-safe field setter for flat string keys. */
function setter<T extends object>(value: T, onChange: (next: T) => void) {
  return <K extends keyof T>(key: K) => (v: T[K]) => onChange({ ...value, [key]: v });
}

/* ── Hero ──────────────────────────────────────────────────── */

export function HeroEditor({ value, onChange, pick }: EditorProps<'hero'>) {
  const set = setter(value, onChange);
  return (
    <Panel
      code="/ · hero"
      title="Hero"
      hint="The full-height opener under the navbar. The headline reveals one line at a time, so line breaks here are the cut."
      actions={<Actions><LiveLink /><Shown on={value.enabled} onToggle={() => set('enabled')(!value.enabled)} label="hero" /></Actions>}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <PhotoTile
          image={value.image}
          aspect="16/9"
          label="Backdrop"
          empty="Navy blueprint only"
          onPick={() => pick({
            title: 'Hero backdrop',
            aspect: '16/9',
            hint: 'JPG, PNG, WebP, or AVIF up to 8 MB. A wide interior or skyline reads best; the navy wash sits over the left two-thirds.',
            onPick: set('image'),
          })}
          onClear={() => set('image')('')}
        />
        <div className="flex flex-col gap-5">
          <Field
            label="Eyebrow"
            value={value.eyebrow}
            max={80}
            onChange={set('eyebrow')}
            hint="Optional. The mono line above the headline."
          />
          <Field
            label="Headline"
            value={value.headline}
            max={200}
            multiline
            rows={3}
            onChange={set('headline')}
            hint="One reveal line per line. Three lines of two to four words each keep the page at its published rhythm."
          />
          <Field
            label="Standfirst"
            value={value.dek}
            max={400}
            multiline
            rows={3}
            onChange={set('dek')}
            hint="Optional. Leave it empty and the hero runs headline-only."
          />
        </div>
      </div>
    </Panel>
  );
}

/* ── Numbers ───────────────────────────────────────────────── */

export function NumbersEditor({ value, onChange }: EditorProps<'numbers'>) {
  const set = setter(value, onChange);
  const stats = value.stats;
  const setStat = (i: number, patch: Partial<HomeStat>) => set('stats')(stats.map((s, x) => (x === i ? { ...s, ...patch } : s)));

  return (
    <Panel
      code="/ · numbers"
      title="Numbers"
      hint="The firm-figures rail. Figures count up on scroll; the suffix is the small amber mark after the figure."
      actions={<Actions><LiveLink /><Shown on={value.enabled} onToggle={() => set('enabled')(!value.enabled)} label="numbers" /></Actions>}
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <Field label="Eyebrow" value={value.eyebrow} max={60} onChange={set('eyebrow')} hint="Optional." />
          <Field label="Heading" value={value.heading} max={120} onChange={set('heading')} />
        </div>
        <Field
          label="Intro"
          value={value.intro}
          max={600}
          multiline
          rows={3}
          onChange={set('intro')}
          hint="Optional. Sits to the right of the heading on a laptop. Leave it empty to run heading-only."
        />

        <div className="flex flex-col gap-3 border-t rule pt-5">
          <ListHeader label="Figures" count={stats.length} max={LIMITS.stats.max} min={LIMITS.stats.min} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {stats.map((s, i) => (
              <RowShell
                key={i}
                index={i}
                count={stats.length}
                label="figure"
                onMove={(d) => set('stats')(move(stats, i, i + d))}
                onRemove={() => set('stats')(stats.filter((_, x) => x !== i))}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Figure</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={999999}
                      value={Number.isFinite(s.value) ? s.value : ''}
                      onChange={(e) => setStat(i, { value: Math.max(0, Math.min(999999, Math.round(Number(e.target.value) || 0))) })}
                      aria-label={`Figure ${i + 1} value`}
                      className={`${INPUT} mono num`}
                    />
                  </div>
                  <Field label="Suffix" value={s.suffix} max={4} size="sm" placeholder="+" onChange={(v) => setStat(i, { suffix: v })} />
                </div>
                <Field label="Label" value={s.label} max={80} size="sm" placeholder="Years of partnership" onChange={(v) => setStat(i, { label: v })} />
              </RowShell>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <AddRow label="Add figure" disabled={stats.length >= LIMITS.stats.max} onAdd={() => set('stats')([...stats, { ...BLANK_STAT }])} />
            <p className="text-[11.5px] text-graphite">Four figures fill the rail on a laptop; fewer widen each cell.</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ── Services ──────────────────────────────────────────────── */

export function ServicesEditor({ value, onChange, pick }: EditorProps<'services'>) {
  const set = setter(value, onChange);
  const rows = value.rows;
  const setRow = (i: number, patch: Partial<HomeServiceRow>) => set('rows')(rows.map((r, x) => (x === i ? { ...r, ...patch } : r)));

  return (
    <>
      <Panel
        code="/ · services"
        title="Services index"
        hint="The navy practice index. Hovering a row floats its photo beside the cursor on a laptop."
        actions={<Actions><LiveLink /><Shown on={value.enabled} onToggle={() => set('enabled')(!value.enabled)} label="services" /></Actions>}
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field label="Eyebrow" value={value.eyebrow} max={60} onChange={set('eyebrow')} hint="Optional." />
            <Field label="Heading" value={value.heading} max={160} onChange={set('heading')} />
          </div>
          <div className="border-t rule pt-5">
            <div className="mono mb-3.5 text-[10px] uppercase tracking-[0.18em] text-graphite">Section link</div>
            <LinkFields link={value.cta} onChange={set('cta')} defaultHref="/services" />
          </div>
        </div>
      </Panel>

      <Panel code="/ · services · rows" title="Practice rows" hint="Title, one-line summary, where the row links, and the hover photo.">
        <div className="flex flex-col gap-3">
          <ListHeader label="Rows" count={rows.length} max={LIMITS.serviceRows.max} min={LIMITS.serviceRows.min} />
          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <RowShell
                key={i}
                index={i}
                count={rows.length}
                label="row"
                onMove={(d) => set('rows')(move(rows, i, i + d))}
                onRemove={() => set('rows')(rows.filter((_, x) => x !== i))}
                aside={
                  <PhotoTile
                    image={r.image}
                    aspect="4/5"
                    label="Hover photo"
                    empty="No hover photo"
                    onPick={() => pick({
                      title: `Hover photo · ${r.title || `row ${i + 1}`}`,
                      aspect: '4/5',
                      hint: 'Portrait crops at roughly 4:5 float beside the cursor. Up to 8 MB.',
                      onPick: (path) => setRow(i, { image: path }),
                    })}
                    onClear={() => setRow(i, { image: '' })}
                  />
                }
              >
                <Field label="Title" value={r.title} max={80} size="sm" placeholder="Research Advisory" onChange={(v) => setRow(i, { title: v })} />
                <Field label="Summary" value={r.blurb} max={160} size="sm" placeholder="Original equity research across 120+ PSE names" onChange={(v) => setRow(i, { blurb: v })} />
                <div className="flex flex-col gap-1.5">
                  <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Links to</label>
                  <input
                    value={r.href}
                    list="home-site-routes"
                    placeholder="/services"
                    spellCheck={false}
                    onChange={(e) => setRow(i, { href: e.target.value })}
                    aria-label={`Row ${i + 1} link path`}
                    className={`${INPUT} mono`}
                  />
                </div>
              </RowShell>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <AddRow label="Add row" disabled={rows.length >= LIMITS.serviceRows.max} onAdd={() => set('rows')([...rows, { ...BLANK_SERVICE }])} />
            <p className="text-[11.5px] text-graphite">An empty link path sends the row to /services.</p>
          </div>
        </div>
      </Panel>
    </>
  );
}

/* ── Insights ──────────────────────────────────────────────── */

export function InsightsEditor({ value, onChange, pick }: EditorProps<'insights'>) {
  const set = setter(value, onChange);
  const featured = value.featured;
  const rows = value.rows;
  const setFeatured = (i: number, patch: Partial<HomeFeaturedNote>) => set('featured')(featured.map((f, x) => (x === i ? { ...f, ...patch } : f)));
  const setRow = (i: number, patch: Partial<HomeNoteRow>) => set('rows')(rows.map((r, x) => (x === i ? { ...r, ...patch } : r)));

  return (
    <>
      <Panel
        code="/ · insights"
        title="Insights"
        hint="The research block on paper: two featured notes with photography, then a ruled ledger of further reading."
        actions={<Actions><LiveLink /><Shown on={value.enabled} onToggle={() => set('enabled')(!value.enabled)} label="insights" /></Actions>}
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field label="Eyebrow" value={value.eyebrow} max={60} onChange={set('eyebrow')} hint="Optional." />
            <Field label="Heading" value={value.heading} max={120} onChange={set('heading')} />
          </div>
          <Field
            label="Intro"
            value={value.intro}
            max={600}
            multiline
            rows={3}
            onChange={set('intro')}
            hint="Optional. Sits to the right of the heading with the section link under it."
          />
          <div className="border-t rule pt-5">
            <div className="mono mb-3.5 text-[10px] uppercase tracking-[0.18em] text-graphite">Section link</div>
            <LinkFields link={value.cta} onChange={set('cta')} defaultHref="/insights" />
          </div>
        </div>
      </Panel>

      <Panel code="/ · insights · featured" title="Featured notes" hint="Up to two, side by side, each with a 16:9 photograph.">
        <div className="flex flex-col gap-3">
          <ListHeader label="Featured" count={featured.length} max={LIMITS.featured.max} />
          <ul className="flex flex-col gap-3">
            {featured.map((f, i) => (
              <RowShell
                key={i}
                index={i}
                count={featured.length}
                label="note"
                onMove={(d) => set('featured')(move(featured, i, i + d))}
                onRemove={() => set('featured')(featured.filter((_, x) => x !== i))}
                aside={
                  <PhotoTile
                    image={f.image}
                    aspect="16/9"
                    label="Photo"
                    empty="No photo"
                    onPick={() => pick({
                      title: `Featured note photo · ${i + 1}`,
                      aspect: '16/9',
                      hint: 'Landscape crops at roughly 16:9. Up to 8 MB.',
                      onPick: (path) => setFeatured(i, { image: path }),
                    })}
                    onClear={() => setFeatured(i, { image: '' })}
                  />
                }
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <Field label="Kicker" value={f.kicker} max={60} size="sm" placeholder="The Big Picture" onChange={(v) => setFeatured(i, { kicker: v })} />
                  <Field label="Dateline" value={f.meta} max={60} size="sm" placeholder="24 AUG 2026 · 6 MIN READ" onChange={(v) => setFeatured(i, { meta: v })} />
                </div>
                <Field label="Title" value={f.title} max={160} size="sm" onChange={(v) => setFeatured(i, { title: v })} />
                <Field label="Summary" value={f.blurb} max={400} multiline rows={2} onChange={(v) => setFeatured(i, { blurb: v })} />
                <div className="flex flex-col gap-1.5">
                  <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Links to</label>
                  <input
                    value={f.href}
                    list="home-site-routes"
                    placeholder="/insights"
                    spellCheck={false}
                    onChange={(e) => setFeatured(i, { href: e.target.value })}
                    aria-label={`Featured note ${i + 1} link path`}
                    className={`${INPUT} mono`}
                  />
                </div>
              </RowShell>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <AddRow label="Add note" disabled={featured.length >= LIMITS.featured.max} onAdd={() => set('featured')([...featured, { ...BLANK_FEATURED }])} />
            <p className="text-[11.5px] text-graphite">With none, the ledger below opens the block.</p>
          </div>
        </div>
      </Panel>

      <Panel code="/ · insights · ledger" title="Further reading" hint="The ruled rows under the featured pair. Kicker, title, dateline.">
        <div className="flex flex-col gap-3">
          <ListHeader label="Rows" count={rows.length} max={LIMITS.noteRows.max} />
          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <RowShell
                key={i}
                index={i}
                count={rows.length}
                label="row"
                onMove={(d) => set('rows')(move(rows, i, i + d))}
                onRemove={() => set('rows')(rows.filter((_, x) => x !== i))}
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <Field label="Kicker" value={r.kicker} max={60} size="sm" placeholder="PSE Desk" onChange={(v) => setRow(i, { kicker: v })} />
                  <Field label="Dateline" value={r.meta} max={60} size="sm" placeholder="02 JUL 2026 · 4 MIN READ" onChange={(v) => setRow(i, { meta: v })} />
                  <div className="flex flex-col gap-1.5">
                    <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Links to</label>
                    <input
                      value={r.href}
                      list="home-site-routes"
                      placeholder="/insights"
                      spellCheck={false}
                      onChange={(e) => setRow(i, { href: e.target.value })}
                      aria-label={`Ledger row ${i + 1} link path`}
                      className={`${INPUT} mono py-2 text-[13px]`}
                    />
                  </div>
                </div>
                <Field label="Title" value={r.title} max={200} size="sm" onChange={(v) => setRow(i, { title: v })} />
              </RowShell>
            ))}
          </ul>
          <AddRow label="Add row" disabled={rows.length >= LIMITS.noteRows.max} onAdd={() => set('rows')([...rows, { ...BLANK_NOTE }])} />
        </div>
      </Panel>
    </>
  );
}

/* ── Story panels ──────────────────────────────────────────── */

export function CultureEditor({ value, onChange, pick }: EditorProps<'culture'>) {
  const set = setter(value, onChange);
  return (
    <Panel
      code="/ · our story"
      title="Our story"
      hint="Full-bleed photograph with the navy block riding over its left edge."
      actions={<Actions><LiveLink /><Shown on={value.enabled} onToggle={() => set('enabled')(!value.enabled)} label="story" /></Actions>}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <PhotoTile
            image={value.image}
            aspect="16/9"
            label="Photograph"
            onPick={() => pick({
              title: 'Our story photograph',
              aspect: '16/9',
              hint: 'The navy block covers the left 42% on a laptop, so keep the subject right of centre.',
              onPick: set('image'),
            })}
            onClear={() => set('image')('')}
          />
          <Field label="Photo description" value={value.imageAlt} max={160} size="sm" onChange={set('imageAlt')} hint="Read by screen readers in place of the photo." />
        </div>
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field label="Eyebrow" value={value.eyebrow} max={60} onChange={set('eyebrow')} hint="Optional." />
            <Field label="Heading" value={value.heading} max={160} multiline rows={2} onChange={set('heading')} />
          </div>
          <div className="border-t rule pt-5">
            <div className="mono mb-3.5 text-[10px] uppercase tracking-[0.18em] text-graphite">Panel link</div>
            <LinkFields link={value.cta} onChange={set('cta')} defaultHref="/about" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function CommunityEditor({ value, onChange, pick }: EditorProps<'community'>) {
  const set = setter(value, onChange);
  return (
    <Panel
      code="/ · community"
      title="People & community"
      hint="The mirror of Our story: photograph bleeding left, bronze block over its right edge."
      actions={<Actions><LiveLink /><Shown on={value.enabled} onToggle={() => set('enabled')(!value.enabled)} label="community" /></Actions>}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <PhotoTile
            image={value.image}
            aspect="16/9"
            label="Photograph"
            onPick={() => pick({
              title: 'Community photograph',
              aspect: '16/9',
              hint: 'The bronze block covers the right 42% on a laptop, so keep the subject left of centre.',
              onPick: set('image'),
            })}
            onClear={() => set('image')('')}
          />
          <Field label="Photo description" value={value.imageAlt} max={160} size="sm" onChange={set('imageAlt')} hint="Read by screen readers in place of the photo." />
        </div>
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field label="Eyebrow" value={value.eyebrow} max={60} onChange={set('eyebrow')} hint="Optional." />
            <Field label="Heading" value={value.heading} max={160} multiline rows={2} onChange={set('heading')} />
          </div>
          <Field label="Body" value={value.body} max={500} multiline rows={3} onChange={set('body')} hint="Optional. The paragraph under the heading inside the bronze block." />
          <div className="border-t rule pt-5">
            <div className="mono mb-3.5 text-[10px] uppercase tracking-[0.18em] text-graphite">Panel link</div>
            <LinkFields link={value.cta} onChange={set('cta')} defaultHref="/about" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ── Quote ─────────────────────────────────────────────────── */

export function QuoteEditor({ value, onChange, pick }: EditorProps<'quote'>) {
  const set = setter(value, onChange);
  return (
    <Panel
      code="/ · president"
      title="A word from the President"
      hint="The portrait sits right and fades into navy on the left; the quote is set in curly quotes automatically."
      actions={<Actions><LiveLink /><Shown on={value.enabled} onToggle={() => set('enabled')(!value.enabled)} label="quote" /></Actions>}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <PhotoTile
          image={value.image}
          aspect="16/9"
          label="Portrait"
          empty="Navy only"
          objectPosition="right center"
          onPick={() => pick({
            title: 'President portrait',
            aspect: '16/9',
            kind: 'portrait',
            hint: 'The portrait anchors right; the left half is washed to navy for the quote. Up to 8 MB.',
            onPick: set('image'),
          })}
          onClear={() => set('image')('')}
        />
        <div className="flex flex-col gap-5">
          <Field label="Eyebrow" value={value.eyebrow} max={60} onChange={set('eyebrow')} hint="Optional." />
          <Field label="Quote" value={value.quote} max={500} multiline rows={4} onChange={set('quote')} hint="Without the quotation marks; the page adds them." />
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Name" value={value.name} max={80} onChange={set('name')} />
            <Field label="Title" value={value.role} max={80} onChange={set('role')} hint="Set in small caps under the name." />
          </div>
          <div className="border-t rule pt-5">
            <div className="mono mb-3.5 text-[10px] uppercase tracking-[0.18em] text-graphite">Footer link</div>
            <LinkFields link={value.cta} onChange={set('cta')} defaultHref="/about#leadership" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ── Careers ───────────────────────────────────────────────── */

export function CareersEditor({ value, onChange, pick }: EditorProps<'careers'>) {
  const set = setter(value, onChange);
  return (
    <Panel
      code="/ · careers"
      title="Careers"
      hint="The closing banner: a navy panel with the photograph rising past its top edge."
      actions={<Actions><LiveLink /><Shown on={value.enabled} onToggle={() => set('enabled')(!value.enabled)} label="careers" /></Actions>}
    >
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <PhotoTile
            image={value.image}
            aspect="4/4.5"
            label="Photograph"
            empty="Copy runs full width"
            onPick={() => pick({
              title: 'Careers photograph',
              aspect: '4/4.5',
              hint: 'A near-square portrait crop rises out of the navy panel. Up to 8 MB.',
              onPick: set('image'),
            })}
            onClear={() => set('image')('')}
          />
          <Field label="Photo description" value={value.imageAlt} max={160} size="sm" onChange={set('imageAlt')} hint="Read by screen readers in place of the photo." />
        </div>
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field label="Eyebrow" value={value.eyebrow} max={60} onChange={set('eyebrow')} hint="Optional." />
            <Field label="Heading" value={value.heading} max={120} onChange={set('heading')} />
          </div>
          <Field label="Body" value={value.body} max={500} multiline rows={3} onChange={set('body')} hint="Optional." />
          <div className="border-t rule pt-5">
            <div className="mono mb-3.5 text-[10px] uppercase tracking-[0.18em] text-graphite">Banner link</div>
            <LinkFields link={value.cta} onChange={set('cta')} defaultHref="/contact" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
