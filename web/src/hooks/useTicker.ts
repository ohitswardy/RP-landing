import { useEffect, useMemo, useRef, useState } from 'react';
import { usePublicContent } from '../lib/publicContent';

export type TickerEntry = {
  sym: string;
  last: string;
  chg: string;
  dir: 'up' | 'down' | 'flat';
};

export type TickerState = {
  entries: TickerEntry[];
  status: 'loading' | 'live' | 'demo';
  updatedAt: Date | null;
};

/* ─────────────────────────────────────────────────────────────
   The market ribbon. Which symbols it shows comes from the CMS
   watchlist (GET /api/content/watchlist, pinned names first); the
   prices come straight from the community phisix feed, polled every
   minute from the browser. When the watchlist is unreachable the
   bundled list below stands in, and when the feed is unreachable the
   seeded DEMO prices do, with the badge saying so.
   ───────────────────────────────────────────────────────────── */

export type WatchSymbol = { id: string; sym: string; name: string; pinned: boolean };

/** The bundled watchlist: the ribbon's historical 15 names, in display order. */
export const WATCHLIST_FALLBACK: WatchSymbol[] = [
  'PSEi', 'ALI', 'BPI', 'SM', 'JFC', 'TEL', 'AC', 'ICT',
  'BDO', 'MER', 'URC', 'GLO', 'AEV', 'MBT', 'AP',
].map((sym, i) => ({ id: `fallback-${i}`, sym, name: sym, pinned: false }));

/** Seeded prices so the ribbon never runs empty. */
const DEMO_PRICES: Record<string, Omit<TickerEntry, 'sym'>> = {
  PSEI: { last: '6,742.18', chg: '+0.42%', dir: 'up' },
  ALI:  { last: '24.85',    chg: '+1.18%', dir: 'up' },
  BPI:  { last: '128.40',   chg: '-0.31%', dir: 'down' },
  SM:   { last: '925.00',   chg: '+0.05%', dir: 'up' },
  JFC:  { last: '241.60',   chg: '-0.74%', dir: 'down' },
  TEL:  { last: '1,388.00', chg: '+0.93%', dir: 'up' },
  AC:   { last: '588.50',   chg: '-0.17%', dir: 'down' },
  ICT:  { last: '378.20',   chg: '+2.14%', dir: 'up' },
  BDO:  { last: '152.10',   chg: '+0.27%', dir: 'up' },
  MER:  { last: '417.00',   chg: '-0.84%', dir: 'down' },
  URC:  { last: '102.30',   chg: '+0.49%', dir: 'up' },
  GLO:  { last: '1,856.00', chg: '-1.06%', dir: 'down' },
  AEV:  { last: '49.80',    chg: '+0.61%', dir: 'up' },
  MBT:  { last: '74.55',    chg: '-0.13%', dir: 'down' },
  AP:   { last: '38.40',    chg: '+0.79%', dir: 'up' },
};

/** phisix keys the index as "PSEI"; the ribbon has always printed it "PSEi". */
function displaySymbol(sym: string): string {
  return sym.toUpperCase() === 'PSEI' ? 'PSEi' : sym.toUpperCase();
}

/** Demo entries for a symbol list: seeded prices where known, dashes where not. */
export function demoEntries(symbols: WatchSymbol[]): TickerEntry[] {
  return symbols.map((w) => {
    const seeded = DEMO_PRICES[w.sym.toUpperCase()];
    return seeded
      ? { sym: displaySymbol(w.sym), ...seeded }
      : { sym: displaySymbol(w.sym), last: '—', chg: '0.00%', dir: 'flat' };
  });
}

