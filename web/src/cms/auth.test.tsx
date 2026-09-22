import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, SESSION_KEY, useAuth } from './auth';
import { UNAUTHORIZED_EVENT } from '../lib/api';

/* ─────────────────────────────────────────────────────────────
   The staff session: /me refresh on boot, the api client's
   regis:unauthorized signal, and the remembered sign-in.
   ───────────────────────────────────────────────────────────── */

const TOKEN_KEY = 'regis.cms.token';

function Probe() {
  const { session, notice, remembered, login } = useAuth();
  const location = useLocation();
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="name">{session?.name ?? '—'}</span>
      <span data-testid="perms">{session?.permissions.join(',') ?? '—'}</span>
      <span data-testid="notice">{notice ?? '—'}</span>
      <span data-testid="remembered">{remembered ? 'yes' : 'no'}</span>
      <button type="button" onClick={() => void login('e.dagal@regis.ph', 'CWDevs2021!', { remember: true })}>remember</button>
      <button type="button" onClick={() => void login('e.dagal@regis.ph', 'CWDevs2021!')}>plain</button>
    </div>
  );
}

function mount(path = '/cms') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const STAFF = { id: '7', name: 'E. Dagal', email: 'e.dagal@regis.ph', role: 'Administrator', permissions: ['home.manage'] };

function seedSession(permissions = ['home.manage']) {
  sessionStorage.setItem(TOKEN_KEY, 'tok-1');
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...STAFF, permissions, signedInAt: '2026-09-21T00:00:00Z' }));
}

describe('cms auth', () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes the stored session from GET /me on boot', async () => {
    seedSession(['home.manage']);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/me')) return json(200, { kind: 'staff', user: { ...STAFF, permissions: ['home.manage', 'careers.manage'] } });
      return json(404, { message: 'nope' });
    });

    mount();
    expect(screen.getByTestId('perms').textContent).toBe('home.manage');
    await waitFor(() => expect(screen.getByTestId('perms').textContent).toBe('home.manage,careers.manage'));

    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/me'));
    expect(call).toBeTruthy();
    expect((call![1]!.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    // The refreshed session is written back where it came from.
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)!).permissions).toEqual(['home.manage', 'careers.manage']);
  });

  it('signs out with the server message when /me answers 403', async () => {
    seedSession();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/me')) return json(403, { message: 'This account has been suspended.' });
      return json(404, { message: 'nope' });
    });

    mount();
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('—'));
    expect(screen.getByTestId('notice').textContent).toBe('This account has been suspended.');
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(screen.getByTestId('path').textContent).toBe('/login/cms');
  });

  it('drops the session and moves to the area login on regis:unauthorized', async () => {
    seedSession();
    fetchMock.mockImplementation(async () => json(200, { kind: 'staff', user: STAFF }));

    mount('/crms/interactions');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId('name').textContent).toBe('E. Dagal');

    act(() => {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { audience: 'cms', status: 401 } }));
    });

    expect(screen.getByTestId('name').textContent).toBe('—');
    expect(screen.getByTestId('notice').textContent).toBe('Your session has expired. Sign in again.');
    expect(screen.getByTestId('path').textContent).toBe('/login/crms');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('ignores the portal audience', async () => {
    seedSession();
    fetchMock.mockImplementation(async () => json(200, { kind: 'staff', user: STAFF }));
    mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { audience: 'portal', status: 401 } }));
    });
    expect(screen.getByTestId('name').textContent).toBe('E. Dagal');
    expect(screen.getByTestId('path').textContent).toBe('/cms');
  });

  it('mirrors a remembered sign-in into localStorage and a plain one into sessionStorage', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/cms/login')) {
        const body = JSON.parse(String(init?.body)) as { remember: boolean };
        return json(200, { token: body.remember ? 'tok-long' : 'tok-tab', expiresAt: body.remember ? '2026-10-21T00:00:00Z' : null, user: STAFF });
      }
      return json(404, { message: 'nope' });
    });

    mount('/login/cms');
    expect(screen.getByTestId('name').textContent).toBe('—');

    await act(async () => { screen.getByText('remember').click(); });
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('E. Dagal'));
    expect(screen.getByTestId('remembered').textContent).toBe('yes');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-long');
    expect(localStorage.getItem(`${TOKEN_KEY}.expires`)).toBe('2026-10-21T00:00:00Z');
    expect(localStorage.getItem(SESSION_KEY)).toContain('"expiresAt":"2026-10-21T00:00:00Z"');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();

    await act(async () => { screen.getByText('plain').click(); });
    await waitFor(() => expect(screen.getByTestId('remembered').textContent).toBe('no'));
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('tok-tab');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toContain('"name":"E. Dagal"');
  });
});
