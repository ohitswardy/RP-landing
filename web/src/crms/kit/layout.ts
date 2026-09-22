import type { FieldSchema, ReportSource } from '../data';
import type { Grid } from './sheet';
import { slugName } from './sheet';

/* ─────────────────────────────────────────────────────────────
   Imported report templates: turn a client's own Excel workbook
   (read in the browser by sheet.ts) into a layout — which tab
   holds the data, where the header row and the first data row
   are, and which CRMS data source fills each column. Everything
   here is a pure function over the parsed grids so it is easy
   to test and to reason about; the modal only renders it.

   Auto-matching normalises the header ("Duration (In mins)" →
   "durationinmins") and looks it up in the source catalog the
   API publishes (meta.reportSources), preferring the vocabulary
   the workbook itself reveals: a Commcise template carries a
   ClientInteractionType tab, a Jefferies one a Lookup tab of
   Meeting Types. Form-builder fields match on label or name.
   ───────────────────────────────────────────────────────────── */

export type LayoutScope = 'client' | 'foreign' | 'all';
export type Flavor = 'commcise' | 'jefferies' | null;

export type LayoutColumn = {
  /** 0-based column on the data sheet. */
  index: number;
  header: string;
  /** A catalog key, form.{internalName}, meta.*, const, blank or formula. */
  source: string;
  /** Joins a multi-value source. */
  separator: string;
  /** Number format for date / time / number sources ('text' writes the value as text). */
  format: string | null;
  /** The fixed text of a `const` column. */
  text: string | null;
};

export type LayoutCell = { ref: string; source: string; text: string | null };

export type LayoutDraft = {
  title: string;
  sheet: string;
  headerRow: number;
  dataStart: number;
  scope: LayoutScope;
  columns: LayoutColumn[];
  cells: LayoutCell[];
};

export const SCOPE_LABELS: Record<LayoutScope, string> = {
  client: 'This client’s interactions',
  foreign: 'Every Foreign client (co-brand upload)',
  all: 'Every client',
};

export const DATE_FORMATS: { id: string; label: string }[] = [
  { id: 'yyyy-mm-dd', label: 'Date · 2026-09-21' },
  { id: 'mm/dd/yyyy', label: 'Date · 09/21/2026 (US)' },
  { id: 'dd/mm/yyyy', label: 'Date · 21/09/2026' },
  { id: 'd mmm yyyy', label: 'Date · 21 Sep 2026' },
  { id: 'text', label: 'Text · 2026-09-21' },
];

export const TIME_FORMATS: { id: string; label: string }[] = [
  { id: 'hh:mm', label: 'Time · 15:10' },
  { id: 'hh:mm:ss', label: 'Time · 15:10:00' },
  { id: 'text', label: 'Text · 15:10' },
];

