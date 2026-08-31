import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCms } from '../../store';
import { useAuth } from '../../auth';
import { BtnGhost, BtnPrimary, EASE, useConfirm } from '../../ui';
import { Field, MiniBtn, TinyBtn, move } from '../../kit/parts';
import ImagePicker from '../../kit/ImagePicker';
import RichTextField from '../../kit/RichTextField';
import { usePublishedHeight } from '../../kit/stickyOffset';
import {
  IconArrowDown, IconArrowUp, IconCheck, IconDownload, IconImage, IconPlus, IconTrash, IconX,
} from '../../icons';
import { downloadIssuePdf } from './printIssue';
import {
  NEWSLETTER_BADGES, defaultNewsletterSubject,
  type NewsletterCadence, type NewsletterIssue, type NewsletterSection,
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
  const { session } = useAuth();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(base && editingId ? base.date : today);
  const [subject, setSubject] = useState(() =>
    base && editingId ? base.subject : defaultNewsletterSubject(cadence, today));
  // The subject keeps following the date until the editor types their own.
  const [autoName, setAutoName] = useState(!editingId);
  const [intro, setIntro] = useState(base?.intro ?? '');
  const [sections, setSections] = useState<DraftSection[]>(() =>
    (base?.sections ?? []).map((s) => ({ ...s, uid: crypto.randomUUID() })));
  const [picking, setPicking] = useState<string | null>(null); // section uid
  // Sections append to the bottom, which is off-screen once the issue is long,
  // so a new one is scrolled to instead of silently landing below the fold.
  const [focus, setFocus] = useState<string | null>(null); // freshly added uid
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
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
      const payload = { cadence, date, subject: subject.trim(), intro, sections: preview };
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
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
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

          <RichTextField
            label="Top of the issue"
            value={intro}
            onChange={setIntro}
            rows={7}
            images={{ scope: 'newsletters', usedBy: 'Newsletter' }}
            hint="A paragraph holding only +++ separates the lead stories, exactly as the mailer prints it."
          />

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
                Daily issues also build the “In the news” index from these.
              </p>
            )}

            {sections.map((s, i) => (
              <div
                key={s.uid}
                id={`section-${s.uid}`}
                className="scroll-mt-[calc(var(--cms-header-h)_+_var(--cms-bar-h,3rem)_+_1rem)] border rule bg-white"
              >
                <div className="flex items-center justify-between border-b rule px-4 py-2.5">
                  <span className="mono num text-[10px] tracking-[0.14em] text-graphite">
                    {String(i + 1).padStart(2, '0')}{s.badge ? ` · ${s.badge}` : ''}
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
                    hint="Optional. Fills the right half of the two-column rows the weekly issue uses."
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
        <div className="min-w-0">
          <div className="sticky top-[calc(var(--cms-header-h)_+_1.5rem)]">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-graphite">Template preview</span>
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-silver">{CADENCE_LABEL[cadence]} mailer</span>
            </div>
            <div className="max-h-[78vh] overflow-y-auto overflow-x-hidden border rule shadow-sm">
              <TemplatePreview cadence={cadence} date={date} subject={subject} intro={intro} sections={preview} />
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-graphite">
              This is the exact layout recipients get. It updates as you type.
            </p>
          </div>
        </div>
      </div>

      {/* Action bar — rides the bottom of the composer so saving, discarding and
          the PDF export stay in reach however far down the section list you are.
          The error lives here too: it is raised by Save, so it belongs next to it. */}
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
            <BtnGhost
              disabled={preparing}
              onClick={() => {
                setPreparing(true);
                void downloadIssuePdf(
                  { cadence, date, subject, intro, sections: preview },
                  session ? { name: session.name, email: session.email } : null,
                ).finally(() => setPreparing(false));
              }}
            >
              <IconDownload size={14} /> {preparing ? 'Preparing…' : 'Download PDF'}
            </BtnGhost>
            <BtnGhost onClick={onClose}>Discard</BtnGhost>
            <BtnPrimary onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save issue'}
            </BtnPrimary>
          </div>
        </div>
      </div>

      <ImagePicker
        open={picking !== null}
        title="Add a chart"
        usedBy="Newsletter"
        scope="newsletters"
        kind="graphic"
        aspect="4/3"
        hint="PNG or JPG chart exports read best. They print centered under the section, in order."
        onPick={(path) => {
          if (!picking) return;
          const current = sections.find((s) => s.uid === picking)?.images ?? [];
          patch(picking, { images: [...new Set([...current, path])] });
        }}
        onClose={() => setPicking(null)}
      />
    </motion.div>
  );
}
