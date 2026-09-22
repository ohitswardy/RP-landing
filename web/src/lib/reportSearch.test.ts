import { describe, expect, it } from 'vitest';
import { parseQuery, searchReports } from './reportSearch';
import type { Report } from '../cms/data';

const base: Report = {
  id: '0', title: '', category: null, reportTypeId: null, reportType: null,
  companyId: null, companyName: null, companySymbol: null, company: null,
  analyst: '', rating: null, date: '2026-01-01', pages: 0, summary: '',
  spotlight: false, fileName: '', fileSize: 0, fileUrl: null,
};

const reports: Report[] = [
  { ...base, id: '1', title: 'BDO Unibank 2Q26 results', category: 'banks' as Report['category'], companyName: 'BDO Unibank', companySymbol: 'BDO', analyst: 'E. Dagal', rating: 'buy' as Report['rating'], date: '2026-08-22', reportType: 'Results', summary: 'Beat on NII.' },
  { ...base, id: '2', title: 'PH macro: BSP holds', category: null, analyst: 'P. Garcia', date: '2026-08-15', reportType: 'Macro', summary: 'Policy rate unchanged.' },
  { ...base, id: '3', title: 'Ayala Land site visit', category: 'property' as Report['category'], companyName: 'Ayala Land', companySymbol: 'ALI', analyst: 'E. Dagal', rating: 'hold' as Report['rating'], date: '2025-11-03', reportType: 'Note', summary: 'Estate launches.' },
];

describe('parseQuery', () => {
  it('splits words, quoted phrases, exclusions and field prefixes', () => {
    const terms = parseQuery('bdo "site visit" -macro sector:banks');
    expect(terms).toEqual([
      { value: 'bdo', field: null, negated: false },
      { value: 'site visit', field: null, negated: false },
      { value: 'macro', field: null, negated: true },
      { value: 'banks', field: 'sector', negated: false },
    ]);
  });

  it('maps field aliases onto canonical columns', () => {
    expect(parseQuery('author:dagal')[0].field).toBe('analyst');
    expect(parseQuery('symbol:ali')[0].field).toBe('ticker');
  });
});

describe('searchReports', () => {
  it('returns everything for an empty query', () => {
    expect(searchReports(reports, '')).toHaveLength(3);
  });

  it('ANDs bare terms in any order', () => {
    expect(searchReports(reports, 'results bdo').map((r) => r.id)).toEqual(['1']);
    expect(searchReports(reports, 'bdo property')).toHaveLength(0);
  });

  it('excludes with a leading minus', () => {
    expect(searchReports(reports, 'dagal -property').map((r) => r.id)).toEqual(['1']);
  });

  it('narrows with field:value', () => {
    expect(searchReports(reports, 'rating:hold').map((r) => r.id)).toEqual(['3']);
    expect(searchReports(reports, 'ticker:bdo').map((r) => r.id)).toEqual(['1']);
  });

  it('understands many spellings of the publication date', () => {
    for (const q of ['2026-08-22', '22/08/2026', 'aug 2026', 'August 2026', '"22 august 2026"']) {
      expect(searchReports(reports, q).map((r) => r.id), q).toContain('1');
    }
    expect(searchReports(reports, '2025').map((r) => r.id)).toEqual(['3']);
  });

  it('ranks a ticker hit above a summary hit', () => {
    const list = [
      { ...base, id: 'a', title: 'x', summary: 'mentions ali in passing', date: '2026-01-01' },
      { ...base, id: 'b', title: 'y', companySymbol: 'ALI', companyName: 'Ayala Land', date: '2026-01-01' },
    ];
    expect(searchReports(list, 'ali')[0].id).toBe('b');
  });
});
