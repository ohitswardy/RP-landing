import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { HOME_SECTIONS, headlineLines, type HomeCopy, type HomeSectionKey } from '../../data';

/* ─────────────────────────────────────────────────────────────
   A miniature of the whole landing page, driven by the draft.
   Every section is redrawn at the same proportions as the live
   composition — navy over the lobby photo, the numeral rail, the
   ruled indices, the two offset story panels, the portrait quote,
   the careers banner — so copy is judged where it will sit. Type
   is sized against the frame (cqw) so the miniature keeps its
   proportions at any preview width. Click a section to edit it.
   ───────────────────────────────────────────────────────────── */

const HERO_WASH =
  'linear-gradient(to right, oklch(0.14 0.040 260 / 0.94) 0%, oklch(0.14 0.040 260 / 0.76) 55%, oklch(0.14 0.040 260 / 0.50) 100%)';
const FOOT_WASH = 'linear-gradient(to top, oklch(0.10 0.036 260 / 0.95) 0%, transparent 100%)';
const QUOTE_WASH =
  'linear-gradient(to right, oklch(0.165 0.040 260 / 0.85) 0%, oklch(0.165 0.040 260 / 0.55) 50%, oklch(0.165 0.040 260 / 0.10) 100%)';

/** Container-relative type. `cqw` keeps the ratio to the frame; clamps keep it legible. */
const t = (cqw: number, min: number, max: number): CSSProperties => ({ fontSize: `clamp(${min}px, ${cqw}cqw, ${max}px)` });

const EYEBROW: CSSProperties = { ...t(1.9, 6, 9), letterSpacing: '0.2em', textTransform: 'uppercase' };

function Eyebrow({ text, paper = false }: { text: string; paper?: boolean }) {
  if (!text) return null;
  return (
    <div
      className="mono flex items-center gap-[1.6cqw]"
      style={{ ...EYEBROW, color: paper ? 'color-mix(in oklab, var(--color-paper) 75%, transparent)' : 'var(--color-slate)' }}
    >
      <span aria-hidden className="block h-px w-[4cqw]" style={{ background: 'var(--color-amber)' }} />
      {text}
    </div>
  );
}

function Cta({ label, paper = false }: { label: string; paper?: boolean }) {
  if (!label) return null;
  return (
    <div className={`flex items-center gap-[1.6cqw] ${paper ? 'text-paper' : 'text-ink'}`} style={t(2.2, 7, 11)}>
      {label}
      <span aria-hidden className="block h-px w-[5cqw]" style={{ background: 'var(--color-amber)' }} />
    </div>
  );
}

function Photo({ src, position = 'center', className = '' }: { src: string; position?: string; className?: string }) {
  if (!src) return null;
  return <img src={src} alt="" aria-hidden className={`absolute inset-0 h-full w-full object-cover ${className}`} style={{ objectPosition: position }} />;
}

/* ── Sections ──────────────────────────────────────────────── */

