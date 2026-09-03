import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCms } from '../../store';
import { BtnGhost, BtnPrimary, EASE, useConfirm } from '../../ui';
import { Field, MiniBtn, TinyBtn, move } from '../../kit/parts';
import ImagePicker from '../../kit/ImagePicker';
import RichTextField from '../../kit/RichTextField';
import { plainToHtml } from '../../kit/textFormat';
import { usePublishedHeight } from '../../kit/stickyOffset';
import {
  IconArrowDown, IconArrowUp, IconCheck, IconImage, IconPlus, IconTrash, IconX,
} from '../../icons';
import {
  BLANK_RAIL_BLOCK, NEWSLETTER_BADGES, defaultNewsletterSubject, railBlock,
  type NewsletterCadence, type NewsletterIssue, type NewsletterRailBlock, type NewsletterSection,
} from '../../data';
import TemplatePreview from './TemplatePreview';

type DraftSection = NewsletterSection & { uid: string };

const BLANK_SECTION = (): DraftSection => ({
  uid: crypto.randomUUID(), badge: '', title: '', body: '', aside: '', images: [],
});

const CADENCE_LABEL: Record<NewsletterCadence, string> = {
  daily: 'daily', weekly: 'weekly', monthly: 'monthly',
};

/**
 * Full-width issue composer: structured editor on the left, the client's
 * mailer template rendering live on the right. Replaces the list while
 * open; `editingId` null means a new issue (possibly seeded from a copy).
 */
