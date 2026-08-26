import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReports } from './reports';
import { fmtBytes, fmtDate, timeAgo, type Report } from '../cms/data';
import { useBookmarks } from './bookmarks';
import { downloadReport } from './download';
import {
  IconX, IconEye, IconDownload, IconSearch, IconBookmark, IconBookmarkFilled,
} from '../cms/icons';

const EASE = [0.25, 1, 0.5, 1] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Opening the reader closes this dialog — the two share the viewport. */
  onView: (report: Report) => void;
};

export default function BookmarksModal({ open, onClose, onView }: Props) {
  const { reports } = useReports();
  const { ids, count, savedAt, remove, clear } = useBookmarks();
  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Saved ids are resolved against the live catalog, so a report pulled by
  // research simply drops out of the shelf rather than rendering a dead row.
  const saved = useMemo(() => {
    const byId = new Map(reports.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is Report => Boolean(r));
  }, [ids, reports]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return saved;
    return saved.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.analyst.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q),
    );
  }, [saved, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Reopening starts clean rather than resuming a half-typed filter.
  useEffect(() => {
    if (!open) { setQuery(''); setConfirmClear(false); }
  }, [open]);

  // Arming "clear all" disarms itself so the destructive label is never left sitting.
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const showFilter = saved.length > 3;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'oklch(0.165 0.040 260 / 0.55)', backdropFilter: 'blur(4px)' }}
          />

          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center md:p-6">
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Saved reports"
              initial={{ opacity: 0, y: 22, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 22, scale: 0.985 }}
              transition={{ duration: 0.38, ease: EASE }}
              className="pointer-events-auto flex w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-paper shadow-2xl outline-none"
              style={{ maxHeight: 'min(84dvh, 720px)' }}
            >
              {/* ── Header ─────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4 border-b rule px-5 py-5 md:px-7">
                <div className="min-w-0">
                  <div className="eyebrow mb-3">Bookmarks</div>
                  <h2 className="text-[19px] font-medium tracking-[-0.015em] text-ink md:text-[21px]">
                    Saved reports
                  </h2>
                  <p className="mono mt-1.5 text-[11px] tracking-[0.04em] text-graphite">
                    <span className="num text-slate">{count}</span> {count === 1 ? 'report' : 'reports'} kept on your account
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close saved reports"
                  onClick={onClose}
                  className="grid h-9 w-9 shrink-0 place-items-center border rule text-graphite transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:scale-[0.94]"
                >
                  <IconX />
                </button>
              </div>

              {/* ── Filter ─────────────────────────────────────── */}
              {showFilter && (
                <label className="relative block shrink-0 border-b rule bg-white">
                  <span className="sr-only">Filter saved reports</span>
                  <IconSearch size={15} className="absolute left-5 top-1/2 -translate-y-1/2 text-graphite md:left-7" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by title, analyst, or sector"
                    className="w-full bg-transparent py-3.5 pl-[3.1rem] pr-5 text-[13.5px] text-ink outline-none placeholder:text-silver md:pl-[4.4rem] md:pr-7"
                  />
                </label>
              )}

              {/* ── Shelf ──────────────────────────────────────── */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-white">
                {saved.length === 0 ? (
                  <EmptyShelf />
                ) : shown.length === 0 ? (
                  <div className="px-5 py-14 text-center md:px-7">
                    <p className="text-[14.5px] font-medium text-ink">No saved report matches that.</p>
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="mono mt-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
                    >
                      Clear filter
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y rule">
                    <AnimatePresence initial={false} mode="popLayout">
                      {shown.map((r, i) => (
                        <SavedRow
                          key={r.id}
                          report={r}
                          index={i}
                          savedAt={savedAt(r.id)}
                          onView={() => onView(r)}
                          onRemove={() => remove(r.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>

              {/* ── Footer ─────────────────────────────────────── */}
              <div className="mono flex shrink-0 items-center justify-between gap-4 border-t rule bg-paper px-5 py-3.5 text-[10px] uppercase tracking-[0.16em] text-graphite md:px-7">
                <span>Saved to your account, never redistributed</span>
                {saved.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { if (confirmClear) { clear(); setConfirmClear(false); } else setConfirmClear(true); }}
                    className="shrink-0 tracking-[0.16em] transition-colors duration-300 hover:text-ink"
                    style={confirmClear ? { color: 'var(--color-warn)' } : undefined}
                  >
                    {confirmClear ? 'Confirm clear' : 'Clear all'}
                  </button>
                )}
              </div>

              {/* Amber conviction line — the shared close on every Regis panel */}
              <div
                aria-hidden
                className="h-[2px] shrink-0"
                style={{ background: 'linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-deep) 55%, transparent 100%)' }}
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Saved row ───────────────────────────────────────────────── */

function SavedRow({
  report, index, savedAt, onView, onRemove,
}: {
  report: Report;
  index: number;
  savedAt: string | null;
  onView: () => void;
  onRemove: () => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE, delay: Math.min(index * 0.04, 0.24) } }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.22, ease: EASE } }}
      className="group relative"
    >
      {/* Hover tick — the same amber marker the sector rail uses */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
        style={{ background: 'var(--color-amber)' }}
      />

      <div className="flex items-start gap-4 px-5 py-4 transition-colors duration-300 group-hover:bg-bone md:px-7">
        <div className="min-w-0 flex-1">
          <div className="mono mb-1.5 flex items-center gap-2.5 text-[10px] uppercase tracking-[0.14em] text-graphite">
            <span className="truncate">{report.category ?? 'General'}</span>
            <span className="text-silver">/</span>
            <span className="num shrink-0">{fmtDate(report.date)}</span>
          </div>

          <button type="button" onClick={onView} className="block w-full text-left">
            <h3 className="text-[14.5px] font-medium leading-snug tracking-[-0.01em] text-ink transition-colors duration-300 group-hover:text-[color:var(--color-amber-deep)]">
              {report.title}
            </h3>
          </button>

          <div className="mono mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] tracking-[0.04em] text-graphite">
            <span className="truncate text-slate">{report.analyst}</span>
            {report.pages ? <span className="num">{report.pages}p</span> : null}
            <span className="num">{fmtBytes(report.fileSize)}</span>
            {savedAt && <span className="text-silver">Saved {timeAgo(savedAt)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <RowAction label="Open report" onClick={onView}>
            <IconEye size={15} />
          </RowAction>
          <RowAction label="Download PDF" onClick={() => void downloadReport(report, 'bookmarks')}>
            <IconDownload size={15} />
          </RowAction>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${report.title} from bookmarks`}
            title="Remove from bookmarks"
            className="group/mark relative grid h-[34px] w-[34px] shrink-0 place-items-center border transition-colors duration-300 active:translate-y-px"
            style={{ borderColor: 'color-mix(in oklab, var(--color-amber-deep) 45%, transparent)', color: 'var(--color-amber-deep)' }}
          >
            {/* Filled by default, hollow on hover — a preview of what the click does */}
            <span className="transition-opacity duration-200 group-hover/mark:opacity-0">
              <IconBookmarkFilled size={14} />
            </span>
            <span className="absolute opacity-0 transition-opacity duration-200 group-hover/mark:opacity-100">
              <IconBookmark size={14} />
            </span>
          </button>
        </div>
      </div>
    </motion.li>
  );
}

function RowAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-[34px] w-[34px] shrink-0 place-items-center border rule text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink active:translate-y-px"
    >
      {children}
    </button>
  );
}

/* ── Empty shelf ─────────────────────────────────────────────── */

function EmptyShelf() {
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-16 md:px-7">
      <span aria-hidden className="block h-[2px] w-6" style={{ background: 'var(--color-amber)' }} />
      <p className="text-[15px] font-medium text-ink">Nothing saved yet.</p>
      <p className="max-w-[52ch] text-[13.5px] leading-relaxed text-graphite">
        Bookmark any report to keep it here. Saved reports stay on your account and follow you across devices.
      </p>
      <span className="mono mt-3 inline-flex items-center gap-2.5 border rule px-3.5 py-2.5 text-[10.5px] uppercase tracking-[0.14em] text-graphite">
        <IconBookmark size={13} /> Beside every download button
      </span>
    </div>
  );
}
