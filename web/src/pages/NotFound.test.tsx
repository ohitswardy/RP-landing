import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotFound from './NotFound';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<NotFound />', () => {
  it('renders on an unknown route with the four ways out and the requested path', () => {
    renderAt('/this/does/not/exist');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/not on the ledger/i);
    expect(screen.getByText('/this/does/not/exist')).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /where to go instead/i });
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/services', '/insights', '/contact']));
  });

  it('sets the document title', () => {
    renderAt('/missing');
    expect(document.title).toMatch(/^404 — Regis Partners/);
  });

  it('does not render on a known route', () => {
    renderAt('/');
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