export default function IssueComposer({
  cadence, editingId, base, onClose,
}: {
  cadence: NewsletterCadence;
  editingId: string | null;
  base: NewsletterIssue | null;
  onClose: () => void;
}) {
  const { createNewsletter, updateNewsletter } = useCms();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(base && editingId ? base.date : today);
  const [subject, setSubject] = useState(() =>
    base && editingId ? base.subject : defaultNewsletterSubject(cadence, today));
  // The subject keeps following the date until the editor types their own.
  const [autoName, setAutoName] = useState(!editingId);
  const [intro, setIntro] = useState(base?.intro ?? '');
  const [sections, setSections] = useState<DraftSection[]>(() =>
    (base?.sections ?? []).map((s) => ({ ...s, uid: crypto.randomUUID() })));
  const [rail, setRail] = useState<NewsletterRailBlock[]>(() => (base?.rail ?? []).map(railBlock));
  // A `rail:<index>` value picks that rail block's graphic; anything
  // else is a section uid picking one of its charts.
  const [picking, setPicking] = useState<string | null>(null);
  // Sections append to the bottom, which is off-screen once the issue is long,
  // so a new one is scrolled to instead of silently landing below the fold.
  const [focus, setFocus] = useState<string | null>(null); // freshly added uid
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [armed, confirm] = useConfirm();

  // The Sections bar pins under the CMS header, and the toolbars of the
  // fields inside each card pin under that — so its height is measured and
  // published rather than guessed at.
  const sectionsRef = useRef<HTMLDivElement>(null);
  const sectionsBarRef = useRef<HTMLDivElement>(null);
  usePublishedHeight(sectionsBarRef, sectionsRef, '--cms-bar-h');

  const preview = useMemo(
    () => sections.map(({ uid: _uid, ...s }) => s),
    [sections],
  );

  function changeDate(next: string) {
    setDate(next);
    if (autoName) setSubject(defaultNewsletterSubject(cadence, next));
  }

  function patchRail(i: number, p: Partial<NewsletterRailBlock>) {
    setRail((list) => list.map((b, bi) => (bi === i ? { ...b, ...p } : b)));
  }

  function addSection() {
    const section = BLANK_SECTION();
    setSections((l) => [...l, section]);
    setFocus(section.uid);
  }

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`section-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFocus(null);
  }, [focus]);

  function patch(uid: string, p: Partial<NewsletterSection>) {
    setSections((list) => list.map((s) => (s.uid === uid ? { ...s, ...p } : s)));
  }

  async function save() {
    if (!date) { setError('Pick the issue date.'); return; }
    if (!subject.trim()) { setError('The issue needs a subject line.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        cadence, date, subject: subject.trim(), intro, sections: preview,
        // The rail is a monthly fixture; the other two mailers never print it.
        rail: cadence === 'daily' ? [] : rail,
      };
      if (editingId) await updateNewsletter(editingId, payload);
      else await createNewsletter(payload);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed. Try again.');
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } }}
      className="space-y-8"
    >
      {/* Composer bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b rule pb-6">
        <div>
          <div className="eyebrow mb-2">{editingId ? 'Editing issue' : 'New issue'}</div>
          <h2 className="text-[clamp(1.2rem,2vw,1.6rem)]">
            {editingId ? subject || 'Untitled issue' : `New ${CADENCE_LABEL[cadence]} issue`}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          aria-pressed={showPreview}
          className={`mono border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 ${
            showPreview ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
          }`}
        >
          Live preview
        </button>
      </div>

      <div className={`grid gap-10 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
        {/* ── Editor rail ── */}
        <div className="min-w-0 space-y-7">
          <div className="grid grid-cols-[150px_1fr] gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Issue date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => changeDate(e.target.value)}
                className="w-full border rule bg-white px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
              />
            </div>
            <Field
              label="Subject line"
              value={subject}
              onChange={(v) => { setSubject(v); setAutoName(false); }}
              max={300}
              hint={autoName ? 'Named from the date in the house format. Type to override.' : undefined}
            />
          </div>

          <div className="space-y-2">
            <RichTextField
              label="Top of the issue"
              value={intro}
              onChange={setIntro}
              rows={7}
              images={{ scope: 'newsletters', usedBy: 'Newsletter' }}
              hint="A paragraph holding only +++ separates the lead stories, exactly as the mailer prints it."
            />
            <TinyBtn onClick={() => setIntro((plainToHtml(intro) || '') + '<p>+++</p>')}>
              <IconPlus size={11} /> Insert story separator
            </TinyBtn>
          </div>

          {cadence !== 'daily' && (
            <MarketRail
              cadence={cadence}
              blocks={rail}
              onPatch={patchRail}
              onAdd={() => setRail((l) => [...l, BLANK_RAIL_BLOCK()])}
              onRemove={(i) => setRail((l) => l.filter((_, bi) => bi !== i))}
              onMove={(from, to) => setRail((l) => move(l, from, to))}
              onPickImage={(i) => setPicking(`rail:${i}`)}
            />
          )}

          <div
            ref={sectionsRef}
            className="space-y-4 [--cms-sticky-top:calc(var(--cms-header-h)_+_var(--cms-bar-h,3rem))]"
          >
            <div
              ref={sectionsBarRef}
              className="sticky top-[var(--cms-header-h)] z-20 flex items-center justify-between border-b rule bg-bone py-2.5"
            >
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-graphite">
                Sections <span className="text-silver">{sections.length}</span>
              </span>
              <TinyBtn tone="accent" onClick={addSection}>
                <IconPlus size={11} /> Add section
              </TinyBtn>
            </div>

            {sections.length === 0 && (
              <p className="border border-dashed rule px-5 py-8 text-[13px] leading-relaxed text-graphite">
                No sections yet. Each section is one story: a category badge, a headline, and its bullets.
                {cadence === 'daily' && ' The daily issue also builds its “In the news” index from these — a section needs both a badge and a headline to appear in it.'}
              </p>
            )}

            {sections.map((s, i) => (
              <div
                key={s.uid}
                id={`section-${s.uid}`}
                className="scroll-mt-[calc(var(--cms-header-h)_+_var(--cms-bar-h,3rem)_+_1rem)] border rule bg-white"
              >
                <div className="flex items-center justify-between border-b rule px-4 py-2.5">
                  <span className="mono num flex items-center gap-2 text-[10px] tracking-[0.14em] text-graphite">
                    {String(i + 1).padStart(2, '0')}{s.badge ? ` · ${s.badge}` : ''}
                    {cadence === 'daily' && (
                      s.badge.trim() && s.title.trim() ? (
                        <span className="mono border px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.12em]" style={{ borderColor: 'var(--color-amber-deep)', color: 'var(--color-amber-deep)' }}>
                          In the news
                        </span>
                      ) : (
                        <span className="mono border rule px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.12em] text-silver" title="A section needs both a badge and a headline to appear in the daily index.">
                          Not indexed
                        </span>
                      )
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <MiniBtn label="Move up" disabled={i === 0} onClick={() => setSections((l) => move(l, i, i - 1))}>
                      <IconArrowUp size={12} />
                    </MiniBtn>
                    <MiniBtn label="Move down" disabled={i === sections.length - 1} onClick={() => setSections((l) => move(l, i, i + 1))}>
                      <IconArrowDown size={12} />
                    </MiniBtn>
                    <MiniBtn
                      label={armed === s.uid ? 'Confirm remove' : 'Remove section'}
                      danger
                      onClick={() => confirm(s.uid, () => setSections((l) => l.filter((x) => x.uid !== s.uid)))}
                    >
                      {armed === s.uid ? <IconCheck size={12} /> : <IconTrash size={12} />}
                    </MiniBtn>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4">
                  <div className="grid grid-cols-[170px_1fr] gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Badge</label>
                      <input
                        list="newsletter-badges"
                        value={s.badge}
                        onChange={(e) => patch(s.uid, { badge: e.target.value.toUpperCase() })}
                        placeholder="MARKET"
                        className="w-full border rule bg-white px-3 py-2 text-[12.5px] uppercase tracking-[0.04em] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
                      />
                      {i > 0 && s.badge.trim() !== '' && s.badge === sections[i - 1]?.badge && (
                        <p className="text-[10.5px] leading-relaxed text-graphite">
                          Same badge as the section above — it prints once, at the first section.
                        </p>
                      )}
                    </div>
                    <Field label="Headline" size="sm" value={s.title} onChange={(v) => patch(s.uid, { title: v })} placeholder="SEC looking at more capital market reforms" max={300} />
                  </div>

                  <RichTextField
                    label="Body"
                    value={s.body}
                    onChange={(v) => patch(s.uid, { body: v })}
                    rows={5}
                    images={{ scope: 'newsletters', usedBy: 'Newsletter' }}
                  />
                  <RichTextField
                    label="Right column"
                    value={s.aside}
                    onChange={(v) => patch(s.uid, { aside: v })}
                    rows={3}
                    images={{ scope: 'newsletters', usedBy: 'Newsletter' }}
                    hint={cadence === 'monthly'
                      ? 'Optional. Makes the block a 50/50 two-column spread — the body on the left, this on the right, exactly like the monthly macro-news pages.'
                      : 'Optional. Prints beneath the body, inside the story row’s right-hand column.'}
                  />

                  {/* Chart strip */}
                  <div className="flex flex-col gap-2">
                    <label className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Charts</label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {s.images.map((src) => (
                        <span key={src} className="group relative block h-14 w-20 overflow-hidden border rule bg-bone">
                          <img src={src} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            aria-label="Remove chart"
                            onClick={() => patch(s.uid, { images: s.images.filter((x) => x !== src) })}
                            className="absolute right-0 top-0 grid h-5 w-5 place-items-center bg-navy/80 text-paper transition-colors duration-200 hover:bg-[color:var(--color-warn)]"
                          >
                            <IconX size={11} />
                          </button>
                        </span>
                      ))}
                      <TinyBtn onClick={() => setPicking(s.uid)}>
                        <IconImage size={12} /> Add chart
                      </TinyBtn>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <datalist id="newsletter-badges">
            {NEWSLETTER_BADGES.map((b) => <option key={b} value={b} />)}
          </datalist>
        </div>

        {/* ── Live template preview ── */}
        {showPreview && (
          <div className="min-w-0">
            <div className="sticky top-[calc(var(--cms-header-h)_+_1.5rem)]">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="mono text-[10px] uppercase tracking-[0.2em] text-graphite">Template preview</span>
                <span className="mono text-[10px] uppercase tracking-[0.2em] text-silver">{CADENCE_LABEL[cadence]} mailer</span>
              </div>
              <div className="max-h-[78vh] overflow-y-auto overflow-x-hidden border rule shadow-sm">
                <TemplatePreview cadence={cadence} date={date} subject={subject} intro={intro} sections={preview} rail={cadence === 'daily' ? [] : rail} />
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-graphite">
                This is the exact layout recipients get. It updates as you type.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action bar — rides the bottom of the composer so saving and discarding
          stay in reach however far down the section list you are. The error
          lives here too: it is raised by Save, so it belongs next to it. */}
      <div className="sticky bottom-4 z-30 border rule bg-paper/95 shadow-[0_10px_30px_-12px_oklch(0.165_0.040_260_/_0.4)] backdrop-blur-md">
        <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {error ? (
              <p className="text-[13px] leading-snug" style={{ color: 'var(--color-warn)' }}>{error}</p>
            ) : (
              <p className="truncate text-[13px] text-slate">
                <span className="mono num mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">
                  {sections.length} {sections.length === 1 ? 'section' : 'sections'}
                </span>
                {editingId ? subject || 'Untitled issue' : `New ${CADENCE_LABEL[cadence]} issue`}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <BtnGhost onClick={onClose}>Discard</BtnGhost>
            <BtnPrimary onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save issue'}
            </BtnPrimary>
          </div>
        </div>
      </div>

      <ImagePicker
        open={picking !== null}
        title={picking?.startsWith('rail:') ? 'Right column graphic' : 'Add a chart'}
        usedBy="Newsletter"
        scope="newsletters"
        kind="graphic"
        aspect="4/3"
        hint={picking?.startsWith('rail:')
          ? 'The chart or table export that prints under this block’s heading — a narrow crop for the monthly rail, a wider one for the weekly strip.'
          : 'PNG or JPG chart exports read best. They print centered under the section, in order.'}
        onPick={(path) => {
          if (!picking) return;
          if (picking.startsWith('rail:')) { patchRail(Number(picking.slice(5)), { image: path }); return; }
          const current = sections.find((s) => s.uid === picking)?.images ?? [];
          patch(picking, { images: [...new Set([...current, path])] });
        }}
        onClose={() => setPicking(null)}
      />
    </motion.div>
  );
}

/* ── The issue's chart blocks ────────────────────────────────── */

/**
 * Editor for the chart blocks that ride alongside the commentary: the
 * monthly prints them as the right-hand rail, the weekly as the strip
 * under the week recap. Each block is a heading and the graphic under
 * it, and the analyst adds as many as the issue needs. The daily
 * template carries neither, so the panel never appears there.
 */
function MarketRail({ cadence, blocks, onPatch, onAdd, onRemove, onMove, onPickImage }: {
  cadence: NewsletterCadence;
  blocks: NewsletterRailBlock[];
  onPatch: (i: number, p: Partial<NewsletterRailBlock>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onMove: (from: number, to: number) => void;
  onPickImage: (i: number) => void;
}) {
  const [armed, confirm] = useConfirm();
  const weekly = cadence === 'weekly';

  return (
    <div className="border rule bg-white">
      <div className="flex items-center justify-between border-b rule px-4 py-2.5">
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-graphite">
          {weekly ? 'Chart strip' : 'Right column'} <span className="text-silver">{blocks.length}</span>
        </span>
        <TinyBtn tone="accent" onClick={onAdd}>
          <IconPlus size={11} /> Add block
        </TinyBtn>
      </div>

      <div className="space-y-4 px-4 py-4">
        {blocks.length === 0 ? (
          <p className="border border-dashed rule px-5 py-6 text-[12.5px] leading-relaxed text-graphite">
            {weekly
              ? 'No charts yet. Blocks print as a strip under the week recap — three across, the way the desk runs the index chart, the flow chart, and the Key data table. Mark one full width and it spans the sheet on its own row, for the big market table.'
              : 'Nothing in the right column — the commentary runs full width. Add a block to print the index chart and the Key data table beside it, or mark one full width to span the sheet below.'}
          </p>
        ) : (
          blocks.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-3 border-b rule pb-4 last:border-0 last:pb-0">
              <Field
                label={`Block ${String(i + 1).padStart(2, '0')} heading${b.wide ? ' · full width' : ''}`}
                size="sm"
                value={b.title}
                onChange={(v) => onPatch(i, { title: v })}
                placeholder={weekly ? 'PSEi +1.9% WoW | 6,404.11' : 'PSEi -4.5% MoM | 5,956.33'}
                max={160}
              />
              <div className="flex items-end gap-2.5">
                {b.image !== '' && (
                  <span className="relative block h-14 w-20 overflow-hidden border rule bg-bone">
                    <img src={b.image} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Remove graphic"
                      onClick={() => onPatch(i, { image: '' })}
                      className="absolute right-0 top-0 grid h-5 w-5 place-items-center bg-navy/80 text-paper transition-colors duration-200 hover:bg-[color:var(--color-warn)]"
                    >
                      <IconX size={11} />
                    </button>
                  </span>
                )}
                <TinyBtn onClick={() => onPickImage(i)}>
                  <IconImage size={12} /> {b.image ? 'Replace' : 'Add graphic'}
                </TinyBtn>
                <button
                  type="button"
                  aria-pressed={b.wide}
                  title={b.wide
                    ? 'Prints across the full width of the sheet, on its own row.'
                    : weekly
                      ? 'Shares the strip with the blocks beside it, three across.'
                      : 'Sits in the right-hand column beside the commentary.'}
                  onClick={() => onPatch(i, { wide: !b.wide })}
                  className={`mono border px-2.5 py-[7px] text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
                    b.wide
                      ? 'border-navy bg-navy text-paper'
                      : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
                  }`}
                >
                  Full width
                </button>
                <div className="flex items-center gap-1.5 pb-0.5">
                  <MiniBtn label="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)}>
                    <IconArrowUp size={12} />
                  </MiniBtn>
                  <MiniBtn label="Move down" disabled={i === blocks.length - 1} onClick={() => onMove(i, i + 1)}>
                    <IconArrowDown size={12} />
                  </MiniBtn>
                  <MiniBtn
                    label={armed === `rail-${i}` ? 'Confirm remove' : 'Remove block'}
                    danger
                    onClick={() => confirm(`rail-${i}`, () => onRemove(i))}
                  >
                    {armed === `rail-${i}` ? <IconCheck size={12} /> : <IconTrash size={12} />}
                  </MiniBtn>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
