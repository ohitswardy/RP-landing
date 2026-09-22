import { describe, expect, it } from 'vitest';
import type { FieldSchema, ReportSource } from '../data';
import {
  cleanFormat, colLetters, defaultFormat, detectDataSheet, detectFlavor, detectHeaderRow, detectSeparator, fieldsForClient, formatOptions, matchSource,
  normalizeHeader, seedColumns, suggestCells, titleFromFilename,
} from './layout';
import type { Grid } from './sheet';

/* A slice of the real catalog: enough to exercise flavours, aliases and kinds. */
const SOURCES: ReportSource[] = [
  { key: 'interaction.type', label: 'Interaction type', group: 'Interaction', kind: 'text', multi: false, aliases: ['interactiontype', 'type'] },
  { key: 'interaction.subtype', label: 'Sub-type', group: 'Interaction', kind: 'text', multi: false, aliases: ['subtype', 'meetingtype'] },
  { key: 'interaction.date', label: 'Date', group: 'Interaction', kind: 'date', multi: false, aliases: ['date', 'interactiondate'] },
  { key: 'interaction.date_utc', label: 'Date (UTC)', group: 'Interaction', kind: 'date', multi: false, aliases: ['dateutc'], flavors: { commcise: ['interactiondate'] } },
  { key: 'interaction.time_start', label: 'Start time', group: 'Interaction', kind: 'time', multi: false, aliases: ['starttime'] },
  { key: 'interaction.minutes', label: 'Duration', group: 'Interaction', kind: 'number', multi: false, aliases: ['duration', 'durationinmins'] },
  { key: 'contacts.emails', label: 'Client emails', group: 'Client contacts', kind: 'text', multi: true, aliases: ['externalattendee', 'consumeremails'] },
  { key: 'regis.emails', label: 'Regis emails', group: 'Regis', kind: 'text', multi: true, aliases: ['sellsideemails'], flavors: { jefferies: ['internalattendee'] } },
  { key: 'regis.names', label: 'Regis names', group: 'Regis', kind: 'text', multi: true, aliases: ['internalattendees', 'broker'] },
  { key: 'derived.jefferies_type', label: 'Jefferies type', group: 'Derived', kind: 'text', multi: false, aliases: [], flavors: { jefferies: ['meetingtype'] } },
  { key: 'derived.commcise_type', label: 'Commcise type', group: 'Derived', kind: 'text', multi: false, aliases: ['clientinteractiontype'], flavors: { commcise: ['interactiontype'] } },
  { key: 'const', label: 'Fixed text', group: 'Other', kind: 'text', multi: false, aliases: [] },
  { key: 'blank', label: 'Leave empty', group: 'Other', kind: 'text', multi: false, aliases: [] },
  { key: 'formula', label: 'Keep formula', group: 'Other', kind: 'text', multi: false, aliases: ['errors'] },
];

const FIELDS: FieldSchema[] = [
  { id: 1, internalName: 'contract_id', label: 'Contract Id', fieldType: 'textBox', required: false, multiSelect: false, options: { type: '', value: '', bindLabel: 'name' }, defaultValue: '' },
  { id: 2, internalName: 'parent_interaction_id', label: 'Parent interaction', fieldType: 'textBox', required: false, multiSelect: false, options: { type: '', value: '', bindLabel: 'name' }, defaultValue: '' },
];

const grid = (name: string, rows: (string[] | null)[], extra: Partial<Grid> = {}): Grid => {
  const kept = rows.map((r, i) => [r, i + 1] as const).filter((x): x is readonly [string[], number] => x[0] !== null);
  return { name, rows: kept.map((x) => x[0]), rowNumbers: kept.map((x) => x[1]), ...extra };
};

