import type { FieldSchema, FieldType } from '../data';

/* ─────────────────────────────────────────────────────────────
   Spreadsheet → form fields. Reads a CSV or XLSX entirely in the
   browser (nothing is uploaded), takes the first row as headers,
   and proposes one interaction-form field per column: the type is
   inferred from the values (numbers, dates, a short repeating set
   → select with the observed choices, long prose → long text).
   The XLSX reader is deliberately small: every worksheet, shared
   strings, inline strings, numbers, date-styled serials, and the
   list validations (dropdowns) that name a column's allowed values.
   ───────────────────────────────────────────────────────────── */

export type Sheet = {
  name: string;
  headers: string[];
  rows: string[][];
  /** Column index → the allowed values of that column's dropdown (data validation), when the file has one. */
  lists: Record<number, string[]>;
  /** Columns whose data cells are all formulas (a validator column, not captured data). */
  formulaColumns: number[];
  /** A tab that reads as prose (instructions, notes) rather than a table. */
  kind: 'table' | 'notes';
};

export type Column = {
  index: number;
  header: string;
  internalName: string;
  /** Non-blank values, in order, for the preview. */
  samples: string[];
  filled: number;
  blank: number;
  distinct: number;
  suggested: FieldType;
  /** For a suggested select: the observed values, most frequent first. */
  choices: string[];
  /** Where the choices came from: the column's dropdown, or the values in the rows. */
  source: 'dropdown' | 'values' | 'none';
  /** The column is a formula (e.g. an Errors check), not captured data. */
  formula: boolean;
};

export const MAX_SHEET_BYTES = 5 * 1024 * 1024;
export const SHEET_ACCEPT = '.csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Internal names are lowercase with underscores and never start with a digit. */
export const slugName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[0-9]/, 'f$&');

/* ── CSV ───────────────────────────────────────────────────── */

function detectDelimiter(text: string): string {
  const head = text.slice(0, 4000).split(/\r?\n/)[0] ?? '';
  const counts: [string, number][] = [[',', 0], [';', 0], ['\t', 0], ['|', 0]].map(([d]) => [d as string, head.split(d as string).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(cell); cell = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/* ── XLSX (zip + SpreadsheetML) ────────────────────────────── */

type ZipEntry = { name: string; method: number; compressedSize: number; offset: number };

function readZipDirectory(buf: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx workbook.');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readZipEntry(buf: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buf);
  if (view.getUint32(entry.offset, true) !== 0x04034b50) throw new Error('Corrupt .xlsx workbook.');
  const nameLen = view.getUint16(entry.offset + 26, true);
  const extraLen = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLen + extraLen;
  const data = new Uint8Array(buf, start, entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new Error('This workbook uses a compression method the browser cannot open. Save it as CSV instead.');
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .xlsx files. Save the sheet as CSV instead.');
  const stream = new ReadableStream<BufferSource>({ start(c) { c.enqueue(data); c.close(); } }).pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(new Uint8Array(value)); }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return new TextDecoder().decode(out);
}

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The workbook contains XML the browser could not read.');
  return doc;
}

const columnIndex = (ref: string): number => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Excel serial date → ISO yyyy-mm-dd (1900 date system). */
function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25_569) * 86_400_000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  return d.toISOString().slice(0, 10);
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** The built-in number formats a template is likely to carry (id → code); anything else is looked up in the file's numFmts. */
const BUILTIN_FORMAT_CODES: Record<number, string> = {
  1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 14: 'mm-dd-yy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy',
  18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yy h:mm', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 49: '@',
};

type StyleFormats = {
  /** Which cell styles (cellXfs index) render as dates. */
  dates: Set<number>;
  /** cellXfs index → number format code, for every style that is not General. */
  codes: Map<number, string>;
};

/** What each cell style (cellXfs index) renders as. */
function styleFormats(stylesXml: string | null): StyleFormats {
  const out: StyleFormats = { dates: new Set(), codes: new Map() };
  if (!stylesXml) return out;
  const doc = xml(stylesXml);
  const custom = new Set<number>();
  const codes = new Map<number, string>(Object.entries(BUILTIN_FORMAT_CODES).map(([k, v]) => [Number(k), v]));
  for (const nf of Array.from(doc.getElementsByTagName('numFmt'))) {
    const id = Number(nf.getAttribute('numFmtId'));
    const raw = nf.getAttribute('formatCode') ?? '';
    codes.set(id, raw);
    const code = raw.replace(/\[[^\]]*]/g, '').replace(/"[^"]*"/g, '');
    if (/[ymd]/i.test(code) && !/[#0]/.test(code)) custom.add(id);
  }
  const xfs = doc.getElementsByTagName('cellXfs')[0];
  Array.from(xfs?.getElementsByTagName('xf') ?? []).forEach((xf, i) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    if (BUILTIN_DATE_FORMATS.has(id) || custom.has(id)) out.dates.add(i);
    if (id !== 0 && codes.has(id)) out.codes.set(i, codes.get(id) as string);
  });
  return out;
}

export type Grid = {
  name: string;
  rows: string[][];
  /** The worksheet row number of each kept row, so validation ranges can be resolved. */
  rowNumbers?: number[];
  lists?: Record<number, string[]>;
  formulaColumns?: number[];
  /** Column index → the number format of its first styled data cell (a date, time or numeric format), when the file has one. */
  formats?: Record<number, string>;
};

/** "Lookup!$A$2:$A$12" or "'My Sheet'!A2:A12" → the sheet and the 0-based column plus row bounds. */
function parseRangeRef(ref: string): { sheet: string | null; col: number; from: number; to: number } | null {
  const m = ref.trim().match(/^(?:'((?:[^']|'')+)'|([^!]+))?!?\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/);
  if (!m) return null;
  const sheet = m[1] ? m[1].replace(/''/g, "'") : m[2] ?? null;
  const col = columnIndex(m[3]);
  const from = Number(m[4]);
  const to = m[6] ? Number(m[6]) : from;
  if (m[5] && columnIndex(m[5]) !== col) return null; // only single-column ranges are choice lists
  return { sheet, col, from: Math.min(from, to), to: Math.max(from, to) };
}

