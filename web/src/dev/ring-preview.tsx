/* Dev-only harness: renders the Overview's Portal engagement panel with a
   stubbed ledger response so the ring chart can be eyeballed without the
   Laravel API or a CMS session. Served only via /ring-preview.html in dev. */
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { PortalEngagement } from '../cms/modules/Overview';
import '../index.css';

const SUMMARY = { total: 202, views: 132, downloads: 47, clicks: 23, actors: 18 };

const realFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes('/api/cms/client-logs')) {
    return Promise.resolve(
      new Response(JSON.stringify({ summary: SUMMARY }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  return realFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="cms-scope mx-auto max-w-[900px] px-10 py-16">
      <PortalEngagement now={Date.now()} />
    </div>
  </MemoryRouter>,
);