/** The Commcise Data tab in miniature: title block, bands, descriptions, mandatory notes, header on 7, marker on 8. */
const commcise = grid('Data', [
  ['', '', 'Interactions Upload Template', '', 'Template Date:', '21 Sep 2026 05:19:16 UTC'],
  ['', '', 'https://schroders.commcise.com/', '', 'Downloaded by:', 'casy'],
  null,
  ['Summary', '', '', 'When/Where'],
  ['Each event must be labelled with a Client Interaction/Event type e.g. "Conference"', 'Description of the event / meeting / service (free text)', 'Unique Interaction ID. This ID must be unique across your entire interaction universe for all-time.', 'Date on which the service was provided (same date format for the whole file)', 'Start time of the meeting in UTC hh:mm:ss', 'Recipient(s) of this interaction at the Asset Manager e.g. "Alan Smith"'],
  ['Mandatory', 'Mandatory', 'Mandatory', '. Mandatory client', '', 'Mandatory. Multiple Values allowed. Separate with a |'],
  ['Interaction Type', 'Description', 'Interaction Id', 'Interaction Date', 'Start Time', 'Consumer Emails'],
  ['Your data starts here: Cell A8'],
]);
const commciseTypes = grid('ClientInteractionType', [['Below is a list of values for: ClientInteractionType.'], ['ClientInteractionType'], ['Analyst Call - 2x1'], ['Analyst Call - Group']]);

/** The Jefferies Data tab: header on 1, two sample rows, an Errors formula column, dropdown lists. */
const jefferies = grid('Data', [
  ['Meeting Type', 'Meeting Method', 'Date', 'Start Time', 'Duration (In mins)', 'Internal Attendee', 'External Attendee', 'Errors'],
  ['Incoming Call', 'N/A', '2026-08-03', '16:00', '20', 'carl.sy@regis.ph', 'a@x.com,b@x.com', ''],
  ['Testing The Waters', 'N/A', '2026-08-04', '10:30', '45', 'carl.sy@regis.ph,rafael@regis.ph', 'c@y.com', ''],
], { formulaColumns: [7], formats: { 2: 'mm/dd/yyyy;@', 3: 'h:mm', 4: '0' } });
const lookup = grid('Lookup', [['Meeting Type', '', 'Meeting Method'], ['Incoming Call', '', 'In Person'], ['Corporate Access One Off', '', 'Virtual'], ['IB/Email Ideas', '', 'Email']]);

describe('header detection', () => {
  it('finds the real header under Commcise’s description and mandatory rows, and the marker row', () => {
    expect(detectHeaderRow(commcise)).toEqual({ headerRow: 7, dataStart: 8, marker: true });
  });
  it('takes row 1 when the table starts there', () => {
    expect(detectHeaderRow(jefferies)).toEqual({ headerRow: 1, dataStart: 2, marker: false });
  });
  it('picks the Data tab by name, else the widest header', () => {
    expect(detectDataSheet([commciseTypes, commcise])).toBe(1);
    expect(detectDataSheet([lookup, grid('Sheet1', [['A', 'B', 'C', 'D', 'E'], ['1', '2', '3', '4', '5']])])).toBe(1);
  });
});

describe('vocabulary', () => {
  it('recognises Commcise and Jefferies workbooks from their reference tabs', () => {
    expect(detectFlavor([commcise, commciseTypes])).toBe('commcise');
    expect(detectFlavor([jefferies, lookup])).toBe('jefferies');
    expect(detectFlavor([grid('Sheet1', [['Firm', 'Date']])])).toBeNull();
  });
  it('lets the flavour win over the generic alias', () => {
    expect(matchSource('Interaction Type', { flavor: 'commcise', sources: SOURCES, fields: [] }).source).toBe('derived.commcise_type');
    expect(matchSource('Interaction Type', { flavor: null, sources: SOURCES, fields: [] }).source).toBe('interaction.type');
    expect(matchSource('Meeting Type', { flavor: 'jefferies', sources: SOURCES, fields: [] }).source).toBe('derived.jefferies_type');
    expect(matchSource('Meeting Type', { flavor: null, sources: SOURCES, fields: [] }).source).toBe('interaction.subtype');
    expect(matchSource('Internal Attendee', { flavor: 'jefferies', sources: SOURCES, fields: [] }).source).toBe('regis.emails');
  });
  it('matches form fields by label or internal name before generic aliases, and falls back to T1C constants', () => {
    expect(matchSource('Contract Id', { flavor: 'commcise', sources: SOURCES, fields: FIELDS }).source).toBe('form.contract_id');
    expect(matchSource('parent_interaction_id', { flavor: null, sources: SOURCES, fields: FIELDS }).source).toBe('form.parent_interaction_id');
    expect(matchSource('SOURCE__C', { flavor: null, sources: SOURCES, fields: [] })).toEqual({ source: 'const', text: 'Regis' });
    expect(matchSource('Something Else', { flavor: null, sources: SOURCES, fields: [] }).source).toBe('blank');
    expect(matchSource('Errors', { flavor: 'jefferies', sources: SOURCES, fields: [], formula: true }).source).toBe('formula');
  });
});