/** Pinned names first, otherwise the CMS order; duplicates and blanks dropped. */
export function orderWatchlist(symbols: WatchSymbol[]): WatchSymbol[] {
  const seen = new Set<string>();
  const clean = symbols.filter((s) => {
    const key = s.sym.trim().toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Array.prototype.sort is stable, so within each group the CMS order holds.
  return [...clean].sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

/** Tolerate a partial payload; an empty list is not a list. */
export function normalizeWatchlist(raw: unknown): WatchSymbol[] {
  const r = raw as { symbols?: unknown } | null;
  if (!r || !Array.isArray(r.symbols)) return WATCHLIST_FALLBACK;
  const list = r.symbols
    .map((s): WatchSymbol => {
      const x = (s ?? {}) as Partial<WatchSymbol>;
      return {
        id: String(x.id ?? ''),
        sym: String(x.sym ?? '').trim().toUpperCase(),
        name: String(x.name ?? ''),
        pinned: Boolean(x.pinned),
      };
    })
    .filter((s) => s.sym !== '');
  return list.length > 0 ? orderWatchlist(list) : WATCHLIST_FALLBACK;
}

/** The ribbon's symbol list: the CMS watchlist, or the bundled 15 until it lands / if it fails. */
export function useWatchlist(): WatchSymbol[] {
  const { data } = usePublicContent('/content/watchlist', WATCHLIST_FALLBACK, normalizeWatchlist);
  return data;
}

/* ── phisix ────────────────────────────────────────────────── */

type PhisixStock = {
  symbol: string;
  name: string;
  price: { currency: string; amount: number };
  percent_change: number;
  volume: number;
};

type PhisixResponse = {
  as_of: string;
  stock: PhisixStock[];
};

// Community endpoints. We try in order; first success wins.
const ENDPOINTS = [
  'https://phisix-api4.appspot.com/stocks.json',
  'https://phisix-api3.appspot.com/stocks.json',
  'https://phisix-api.appspot.com/stocks.json',
];

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/** Map a phisix payload onto the watchlist, in watchlist order. */
export function pickQuotes(data: PhisixResponse, symbols: WatchSymbol[]): TickerEntry[] {
  const bySym = new Map<string, PhisixStock>();
  for (const s of data.stock) bySym.set(s.symbol.toUpperCase(), s);

  const out: TickerEntry[] = [];
  for (const w of symbols) {
    const s = bySym.get(w.sym.toUpperCase());
    if (!s) continue;
    const dir: TickerEntry['dir'] =
      s.percent_change > 0 ? 'up' : s.percent_change < 0 ? 'down' : 'flat';
    out.push({
      sym: displaySymbol(w.sym),
      last: formatPrice(s.price.amount),
      chg: formatChange(s.percent_change),
      dir,
    });
  }
  return out;
}

async function fetchPhisix(signal: AbortSignal, symbols: WatchSymbol[]): Promise<TickerEntry[] | null> {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { signal, cache: 'no-store' });
      if (!res.ok) continue;
      const data: PhisixResponse = await res.json();
      if (!Array.isArray(data?.stock)) continue;
      const out = pickQuotes(data, symbols);
      // A feed that knows almost none of our names is not a feed worth showing.
      if (out.length >= Math.min(4, symbols.length)) return out;
    } catch {
      // try the next endpoint
    }
  }
  return null;
}

export function useTicker(refreshMs = 60_000): TickerState {
  const watchlist = useWatchlist();
  const demo = useMemo(() => demoEntries(watchlist), [watchlist]);
  const [state, setState] = useState<TickerState>({
    entries: demo,
    status: 'loading',
    updatedAt: null,
  });
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      aborter.current?.abort();
      const ac = new AbortController();
      aborter.current = ac;
      const result = await fetchPhisix(ac.signal, watchlist);
      if (cancelled) return;
      if (result) {
        setState({ entries: result, status: 'live', updatedAt: new Date() });
      } else {
        // Stay on whatever we had, but mark demo so the badge is honest
        setState((prev) => ({
          entries: prev.status === 'live' && prev.entries.length ? prev.entries : demo,
          status: 'demo',
          updatedAt: prev.updatedAt,
        }));
      }
    }

    tick();
    const id = window.setInterval(tick, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      aborter.current?.abort();
    };
  }, [refreshMs, watchlist, demo]);

  return state;
}