/** Column indexes covered by an sqref such as "A1:A1048576 B1:B10 B12:B1048576". */
function sqrefColumns(sqref: string): number[] {
  const out = new Set<number>();
  for (const part of sqref.trim().split(/\s+/)) {
    const m = part.match(/^\$?([A-Z]+)\$?\d*(?::\$?([A-Z]+)\$?\d*)?$/);
    if (!m) continue;
    const a = columnIndex(m[1]);
    const b = m[2] ? columnIndex(m[2]) : a;
    for (let c = Math.min(a, b); c <= Math.max(a, b); c++) out.add(c);
  }
  return Array.from(out);
}

type PendingList = { columns: number[]; formula: string };

/** The list validations of one worksheet: both the classic element and the x14 extension Excel writes for cross-sheet ranges. */
function listValidations(doc: Document): PendingList[] {
  const out: PendingList[] = [];
  for (const dv of Array.from(doc.getElementsByTagName('dataValidation'))) {
    if (dv.getAttribute('type') !== 'list') continue;
    const formula = dv.getElementsByTagName('formula1')[0]?.textContent ?? '';
    const sqref = dv.getAttribute('sqref') ?? '';
    if (formula && sqref) out.push({ columns: sqrefColumns(sqref), formula });
  }
  for (const dv of Array.from(doc.getElementsByTagName('x14:dataValidation'))) {
    if (dv.getAttribute('type') !== 'list') continue;
    const formula = dv.getElementsByTagName('xm:f')[0]?.textContent ?? '';
    const sqref = dv.getElementsByTagName('xm:sqref')[0]?.textContent ?? '';
    if (formula && sqref) out.push({ columns: sqrefColumns(sqref), formula });
  }
  return out;
}

/** Resolve a list formula against the parsed grids: an inline "a,b,c" or a single-column range on any sheet. */
function resolveList(formula: string, grids: Grid[], own: Grid): string[] {
  const f = formula.trim();
  if (/^".*"$/.test(f)) return f.slice(1, -1).split(',').map((v) => v.trim()).filter(Boolean);
  const ref = parseRangeRef(f);
  if (!ref) return [];
  const grid = ref.sheet ? grids.find((g) => g.name === ref.sheet) : own;
  if (!grid?.rowNumbers) return [];
  const out: string[] = [];
  grid.rows.forEach((row, k) => {
    const n = grid.rowNumbers![k];
    if (n >= ref.from && n <= ref.to && (row[ref.col] ?? '').trim() !== '') out.push(row[ref.col].trim());
  });
  return Array.from(new Set(out));
}

