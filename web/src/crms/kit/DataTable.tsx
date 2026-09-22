import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, EmptyState, SkeletonRows } from '../../cms/ui';
import { markSuccess } from '../../lib/activity';
import { IconArrowDown, IconArrowUp, IconDownload, IconSearch, IconX } from '../../cms/icons';
import { Select } from '../../cms/kit/pickers';

/* ─────────────────────────────────────────────────────────────
   The one list component every CRMS screen uses — the React
   answer to the legacy DataTables setup: search, sortable
   columns, column visibility, page size with "Show all", CSV
   export, print view, and a row-action column. Client-side over
   the rows it is given; the paged modules hand it one page and
   render their own pager underneath.
   ───────────────────────────────────────────────────────────── */

export type Column<T> = {
  key: string;
  label: string;
  /** Plain value for search, sort, CSV and print. Defaults to the cell text. */
  value?: (row: T) => string | number | null | undefined;
  /** Rich cell. Defaults to the value. */
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  /** Start hidden; the column picker can reveal it. */
  hidden?: boolean;
  /** Tailwind width / span classes for the cell. */
  className?: string;
  align?: 'left' | 'right';
  mono?: boolean;
};

const PAGE_SIZES = [10, 25, 50, 0] as const; // 0 = all

function cellValue<T>(col: Column<T>, row: T): string {
  const v = col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];
  return v === null || v === undefined ? '' : String(v);
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function DataTable<T extends { id: string }>({
  rows, columns, loading = false, title = 'Records', searchPlaceholder = 'Search', emptyTitle = 'Nothing here yet.', emptyHint = '',
  actions, onRowClick, toolbar, storageKey, initialPageSize = 25, hideSearch = false, footer,
}: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  title?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyHint?: string;
  /** Row-action cell (edit / delete). */
  actions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** Extra controls left of the search box (filters, New button). */
  toolbar?: ReactNode;
  /** Remembers hidden columns and page size per screen. */
  storageKey?: string;
  initialPageSize?: number;
  hideSearch?: boolean;
  footer?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => read(storageKey, 'size', initialPageSize));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(read<string[]>(storageKey, 'hidden', columns.filter((c) => c.hidden).map((c) => c.key))));
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPage(1); }, [q, pageSize, rows.length]);
  useEffect(() => { write(storageKey, 'size', pageSize); }, [storageKey, pageSize]);
  useEffect(() => { write(storageKey, 'hidden', Array.from(hidden)); }, [storageKey, hidden]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const visible = columns.filter((c) => !hidden.has(c.key));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = s ? rows.filter((r) => columns.some((c) => cellValue(c, r).toLowerCase().includes(s))) : rows.slice();
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        out = out.slice().sort((a, b) => {
          const va = col.value ? col.value(a) : cellValue(col, a);
          const vb = col.value ? col.value(b) : cellValue(col, b);
          const na = typeof va === 'number' && typeof vb === 'number';
          const cmp = na ? (va as number) - (vb as number) : String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, columns, q, sort]);

  const pages = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const paged = pageSize ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered;

  const toggleSort = (key: string) => {
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));
  };

  const exportCsv = () => {
    const head = visible.map((c) => csvEscape(c.label)).join(',');
    const body = filtered.map((r) => visible.map((c) => csvEscape(cellValue(c, r))).join(',')).join('\n');
    const blob = new Blob([`﻿${head}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    markSuccess();
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] ?? ch));
    const head = visible.map((c) => `<th>${esc(c.label)}</th>`).join('');
    const body = filtered.map((r) => `<tr>${visible.map((c) => `<td>${esc(cellValue(c, r))}</td>`).join('')}</tr>`).join('');
    w.document.write(`<!doctype html><title>${esc(title)}</title><style>
      body{font:12px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;padding:28px}
      h1{font-size:16px;font-weight:500;margin:0 0 4px}.m{font:10px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#777;margin-bottom:18px}
      table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;vertical-align:top}th{font:10px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#555}
    </style><h1>${esc(title)}</h1><div class="m">Regis CRMS · ${filtered.length} rows · ${new Date().toLocaleString('en-PH')}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        <div className="flex flex-wrap items-center gap-2">
          {!hideSearch && (
            <label className="flex items-center gap-2 border rule bg-white px-3">
              <IconSearch size={13} className="text-silver" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="w-[160px] bg-transparent py-2 text-[13px] outline-none placeholder:text-silver md:w-[200px]" />
              {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="text-graphite hover:text-ink"><IconX size={12} /></button>}
            </label>
          )}
          <div className="relative" ref={colsRef}>
            <ToolBtn onClick={() => setColsOpen((v) => !v)} active={colsOpen}>Columns</ToolBtn>
            <AnimatePresence>
              {colsOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: EASE }} className="absolute right-0 top-[calc(100%+4px)] z-30 min-w-[200px] border rule bg-paper py-1 shadow-[0_24px_50px_-28px_rgba(13,13,13,0.4)]">
                  {columns.map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-3 px-3.5 py-2 text-[13px] text-slate hover:bg-bone">
                      <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => setHidden((h) => { const n = new Set(h); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; })} className="accent-[navy]" />
                      {c.label}
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Select
            variant="compact"
            ariaLabel="Rows per page"
            className="w-[128px]"
            value={String(pageSize)}
            onChange={(v) => { if (v !== null) setPageSize(Number(v)); }}
            options={PAGE_SIZES.map((n) => ({ id: String(n), label: n === 0 ? 'Show all' : `${n} rows` }))}
          />
          <ToolBtn onClick={exportCsv} disabled={filtered.length === 0}><IconDownload size={12} /> CSV</ToolBtn>
          <ToolBtn onClick={print} disabled={filtered.length === 0}>Print</ToolBtn>
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState title={q ? `No rows match “${q}”.` : emptyTitle} hint={q ? 'Clear the search to see every row.' : emptyHint} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b rule">
                {visible.map((c) => (
                  <th key={c.key} className={`py-2.5 pr-4 text-left align-bottom ${c.align === 'right' ? 'text-right' : ''} ${c.className ?? ''}`}>
                    {c.sortable === false ? (
                      <span className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">{c.label}</span>
                    ) : (
                      <button type="button" onClick={() => toggleSort(c.key)} className={`mono inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.2em] transition-colors ${sort?.key === c.key ? 'text-ink' : 'text-graphite hover:text-ink'}`}>
                        {c.label}
                        {sort?.key === c.key && (sort.dir === 'asc' ? <IconArrowUp size={10} /> : <IconArrowDown size={10} />)}
                      </button>
                    )}
                  </th>
                ))}
                {actions && <th className="w-[1%] py-2.5 text-right"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {paged.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.3, ease: EASE, delay: Math.min(i * 0.02, 0.2) } }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`group border-b rule transition-colors hover:bg-bone/70 ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {visible.map((c) => (
                      <td key={c.key} className={`py-3 pr-4 align-top text-[13.5px] text-slate ${c.align === 'right' ? 'text-right' : ''} ${c.mono ? 'mono num text-[12.5px]' : ''} ${c.className ?? ''}`}>
                        {c.render ? c.render(row) : cellValue(c, row) || <span className="text-silver">—</span>}
                      </td>
                    ))}
                    {actions && (
                      <td className="py-2.5 text-right align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">{actions(row)}</div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {(pages > 1 || footer) && !loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="mono num text-[10.5px] uppercase tracking-[0.16em] text-graphite">
            {filtered.length.toLocaleString('en-PH')} row{filtered.length === 1 ? '' : 's'}{pageSize ? ` · page ${page} / ${pages}` : ''}
          </span>
          <div className="flex items-center gap-3">
            {footer}
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <ToolBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</ToolBtn>
                <ToolBtn onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Next</ToolBtn>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolBtn({ children, onClick, disabled = false, active = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`mono inline-flex items-center gap-1.5 border px-3 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'border-navy bg-navy text-paper' : 'rule text-slate hover:border-[color:var(--color-amber-deep)] hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function read<T>(key: string | undefined, part: string, fallback: T): T {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(`regis-crms-table:${key}:${part}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string | undefined, part: string, value: unknown) {
  if (!key) return;
  try { localStorage.setItem(`regis-crms-table:${key}:${part}`, JSON.stringify(value)); } catch { /* ignore */ }
}
