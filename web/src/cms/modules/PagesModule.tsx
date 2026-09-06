import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCms } from '../store';
import { BtnGhost, BtnPrimary, EmptyState, ModuleHeader, SkeletonRows, EASE } from '../ui';
import { Field, Modal, Panel } from '../kit/parts';
import { fmtDate, type PageBlock } from '../data';
import ContactCopyEditor from './pages/ContactCopyEditor';
import SaveBar from '../kit/SaveBar';

/* ─────────────────────────────────────────────────────────────
   The standing pages: the Contact page's copy, and the two legal
   documents behind the footer links. One target is open at a
   time and each publishes on its own.
   ───────────────────────────────────────────────────────────── */

/** The two documents this module governs, in the order they are published. */
const DOCUMENTS = ['Terms & Conditions', 'Privacy & Cookies Policy'] as const;

/** Reserved blocks: the dateline under the title, and the document itself. */
const EFFECTIVE = 'Effective date';
const DOCUMENT = 'Document';

const MAX = 40000;

/** Which editor the module is showing. Legal keeps its own selected title. */
type View = 'contact' | 'legal';

type Doc = {
  title: string;
  effective: PageBlock | null;
  document: PageBlock;
};

type Draft = { effective: string; body: string };

/** Where a discard-or-stay decision is heading, once it is answered. */
type Pending = { view: 'contact' } | { view: 'legal'; title: string };