/** Every worksheet in workbook order (hidden ones included), each as a grid of trimmed strings. */
export async function parseXlsx(buf: ArrayBuffer): Promise<Grid[]> {
  const entries = readZipDirectory(buf);
  const find = (name: string) => entries.find((e) => e.name === name || e.name === name.replace(/^\//, ''));
  const text = async (name: string) => { const e = find(name); return e ? readZipEntry(buf, e) : null; };

  // Worksheets by workbook order, resolved through the relationships part; a bare sheetN.xml scan is the fallback.
  const sheets: { name: string; path: string }[] = [];
  const workbook = await text('xl/workbook.xml');
  const rels = await text('xl/_rels/workbook.xml.rels');
  if (workbook) {
    const relMap = new Map<string, string>();
    if (rels) for (const r of Array.from(xml(rels).getElementsByTagName('Relationship'))) relMap.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');
    Array.from(xml(workbook).getElementsByTagName('sheet')).forEach((sheet, i) => {
      const rid = sheet.getAttribute('r:id') ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
      const target = relMap.get(rid);
      const path = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`) : `xl/worksheets/sheet${i + 1}.xml`;
      sheets.push({ name: sheet.getAttribute('name') ?? `Sheet${i + 1}`, path });
    });
  }
  if (sheets.length === 0) {
    for (const e of entries) if (/^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)) sheets.push({ name: e.name.replace(/^.*\/(sheet\d+)\.xml$/, '$1'), path: e.name });
  }
  if (sheets.length === 0) throw new Error('The workbook has no worksheet to read.');

  const shared: string[] = [];
  const sst = await text('xl/sharedStrings.xml');
  if (sst) {
    for (const si of Array.from(xml(sst).getElementsByTagName('si'))) {
      shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''));
    }
  }
  const { dates, codes } = styleFormats(await text('xl/styles.xml'));

  const grids: Grid[] = [];
  const pending: PendingList[][] = [];
  for (const sheet of sheets) {
    const sheetXml = await text(sheet.path);
    if (!sheetXml) continue;
    const doc = xml(sheetXml);
    const rows: string[][] = [];
    const rowNumbers: number[] = [];
    // Per column: how many data cells (below row 1) are filled, and how many of those are formulas.
    const filledBy: number[] = [];
    const formulaBy: number[] = [];
    // Per column: the number format of the first data cell that carries a date / time / numeric style.
    const formats: Record<number, string> = {};
    for (const row of Array.from(doc.getElementsByTagName('row'))) {
      const out: string[] = [];
      let cursor = 0;
      const rowNumber = Number(row.getAttribute('r') ?? rows.length + 1);
      for (const c of Array.from(row.getElementsByTagName('c'))) {
        const ref = c.getAttribute('r');
        const idx = ref ? columnIndex(ref) : cursor;
        cursor = idx + 1;
        const t = c.getAttribute('t');
        const isFormula = c.getElementsByTagName('f').length > 0;
        let value = '';
        if (t === 'inlineStr') value = Array.from(c.getElementsByTagName('t')).map((n) => n.textContent ?? '').join('');
        else {
          const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
          if (t === 's') value = shared[Number(v)] ?? '';
          else if (t === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
          else if (t === 'str' || t === 'e') value = v;
          else if (v !== '' && dates.has(Number(c.getAttribute('s') ?? -1))) value = serialToIso(Number(v));
          else value = v;
        }
        while (out.length < idx) out.push('');
        out[idx] = value;
        if (rowNumber > 1 && (value.trim() !== '' || isFormula)) {
          filledBy[idx] = (filledBy[idx] ?? 0) + 1;
          if (isFormula) formulaBy[idx] = (formulaBy[idx] ?? 0) + 1;
          const code = codes.get(Number(c.getAttribute('s') ?? -1));
          if (code && !(idx in formats) && t !== 's' && t !== 'inlineStr' && (c.getElementsByTagName('v')[0]?.textContent ?? '') !== '') formats[idx] = code;
        }
      }
      if (out.some((v) => v.trim() !== '')) { rows.push(out); rowNumbers.push(rowNumber); }
    }
    const formulaColumns = filledBy.map((n, i) => (n > 0 && formulaBy[i] === n ? i : -1)).filter((i) => i >= 0);
    grids.push({ name: sheet.name, rows, rowNumbers, formulaColumns, formats });
    pending.push(listValidations(doc));
  }
  // Dropdown lists resolve only once every sheet is read, since they usually point at a Lookup tab.
  grids.forEach((grid, g) => {
    const lists: Record<number, string[]> = {};
    for (const { columns, formula } of pending[g] ?? []) {
      const values = resolveList(formula, grids, grid);
      if (values.length === 0) continue;
      for (const col of columns) lists[col] = values;
    }
    grid.lists = lists;
  });
  return grids;
}

/* ── File → sheet ──────────────────────────────────────────── */

function readFile(file: File, as: 'text'): Promise<string>;
function readFile(file: File, as: 'buffer'): Promise<ArrayBuffer>;
function readFile(file: File, as: 'text' | 'buffer'): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('The file could not be read.'));
    r.onload = () => resolve(r.result as string | ArrayBuffer);
    if (as === 'text') r.readAsText(file); else r.readAsArrayBuffer(file);
  });
}

export type Workbook = { file: string; sheets: Sheet[] };

/** A grid's first row becomes the headers; blank headers are named by position and ragged rows are padded. */
function gridToSheet(grid: Grid): Sheet | null {
  if (grid.rows.length === 0) return null;
  const width = Math.max(...grid.rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim());
  const [head, ...body] = grid.rows.map(pad);
  return {
    name: grid.name,
    headers: head.map((h, i) => h || `Column ${i + 1}`),
    rows: body,
    lists: grid.lists ?? {},
    formulaColumns: grid.formulaColumns ?? [],
    kind: readsAsNotes(head, body) ? 'notes' : 'table',
  };
}

/** Instructions tabs: one or two used columns whose cells are sentences, not values. */
function readsAsNotes(head: string[], body: string[][]): boolean {
  const used = (r: string[]) => r.filter((v) => v !== '').length;
  if (used(head) > 2) return false;
  const cells = [head, ...body].flatMap((r) => r.filter((v) => v !== ''));
  if (cells.length === 0) return false;
  const prose = cells.filter((v) => v.length > 40 && /\s/.test(v)).length;
  return (head[0] ?? '').length > 40 && body.every((r) => used(r) <= 1) ? true : prose / cells.length >= 0.6 && body.every((r) => used(r) <= 2);
}

/** Every non-empty tab of the file: one for a CSV, one per worksheet for an .xlsx. */
export async function readWorkbook(file: File): Promise<Workbook> {
  if (file.size > MAX_SHEET_BYTES) throw new Error('Files up to 5 MB only. Trim the sheet to a few hundred rows; only the headers and a sample of values are needed.');
  const isXlsx = /\.xlsx$/i.test(file.name) || file.type.includes('spreadsheetml');
  if (/\.xls$/i.test(file.name)) throw new Error('Legacy .xls workbooks are not supported. Save it as .xlsx or CSV.');
  const grids = isXlsx ? await parseXlsx(await readFile(file, 'buffer')) : [{ name: file.name.replace(/\.[^.]+$/, ''), rows: parseCsv(await readFile(file, 'text')) }];
  const sheets = grids.map(gridToSheet).filter((g): g is Sheet => g !== null);
  if (sheets.length === 0) throw new Error(grids.length > 1 ? 'Every tab in the workbook is empty.' : 'The sheet is empty.');
  return { file: file.name, sheets };
}

/* ── Column inference ──────────────────────────────────────── */

const NUMBER = /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?$/;
const DATE = /^(\d{4}-\d{1,2}-\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2})?)?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})$/;
const MAX_CHOICES = 15;

export function inferColumns(sheet: Sheet): Column[] {
  return sheet.headers.map((header, index) => {
    const values = sheet.rows.map((r) => r[index] ?? '');
    const filled = values.filter((v) => v !== '');
    const freq = new Map<string, number>();
    for (const v of filled) freq.set(v, (freq.get(v) ?? 0) + 1);
    const distinctValues = Array.from(freq.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
    const formula = sheet.formulaColumns.includes(index);
    const dropdown = sheet.lists[index];

    let suggested: FieldType = 'textBox';
    let choices: string[] = [];
    let source: Column['source'] = 'none';
    if (dropdown && dropdown.length > 0) {
      // The file says what this column may hold; that beats guessing from the rows.
      suggested = 'select';
      choices = dropdown.slice();
      source = 'dropdown';
    } else if (formula) {
      suggested = 'textBox';
    } else if (filled.length > 0) {
      const avg = filled.reduce((s, v) => s + v.length, 0) / filled.length;
      const isSet = distinctValues.length <= MAX_CHOICES && distinctValues.length < filled.length && distinctValues.every((v) => v.length <= 60 && !v.includes('\n'));
      if (filled.every((v) => NUMBER.test(v))) suggested = isSet && distinctValues.length <= 3 ? 'select' : 'number';
      else if (filled.every((v) => DATE.test(v))) suggested = 'date';
      else if (isSet) suggested = 'select';
      else if (avg > 80 || filled.some((v) => v.includes('\n'))) suggested = 'textArea';
      if (suggested === 'select') { choices = distinctValues; source = 'values'; }
    }

    return { index, header, internalName: slugName(header) || `column_${index + 1}`, samples: distinctValues.slice(0, 4), filled: filled.length, blank: values.length - filled.length, distinct: distinctValues.length, suggested, choices, source, formula };
  });
}

/** A field in the legacy FieldSchema shape for one chosen column. */
export function fieldFromColumn(col: Pick<Column, 'header' | 'internalName' | 'choices'>, fieldType: FieldType, id: number): FieldSchema {
  return {
    id,
    internalName: col.internalName,
    label: col.header,
    fieldType,
    required: false,
    multiLine: fieldType === 'textArea',
    rows: 0,
    multiSelect: false,
    options: fieldType === 'select' ? { type: 'Static', value: col.choices.slice(), bindLabel: 'name' } : { type: '', value: '', bindLabel: 'name' },
    column: '1',
    defaultValue: '',
  };
}
