import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiBlob, apiFetch, ApiError, getToken, getTokenExpiry, setToken, UNAUTHORIZED_EVENT, type UnauthorizedDetail,
} from './api';

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function listen(): { events: UnauthorizedDetail[]; stop: () => void } {
  const events: UnauthorizedDetail[] = [];
  const handler = (e: Event) => { events.push((e as CustomEvent<UnauthorizedDetail>).detail); };
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return { events, stop: () => window.removeEventListener(UNAUTHORIZED_EVENT, handler) };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('token storage', () => {
  it('keeps a plain token in sessionStorage only', () => {
    setToken('portal', 'abc');
    expect(sessionStorage.getItem('regis.portal.token')).toBe('abc');
    expect(localStorage.getItem('regis.portal.token')).toBeNull();
    expect(getToken('portal')).toBe('abc');
    expect(getTokenExpiry('portal')).toBeNull();
  });

  it('persists a remembered token with its expiry in localStorage', () => {
    setToken('portal', 'remembered', { persist: true, expiresAt: '2099-01-01T00:00:00Z' });
    expect(sessionStorage.getItem('regis.portal.token')).toBeNull();
    expect(localStorage.getItem('regis.portal.token')).toBe('remembered');
    expect(localStorage.getItem('regis.portal.token.expires')).toBe('2099-01-01T00:00:00Z');
    expect(getToken('portal')).toBe('remembered');
    expect(getTokenExpiry('portal')).toBe('2099-01-01T00:00:00Z');
  });

  it('prefers this tab\'s token over a remembered one', () => {
    setToken('cms', 'remembered', { persist: true, expiresAt: null });
    sessionStorage.setItem('regis.cms.token', 'tab');
    expect(getToken('cms')).toBe('tab');
  });

  it('discards a remembered token whose expiry has passed', () => {
    setToken('portal', 'stale', { persist: true, expiresAt: '2000-01-01T00:00:00Z' });
    expect(getToken('portal')).toBeNull();
    expect(localStorage.getItem('regis.portal.token')).toBeNull();
    expect(localStorage.getItem('regis.portal.token.expires')).toBeNull();
  });

  it('clears both stores on setToken(null)', () => {
    setToken('portal', 'a');
    setToken('portal', null);
    setToken('portal', 'b', { persist: true, expiresAt: '2099-01-01T00:00:00Z' });
    setToken('portal', null);
    expect(sessionStorage.getItem('regis.portal.token')).toBeNull();
    expect(localStorage.getItem('regis.portal.token')).toBeNull();
    expect(localStorage.getItem('regis.portal.token.expires')).toBeNull();
    expect(getToken('portal')).toBeNull();
  });

  it('keeps audiences apart', () => {
    setToken('cms', 'staff');
    setToken('portal', 'client');
    expect(getToken('cms')).toBe('staff');
    expect(getToken('portal')).toBe('client');
    setToken('cms', null);
    expect(getToken('portal')).toBe('client');
  });
});

describe('apiFetch', () => {
  it('sends the bearer token and keepalive, and returns JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    setToken('portal', 'tok');

    const out = await apiFetch<{ ok: boolean }>('/portal/activity', {
      method: 'POST', audience: 'portal', body: { event: 'view' }, keepalive: true,
    });

    expect(out).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/portal/activity');
    expect(init.keepalive).toBe(true);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.body).toBe(JSON.stringify({ event: 'view' }));
  });

  it('clears the token and dispatches regis:unauthorized on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Unauthenticated.' })));
    setToken('portal', 'dead');
    const { events, stop } = listen();

    await expect(apiFetch('/portal/reports', { audience: 'portal' })).rejects.toMatchObject({ status: 401 });

    expect(getToken('portal')).toBeNull();
    expect(events).toEqual([{ audience: 'portal', status: 401, message: 'Unauthenticated.' }]);
    stop();
  });

  it('does not touch the other audience\'s token on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    setToken('portal', 'dead');
    setToken('cms', 'alive');

    await expect(apiFetch('/portal/reports', { audience: 'portal' })).rejects.toBeInstanceOf(ApiError);
    expect(getToken('cms')).toBe('alive');
  });

  it('stays quiet on 401 when no token was sent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    const { events, stop } = listen();

    await expect(apiFetch('/portal/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 });
    expect(events).toEqual([]);
    stop();
  });

  it('dispatches an account-state 403 with its message but keeps the token', async () => {
    const message = 'Portal access for this mandate is suspended. Contact your Regis coverage.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { message })));
    setToken('portal', 'tok');
    const { events, stop } = listen();

    await expect(apiFetch('/portal/reports', { audience: 'portal' })).rejects.toMatchObject({ status: 403, message });

    expect(getToken('portal')).toBe('tok');
    expect(events).toEqual([{ audience: 'portal', status: 403, message }]);
    stop();
  });

  it('does not treat a plain permission 403 as a session event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { message: 'This action is unauthorized.' })));
    setToken('cms', 'tok');
    const { events, stop } = listen();

    await expect(apiFetch('/cms/careers', { audience: 'cms' })).rejects.toMatchObject({ status: 403 });
    expect(events).toEqual([]);
    stop();
  });

  it('surfaces Laravel validation errors on the ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(422, {
      message: 'The current password is incorrect.',
      errors: { current: ['The current password is incorrect.'] },
    })));
    setToken('portal', 'tok');

    const err = await apiFetch('/portal/password', { method: 'PUT', audience: 'portal', body: {} }).catch((e) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).errors).toEqual({ current: ['The current password is incorrect.'] });
  });
});

describe('apiBlob', () => {
  it('resolves null on 404 and throws on other failures', async () => {
    setToken('portal', 'tok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(apiBlob('/reports/1/file', 'portal')).resolves.toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { message: 'Boom' })));
    await expect(apiBlob('/reports/1/file', 'portal')).rejects.toMatchObject({ status: 500, message: 'Boom' });
  });

  it('fires the session event on 401 too', async () => {
    setToken('portal', 'tok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    const { events, stop } = listen();

    await expect(apiBlob('/reports/1/file', 'portal')).rejects.toMatchObject({ status: 401 });
    expect(getToken('portal')).toBeNull();
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(401);
    stop();
  });
});
