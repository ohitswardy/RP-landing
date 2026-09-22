import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CmsProvider, MediaInUseError, useCms } from './store';
import { EMPTY_CONTACT } from './data';

/* ─────────────────────────────────────────────────────────────
   The CMS store: bootstrap merge, {item, audit} mutation merges,
   optimistic reorders, and the media-in-use refusal.
   ───────────────────────────────────────────────────────────── */

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const AUDIT = (id: string, action: string) => ({ id, actor: 'E. Dagal', action, target: 'x', at: '2026-09-21T00:00:00Z' });

/** A bootstrap from an API build that predates careers/watchlist. */
const BOOTSTRAP = {
  articles: [], reports: [], companies: [], reportTypes: [],
  trendingRules: { enabled: true, metric: 'views', windowMonths: 3, limit: 3, minEvents: 1 },
  people: [], services: [], servicePage: { eyebrow: '', title: '', dek: '', heroImage: '', cardCta: '' },
  aboutPage: { hero: { eyebrow: '', title: '', image: '' }, overview: { heading: '', paragraphs: [], profile: [] }, heritage: { eyebrow: '', heading: '', timeline: [] }, leadership: { heading: '' }, awards: { eyebrow: '', heading: '', groups: [] } },
  contactPage: EMPTY_CONTACT,
  homePage: {}, insightsPage: {},
  newsletters: [], subscribers: [], pages: [],
  media: [{ id: '1', path: '/api/media/site/a.jpg', label: 'A', kind: 'photo', usedBy: 'Home' }],
  watchlist: [{ id: '1', sym: 'ALI', name: 'Ayala Land', pinned: false }, { id: '2', sym: 'BPI', name: 'BPI', pinned: true }],
  audit: [AUDIT('0', 'Seeded')],
};

let lastError: unknown = null;

function Probe() {
  const cms = useCms();
  return (
    <div>
      <span data-testid="status">{cms.status}</span>
      <span data-testid="careers">{cms.careers.length}</span>
      <span data-testid="watch">{cms.watchlist.map((w) => w.sym).join(',')}</span>
      <span data-testid="media">{cms.media.map((m) => m.id).join(',')}</span>
      <span data-testid="audit">{cms.audit.map((a) => a.action).join('|')}</span>
      <button type="button" onClick={() => void cms.addWatchSymbol('sm')}>add</button>
      <button type="button" onClick={() => void cms.reorderWatchlist(['2', '1'])}>reorder</button>
      <button type="button" onClick={() => void cms.addCareer({ title: 'Analyst', dept: 'Research', type: 'Full-time', location: 'Makati', summary: '', body: '' })}>career</button>
      <button type="button" onClick={() => { lastError = null; void cms.deleteMedia('1').catch((e: unknown) => { lastError = e; }); }}>delmedia</button>
    </div>
  );
}

describe('cms store', () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    sessionStorage.setItem('regis.cms.token', 'tok');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    lastError = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  function route(handlers: Record<string, (init?: RequestInit) => Response>) {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const key = `${(init?.method ?? 'GET').toUpperCase()} ${url}`;
      const hit = Object.entries(handlers).find(([k]) => key === k || key.endsWith(k));
      return hit ? hit[1](init) : json(404, { message: `no route for ${key}` });
    });
  }

  async function mountReady() {
    render(<CmsProvider><Probe /></CmsProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'));
  }

  it('fills collections the bootstrap omits, so older API builds never crash a module', async () => {
    route({ 'GET /api/cms/bootstrap': () => json(200, BOOTSTRAP) });
    await mountReady();
    expect(screen.getByTestId('careers').textContent).toBe('0');
    expect(screen.getByTestId('watch').textContent).toBe('ALI,BPI');
  });

  it('merges {item, audit} from a create: item upserted, audit row prepended', async () => {
    route({
      'GET /api/cms/bootstrap': () => json(200, BOOTSTRAP),
      'POST /api/cms/watchlist': (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ sym: 'SM' });
        return json(201, { item: { id: '3', sym: 'SM', name: 'SM', pinned: false }, audit: AUDIT('9', 'Added ribbon symbol') });
      },
      'POST /api/cms/careers': () => json(201, {
        item: { id: '4', title: 'Analyst', dept: 'Research', type: 'Full-time', location: 'Makati', summary: '', body: '', posted: '2026-09-21', status: 'open', applicants: 0 },
        audit: AUDIT('10', 'Opened posting'),
      }),
    });
    await mountReady();

    await act(async () => { screen.getByText('add').click(); });
    await waitFor(() => expect(screen.getByTestId('watch').textContent).toBe('ALI,BPI,SM'));
    expect(screen.getByTestId('audit').textContent).toBe('Added ribbon symbol|Seeded');

    await act(async () => { screen.getByText('career').click(); });
    await waitFor(() => expect(screen.getByTestId('careers').textContent).toBe('1'));
    expect(screen.getByTestId('audit').textContent).toBe('Opened posting|Added ribbon symbol|Seeded');
  });

  it('reorders the watchlist optimistically, then takes the server echo', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    route({
      'GET /api/cms/bootstrap': () => json(200, BOOTSTRAP),
      'PUT /api/cms/watchlist/reorder': () => json(200, { items: [{ id: '2', sym: 'BPI', name: 'BPI', pinned: true }, { id: '1', sym: 'ALI', name: 'Ayala Land', pinned: false }], audit: AUDIT('11', 'Reordered ribbon symbols') }),
    });
    fetchMock.mockImplementationOnce(async () => json(200, BOOTSTRAP)); // bootstrap
    fetchMock.mockImplementationOnce(async () => { await gate; return json(200, { items: [{ id: '2', sym: 'BPI', name: 'BPI', pinned: true }, { id: '1', sym: 'ALI', name: 'Ayala Land', pinned: false }], audit: AUDIT('11', 'Reordered ribbon symbols') }); });
    await mountReady();

    await act(async () => { screen.getByText('reorder').click(); });
    // Optimistic: the list has already moved before the API answers.
    expect(screen.getByTestId('watch').textContent).toBe('BPI,ALI');
    expect(screen.getByTestId('audit').textContent).toBe('Seeded');

    await act(async () => { release(); await gate; });
    await waitFor(() => expect(screen.getByTestId('audit').textContent).toBe('Reordered ribbon symbols|Seeded'));
    expect(screen.getByTestId('watch').textContent).toBe('BPI,ALI');
  });

  it('surfaces a media delete refused as 409 with the documents still using it', async () => {
    route({
      'GET /api/cms/bootstrap': () => json(200, BOOTSTRAP),
      'DELETE /api/cms/media/1': () => json(409, { message: 'This image is still in use. Replace it there first.', references: ['Landing page · hero', 'Services / Equities'] }),
    });
    await mountReady();

    await act(async () => { screen.getByText('delmedia').click(); });
    await waitFor(() => expect(lastError).toBeInstanceOf(MediaInUseError));
    expect((lastError as MediaInUseError).references).toEqual(['Landing page · hero', 'Services / Equities']);
    // Nothing was removed locally.
    expect(screen.getByTestId('media').textContent).toBe('1');
  });
});
