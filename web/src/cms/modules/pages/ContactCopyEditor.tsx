import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCms } from '../../store';
import { Switch } from '../../ui';
import { IconArrowDown, IconArrowRight, IconArrowUp, IconExternal, IconPen, IconPlus, IconTrash, IconX } from '../../icons';
import type { ContactChannel, ContactCopy } from '../../data';
import ImagePicker from '../../kit/ImagePicker';
import { Field, MiniBtn, Panel, TinyBtn, move } from '../../kit/parts';
import SaveBar from './SaveBar';

/* ─────────────────────────────────────────────────────────────
   Everything /contact says — the hero caption over the sunray
   panel, the inquiry column beside the form, the form's own
   labels and its confirmation, and the office ledger — edited as
   one document and published with one save.
   ───────────────────────────────────────────────────────────── */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = (c: ContactCopy): ContactCopy => JSON.parse(JSON.stringify(c)) as ContactCopy;

const LIMITS = { interests: 8, address: 8, channels: 6 } as const;

/** Trim every string; drop rows that are entirely empty. */
function tidy(c: ContactCopy): ContactCopy {
  const t = (v: string) => v.trim();
  const seen = new Set<string>();

  return {
    hero: { eyebrow: t(c.hero.eyebrow), title: t(c.hero.title), image: t(c.hero.image) },
    inquiry: {
      eyebrow: t(c.inquiry.eyebrow),
      // Internal newlines are the author's line breaks; only the ends are trimmed.
      heading: t(c.inquiry.heading),
      blurb: t(c.inquiry.blurb),
      deskLabel: t(c.inquiry.deskLabel),
      deskName: t(c.inquiry.deskName),
      deskPhone: t(c.inquiry.deskPhone),
      interests: c.inquiry.interests.map(t).filter((v) => {
        if (!v || seen.has(v.toLowerCase())) return false;
        seen.add(v.toLowerCase());
        return true;
      }),
      submitLabel: t(c.inquiry.submitLabel),
      successHeading: t(c.inquiry.successHeading),
      successBody: t(c.inquiry.successBody),
    },
    offices: {
      eyebrow: t(c.offices.eyebrow),
      heading: t(c.offices.heading),
      addressLabel: t(c.offices.addressLabel),
      address: c.offices.address.map(t).filter(Boolean),
      contactLabel: t(c.offices.contactLabel),
      channels: c.offices.channels
        .map((r) => ({ label: t(r.label), value: t(r.value) }))
        .filter((r) => r.label || r.value),
      emailLabel: t(c.offices.emailLabel),
      email: t(c.offices.email),
    },
    newsletter: { enabled: c.newsletter.enabled },
  };
}

/** Everything the API would reject, phrased the way an editor thinks about it. */
function validateCopy(c: ContactCopy): string | null {
  if (!c.hero.title) return 'The hero needs a caption.';
  if (!c.inquiry.heading) return 'The inquiry panel needs a heading.';
  if (c.inquiry.interests.length === 0) return 'The form needs at least one area of interest.';
  if (!c.inquiry.submitLabel) return 'The submit button needs a label.';
  if (!c.inquiry.successHeading) return 'The confirmation needs a heading.';
  if (!c.inquiry.successBody) return 'The confirmation needs a message.';
  if (!c.offices.heading) return 'The office ledger needs a heading.';
  if (c.offices.channels.some((r) => !r.label || !r.value)) return 'Every contact row needs both a label and a number.';
  if (!c.offices.email) return 'The office ledger needs an email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.offices.email)) return `“${c.offices.email}” is not a valid email address.`;
  return null;
}

/** Resolve the confirmation tokens the way the live page will. */
function resolveTokens(body: string, desk: string): string {
  return body
    .replaceAll('{email}', 'analyst@fundhouse.com')
    .replaceAll('{desk}', desk || '(no desk number set)');
}

