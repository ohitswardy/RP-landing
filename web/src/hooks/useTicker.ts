import { useEffect, useRef, useState } from 'react';

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

// Symbols we want to surface on the ribbon, in display order.
const WATCH = [
  'PSEi', 'ALI', 'BPI', 'SM', 'JFC', 'TEL', 'AC', 'ICT',
  'BDO', 'MER', 'URC', 'GLO', 'AEV', 'MBT', 'AP',
] as const;

// Static fallback so the UI never empties out.
const DEMO: TickerEntry[] = [
  { sym: 'PSEi', last: '6,742.18', chg: '+0.42%', dir: 'up' },
  { sym: 'ALI',  last: '24.85',    chg: '+1.18%', dir: 'up' },
  { sym: 'BPI',  last: '128.40',   chg: '-0.31%', dir: 'down' },
  { sym: 'SM',   last: '925.00',   chg: '+0.05%', dir: 'up' },
  { sym: 'JFC',  last: '241.60',   chg: '-0.74%', dir: 'down' },
  { sym: 'TEL',  last: '1,388.00', chg: '+0.93%', dir: 'up' },
  { sym: 'AC',   last: '588.50',   chg: '-0.17%', dir: 'down' },
  { sym: 'ICT',  last: '378.20',   chg: '+2.14%', dir: 'up' },
  { sym: 'BDO',  last: '152.10',   chg: '+0.27%', dir: 'up' },
  { sym: 'MER',  last: '417.00',   chg: '-0.84%', dir: 'down' },
  { sym: 'URC',  last: '102.30',   chg: '+0.49%', dir: 'up' },
  { sym: 'GLO',  last: '1,856.00', chg: '-1.06%', dir: 'down' },
  { sym: 'AEV',  last: '49.80',    chg: '+0.61%', dir: 'up' },
  { sym: 'MBT',  last: '74.55',    chg: '-0.13%', dir: 'down' },
  { sym: 'AP',   last: '38.40',    chg: '+0.79%', dir: 'up' },
];

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

async function fetchPhisix(signal: AbortSignal): Promise<TickerEntry[] | null> {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { signal, cache: 'no-store' });
      if (!res.ok) continue;
      const data: PhisixResponse = await res.json();
      if (!Array.isArray(data?.stock)) continue;

      const bySym = new Map<string, PhisixStock>();
      for (const s of data.stock) bySym.set(s.symbol.toUpperCase(), s);

      const out: TickerEntry[] = [];
      for (const w of WATCH) {
        // phisix uses "PSEI" for the index, we render it as "PSEi"
        const lookup = w === 'PSEi' ? 'PSEI' : w;
        const s = bySym.get(lookup);
        if (!s) continue;
        const dir: TickerEntry['dir'] =
          s.percent_change > 0 ? 'up' : s.percent_change < 0 ? 'down' : 'flat';
        out.push({
          sym: w,
          last: formatPrice(s.price.amount),
          chg: formatChange(s.percent_change),
          dir,
        });
      }
      if (out.length >= 4) return out;
    } catch {
      // try the next endpoint
    }
  }
  return null;
}

export function useTicker(refreshMs = 60_000): TickerState {
  const [state, setState] = useState<TickerState>({
    entries: DEMO,
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
      const result = await fetchPhisix(ac.signal);
      if (cancelled) return;
      if (result) {
        setState({ entries: result, status: 'live', updatedAt: new Date() });
      } else {
        // Stay on whatever we had, but mark demo so the badge is honest
        setState((prev) => ({
          entries: prev.entries.length ? prev.entries : DEMO,
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
  }, [refreshMs]);

  return state;
}
