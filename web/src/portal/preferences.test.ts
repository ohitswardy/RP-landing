import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES, parsePreferences, PREFERENCES_KEY, readPreferences, resetPreferences, writePreferences,
} from './preferences';

beforeEach(() => {
  localStorage.clear();
  resetPreferences();
});

describe('parsePreferences', () => {
  it('falls back to the defaults on nothing, junk, or partial input', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('not json')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"defaultCompany":"Local"}')).toEqual({ defaultView: 'latest', defaultCompany: 'Local' });
  });

  it('accepts the catch-all views and any known sector', () => {
    expect(parsePreferences('{"defaultView":"all"}').defaultView).toBe('all');
    expect(parsePreferences('{"defaultView":"Banks"}').defaultView).toBe('Banks');
  });

  it('drops a sector that is not in the catalog and a company that is not Local/Foreign', () => {
    expect(parsePreferences('{"defaultView":"Crypto","defaultCompany":"Martian"}')).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('writePreferences / readPreferences', () => {
  it('round-trips through localStorage', () => {
    writePreferences({ defaultView: 'Property', defaultCompany: 'Foreign' });
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}')).toEqual({ defaultView: 'Property', defaultCompany: 'Foreign' });
    expect(readPreferences()).toEqual({ defaultView: 'Property', defaultCompany: 'Foreign' });
  });

  it('merges a partial patch over what is stored', () => {
    writePreferences({ defaultView: 'Banks' });
    writePreferences({ defaultCompany: 'Local' });
    expect(readPreferences()).toEqual({ defaultView: 'Banks', defaultCompany: 'Local' });
  });

  it('removes the key again once everything is back at the default', () => {
    writePreferences({ defaultView: 'Banks' });
    expect(localStorage.getItem(PREFERENCES_KEY)).not.toBeNull();
    writePreferences({ defaultView: 'latest' });
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('resetPreferences clears the store', () => {
    writePreferences({ defaultView: 'all', defaultCompany: 'Local' });
    expect(resetPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
  });
});