export default function ContactCopyEditor({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  const { contactPage, updateContactPage } = useCms();
  const [draft, setDraft] = useState<ContactCopy>(() => clone(contactPage));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pickingHero, setPickingHero] = useState(false);
  const savedTimer = useRef<number | null>(null);

  // Follow the store when an untouched editor's baseline changes
  // (bootstrap landing late). A dirty draft is never overwritten.
  const baseline = useRef(contactPage);
  useEffect(() => {
    setDraft((d) => (same(d, baseline.current) ? clone(contactPage) : d));
    baseline.current = contactPage;
  }, [contactPage]);

  const dirty = !same(draft, contactPage);

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
  const patch = (fn: (c: ContactCopy) => void) => {
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
      const saved = await updateContactPage(trimmed);
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
      {/* ── Hero ───────────────────────────────────────────── */}
      <Panel
        code="/contact · hero"
        title="Hero caption"
        hint="The banner at the very top of the page. The preview below is the live composition — navy and blueprint grid on the left, the photo panel on the right."
        actions={<LiveLink hash="" />}
      >
        <div className="flex flex-col gap-6">
          <HeroMirror
            eyebrow={draft.hero.eyebrow}
            title={draft.hero.title}
            image={draft.hero.image}
            onPick={() => setPickingHero(true)}
            onClear={() => patch((c) => { c.hero.image = ''; })}
          />

          <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field
              label="Eyebrow"
              value={draft.hero.eyebrow}
              max={60}
              onChange={(v) => patch((c) => { c.hero.eyebrow = v; })}
              hint="Optional. Leave it empty and the banner runs caption-only."
            />
            <Field
              label="Caption"
              value={draft.hero.title}
              max={80}
              onChange={(v) => patch((c) => { c.hero.title = v; })}
              hint="Two lines at most on a laptop; the amber rule is drawn underneath automatically."
            />
          </div>

          <p className="mono truncate text-[9.5px] tracking-[0.06em] text-graphite" title={draft.hero.image}>
            Photo · {draft.hero.image || '— none, navy only —'}
          </p>
        </div>
      </Panel>

      {/* ── Inquiry column ─────────────────────────────────── */}
      <Panel
        code="/contact · inquiry"
        title="Inquiry panel"
        hint="The column to the left of the enquiry form."
        actions={<LiveLink hash="#enquiry" />}
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field label="Eyebrow" value={draft.inquiry.eyebrow} max={60} onChange={(v) => patch((c) => { c.inquiry.eyebrow = v; })} />
            <Field
              label="Heading"
              value={draft.inquiry.heading}
              max={120}
              multiline
              rows={2}
              onChange={(v) => patch((c) => { c.inquiry.heading = v; })}
              hint="A line break here breaks the heading on the page."
            />
          </div>

          <Field
            label="Standfirst"
            value={draft.inquiry.blurb}
            max={400}
            multiline
            rows={3}
            onChange={(v) => patch((c) => { c.inquiry.blurb = v; })}
            hint="The response promise under the heading. Leave it empty to drop the paragraph."
          />

          <div className="border-t rule pt-5">
            <div className="mono mb-3.5 text-[10px] uppercase tracking-[0.18em] text-graphite">Dealing line</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Label" value={draft.inquiry.deskLabel} max={60} size="sm" onChange={(v) => patch((c) => { c.inquiry.deskLabel = v; })} />
              <Field label="Desk name" value={draft.inquiry.deskName} max={60} size="sm" onChange={(v) => patch((c) => { c.inquiry.deskName = v; })} />
              <Field label="Number" value={draft.inquiry.deskPhone} max={60} size="sm" onChange={(v) => patch((c) => { c.inquiry.deskPhone = v; })} />
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-graphite">
              Clearing the label, the name, and the number together removes the whole block from the page.
            </p>
          </div>
        </div>
      </Panel>

      {/* ── The form itself ────────────────────────────────── */}
      <Panel
        code="/contact · enquiry form"
        title="Form and confirmation"
        hint="The wording around the form. Where the enquiry is delivered is configured outside the CMS."
        actions={<LiveLink hash="#enquiry" />}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Areas of interest</span>
              <span className="mono num text-[10px] tracking-[0.14em] text-silver">
                {draft.inquiry.interests.length}/{LIMITS.interests}
              </span>
            </div>
            <InterestChips
              items={draft.inquiry.interests}
              onChange={(v) => patch((c) => { c.inquiry.interests = v; })}
            />
            <p className="text-[11.5px] leading-relaxed text-graphite">
              The chips above the message box. The first one is selected when the form loads, so lead with the
              enquiry the desk wants most.
            </p>
          </div>

          <div className="grid gap-5 border-t rule pt-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field label="Submit button" value={draft.inquiry.submitLabel} max={40} onChange={(v) => patch((c) => { c.inquiry.submitLabel = v; })} />
            <Field label="Confirmation heading" value={draft.inquiry.successHeading} max={80} onChange={(v) => patch((c) => { c.inquiry.successHeading = v; })} />
          </div>

          <div className="flex flex-col gap-2.5">
            <Field
              label="Confirmation message"
              value={draft.inquiry.successBody}
              max={600}
              multiline
              rows={4}
              onChange={(v) => patch((c) => { c.inquiry.successBody = v; })}
              hint="Replaces the form once an enquiry sends. {email} prints the sender's address; {desk} prints the dealing number above."
            />
            <div className="border-l-2 bg-bone px-3.5 py-3" style={{ borderColor: 'var(--color-amber)' }}>
              <div className="mono mb-1.5 text-[9.5px] uppercase tracking-[0.16em] text-graphite">As the sender reads it</div>
              <p className="text-[12.5px] leading-relaxed text-slate">
                {resolveTokens(draft.inquiry.successBody, draft.inquiry.deskPhone) || '— nothing to show —'}
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Office ledger ──────────────────────────────────── */}
      <Panel
        code="/contact · offices"
        title="Office ledger"
        hint="The three-column band at the foot of the page — address, switchboard, and the published inbox."
        actions={<LiveLink hash="#offices" />}
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <Field label="Eyebrow" value={draft.offices.eyebrow} max={60} onChange={(v) => patch((c) => { c.offices.eyebrow = v; })} />
            <Field label="Section heading" value={draft.offices.heading} max={160} onChange={(v) => patch((c) => { c.offices.heading = v; })} />
          </div>

          <div className="grid gap-5 border-t rule pt-5 lg:grid-cols-3">
            <LedgerColumn label={draft.offices.addressLabel} onLabel={(v) => patch((c) => { c.offices.addressLabel = v; })} title="Address column">
              <LineList
                rows={draft.offices.address}
                onChange={(v) => patch((c) => { c.offices.address = v; })}
                addLabel="Add line"
                max={LIMITS.address}
                placeholder="23/F Tower One,"
              />
            </LedgerColumn>

            <LedgerColumn label={draft.offices.contactLabel} onLabel={(v) => patch((c) => { c.offices.contactLabel = v; })} title="Switchboard column">
              <ChannelList
                rows={draft.offices.channels}
                onChange={(v) => patch((c) => { c.offices.channels = v; })}
              />
            </LedgerColumn>

            <LedgerColumn label={draft.offices.emailLabel} onLabel={(v) => patch((c) => { c.offices.emailLabel = v; })} title="Email column">
              <input
                value={draft.offices.email}
                onChange={(e) => patch((c) => { c.offices.email = e.target.value; })}
                placeholder="info@regis.ph"
                aria-label="Published email address"
                inputMode="email"
                className={`${INPUT} mono`}
              />
              <p className="mt-2 text-[11.5px] leading-relaxed text-graphite">
                Published as a mailto link, and quoted again if an enquiry fails to send.
              </p>
            </LedgerColumn>
          </div>
        </div>
      </Panel>

      {/* ── Newsletter ─────────────────────────────────────── */}
      <Panel
        code="/contact · footer band"
        title="Newsletter sign-up"
        hint="The subscribe band between the office ledger and the site footer. Its copy is shared with every other page that carries it."
      >
        <label className="flex cursor-pointer items-center gap-3.5">
          <Switch
            on={draft.newsletter.enabled}
            onToggle={() => patch((c) => { c.newsletter.enabled = !c.newsletter.enabled; })}
            label="Show the newsletter band on the Contact page"
          />
          <span className="text-[13.5px] text-slate">
            {draft.newsletter.enabled ? 'Shown on the Contact page' : 'Hidden on the Contact page'}
          </span>
        </label>
      </Panel>

      <ImagePicker
        open={pickingHero}
        title="Contact hero photo"
        usedBy="Contact page"
        scope="contact"
        kind="photo"
        aspect="21/9"
        hint="JPG, PNG, WebP, or AVIF up to 8 MB. The banner crops wide and tall, so keep the subject right of centre where the navy seam does not fall."
        onPick={(path) => patch((c) => { c.hero.image = path; })}
        onClose={() => setPickingHero(false)}
      />

      <SaveBar
        dirty={dirty}
        saving={saving}
        justSaved={justSaved}
        error={error}
        scope="Contact page copy"
        onDiscard={() => { setError(null); setDraft(clone(contactPage)); }}
        onSave={() => void save()}
      />
    </div>
  );
}

