import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import {
  BtnPrimary, Chip, EmptyState, ModuleHeader, RowAction, SkeletonRows, Stat, useConfirm, EASE,
} from '../ui';
import { IconArrowDown, IconArrowUp, IconCheck, IconExternal, IconPin, IconPlus, IconTrash } from '../icons';
import { MiniBtn, Panel, move, useDragReorder } from '../kit/parts';
import { WATCH_SYM_RE, ribbonOrder, type WatchSymbol } from '../data';

/* ─────────────────────────────────────────────────────────────
   The symbols on the public market ribbon. Prices come from the
   PSE feed the browser polls itself, once a minute, so this
   module governs the list only: which tickers, in what order,
   and which ones are pinned to the front.
   ───────────────────────────────────────────────────────────── */

const MAX_SYMBOLS = 30;

export default function WatchlistModule() {
  const { watchlist, status, addWatchSymbol, updateWatchSymbol, reorderWatchlist, deleteWatchSymbol } = useCms();

  const [sym, setSym] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();

  const loading = status === 'loading';
  const pinned = useMemo(() => watchlist.filter((w) => w.pinned).length, [watchlist]);
  const onRibbon = useMemo(() => ribbonOrder(watchlist), [watchlist]);

  const { dragging, over, handle, target } = useDragReorder(watchlist, (next) => {
    void reorderWatchlist(next.map((w) => w.id));
  });

  const cleaned = sym.trim().toUpperCase();
  const duplicate = cleaned !== '' && watchlist.some((w) => w.sym === cleaned);

  async function add() {
    setAddError(null);
    if (!cleaned) return;
    if (!WATCH_SYM_RE.test(cleaned)) { setAddError('PSE tickers are 1 to 6 letters or digits.'); return; }
    if (duplicate) { setAddError(`${cleaned} is already on the ribbon.`); return; }
    if (watchlist.length >= MAX_SYMBOLS) { setAddError(`The ribbon carries at most ${MAX_SYMBOLS} symbols.`); return; }
    setAdding(true);
    try {
      await addWatchSymbol(cleaned);
      setSym('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'The symbol could not be added.');
    } finally {
      setAdding(false);
    }
  }

  function reorder(from: number, to: number) {
    const next = move(watchlist, from, to);
    if (next === watchlist) return;
    setRowError(null);
    void reorderWatchlist(next.map((w) => w.id)).catch((e: unknown) => {
      setRowError(e instanceof Error ? e.message : 'The order could not be saved.');
    });
  }

  function togglePin(w: WatchSymbol) {
    setRowError(null);
    void updateWatchSymbol(w.id, { pinned: !w.pinned }).catch((e: unknown) => {
      setRowError(e instanceof Error ? e.message : 'The pin could not be changed.');
    });
  }

  function remove(w: WatchSymbol) {
    setRowError(null);
    void deleteWatchSymbol(w.id).catch((e: unknown) => {
      setRowError(e instanceof Error ? e.message : 'The symbol could not be removed.');
    });
  }

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="12 / Market ribbon"
        title="Market ribbon"
        blurb="The tickers that scroll along the top of every public page. Pinned symbols lead the ribbon, the rest follow in the order below. Prices are the PSE feed's, polled by the visitor's browser once a minute."
        actions={
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="mono inline-flex items-center gap-2 border rule px-4 py-2.5 text-[10.5px] uppercase tracking-[0.16em] text-slate transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink"
          >
            View live ribbon <IconExternal size={12} />
          </a>
        }
      />

      {!loading && watchlist.length > 0 && (
        <div className="grid grid-cols-3 gap-6 border-b rule pb-8">
          <Stat value={String(watchlist.length)} label="Symbols" />
          <Stat value={String(pinned)} label="Pinned" />
          <Stat value="60 s" label="Ribbon refresh" />
        </div>
      )}

      {/* ── Preview ─────────────────────────────────────────── */}
      <Panel
        code="Preview"
        title="As the ribbon prints it"
        hint="Pinned first, then list order. Quotes are placeholders here; the live ribbon fills them from the feed, and a change made here reaches visitors on their next one-minute poll."
      >
        <RibbonPreview symbols={onRibbon} />
      </Panel>

      {/* ── Add ─────────────────────────────────────────────── */}
      <Panel code="Add" title="Add a symbol" hint="The PSE ticker exactly as the exchange lists it. The company name is filled from the feed.">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(e) => { e.preventDefault(); void add(); }}
        >
          <div className="flex flex-col gap-2 sm:w-[220px]">
            <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Ticker</label>
            <input
              value={sym}
              onChange={(e) => { setSym(e.target.value.toUpperCase()); setAddError(null); }}
              placeholder="ALI"
              maxLength={6}
              autoCapitalize="characters"
              spellCheck={false}
              className="mono w-full border rule bg-white px-3.5 py-2.5 text-[14px] uppercase tracking-[0.08em] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
              style={addError ? { borderColor: 'var(--color-warn)' } : undefined}
            />
            {addError ? (
              <p className="text-[12px]" style={{ color: 'var(--color-warn)' }}>{addError}</p>
            ) : duplicate ? (
              <p className="text-[12px]" style={{ color: 'var(--color-amber-deep)' }}>{cleaned} is already on the ribbon.</p>
            ) : (
              <p className="text-[12px] text-graphite">1 to 6 letters or digits.</p>
            )}
          </div>
          <div className="sm:pt-[26px]">
            <BtnPrimary type="submit" disabled={adding || !cleaned || duplicate}>
              <IconPlus size={14} /> {adding ? 'Adding…' : 'Add to ribbon'}
            </BtnPrimary>
          </div>
        </form>
      </Panel>

      {/* ── Order ───────────────────────────────────────────── */}
      <Panel
        code="Order"
        title="Symbols"
        hint="Drag a row by its handle or use the arrows. Pinning moves a symbol to the front without changing its place in this list."
        actions={<span className="mono num text-[10px] uppercase tracking-[0.16em] text-graphite">{watchlist.length} / {MAX_SYMBOLS}</span>}
      >
        {rowError && (
          <p className="mb-4 border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
            {rowError}
          </p>
        )}

        {loading ? (
          <SkeletonRows rows={5} />
        ) : watchlist.length === 0 ? (
          <EmptyState
            title="The ribbon has no symbols."
            hint="Until at least one ticker is added here, the public ribbon falls back to its built-in list."
          />
        ) : (
          <ul className="divide-y rule border-y rule">
            <AnimatePresence initial={false}>
              {watchlist.map((w, i) => (
                <motion.li
                  key={w.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
                  {...target(i)}
                  className="flex items-center gap-4 py-3 transition-colors"
                  style={{
                    background: over === i && dragging !== null && dragging !== i ? 'color-mix(in oklab, var(--color-amber) 10%, transparent)' : undefined,
                    opacity: dragging === i ? 0.45 : 1,
                  }}
                >
                  <span
                    {...handle(i)}
                    title="Drag to reorder"
                    aria-label={`Drag ${w.sym}`}
                    className="mono grid h-7 w-7 shrink-0 cursor-grab place-items-center text-[12px] leading-none text-silver select-none active:cursor-grabbing"
                  >
                    ⋮⋮
                  </span>
                  <span className="mono num w-6 shrink-0 text-[10.5px] text-graphite">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mono w-[72px] shrink-0 text-[13.5px] tracking-[0.06em] text-ink">{w.sym}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate">{w.name !== w.sym ? w.name : <span className="text-silver">Name from the feed</span>}</span>
                  <span className="hidden sm:block">
                    {w.pinned ? <Chip tone="amber">Pinned · leads</Chip> : <Chip tone="muted">In order</Chip>}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <MiniBtn label={w.pinned ? `Unpin ${w.sym}` : `Pin ${w.sym} to the front`} active={w.pinned} onClick={() => togglePin(w)}>
                      <IconPin size={13} />
                    </MiniBtn>
                    <MiniBtn label={`Move ${w.sym} up`} disabled={i === 0} onClick={() => reorder(i, i - 1)}>
                      <IconArrowUp size={13} />
                    </MiniBtn>
                    <MiniBtn label={`Move ${w.sym} down`} disabled={i === watchlist.length - 1} onClick={() => reorder(i, i + 1)}>
                      <IconArrowDown size={13} />
                    </MiniBtn>
                    <RowAction label={armed === w.id ? 'Confirm remove' : `Remove ${w.sym}`} danger onClick={() => confirm(w.id, () => remove(w))}>
                      {armed === w.id ? <IconCheck /> : <IconTrash />}
                    </RowAction>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ── Preview strip ─────────────────────────────────────────── */

/**
 * The navy strip as the public site prints it, scaled to the panel. It is
 * public-site chrome, so it sits in a `theme-light` island and keeps its
 * navy in dark mode. Quotes are not fetched here; the ribbon is a live
 * feed and this is about order, not price.
 */
function RibbonPreview({ symbols }: { symbols: WatchSymbol[] }) {
  return (
    <div className="theme-light overflow-hidden border rule" style={{ background: 'var(--color-navy-deep)' }}>
      <div className="flex h-9 items-stretch">
        <div className="relative flex-1 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12" style={{ background: 'linear-gradient(to left, var(--color-navy-deep), transparent)' }} />
          <div className="mono flex h-full items-center gap-8 overflow-x-auto whitespace-nowrap px-6 text-[11px] tracking-[0.04em]" style={{ scrollbarWidth: 'none' }}>
            {symbols.length === 0 ? (
              <span className="text-paper/45">Built-in list until a symbol is added</span>
            ) : symbols.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-2">
                <span className={t.pinned ? 'text-[color:var(--color-amber)]' : 'text-paper/85'}>{t.sym}</span>
                <span className="num text-paper/35">—</span>
                <span className="num text-paper/35">◆ —</span>
                <span className="px-2 text-paper/15" aria-hidden>/</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-l pl-5 pr-6" style={{ borderColor: 'color-mix(in oklab, var(--color-paper) 12%, transparent)' }}>
          <span className="block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-signal)' }} />
          <span className="mono text-[9.5px] uppercase tracking-[0.18em] text-paper/70">PSE · Delayed</span>
        </div>
      </div>
      <div className="mono flex items-center justify-between border-t px-4 py-1.5 text-[9px] uppercase tracking-[0.16em] text-paper/45" style={{ borderColor: 'color-mix(in oklab, var(--color-paper) 10%, transparent)' }}>
        <span>{symbols.filter((s) => s.pinned).length} pinned lead · then list order</span>
        <span>Visitors' browsers poll the feed every 60 s</span>
      </div>
    </div>
  );
}
