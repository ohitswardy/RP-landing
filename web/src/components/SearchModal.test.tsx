import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SearchModal, { computeResults, type SearchEntry } from './SearchModal';
import { normalizeSearchIndex, SEARCH_FALLBACK } from '../lib/searchContent';

const INDEX: SearchEntry[] = [
  { title: 'Research Advisory', desc: 'Original equity research.', href: '/services/research', category: 'Services', keywords: ['research'] },
  { title: 'Maria Research-Lead', desc: 'Head of Research · Research', href: '/about#maria-research-lead', category: 'People', keywords: ['head of research', 'research', 'banks'] },
  { title: 'NIMs have peaked.', desc: 'Banks · 2026-05-21', href: '/insights/nims-have-peaked', category: 'Insights', keywords: ['banks', 'note', 'research'] },
  { title: 'Careers', desc: 'Open roles across the desk.', href: '/careers', category: 'Pages', keywords: ['careers', 'jobs'] },
];

const noop = () => {};

describe('computeResults', () => {
  it('ranks an exact title above a keyword hit and drops non-matches', () => {
    const hits = computeResults('research', INDEX);
    expect(hits[0].title).toBe('Research Advisory');
    expect(hits.map((h) => h.title)).not.toContain('Careers');
    expect(hits.map((h) => h.category)).toEqual(expect.arrayContaining(['Services', 'People', 'Insights']));
  });

  it('returns nothing for a blank query', () => {
    expect(computeResults('   ', INDEX)).toEqual([]);
  });
});

describe('search index', () => {
  it('flattens the API payload into linkable entries', () => {
    const entries = normalizeSearchIndex({
      people: [{ id: '1', name: 'Ana Cruz', role: 'Analyst', team: 'Research', sectors: ['Banks'], anchor: '/about#ana-cruz' }],
      services: [{ id: '2', title: 'Sales Advisory', slug: 'sales', summary: 'Dealing desk.', path: '/services/sales' }],
      insights: [{ id: '3', title: 'BSP pivot', slug: 'bsp-pivot', tag: 'Policy', date: '2026-05-16', path: '/insights/bsp-pivot' }],
      pages: [{ title: 'Home', path: '/' }],
    });
    expect(entries.find((e) => e.category === 'People')?.href).toBe('/about#ana-cruz');
    expect(entries.find((e) => e.category === 'Insights')?.href).toBe('/insights/bsp-pivot');
    expect(entries.find((e) => e.category === 'Services')?.href).toBe('/services/sales');
    expect(entries.find((e) => e.category === 'Pages')?.href).toBe('/');
  });

  it('bundles a compact fallback with no dead anchors', () => {
    expect(SEARCH_FALLBACK.length).toBeGreaterThan(10);
    expect(SEARCH_FALLBACK.some((e) => e.href.includes('#compliance'))).toBe(false);
    expect(SEARCH_FALLBACK.filter((e) => e.category === 'Insights').every((e) => e.href.startsWith('/insights/'))).toBe(true);
  });
});

describe('<SearchModal />', () => {
  it('renders results grouped by category from the index it is given', () => {
    render(
      <SearchModal
        open
        index={INDEX}
        query="research"
        onQueryChange={noop}
        activeIndex={0}
        onActiveIndex={noop}
        onSelect={noop}
      />,
    );

    // Group headings, in ranked order of first appearance.
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.queryByText('Pages')).not.toBeInTheDocument();

    // Entries render as buttons that hand back their href.
    const buttons = screen.getAllByRole('button');
    expect(buttons.some((b) => within(b).queryByText(/Advisory/))).toBe(true);
    expect(buttons.some((b) => within(b).queryByText(/NIMs/))).toBe(true);
  });

  it('hands the chosen href to onSelect', () => {
    const onSelect = vi.fn();
    render(
      <SearchModal
        open
        index={INDEX}
        query="careers"
        onQueryChange={noop}
        activeIndex={0}
        onActiveIndex={noop}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Careers/ }));
    expect(onSelect).toHaveBeenCalledWith('/careers');
  });

  it('shows the empty state for a query nothing matches', () => {
    render(
      <SearchModal
        open
        index={INDEX}
        query="zzzz"
        onQueryChange={noop}
        activeIndex={0}
        onActiveIndex={noop}
        onSelect={noop}
      />,
    );
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });
});
