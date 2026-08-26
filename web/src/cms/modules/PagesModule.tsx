import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import { BtnGhost, BtnPrimary, Chip, EmptyState, ModuleHeader, SkeletonRows, EASE } from '../ui';
import { Field, Modal, Panel } from '../kit/parts';
import { fmtDate, type PageBlock } from '../data';

/** The two documents this module governs, in the order they are published. */
const DOCUMENTS = ['Terms & Conditions', 'Privacy & Cookies Policy'] as const;

/** Reserved blocks: the dateline under the title, and the document itself. */
const EFFECTIVE = 'Effective date';
const DOCUMENT = 'Document';

const MAX = 40000;

type Doc = {
  title: string;
  effective: PageBlock | null;
  document: PageBlock;
};

type Draft = { effective: string; body: string };

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

  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ effective: '', body: '' });
  const [pending, setPending] = useState<string | null>(null);   // tab waiting on a discard decision
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  const loading = status === 'loading' && docs.length === 0;
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
  const dirty = dirtyBody || dirtyEffective;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  function selectDoc(title: string) {
    if (title === selected?.title) return;
    if (dirty) { setPending(title); return; }
    setError(null);
    setSelectedTitle(title);
  }

  function discard() {
    setError(null);
    setDraft(stored);
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
        code="05 / Legal"
        title="Legal"
        blurb="The Terms & Conditions and the Privacy & Cookies Policy — the two documents behind the footer links and every login portal. Each is edited whole, as one body of text; nothing else on the site is edited here."
      />

      {loading && <SkeletonRows rows={4} />}

      {!loading && docs.length === 0 && (
        <EmptyState
          title="The legal documents are not provisioned."
          hint="Both are planted with the database. Ask systems administration to run the content seeder."
        />
      )}

      {!loading && selected && (
        <>
          {/* ── Document selector ────────────────────────────── */}
          <div>
            <div className="mono mb-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-graphite">
              <span>Documents</span>
              <span className="h-px flex-1" style={{ background: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }} />
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {docs.map((d) => {
                const on = d.title === selected.title;
                return (
                  <li key={d.title}>
                    <button
                      type="button"
                      onClick={() => selectDoc(d.title)}
                      aria-pressed={on}
                      className={`flex w-full flex-col gap-1.5 border px-4 py-3.5 text-left transition-colors duration-300 ${
                        on ? 'border-navy bg-navy text-paper' : 'rule bg-paper hover:border-[color:var(--color-amber-deep)]'
                      }`}
                    >
                      <span className={`mono text-[9.5px] uppercase tracking-[0.2em] ${on ? 'text-paper/55' : 'text-graphite'}`}>
                        {on && dirty ? 'Editing · unsaved' : `Updated ${fmtDate(d.document.updated)}`}
                      </span>
                      <span className={`text-[14px] leading-snug ${on ? 'text-paper' : 'text-ink'}`}>{d.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── The document ─────────────────────────────────── */}
          <motion.div
            key={selected.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <Panel
              code="05 / Legal"
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

          {/* ── Sticky save bar ──────────────────────────────── */}
          <SaveBar
            dirty={dirty}
            saving={saving}
            justSaved={justSaved}
            error={error}
            scope={selected.title}
            onDiscard={discard}
            onSave={() => void save()}
          />
        </>
      )}

      {/* Leaving an edited document behind */}
      <Modal
        open={pending !== null}
        title="Unsaved changes"
        onClose={() => setPending(null)}
        footer={
          <>
            <BtnGhost onClick={() => setPending(null)}>Stay here</BtnGhost>
            <BtnPrimary
              onClick={() => {
                setDraft(stored);
                setSelectedTitle(pending);
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
          {selected?.title} has edits that have not been published. Switching documents now throws them away.
        </p>
      </Modal>
    </div>
  );
}

/* ── Save bar ──────────────────────────────────────────────── */

function SaveBar({
  dirty, saving, justSaved, error, scope, onDiscard, onSave,
}: {
  dirty: boolean; saving: boolean; justSaved: boolean; error: string | null;
  scope: string; onDiscard: () => void; onSave: () => void;
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
                  {scope}
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