/** "Duration (In mins)" → "durationinmins". */
export const normalizeHeader = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Column letters for a 0-based index: 0 → A, 26 → AA. */
export function colLetters(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

/* ── Which tab, which rows ─────────────────────────────────── */

const cellAt = (grid: Grid, rowNumber: number, col: number): string => {
  const k = grid.rowNumbers?.indexOf(rowNumber) ?? -1;
  return k >= 0 ? (grid.rows[k]?.[col] ?? '').trim() : '';
};

const rowAt = (grid: Grid, rowNumber: number): string[] => {
  const k = grid.rowNumbers?.indexOf(rowNumber) ?? -1;
  return k >= 0 ? grid.rows[k].map((v) => (v ?? '').trim()) : [];
};

const used = (r: string[]) => r.filter((v) => v !== '').length;
const NUMERIC = /^-?\d+(\.\d+)?$/;
const ISO = /^\d{4}-\d{2}-\d{2}/;

/** A row that reads as headers: mostly short text, no numbers or dates. */
function headerScore(r: string[], width: number): number {
  const filled = r.filter((v) => v !== '');
  if (filled.length < 2 || filled.length < width * 0.5) return 0;
  const shortText = filled.filter((v) => v.length <= 40 && !NUMERIC.test(v) && !ISO.test(v) && !/[.!?]\s/.test(v)).length;
  return shortText / filled.length >= 0.8 ? filled.length : 0;
}

/**
 * The header row and the first data row of a tab. Prefers the last
 * header-like row among the first twenty (Commcise stacks descriptions
 * and "Mandatory" notes above its real header), and skips a "Your data
 * starts here" marker row.
 */
export function detectHeaderRow(grid: Grid): { headerRow: number; dataStart: number; marker: boolean } {
  const numbers = grid.rowNumbers ?? grid.rows.map((_, i) => i + 1);
  const width = Math.max(1, ...grid.rows.map((r) => r.length));
  let headerRow = numbers[0] ?? 1;
  let best = -1;
  for (let k = 0; k < Math.min(grid.rows.length, 20); k++) {
    const score = headerScore(grid.rows[k].map((v) => (v ?? '').trim()), width);
    if (score >= best && score > 0) { best = score; headerRow = numbers[k]; }
  }
  let dataStart = headerRow + 1;
  const next = rowAt(grid, dataStart);
  const marker = next.some((v) => /data starts here/i.test(v));
  return { headerRow, dataStart, marker };
}

/** The tab most likely to hold the data: the widest header row wins; a tab named Data wins outright. */
export function detectDataSheet(grids: Grid[]): number {
  const named = grids.findIndex((g) => /^data$/i.test(g.name.trim()));
  if (named >= 0) return named;
  let best = 0;
  let width = -1;
  grids.forEach((g, i) => {
    const { headerRow } = detectHeaderRow(g);
    const w = used(rowAt(g, headerRow));
    if (w > width) { width = w; best = i; }
  });
  return best;
}

/* ── Vocabulary the workbook reveals ───────────────────────── */

const COMMCISE_MARKERS = ['analystcall2x1', 'clientinteractiontype', 'consumersite', 'yourdatastartshere'];
const JEFFERIES_MARKERS = ['testingthewaters', 'corporateaccessoneoff', 'ibemailideas', 'gicssectorsindustry'];

export function detectFlavor(grids: Grid[]): Flavor {
  const bag = new Set<string>();
  for (const g of grids) {
    bag.add(normalizeHeader(g.name));
    for (const r of g.rows.slice(0, 120)) for (const v of r) if (v) bag.add(normalizeHeader(v));
  }
  const hits = (markers: string[]) => markers.filter((m) => bag.has(m)).length;
  const c = hits(COMMCISE_MARKERS);
  const j = hits(JEFFERIES_MARKERS);
  if (c === 0 && j === 0) return null;
  return c >= j ? 'commcise' : 'jefferies';
}

/* ── Column → source ───────────────────────────────────────── */

/** Fixed values the T1C / Salesforce extract expects, by normalised header. */
const CONST_PRESETS: Record<string, string> = { solicitedc: 'Yes', teexpensec: 'False', sourcec: 'Regis', lineofbusinessc: 'Equity' };

export type Match = { source: string; text: string | null };

/**
 * The best source for a header: the flavour's own vocabulary first, then
 * the client's form fields by label or internal name, then the generic
 * aliases, then the T1C constants. A formula column keeps its formula.
 */
export function matchSource(header: string, opts: { flavor: Flavor; sources: ReportSource[]; fields: FieldSchema[]; formula?: boolean }): Match {
  if (opts.formula) return { source: 'formula', text: null };
  const key = normalizeHeader(header);
  if (!key) return { source: 'blank', text: null };
  if (opts.flavor) {
    const hit = opts.sources.find((s) => (s.flavors?.[opts.flavor as string] ?? []).includes(key));
    if (hit) return { source: hit.key, text: null };
  }
  const field = opts.fields.find((f) => normalizeHeader(f.label) === key || normalizeHeader(f.internalName) === key || slugName(f.label) === slugName(header));
  if (field) return { source: `form.${field.internalName}`, text: null };
  const generic = opts.sources.find((s) => s.aliases.includes(key));
  if (generic) return { source: generic.key, text: null };
  if (key in CONST_PRESETS) return { source: 'const', text: CONST_PRESETS[key] };
  return { source: 'blank', text: null };
}

/**
 * How a multi-value column joins its values: the note the template writes
 * above the header ("Separate with a |"), else what the sample rows use,
 * else a comma (with a space, as the legacy sheets printed names).
 */
export function detectSeparator(grid: Grid, headerRow: number, col: number, flavor: Flavor): string {
  const numbers = grid.rowNumbers ?? [];
  for (const n of numbers) {
    if (n >= headerRow) break;
    const m = cellAt(grid, n, col).match(/separate(?:d)?\s+(?:with|by)\s+(?:a\s+)?["“']?([^\w\s"”'])/i);
    if (m) return m[1];
  }
  const samples = numbers.filter((n) => n > headerRow).slice(0, 40).map((n) => cellAt(grid, n, col)).filter(Boolean);
  if (samples.some((v) => v.includes('|'))) return '|';
  if (samples.some((v) => /\S,\S/.test(v))) return ',';
  if (samples.some((v) => /, /.test(v))) return ', ';
  if (flavor === 'jefferies') return ',';
  if (flavor === 'commcise') return '|';
  return ', ';
}

/** "mm/dd/yyyy;@" → "mm/dd/yyyy": the format code as a reader sees it. */
export const cleanFormat = (code: string): string => code.split(';')[0].replace(/\\/g, '').trim();

/**
 * The number format to write a date / time source with: the template's own
 * sample format when its cells carried one (so the server reuses that very
 * style), else ISO dates and hh:mm times.
 */
export function defaultFormat(kind: ReportSource['kind'], sampleCode: string | undefined): string | null {
  if (kind !== 'date' && kind !== 'time') return null;
  const code = cleanFormat(sampleCode ?? '');
  if (code === '@') return 'text';
  if (kind === 'date') return /[yd]/i.test(code) ? code : 'yyyy-mm-dd';
  return /[hs]/i.test(code) && code.includes(':') ? code : 'hh:mm';
}

/** The format choices for a date / time column: the presets plus the template's own code when it is not one of them. */
export function formatOptions(kind: 'date' | 'time', current: string | null): { id: string; label: string }[] {
  const base = kind === 'date' ? DATE_FORMATS : TIME_FORMATS;
  if (!current || base.some((f) => f.id === current)) return base;
  return [{ id: current, label: `Template’s format · ${current}` }, ...base];
}

/* ── Title-block cells ─────────────────────────────────────── */

const CELL_LABELS: { test: RegExp; source: string }[] = [
  { test: /^template\s*date\b|^generated\s*(on|at)?\b|^report\s*date\b|^run\s*date\b|^date\s*(generated|created)\b/i, source: 'meta.generated_at_utc' },
  { test: /^downloaded\s*by\b|^generated\s*by\b|^prepared\s*by\b|^run\s*by\b/i, source: 'meta.generated_by' },
  { test: /^(date\s*)?range\b|^period\b|^reporting\s*period\b/i, source: 'meta.range' },
  { test: /^client\b|^asset\s*manager\b|^firm\b/i, source: 'meta.client_name' },
];

/**
 * Cells above the header row whose left-hand neighbour is a label such as
 * "Template Date:" or "Downloaded by:" — the value cell is bound to the
 * matching run fact so the finished file is stamped like a fresh download.
 */
export function suggestCells(grid: Grid, headerRow: number): LayoutCell[] {
  const out: LayoutCell[] = [];
  const numbers = grid.rowNumbers ?? [];
  for (const n of numbers) {
    if (n >= headerRow) break;
    const row = rowAt(grid, n);
    row.forEach((v, c) => {
      const label = v.replace(/\s*:\s*$/, '');
      const hit = CELL_LABELS.find((l) => l.test.test(label));
      if (!hit || !/:\s*$/.test(v)) return;
      out.push({ ref: `${colLetters(c + 1)}${n}`, source: hit.source, text: null });
    });
  }
  return out;
}

/* ── Putting it together ───────────────────────────────────── */

/** "2026-09-21-Schroders-Commcise Template_20260921051916.xlsx" → "Schroders-Commcise Template". */
export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/^\d{4}[-_.]\d{2}[-_.]\d{2}[-_\s]*/, '')
    .replace(/[-_\s]*\d{8,}$/, '')
    .replace(/[-_\s]*\(\d+\)$/, '')
    .trim() || name.replace(/\.[^.]+$/, '');
}

export type ColumnSeed = { column: LayoutColumn; sample: string; kind: ReportSource['kind']; multi: boolean; formula: boolean };

/**
 * One draft column per used column of the data tab: header text, the
 * matched source, the separator and format the template implies, and the
 * first sample value for the operator to check against.
 */
export function seedColumns(grid: Grid, headerRow: number, dataStart: number, opts: { flavor: Flavor; sources: ReportSource[]; fields: FieldSchema[] }): ColumnSeed[] {
  const header = rowAt(grid, headerRow);
  const numbers = grid.rowNumbers ?? [];
  const dataRows = numbers.filter((n) => n >= dataStart);
  const width = Math.max(header.length, ...dataRows.slice(0, 50).map((n) => rowAt(grid, n).length));
  const byKey = new Map(opts.sources.map((s) => [s.key, s]));
  const out: ColumnSeed[] = [];
  for (let c = 0; c < width; c++) {
    const text = header[c] ?? '';
    const samples = dataRows.map((n) => cellAt(grid, n, c)).filter((v) => v && !/data starts here/i.test(v));
    if (!text && samples.length === 0) continue;
    const formula = (grid.formulaColumns ?? []).includes(c);
    const match = matchSource(text || `Column ${c + 1}`, { ...opts, formula });
    const src = byKey.get(match.source);
    const kind = src?.kind ?? 'text';
    out.push({
      column: {
        index: c,
        header: text,
        source: match.source,
        separator: src?.multi ? detectSeparator(grid, headerRow, c, opts.flavor) : ', ',
        format: defaultFormat(kind, grid.formats?.[c]),
        text: match.text,
      },
      sample: samples[0] ?? '',
      kind,
      multi: src?.multi ?? false,
      formula,
    });
  }
  return out;
}

/** The form a client's interactions use: its own, else the default, else the Generic Form's (mirrors Form::forClient). */
export function fieldsForClient(forms: { clientId: string | null; fields: FieldSchema[] }[], clientId: string | null, genericClientId: string | null): FieldSchema[] {
  const own = clientId ? forms.find((f) => f.clientId === clientId) : null;
  const fallback = forms.find((f) => f.clientId === null) ?? (genericClientId ? forms.find((f) => f.clientId === genericClientId) : null);
  return (own ?? fallback)?.fields ?? [];
}

/** Grouped options for the source picker: the catalog by group, then the client's form fields. */
export function sourceOptions(sources: ReportSource[], fields: FieldSchema[]): { id: string; label: string; group: string; hint?: string }[] {
  const out = sources.map((s) => ({ id: s.key, label: s.label, group: s.group, hint: s.multi ? 'list' : s.kind === 'text' ? undefined : s.kind }));
  const seen = new Set<string>();
  for (const f of fields) {
    if (!f.internalName || seen.has(f.internalName)) continue;
    seen.add(f.internalName);
    out.push({ id: `form.${f.internalName}`, label: f.label || f.internalName, group: 'Form fields', hint: f.internalName });
  }
  return out;
}