/* ── Shared bits ───────────────────────────────────────────── */

const INPUT =
  'w-full border rule bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]';

function LiveLink({ hash }: { hash: string }) {
  return (
    <a
      href={`/contact${hash}`}
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

/* ── Hero mirror ───────────────────────────────────────────── */

/**
 * A scaled stand-in for the live banner: the same navy, blueprint grid,
 * amber glow, photo panel, and seam, so the caption is written against
 * the composition it will actually sit in rather than against a blank
 * text box. Sizes are container-relative, so the type keeps its real
 * proportion to the banner at any preview width.
 */
function HeroMirror({
  eyebrow, title, image, onPick, onClear,
}: {
  eyebrow: string; title: string; image: string; onPick: () => void; onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="group relative aspect-[21/9] w-full overflow-hidden border rule"
        style={{ containerType: 'inline-size', backgroundColor: 'var(--color-navy)' }}
      >
        {/* Blueprint grid — the left panel of the live hero. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 4%, transparent) 1px, transparent 1px),' +
              'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px)',
            backgroundSize: '5cqw 5cqw',
          }}
        />

        {/* Amber atmospheric glow, bottom-left. */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: '-22%', bottom: '-70%', width: '78%', aspectRatio: '1',
            background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.22) 0%, transparent 70%)',
          }}
        />

        {/* Photo panel, right 44%, with the navy seam painted over its left edge. */}
        {image && (
          <div aria-hidden className="absolute inset-y-0 right-0 overflow-hidden" style={{ width: '44%' }}>
            <img src={image} alt="" className="h-full w-full object-cover" style={{ objectPosition: '55% 28%' }} />
            <span
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right,' +
                    'oklch(0.215 0.048 260 / 1.00)  0%,' +
                    'oklch(0.215 0.048 260 / 0.84) 10%,' +
                    'oklch(0.215 0.048 260 / 0.46) 26%,' +
                    'oklch(0.215 0.048 260 / 0.10) 46%,' +
                    'transparent 68%)',
              }}
            />
            <span
              className="absolute inset-x-0 bottom-0"
              style={{
                height: '50%',
                background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.96) 0%, transparent 100%)',
              }}
            />
          </div>
        )}

        {/* The caption itself. */}
        <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingInline: '6cqw' }}>
          {eyebrow && (
            <div
              className="mono uppercase"
              style={{
                fontSize: 'clamp(6px, 1.15cqw, 11px)',
                letterSpacing: '0.2em',
                color: 'color-mix(in oklab, var(--color-paper) 70%, transparent)',
                marginBottom: '1.6cqw',
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            className="text-paper"
            style={{
              fontSize: 'clamp(12px, 4.4cqw, 40px)',
              lineHeight: 1.04,
              letterSpacing: '-0.026em',
              fontWeight: 500,
              maxWidth: '18ch',
            }}
          >
            {title || <span className="text-paper/35">Caption</span>}
          </div>
          <span
            aria-hidden
            style={{
              marginTop: '2.4cqw', height: '1px', width: 'min(26cqw, 260px)',
              background: 'linear-gradient(to right, var(--color-amber), transparent)',
            }}
          />
        </div>

        {/* Photo controls, on hover or keyboard focus. */}
        <div
          className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 p-2"
          style={{ background: 'linear-gradient(to top, oklch(0.165 0.040 260 / 0.85), transparent)' }}
        >
          <TinyBtn onClick={onPick} tone="accent">
            <IconPen size={11} /> {image ? 'Replace photo' : 'Add photo'}
          </TinyBtn>
          {image && (
            <TinyBtn onClick={onClear}>
              <IconTrash size={11} /> Clear
            </TinyBtn>
          )}
        </div>
      </div>
      <p className="mono text-[9.5px] uppercase tracking-[0.16em] text-silver">Preview · not to scale</p>
    </div>
  );
}

/* ── Areas of interest ─────────────────────────────────────── */

function InterestChips({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const [entry, setEntry] = useState('');

  const add = () => {
    const v = entry.trim();
    if (!v || items.length >= LIMITS.interests) return;
    if (items.some((x) => x.toLowerCase() === v.toLowerCase())) { setEntry(''); return; }
    onChange([...items, v]);
    setEntry('');
  };

  return (
    <div className="flex flex-col gap-2.5">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <li key={`${i}-${item}`} className="inline-flex items-stretch border rule bg-white">
              <span className={`px-3 py-1.5 text-[12.5px] ${i === 0 ? 'text-ink' : 'text-slate'}`}>
                {i === 0 && (
                  <span aria-hidden className="mr-2 inline-block h-1.5 w-1.5 align-middle" style={{ background: 'var(--color-amber)' }} />
                )}
                {item}
              </span>
              <span className="flex items-center border-l rule">
                <button
                  type="button"
                  aria-label={`Move ${item} earlier`}
                  disabled={i === 0}
                  onClick={() => onChange(move(items, i, i - 1))}
                  className="grid h-full w-6 place-items-center text-graphite transition-colors hover:text-ink disabled:opacity-25"
                >
                  <IconArrowRight size={11} className="rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item} later`}
                  disabled={i === items.length - 1}
                  onClick={() => onChange(move(items, i, i + 1))}
                  className="grid h-full w-6 place-items-center border-l rule text-graphite transition-colors hover:text-ink disabled:opacity-25"
                >
                  <IconArrowRight size={11} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => onChange(items.filter((_, x) => x !== i))}
                  className="grid h-full w-6 place-items-center border-l rule text-graphite transition-colors hover:text-[color:var(--color-warn)]"
                >
                  <IconX size={11} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={items.length >= LIMITS.interests ? 'All eight chips are in use' : 'Corporate Access'}
          aria-label="New area of interest"
          disabled={items.length >= LIMITS.interests}
          className={`${INPUT} max-w-[260px] disabled:cursor-not-allowed disabled:opacity-50`}
        />
        <TinyBtn onClick={add} disabled={!entry.trim() || items.length >= LIMITS.interests}>
          <IconPlus size={12} /> Add
        </TinyBtn>
      </div>
    </div>
  );
}

/* ── Office ledger columns ─────────────────────────────────── */

function LedgerColumn({
  label, onLabel, title, children,
}: {
  label: string; onLabel: (v: string) => void; title: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border rule bg-white p-3.5">
      <div className="flex flex-col gap-1.5">
        <label className="mono text-[9.5px] uppercase tracking-[0.18em] text-graphite">{title} · label</label>
        <input
          value={label}
          onChange={(e) => onLabel(e.target.value)}
          placeholder="Address"
          aria-label={`${title} label`}
          className={`${INPUT} mono uppercase tracking-[0.14em]`}
        />
      </div>
      <div className="border-t rule pt-3">{children}</div>
    </div>
  );
}

function LineList({
  rows, onChange, addLabel, max, placeholder,
}: {
  rows: string[]; onChange: (v: string[]) => void; addLabel: string; max: number; placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={row}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={placeholder}
            aria-label={`Line ${i + 1}`}
            className={INPUT}
          />
          <RowControls
            index={i}
            count={rows.length}
            label={`line ${i + 1}`}
            onMove={(dir) => onChange(move(rows, i, i + dir))}
            onRemove={() => onChange(rows.filter((_, x) => x !== i))}
          />
        </div>
      ))}
      <AddRow label={addLabel} count={rows.length} max={max} onAdd={() => onChange([...rows, ''])} />
    </div>
  );
}

