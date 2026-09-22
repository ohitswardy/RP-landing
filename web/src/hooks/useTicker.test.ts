import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  demoEntries, normalizeWatchlist, orderWatchlist, useTicker, WATCHLIST_FALLBACK,
  type WatchSymbol,
} from './useTicker';
import { resetPublicContent } from '../lib/publicContent';

type Handler = (url: string) => Promise<Partial<Response>>;

/** Route fetch by URL: the CMS watchlist on /api, phisix on appspot. */
function stubFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return (await handler(url)) as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (body: unknown, status = 200): Partial<Response> => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const sym = (s: string, pinned = false): WatchSymbol => ({ id: s, sym: s, name: s, pinned });

describe('watchlist ordering', () => {
  it('puts pinned symbols first and keeps CMS order within each group', () => {
    const ordered = orderWatchlist([sym('ALI'), sym('BDO', true), sym('SM'), sym('TEL', true)]);
    expect(ordered.map((s) => s.sym)).toEqual(['BDO', 'TEL', 'ALI', 'SM']);
  });

  it('drops blanks and duplicates', () => {
    const ordered = orderWatchlist([sym('ALI'), sym(' '), sym('ali'), sym('SM')]);
    expect(ordered.map((s) => s.sym)).toEqual(['ALI', 'SM']);
  });

  it('falls back to the bundled list for a malformed or empty payload', () => {
    expect(normalizeWatchlist(null)).toBe(WATCHLIST_FALLBACK);
    expect(normalizeWatchlist({ symbols: 'nope' })).toBe(WATCHLIST_FALLBACK);
    expect(normalizeWatchlist({ symbols: [] })).toBe(WATCHLIST_FALLBACK);
  });

  it('normalises a live payload, pinned first, symbols upper-cased', () => {
    const list = normalizeWatchlist({ symbols: [{ id: '1', sym: 'ali', pinned: false }, { id: '2', sym: 'psei', pinned: true }] });
    expect(list.map((s) => s.sym)).toEqual(['PSEI', 'ALI']);
  });

  it('seeds demo prices where known and dashes where not, rendering PSEI as PSEi', () => {
    const demo = demoEntries([sym('PSEI'), sym('ZZZ')]);
    expect(demo[0]).toMatchObject({ sym: 'PSEi', last: '6,742.18' });
    expect(demo[1]).toMatchObject({ sym: 'ZZZ', last: '—', dir: 'flat' });
  });
});

describe('useTicker', () => {
  beforeEach(() => resetPublicContent());
  afterEach(() => vi.unstubAllGlobals());

  it('shows the bundled list in demo mode when both the watchlist and the feed fail', async () => {
    stubFetch(async (url) => {
      if (url.startsWith('/api/content/watchlist')) return json({ message: 'down' }, 500);
      throw new TypeError('network down');
    });

    const { result } = renderHook(() => useTicker(60_000));
    await waitFor(() => expect(result.current.status).toBe('demo'));

    expect(result.current.entries.map((e) => e.sym)).toEqual(WATCHLIST_FALLBACK.map((s) => s.sym));
    expect(result.current.entries[0]).toMatchObject({ sym: 'PSEi', last: '6,742.18' });
  });

  it('polls the feed for the CMS watchlist, pinned symbols first', async () => {
    stubFetch(async (url) => {
      if (url.startsWith('/api/content/watchlist')) {
        return json({ symbols: [
          { id: '1', sym: 'ALI', name: 'Ayala Land', pinned: false },
          { id: '2', sym: 'PSEI', name: 'PSE index', pinned: true },
          { id: '3', sym: 'BDO', name: 'BDO', pinned: false },
          { id: '4', sym: 'SM', name: 'SM', pinned: false },
        ] });
      }
      if (url.includes('phisix')) {
        return json({
          as_of: '2026-09-21T10:00:00+08:00',
          stock: [
            { symbol: 'ALI', name: 'Ayala Land', price: { currency: 'PHP', amount: 25.5 }, percent_change: 1.2, volume: 1 },
            { symbol: 'PSEI', name: 'PSEi', price: { currency: 'PHP', amount: 6800.12 }, percent_change: -0.4, volume: 1 },
            { symbol: 'BDO', name: 'BDO', price: { currency: 'PHP', amount: 150, }, percent_change: 0, volume: 1 },
            { symbol: 'SM', name: 'SM', price: { currency: 'PHP', amount: 900, }, percent_change: 0.5, volume: 1 },
          ],
        });
      }
      throw new TypeError(`unexpected ${url}`);
    });

    const { result } = renderHook(() => useTicker(60_000));
    await waitFor(() => {
      expect(result.current.status).toBe('live');
      expect(result.current.entries.map((e) => e.sym)).toEqual(['PSEi', 'ALI', 'BDO', 'SM']);
    });
    expect(result.current.entries[0]).toMatchObject({ sym: 'PSEi', last: '6,800.12', chg: '-0.40%', dir: 'down' });
    expect(result.current.entries[2]).toMatchObject({ sym: 'BDO', dir: 'flat' });
  });
});