/** Clause count, so the editor can see the `## ` markers are landing. */
function countClauses(body: string): number {
  return body.split('\n').filter((l) => /^ {0,3}#{1,6} +\S/.test(l)).length;
}

export default function PagesModule() {
  const { pages, status, updatePage } = useCms();

  const docs = useMemo<Doc[]>(() => {
    const out: Doc[] = [];
    for (const title of DOCUMENTS) {
      const blocks = pages.filter((b) => b.page === title);
      const document = blocks.find((b) => b.field === DOCUMENT);
      if (document) {
        out.push({ title, effective: blocks.find((b) => b.field === EFFECTIVE) ?? null, document });
      }
    }
    return out;
  }, [pages]);

  const [view, setView] = useState<View>('contact');
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [contactDirty, setContactDirty] = useState(false);
  const [draft, setDraft] = useState<Draft>({ effective: '', body: '' });
  const [pending, setPending] = useState<Pending | null>(null);  // target waiting on a discard decision
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  const booting = status === 'loading';
  const loading = booting && docs.length === 0;
  const selected = useMemo(
    () => docs.find((d) => d.title === selectedTitle) ?? docs[0] ?? null,
    [docs, selectedTitle],
  );

  const stored = useMemo<Draft>(
    () => ({ effective: selected?.effective?.value ?? '', body: selected?.document.value ?? '' }),
    [selected],
  );

  // Load the draft only when the document changes — saving replaces the
  // underlying blocks, and that should not wipe what is being typed.
  useEffect(() => {
    setDraft({ effective: selected?.effective?.value ?? '', body: selected?.document.value ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.title]);

  useEffect(() => () => { if (savedTimer.current) window.clearTimeout(savedTimer.current); }, []);

  const dirtyBody = draft.body !== stored.body;
  const dirtyEffective = draft.effective !== stored.effective;
  const legalDirty = dirtyBody || dirtyEffective;

  /** Whatever is on screen right now, and whether it has unpublished edits. */
  const openDirty = view === 'contact' ? contactDirty : legalDirty;
  const openLabel = view === 'contact' ? 'The Contact page' : selected?.title ?? 'This document';

  useEffect(() => {
    if (!legalDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [legalDirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  /** Move the module to another target, asking first if edits would be lost. */
  function go(target: Pending) {
    if (target.view === view && (target.view === 'contact' || target.title === selected?.title)) return;
    if (openDirty) { setPending(target); return; }
    apply(target);
  }

  function apply(target: Pending) {
    setError(null);
    if (target.view === 'contact') {
      // The Contact editor unmounts, so its draft is discarded with it.
      setView('contact');
    } else {
      setView('legal');
      setSelectedTitle(target.title);
    }
  }

  async function save() {
    if (!selected) return;
    if (!draft.body.trim()) { setError('The document cannot be published empty.'); return; }
    if (draft.body.length > MAX) { setError(`The document is over ${MAX.toLocaleString()} characters.`); return; }
    if (selected.effective && !draft.effective.trim()) { setError('The dateline cannot be published empty.'); return; }

    setSaving(true);
    setError(null);
    try {
      if (dirtyEffective && selected.effective) await updatePage(selected.effective.id, draft.effective.trim());
      if (dirtyBody) await updatePage(selected.document.id, draft.body.trim());
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
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="06 / Pages"
        title="Pages"
        blurb="The standing pages: the Contact page's copy, and the Terms & Conditions and Privacy & Cookies Policy behind the footer links and every login portal. Pick a page below; each one publishes on its own."
      />

      {/* ── Target selector ──────────────────────────────────── */}
      <div>
        <div className="mono mb-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-graphite">
          <span>Pages</span>
          <span className="h-px flex-1" style={{ background: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }} />
        </div>

        <ul className="grid gap-3 md:grid-cols-3">
          <li>
            <TargetCard
              on={view === 'contact'}
              where="/contact"
              title="Contact"
              state={view === 'contact' && contactDirty ? 'Editing · unsaved' : 'Hero, inquiry, offices'}
              unit="5 sections"
              onClick={() => go({ view: 'contact' })}
            />
          </li>

          {loading && docs.length === 0 && (
            <li className="md:col-span-2">
              <div className="h-full border rule border-dashed px-4 py-3.5">
                <span className="mono text-[9.5px] uppercase tracking-[0.2em] text-silver">Loading documents…</span>
              </div>
            </li>
          )}

          {docs.map((d) => {
            const on = view === 'legal' && d.title === selected?.title;
            return (
              <li key={d.title}>
                <TargetCard
                  on={on}
                  where="Footer + portals"
                  title={d.title}
                  state={on && legalDirty ? 'Editing · unsaved' : `Updated ${fmtDate(d.document.updated)}`}
                  unit={`${countClauses(d.document.value)} clauses`}
                  onClick={() => go({ view: 'legal', title: d.title })}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Contact page ─────────────────────────────────────── */}
      {view === 'contact' && booting && <SkeletonRows rows={5} />}

      {view === 'contact' && !booting && (
        <motion.div
          key="contact"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <ContactCopyEditor onDirty={setContactDirty} />
        </motion.div>
      )}

      {/* ── Legal documents ──────────────────────────────────── */}
      {view === 'legal' && loading && <SkeletonRows rows={4} />}

      {view === 'legal' && !loading && !selected && (
        <EmptyState
          title="The legal documents are not provisioned."
          hint="Both are planted with the database. Ask systems administration to run the content seeder."
        />
      )}

      {view === 'legal' && !loading && selected && (
        <>
          <motion.div
            key={selected.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <Panel
              code="06 / Legal"
              title={selected.title}
              hint="Read in the site footer and on every login portal. Blank lines separate paragraphs; a line opening with “## ” becomes a clause heading, and a line opening with “•” renders as a bullet."
              actions={
                <span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">
                  {countClauses(draft.body)} clauses
                </span>
              }
            >
              <div className="flex flex-col gap-6">
                <div className="grid gap-5 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                  <Field
                    label="Dateline"
                    value={draft.effective}
                    max={80}
                    onChange={(v) => set('effective', v)}
                    hint="Printed under the title — e.g. “Effective 1 January 2025”."
                  />
                  <div className="flex flex-col justify-end pb-1.5">
                    <p className="text-[12.5px] leading-relaxed text-graphite">
                      Last published {fmtDate(selected.document.updated)} by {selected.document.editor}. Legal copy changes
                      are flagged to the Corporate Secretary automatically.
                    </p>
                  </div>
                </div>

                <Field
                  label="Document"
                  value={draft.body}
                  max={MAX}
                  multiline
                  rows={30}
                  onChange={(v) => set('body', v)}
                  placeholder={'## Clause heading\n\nThe text of the clause…'}
                />
              </div>
            </Panel>
          </motion.div>

          <SaveBar
            dirty={legalDirty}
            saving={saving}
            justSaved={justSaved}
            error={error}
            scope={selected.title}
            onDiscard={() => { setError(null); setDraft(stored); }}
            onSave={() => void save()}
          />
        </>
      )}

      {/* Leaving an edited page behind */}
      <Modal
        open={pending !== null}
        title="Unsaved changes"
        onClose={() => setPending(null)}
        footer={
          <>
            <BtnGhost onClick={() => setPending(null)}>Stay here</BtnGhost>
            <BtnPrimary
              onClick={() => {
                if (pending) {
                  setDraft(stored);   // the legal draft; the Contact draft goes with its unmount
                  apply(pending);
                }
                setPending(null);
              }}
            >
              Discard and switch
            </BtnPrimary>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate">
          {openLabel} has edits that have not been published. Switching now throws them away.
        </p>
      </Modal>
    </div>
  );
}

/* ── Target card ───────────────────────────────────────────── */

function TargetCard({
  on, where, title, state, unit, onClick,
}: {
  on: boolean; where: string; title: string; state: string; unit: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-full w-full flex-col gap-1.5 border px-4 py-3.5 text-left transition-colors duration-300 ${
        on ? 'border-navy bg-navy text-paper' : 'rule bg-paper hover:border-[color:var(--color-amber-deep)]'
      }`}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className={`mono text-[9.5px] uppercase tracking-[0.2em] ${on ? 'text-paper/70' : 'text-graphite'}`}>
          {where}
        </span>
        <span className={`mono num shrink-0 text-[9.5px] uppercase tracking-[0.14em] ${on ? 'text-paper/45' : 'text-silver'}`}>
          {unit}
        </span>
      </span>
      <span className={`text-[14px] leading-snug ${on ? 'text-paper' : 'text-ink'}`}>{title}</span>
      <span className={`mono truncate text-[9.5px] uppercase tracking-[0.16em] ${on ? 'text-paper/55' : 'text-graphite'}`}>
        {state}
      </span>
    </button>
  );
}