function Hero({ c }: { c: HomeCopy['hero'] }) {
  const lines = headlineLines(c.headline);
  return (
    <div className={`relative overflow-hidden text-paper ${c.image ? 'bg-navy' : 'bg-blueprint'}`} style={{ aspectRatio: '16 / 9' }}>
      <Photo src={c.image} />
      <div aria-hidden className="absolute inset-0" style={{ background: HERO_WASH }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[38%]" style={{ background: FOOT_WASH }} />
      <div className="absolute inset-0 flex flex-col justify-center px-[6cqw] pb-[5cqw]">
        {c.eyebrow && <div className="mb-[3.2cqw]"><Eyebrow text={c.eyebrow} paper /></div>}
        <div className="font-medium" style={{ ...t(5.4, 14, 44), lineHeight: 1.02, letterSpacing: '-0.028em', maxWidth: '18ch' }}>
          {lines.length > 0 ? lines.map((l, i) => <span key={i} className="block">{l}</span>) : <span className="text-paper/35">Headline</span>}
        </div>
        {c.dek && (
          <p className="mt-[3cqw] text-paper/70" style={{ ...t(2.1, 7, 12), lineHeight: 1.6, maxWidth: '54ch' }}>{c.dek}</p>
        )}
      </div>
    </div>
  );
}

function Numbers({ c }: { c: HomeCopy['numbers'] }) {
  const n = c.stats.length;
  const cols = n >= 4 ? 4 : Math.max(1, n);
  return (
    <div className="bg-paper px-[6cqw] py-[7cqw] text-ink">
      <div className="grid grid-cols-12 gap-x-[2cqw]">
        <div className="col-span-5">
          {c.eyebrow && <div className="mb-[2cqw]"><Eyebrow text={c.eyebrow} /></div>}
          <h3 style={{ ...t(3.4, 11, 26), lineHeight: 1.08, letterSpacing: '-0.022em', maxWidth: '14ch' }}>{c.heading || <span className="text-silver">Heading</span>}</h3>
        </div>
        {c.intro && (
          <p className="col-span-6 col-start-7 text-slate" style={{ ...t(1.9, 7, 11), lineHeight: 1.6 }}>{c.intro}</p>
        )}
      </div>
      {n > 0 && (
        <div className="mt-[5cqw] grid border-t rule" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {c.stats.map((s, i) => (
            <div key={i} className={`py-[3.5cqw] pr-[2cqw] ${i % cols !== 0 ? 'border-l rule pl-[2.4cqw]' : ''} ${i >= cols ? 'border-t rule' : ''}`}>
              <div className="mono num font-medium" style={{ ...t(6.2, 16, 46), lineHeight: 1, letterSpacing: '-0.03em' }}>
                {s.value}
                {s.suffix && <span style={{ fontSize: '0.45em', color: 'var(--color-amber-deep)', verticalAlign: '0.55em' }}>{s.suffix}</span>}
              </div>
              <div className="mt-[2cqw] text-graphite"><Eyebrow text={s.label || '—'} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Services({ c }: { c: HomeCopy['services'] }) {
  return (
    <div className="bg-navy px-[6cqw] py-[7cqw] text-paper">
      <div className="mb-[4.5cqw] flex items-end justify-between gap-[3cqw]">
        <div>
          {c.eyebrow && <div className="mb-[2cqw]"><Eyebrow text={c.eyebrow} paper /></div>}
          <h3 style={{ ...t(3.8, 12, 30), lineHeight: 1.06, letterSpacing: '-0.024em', maxWidth: '20ch' }}>{c.heading || <span className="text-paper/35">Heading</span>}</h3>
        </div>
        <Cta label={c.cta.label} paper />
      </div>
      <ul className="border-t" style={{ borderColor: 'var(--color-navy-line)' }}>
        {c.rows.map((r, i) => (
          <li key={i} className="grid grid-cols-12 items-baseline gap-x-[1.5cqw] border-b py-[2.4cqw]" style={{ borderColor: 'var(--color-navy-line)' }}>
            <span className="mono num col-span-1 text-paper/35" style={t(1.8, 6, 9)}>{String(i + 1).padStart(2, '0')}</span>
            <span className="col-span-6 font-medium" style={{ ...t(2.9, 9, 20), lineHeight: 1.1, letterSpacing: '-0.02em' }}>{r.title || <span className="text-paper/35">Untitled</span>}</span>
            <span className="col-span-4 text-paper/55" style={{ ...t(1.9, 7, 11), lineHeight: 1.45 }}>{r.blurb}</span>
            <span className="col-span-1 text-right text-paper/45" style={t(2.2, 7, 12)}>↗</span>
          </li>
        ))}
        {c.rows.length === 0 && <li className="py-[4cqw] text-center text-paper/45" style={t(2, 8, 11)}>No rows yet. The index would render empty.</li>}
      </ul>
    </div>
  );
}

function Insights({ c }: { c: HomeCopy['insights'] }) {
  const aside = Boolean(c.intro || c.cta.label);
  return (
    <div className="bg-paper px-[6cqw] py-[7cqw] text-ink">
      <div className={`grid grid-cols-12 gap-x-[2cqw] ${c.featured.length || c.rows.length ? 'mb-[4.5cqw]' : ''}`}>
        <div className="col-span-5">
          {c.eyebrow && <div className="mb-[2cqw]"><Eyebrow text={c.eyebrow} /></div>}
          <h3 style={{ ...t(3.8, 12, 30), lineHeight: 1.06, letterSpacing: '-0.024em', maxWidth: '12ch' }}>{c.heading || <span className="text-silver">Heading</span>}</h3>
        </div>
        {aside && (
          <div className="col-span-6 col-start-7 flex flex-col gap-[2cqw]">
            {c.intro && <p className="text-slate" style={{ ...t(1.9, 7, 11), lineHeight: 1.6 }}>{c.intro}</p>}
            <Cta label={c.cta.label} />
          </div>
        )}
      </div>

      {c.featured.length > 0 && (
        <div className="grid grid-cols-2 gap-x-[2cqw] gap-y-[3cqw]">
          {c.featured.map((f, i) => (
            <article key={i}>
              <div className="relative overflow-hidden bg-bone" style={{ aspectRatio: '16 / 9' }}><Photo src={f.image} /></div>
              {f.kicker && <div className="mt-[2.2cqw]"><Eyebrow text={f.kicker} /></div>}
              <h4 className="mt-[1cqw]" style={{ ...t(2.4, 8, 16), lineHeight: 1.25, letterSpacing: '-0.016em' }}>{f.title || <span className="text-silver">Untitled</span>}</h4>
              {f.blurb && <p className="mt-[1cqw] text-slate" style={{ ...t(1.8, 6.5, 10), lineHeight: 1.6 }}>{f.blurb}</p>}
              {f.meta && <div className="mono num mt-[1.4cqw] text-graphite" style={{ ...t(1.5, 5.5, 8), letterSpacing: '0.18em' }}>{f.meta}</div>}
            </article>
          ))}
        </div>
      )}

      {c.rows.length > 0 && (
        <ul className={`border-t rule ${c.featured.length ? 'mt-[5cqw]' : ''}`}>
          {c.rows.map((r, i) => (
            <li key={i} className="grid grid-cols-12 items-baseline gap-x-[1.5cqw] border-b rule py-[2.2cqw]">
              <span className="mono col-span-3 uppercase text-graphite" style={{ ...t(1.5, 5.5, 8), letterSpacing: '0.16em' }}>{r.kicker}</span>
              <span className="col-span-6" style={{ ...t(2.1, 7.5, 12), lineHeight: 1.4, letterSpacing: '-0.012em' }}>{r.title || <span className="text-silver">Untitled</span>}</span>
              <span className="mono num col-span-2 text-graphite" style={{ ...t(1.5, 5.5, 8), letterSpacing: '0.14em' }}>{r.meta}</span>
              <span className="col-span-1 text-right text-graphite" style={t(2, 7, 11)}>↗</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StoryPanel({ c, side, tone }: {
  c: { eyebrow: string; heading: string; body?: string; cta: HomeCopy['culture']['cta']; image: string };
  side: 'left' | 'right';
  tone: 'navy' | 'bronze';
}) {
  const photoInset = side === 'left' ? { marginLeft: '28%' } : { marginRight: '28%' };
  const blockSide = side === 'left' ? { left: 0 } : { right: 0 };
  return (
    <div className={`bg-paper px-[6cqw] ${side === 'left' ? 'pt-[7cqw] pb-[1.2cqw]' : 'pt-[1.2cqw] pb-[7cqw]'}`}>
      <div className="relative">
        <div className="relative overflow-hidden bg-bone" style={{ aspectRatio: '16 / 9', ...photoInset }}>
          <Photo src={c.image} />
        </div>
        <div
          className={`absolute top-[9%] flex min-h-[82%] w-[42%] flex-col justify-center px-[3.6cqw] py-[3cqw] text-paper ${tone === 'navy' ? 'bg-navy-deep' : 'bg-bronze'}`}
          style={blockSide}
        >
          {c.eyebrow && <div className="mb-[2cqw]"><Eyebrow text={c.eyebrow} paper /></div>}
          <h3 style={{ ...t(2.7, 9, 22), lineHeight: 1.12, letterSpacing: '-0.02em', maxWidth: '20ch' }}>{c.heading || <span className="text-paper/35">Heading</span>}</h3>
          {c.body && <p className="mt-[1.8cqw] text-paper/75" style={{ ...t(1.7, 6, 10), lineHeight: 1.6, maxWidth: '42ch' }}>{c.body}</p>}
          {c.cta.label && <div className="mt-[2.4cqw]"><Cta label={c.cta.label} paper /></div>}
        </div>
      </div>
    </div>
  );
}

function Quote({ c }: { c: HomeCopy['quote'] }) {
  const signature = Boolean(c.name || c.role);
  return (
    <div className="relative overflow-hidden bg-navy-deep px-[6cqw] py-[8cqw] text-paper">
      <Photo src={c.image} position="right center" />
      <div aria-hidden className="absolute inset-0" style={{ background: QUOTE_WASH }} />
      <div className="relative">
        {c.eyebrow && <div className="mb-[3cqw]"><Eyebrow text={c.eyebrow} paper /></div>}
        <blockquote className="font-medium" style={{ ...t(3.3, 10, 26), lineHeight: 1.15, letterSpacing: '-0.024em', maxWidth: '38ch' }}>
          “{c.quote || <span className="text-paper/35">Quote</span>}”
        </blockquote>
        {(signature || c.cta.label) && (
          <div className="mt-[4cqw] flex flex-wrap items-center gap-x-[6cqw] gap-y-[2cqw]">
            {signature && (
              <div className="flex items-center gap-[1.6cqw]">
                <span aria-hidden className="block h-px w-[3cqw]" style={{ background: 'var(--color-amber)' }} />
                <div>
                  {c.name && <div style={t(2, 7, 12)}>{c.name}</div>}
                  {c.role && <div className="mono uppercase text-paper/55" style={{ ...t(1.5, 5.5, 8), letterSpacing: '0.16em' }}>{c.role}</div>}
                </div>
              </div>
            )}
            <Cta label={c.cta.label} paper />
          </div>
        )}
      </div>
    </div>
  );
}

function Careers({ c }: { c: HomeCopy['careers'] }) {
  return (
    <div className="bg-bone px-[6cqw] py-[7cqw]">
      <div className="relative mr-[6%] bg-navy text-paper">
        <div className="grid grid-cols-12 items-end gap-x-[2cqw]">
          <div className={`px-[4cqw] py-[5cqw] ${c.image ? 'col-span-7' : 'col-span-9'}`}>
            {c.eyebrow && <div className="mb-[2cqw]"><Eyebrow text={c.eyebrow} paper /></div>}
            <h3 style={{ ...t(3.2, 10, 24), lineHeight: 1.08, letterSpacing: '-0.02em', maxWidth: '16ch' }}>{c.heading || <span className="text-paper/35">Heading</span>}</h3>
            {c.body && <p className="mt-[1.8cqw] text-paper/68" style={{ ...t(1.8, 6.5, 10.5), lineHeight: 1.65, maxWidth: '46ch' }}>{c.body}</p>}
            {c.cta.label && <div className="mt-[3cqw]"><Cta label={c.cta.label} paper /></div>}
          </div>
          {c.image && (
            <div className="col-span-4 col-start-9 self-end">
              <div className="relative -mt-[4cqw] overflow-hidden bg-bone" style={{ aspectRatio: '4 / 4.5' }}><Photo src={c.image} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Frame ─────────────────────────────────────────────────── */

function Section({
  meta, on, hidden, onSelect, children, refCb,
}: {
  meta: { key: HomeSectionKey; label: string };
  on: boolean;
  hidden: boolean;
  onSelect: () => void;
  children: ReactNode;
  refCb: (el: HTMLDivElement | null) => void;
}) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
  };

  return (
    <div
      ref={refCb}
      role="button"
      tabIndex={0}
      aria-pressed={on}
      aria-label={`Edit the ${meta.label} section`}
      onClick={onSelect}
      onKeyDown={onKey}
      className="group relative cursor-pointer outline-none"
    >
      {hidden ? (
        <div className="flex items-center justify-between gap-3 border-y border-dashed rule bg-bone/60 px-4 py-2.5">
          {/* The editing tag names the section when it is selected, so the strip's own label steps aside. */}
          <span className={`mono text-[9.5px] uppercase tracking-[0.16em] text-graphite ${on ? 'invisible' : ''}`}>{meta.label} · hidden</span>
          <span className="mono text-[9px] uppercase tracking-[0.14em] text-silver">Left out of the page</span>
        </div>
      ) : children}

      {/* Selection ring and label; hover shows a fainter ring. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-[box-shadow] duration-300 ${
          on ? '' : 'group-hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-amber-deep)_55%,transparent)] group-focus-visible:shadow-[inset_0_0_0_2px_var(--color-amber-deep)]'
        }`}
        style={on ? { boxShadow: 'inset 0 0 0 2px var(--color-amber-deep)' } : undefined}
      />
      {on && (
        <span
          aria-hidden
          className="mono pointer-events-none absolute left-0 top-0 px-2 py-1 text-[8.5px] uppercase tracking-[0.16em] text-paper"
          style={{ background: 'var(--color-amber-deep)' }}
        >
          Editing · {meta.label}
        </span>
      )}
    </div>
  );
}

export default function HomePreview({
  copy, selected, onSelect,
}: {
  copy: HomeCopy;
  selected: HomeSectionKey;
  onSelect: (key: HomeSectionKey) => void;
}) {
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const nodes = useRef<Partial<Record<HomeSectionKey, HTMLDivElement | null>>>({});

  // Bring the section being edited into the frame if it is out of view.
  useEffect(() => {
    const box = scroller.current;
    const el = nodes.current[selected];
    if (!box || !el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    const viewTop = box.scrollTop;
    const viewBottom = viewTop + box.clientHeight;
    if (top >= viewTop && bottom <= viewBottom) return;
    box.scrollTo({ top: Math.max(0, top - 8), behavior: reduce ? 'auto' : 'smooth' });
  }, [selected, reduce]);

  const render = (key: HomeSectionKey): ReactNode => {
    switch (key) {
      case 'hero': return <Hero c={copy.hero} />;
      case 'numbers': return <Numbers c={copy.numbers} />;
      case 'services': return <Services c={copy.services} />;
      case 'insights': return <Insights c={copy.insights} />;
      case 'culture': return <StoryPanel c={copy.culture} side="left" tone="navy" />;
      case 'community': return <StoryPanel c={copy.community} side="right" tone="bronze" />;
      case 'quote': return <Quote c={copy.quote} />;
      case 'careers': return <Careers c={copy.careers} />;
    }
  };

  return (
    <div className="overflow-hidden border rule bg-paper">
      <div className="flex items-center gap-2.5 border-b rule bg-bone px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-silver)' }} />
          ))}
        </span>
        <span className="mono truncate text-[9.5px] tracking-[0.1em] text-graphite">regispartners.com/</span>
        <span className="mono ml-auto shrink-0 text-[9px] uppercase tracking-[0.14em] text-silver">Not to scale</span>
      </div>
      <div
        ref={scroller}
        className="relative max-h-[calc(100dvh-var(--cms-header-h,64px)-150px)] min-h-[320px] overflow-y-auto"
        style={{ containerType: 'inline-size', scrollbarGutter: 'stable' }}
      >
        {HOME_SECTIONS.map((s) => (
          <Section
            key={s.key}
            meta={s}
            on={s.key === selected}
            hidden={!copy[s.key].enabled}
            onSelect={() => onSelect(s.key)}
            refCb={(el) => { nodes.current[s.key] = el; }}
          >
            {render(s.key)}
          </Section>
        ))}
      </div>
    </div>
  );
}
