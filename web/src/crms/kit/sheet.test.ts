import { describe, expect, it } from 'vitest';
import { fieldFromColumn, inferColumns, parseCsv, parseXlsx, readWorkbook, slugName, type Sheet } from './sheet';

/** A minimal zip with stored (uncompressed) entries: enough for the reader, no CRCs checked. */
function zip(files: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const [name, text] of Object.entries(files)) {
    const nameB = enc.encode(name);
    const data = enc.encode(text);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...nameB, ...data]);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameB]));
    parts.push(local);
    offset += local.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, eocd];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const part of all) { out.set(part, p); p += part.length; }
  return out.buffer;
}

describe('parseCsv', () => {
  it('handles quotes, embedded delimiters, CRLF and a BOM', () => {
    const rows = parseCsv('﻿Name,"Notes, long"\r\n"Acme, Inc.","He said ""hi"""\r\nBeta,\r\n');
    expect(rows).toEqual([['Name', 'Notes, long'], ['Acme, Inc.', 'He said "hi"'], ['Beta', '']]);
  });

  it('detects semicolon and tab delimiters', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseXlsx', () => {
  it('reads every sheet in workbook order through the relationships, shared strings and date styles', async () => {
    const buf = zip({
      'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Meetings" sheetId="1" r:id="rId7"/><sheet name="Contacts" sheetId="2" r:id="rId8"/><sheet name="Blank" sheetId="3" r:id="rId9"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId7" Type="x" Target="worksheets/sheet3.xml"/><Relationship Id="rId8" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId9" Type="x" Target="worksheets/sheet2.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<sst><si><t>Company</t></si><si><t>Met on</t></si><si><r><t>Ay</t></r><r><t>ala</t></r></si><si><t>Email</t></si></sst>',
      'xl/styles.xml': '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
      'xl/worksheets/sheet3.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Minutes</t></is></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>46023</v></c><c r="C2"><v>45</v></c></row></sheetData></worksheet>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>3</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>x@y.com</t></is></c></row></sheetData></worksheet>',
      'xl/worksheets/sheet2.xml': '<worksheet><sheetData/></worksheet>',
    });
    const grids = await parseXlsx(buf);
    expect(grids.map((g) => g.name)).toEqual(['Meetings', 'Contacts', 'Blank']);
    expect(grids[0].rows).toEqual([['Company', 'Met on', 'Minutes'], ['Ayala', '2026-01-01', '45']]);
    expect(grids[1].rows).toEqual([['Email'], ['x@y.com']]);
    expect(grids[2].rows).toEqual([]);
  });

  it('rejects something that is not a workbook', async () => {
    await expect(parseXlsx(new Uint8Array(40).buffer)).rejects.toThrow(/not a valid/i);
  });
});

describe('inferColumns', () => {
  const sheet: Sheet = {
    name: 'x',
    lists: {},
    formulaColumns: [],
    kind: 'table',
    headers: ['Company Name', 'Meeting Type', 'Minutes', 'Met on', 'Notes', 'Empty'],
    rows: [
      ['Ayala', 'Call', '30', '2026-01-04', 'A very long paragraph of prose that goes on and on and on about the meeting, the people in the room, and every single thing that was said between them.', ''],
      ['SM Prime', 'Visit', '45', '04/01/2026', 'Short.', ''],
      ['Ayala', 'Call', '60', '4 Jan 2026', 'Also short prose here, but a bit longer than the last one to push the average up a little more than it is.', ''],
      ['BDO', 'Call', '15', '2026-02-11', 'Another very long paragraph of prose that goes on and on about the meeting and the people and the coffee and the weather outside the window.', ''],
    ],
  };
  const cols = inferColumns(sheet);

  it('slugs headers into internal names', () => {
    expect(cols.map((c) => c.internalName)).toEqual(['company_name', 'meeting_type', 'minutes', 'met_on', 'notes', 'empty']);
    expect(slugName('1st Contact')).toBe('f1st_contact');
  });

  it('suggests a type per column and lists select choices by frequency', () => {
    expect(cols.map((c) => c.suggested)).toEqual(['select', 'select', 'number', 'date', 'textArea', 'textBox']);
    expect(cols[1].choices).toEqual(['Call', 'Visit']);
    expect(cols[0].choices).toEqual(['Ayala', 'BDO', 'SM Prime']);
    expect(cols[5]).toMatchObject({ filled: 0, blank: 4, choices: [] });
  });

  it('takes choices from the sheet dropdown over the row values, and flags formula columns', () => {
    const cols = inferColumns({ ...sheet, lists: { 1: ['Call', 'Visit', 'Email', 'Site tour'] }, formulaColumns: [2] });
    expect(cols[1]).toMatchObject({ suggested: 'select', source: 'dropdown', choices: ['Call', 'Visit', 'Email', 'Site tour'] });
    expect(cols[2]).toMatchObject({ formula: true, suggested: 'textBox', choices: [] });
    expect(cols[0]).toMatchObject({ source: 'values', formula: false });
  });

  it('builds a legacy-shaped field from a column', () => {
    const select = fieldFromColumn(cols[1], 'select', 7);
    expect(select).toMatchObject({ id: 7, internalName: 'meeting_type', label: 'Meeting Type', fieldType: 'select', options: { type: 'Static', value: ['Call', 'Visit'], bindLabel: 'name' }, multiSelect: false, required: false });
    const text = fieldFromColumn(cols[4], 'textArea', 8);
    expect(text).toMatchObject({ fieldType: 'textArea', multiLine: true, options: { type: '', value: '' } });
  });
});

describe('readWorkbook', () => {
  it('names blank headers, pads ragged rows and refuses .xls', async () => {
    const file = new File(['a,,c\n1,2\n'], 'x.csv', { type: 'text/csv' });
    const { file: name, sheets } = await readWorkbook(file);
    expect(name).toBe('x.csv');
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('x');
    expect(sheets[0].headers).toEqual(['a', 'Column 2', 'c']);
    expect(sheets[0].rows).toEqual([['1', '2', '']]);
    await expect(readWorkbook(new File(['x'], 'old.xls'))).rejects.toThrow(/\.xlsx or CSV/);
  });

  it('reads dropdown validations (classic and x14) into column lists and spots formula columns and notes tabs', async () => {
    const buf = zip({
      'xl/workbook.xml': '<workbook><sheets><sheet name="Instructions"/><sheet name="Data"/><sheet name="Lookup"/></sheets></workbook>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>High-Level Instructions for Completing the Bulk Upload Template</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>1. Make sure Errors (Column N) is always empty. Formula should be applied to all rows.</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>2. For Date (column C), date format is mm/dd/yyyy (Standard American).</t></is></c></row></sheetData></worksheet>',
      'xl/worksheets/sheet2.xml': '<worksheet><sheetData>'
        + '<row r="1"><c r="A1" t="inlineStr"><is><t>Meeting Type</t></is></c><c r="B1" t="inlineStr"><is><t>Method</t></is></c><c r="C1" t="inlineStr"><is><t>Errors</t></is></c></row>'
        + '<row r="2"><c r="A2" t="inlineStr"><is><t>Incoming Call</t></is></c><c r="B2" t="inlineStr"><is><t>N/A</t></is></c><c r="C2" t="str"><f>IF(A2="","x","")</f><v></v></c></row>'
        + '<row r="3"><c r="A3" t="inlineStr"><is><t>Incoming Call</t></is></c><c r="B3" t="inlineStr"><is><t>Email</t></is></c><c r="C3" t="str"><f>IF(A3="","x","")</f><v>Invalid</v></c></row>'
        + '</sheetData>'
        + '<dataValidations count="1"><dataValidation type="list" sqref="B2:B1048576"><formula1>"In Person,Virtual,Email,N/A"</formula1></dataValidation></dataValidations>'
        + '<extLst><ext><x14:dataValidations xmlns:x14="x" xmlns:xm="m"><x14:dataValidation type="list"><x14:formula1><xm:f>Lookup!$A$2:$A$12</xm:f></x14:formula1><xm:sqref>A1:A1048576</xm:sqref></x14:dataValidation></x14:dataValidations></ext></extLst>'
        + '</worksheet>',
      'xl/worksheets/sheet3.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Meeting Type</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Incoming Call</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Outgoing Call</t></is></c></row><row r="5"><c r="A5" t="inlineStr"><is><t>Bespoke Client Request</t></is></c></row><row r="13"><c r="A13" t="inlineStr"><is><t>Beyond the range</t></is></c></row></sheetData></worksheet>',
    });
    const { sheets } = await readWorkbook(new File([buf], 'template.xlsx'));
    expect(sheets.map((s) => [s.name, s.kind])).toEqual([['Instructions', 'notes'], ['Data', 'table'], ['Lookup', 'table']]);
    const data = sheets[1];
    expect(data.lists[0]).toEqual(['Incoming Call', 'Outgoing Call', 'Bespoke Client Request']);
    expect(data.lists[1]).toEqual(['In Person', 'Virtual', 'Email', 'N/A']);
    expect(data.formulaColumns).toEqual([2]);
    const cols = inferColumns(data);
    expect(cols[0]).toMatchObject({ suggested: 'select', source: 'dropdown', choices: ['Incoming Call', 'Outgoing Call', 'Bespoke Client Request'] });
    expect(cols[2]).toMatchObject({ formula: true });
  });

  it('drops empty tabs and keeps the rest', async () => {
    const buf = zip({
      'xl/workbook.xml': '<workbook><sheets><sheet name="Empty"/><sheet name="Data"/></sheets></workbook>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData/></worksheet>',
      'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row><c t="inlineStr"><is><t>Name</t></is></c></row><row><c t="inlineStr"><is><t>Ayala</t></is></c></row></sheetData></worksheet>',
    });
    const { sheets } = await readWorkbook(new File([buf], 'book.xlsx'));
    expect(sheets.map((s) => s.name)).toEqual(['Data']);
    expect(sheets[0].headers).toEqual(['Name']);
  });
});