describe('separators and formats', () => {
  it('reads the separator the template asks for above the header, else from the samples', () => {
    expect(detectSeparator(commcise, 7, 5, 'commcise')).toBe('|');
    expect(detectSeparator(jefferies, 1, 6, 'jefferies')).toBe(',');
    expect(detectSeparator(grid('S', [['Names'], ['A, B']]), 1, 0, null)).toBe(', ');
    expect(detectSeparator(grid('S', [['Names']]), 1, 0, null)).toBe(', ');
  });
  it('keeps the template’s own date and time formats and defaults to ISO / hh:mm otherwise', () => {
    expect(defaultFormat('date', 'mm/dd/yyyy;@')).toBe('mm/dd/yyyy');
    expect(defaultFormat('date', 'yyyy\\-mm\\-dd;@')).toBe('yyyy-mm-dd');
    expect(defaultFormat('date', undefined)).toBe('yyyy-mm-dd');
    expect(defaultFormat('date', '@')).toBe('text');
    expect(defaultFormat('time', 'h:mm')).toBe('h:mm');
    expect(defaultFormat('time', '0')).toBe('hh:mm');
    expect(defaultFormat('text', 'mm/dd/yyyy')).toBeNull();
    expect(cleanFormat('mm/dd/yyyy;@')).toBe('mm/dd/yyyy');
    expect(formatOptions('time', 'h:mm')[0]).toEqual({ id: 'h:mm', label: 'Template’s format · h:mm' });
    expect(formatOptions('time', 'hh:mm').map((f) => f.id)).toEqual(['hh:mm', 'hh:mm:ss', 'text']);
  });
});

describe('seeding a layout', () => {
  it('maps every Jefferies column, keeps the Errors formula and the template’s formats', () => {
    const seeds = seedColumns(jefferies, 1, 2, { flavor: 'jefferies', sources: SOURCES, fields: [] });
    expect(seeds.map((s) => s.column.source)).toEqual(['derived.jefferies_type', 'blank', 'interaction.date', 'interaction.time_start', 'interaction.minutes', 'regis.emails', 'contacts.emails', 'formula']);
    expect(seeds[2].column.format).toBe('mm/dd/yyyy');
    expect(seeds[3].column.format).toBe('h:mm');
    expect(seeds[5].column.separator).toBe(',');
    expect(seeds[0].sample).toBe('Incoming Call');
    expect(seeds[7].formula).toBe(true);
  });
  it('maps the Commcise columns with the UTC date and skips the marker as a sample', () => {
    const seeds = seedColumns(commcise, 7, 8, { flavor: 'commcise', sources: SOURCES, fields: FIELDS });
    expect(seeds.map((s) => s.column.source)).toEqual(['derived.commcise_type', 'blank', 'blank', 'interaction.date_utc', 'interaction.time_start', 'contacts.emails']);
    expect(seeds[5].column.separator).toBe('|');
    expect(seeds.every((s) => s.sample === '')).toBe(true);
  });
  it('stamps the Template Date and Downloaded by cells', () => {
    expect(suggestCells(commcise, 7)).toEqual([
      { ref: 'F1', source: 'meta.generated_at_utc', text: null },
      { ref: 'F2', source: 'meta.generated_by', text: null },
    ]);
  });
});

describe('helpers', () => {
  it('normalises headers, letters columns and titles files', () => {
    expect(normalizeHeader('Duration (In mins)')).toBe('durationinmins');
    expect(colLetters(0)).toBe('A');
    expect(colLetters(27)).toBe('AB');
    expect(titleFromFilename('2026-09-21-Schroders-Commcise Template_20260921051916.xlsx')).toBe('Schroders-Commcise Template');
    expect(titleFromFilename('Aug 2026 - Regis Interactions.xlsx')).toBe('Aug 2026 - Regis Interactions');
  });
  it('resolves the form a client uses like the API does', () => {
    const forms = [{ clientId: '81', fields: FIELDS }, { clientId: '5', fields: [FIELDS[0]] }];
    expect(fieldsForClient(forms, '5', '81')).toHaveLength(1);
    expect(fieldsForClient(forms, '6', '81')).toHaveLength(2);
    expect(fieldsForClient([], '6', '81')).toEqual([]);
  });
});