function ChannelList({ rows, onChange }: { rows: ContactChannel[]; onChange: (v: ContactChannel[]) => void }) {
  const set = (i: number, p: Partial<ContactChannel>) => onChange(rows.map((r, x) => (x === i ? { ...r, ...p } : r)));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-col gap-2 border-b rule pb-2 last:border-b-0 last:pb-0">
          <div className="flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => set(i, { label: e.target.value })}
              placeholder="TEL"
              aria-label={`Row ${i + 1} label`}
              className={`${INPUT} mono w-[86px] shrink-0 uppercase`}
            />
            <RowControls
              index={i}
              count={rows.length}
              label={`row ${i + 1}`}
              onMove={(dir) => onChange(move(rows, i, i + dir))}
              onRemove={() => onChange(rows.filter((_, x) => x !== i))}
            />
          </div>
          <textarea
            rows={row.value.includes('\n') ? 2 : 1}
            value={row.value}
            onChange={(e) => set(i, { value: e.target.value })}
            placeholder="+63 2 8894 6600"
            aria-label={`Row ${i + 1} numbers`}
            className={`${INPUT} mono resize-y leading-relaxed`}
          />
        </div>
      ))}
      <AddRow label="Add row" count={rows.length} max={LIMITS.channels} onAdd={() => onChange([...rows, { label: '', value: '' }])} />
      <p className="text-[11px] leading-relaxed text-graphite">
        One row per channel. A line break inside a row stacks a second number under the first, the way FAX prints.
      </p>
    </div>
  );
}
