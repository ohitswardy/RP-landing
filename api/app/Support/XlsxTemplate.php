<?php

namespace App\Support;

use RuntimeException;
use ZipArchive;

/**
 * Fills a client's own Excel template with rows while leaving everything
 * else in the workbook exactly as it was uploaded: every other tab (Lookup,
 * Roles, Region, Client Data Quality Rules…), the styles, column widths,
 * merged title bands, conditional formats, dropdown validations, comments
 * and images. Only the data sheet is touched, and only from the row the
 * data starts at: the template's own sample rows are removed, our rows are
 * written in their place with the sample row's cell styles, any per-row
 * formula (a validator such as Jefferies' Errors column) is re-addressed
 * to each new row, and the validation / conditional-format ranges are
 * re-based so they cover exactly the rows written.
 *
 * The work is string surgery on the sheet XML rather than a DOM round trip
 * so untouched parts stay byte-identical. Excel's own files are the test
 * bed: the Jefferies bulk-upload workbook (header on row 1, data from row 2,
 * array formulas, x14 list validations) and the Commcise templates (seven
 * header rows, a "Your data starts here" marker on row 8, column styles,
 * conditional formats to row 10,000).
 */
class XlsxTemplate
{
    public const MAX_ROW = 1048576;

    /** Excel's built-in number formats a template is likely to use (id → code). */
    private const BUILTIN_FORMATS = [
        0 => 'General', 1 => '0', 2 => '0.00', 3 => '#,##0', 4 => '#,##0.00', 9 => '0%', 10 => '0.00%', 11 => '0.00E+00',
        14 => 'mm-dd-yy', 15 => 'd-mmm-yy', 16 => 'd-mmm', 17 => 'mmm-yy', 18 => 'h:mm AM/PM', 19 => 'h:mm:ss AM/PM',
        20 => 'h:mm', 21 => 'h:mm:ss', 22 => 'm/d/yy h:mm', 45 => 'mm:ss', 46 => '[h]:mm:ss', 47 => 'mmss.0', 49 => '@',
    ];

    private ZipArchive $zip;

    /** @var array<string, string|null> part name → xml (read once, possibly modified) */
    private array $parts = [];

    /** @var array<string, true> parts changed since open() */
    private array $dirty = [];

    /** @var list<string> parts to drop on save() */
    private array $removed = [];

    /** @var array<string, string>|null sheet name → part path */
    private ?array $sheets = null;

    /** @var list<string>|null */
    private ?array $shared = null;

    /** @var array<int, string>|null cellXfs index → xf xml */
    private ?array $xfs = null;

    /** @var array<int, string>|null numFmtId → format code (custom + built-in) */
    private ?array $numFmts = null;

    /** @var array<string, int> "format|base" → xf index created or found */
    private array $styleCache = [];

    private function __construct(private readonly string $source)
    {
        $this->zip = new ZipArchive;
        if ($this->zip->open($source) !== true) {
            throw new RuntimeException('Not a valid .xlsx workbook.');
        }
        if ($this->zip->locateName('xl/workbook.xml') === false) {
            $this->zip->close();
            throw new RuntimeException('Not a valid .xlsx workbook: it has no xl/workbook.xml.');
        }
    }

    public function __destruct()
    {
        try {
            @$this->zip->close();
        } catch (\Throwable) {
            // already closed
        }
    }

    public static function open(string $path): self
    {
        if (! is_file($path)) {
            throw new RuntimeException('The template workbook is missing.');
        }

        return new self($path);
    }

    /* ── Reading ─────────────────────────────────────────────────── */

    /** @return array<string, string> sheet name → part path, in workbook order */
    public function sheets(): array
    {
        if ($this->sheets !== null) {
            return $this->sheets;
        }
        $targets = [];
        preg_match_all('/<Relationship\s[^>]*>/', $this->part('xl/_rels/workbook.xml.rels') ?? '', $m);
        foreach ($m[0] as $rel) {
            if (preg_match('/\bId="([^"]+)"/', $rel, $id) && preg_match('/\bTarget="([^"]+)"/', $rel, $t)) {
                $target = self::decode($t[1]);
                $targets[$id[1]] = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/'.preg_replace('#^\./#', '', $target);
            }
        }
        $out = [];
        preg_match_all('/<sheet\s[^>]*>/', $this->part('xl/workbook.xml') ?? '', $m);
        foreach ($m[0] as $i => $sheet) {
            $name = preg_match('/\sname="([^"]*)"/', $sheet, $n) ? self::decode($n[1]) : 'Sheet'.($i + 1);
            $rid = preg_match('/\sr:id="([^"]+)"/', $sheet, $r) ? $r[1] : '';
            $out[$name] = $targets[$rid] ?? 'xl/worksheets/sheet'.($i + 1).'.xml';
        }
        if ($out === []) {
            throw new RuntimeException('The workbook has no worksheets.');
        }

        return $this->sheets = $out;
    }

    /**
     * The text of every cell on one row of a sheet, keyed by 0-based column.
     *
     * @return array<int, string>
     */
    public function rowText(string $sheet, int $row): array
    {
        $path = $this->sheets()[$sheet] ?? throw new RuntimeException("The workbook has no sheet named \"$sheet\".");
        $xml = $this->part($path) ?? '';
        if (! preg_match('/<row\b[^>]*?\br="'.$row.'"[^>]*?(?:\/>|>.*?<\/row>)/s', $xml, $m)) {
            return [];
        }
        $out = [];
        foreach ($this->parseRow($m[0])['cells'] as $col => $cell) {
            if ($cell['text'] !== '') {
                $out[$col] = $cell['text'];
            }
        }

        return $out;
    }

    /* ── Filling ─────────────────────────────────────────────────── */

    /**
     * Replace the data area of $sheet (rows ≥ $dataStart) with $rows.
     *
     * Each row is `array<int, array{v: mixed, kind: string, format?: ?string}>`
     * keyed by 0-based column; kind is text | date (v = Y-m-d) | time
     * (v = H:i[:s]) | number | formula (the template's own formula on that
     * column, re-addressed). $cells patches cells above the data area
     * (A1-style ref → text), e.g. a "Downloaded by" value in the title block.
     *
     * @param  iterable<array<int, array>>  $rows
     * @param  array<string, string>  $cells
     */
    public function fill(string $sheet, int $headerRow, int $dataStart, iterable $rows, array $cells = []): void
    {
        $path = $this->sheets()[$sheet] ?? throw new RuntimeException("The workbook has no sheet named \"$sheet\".");
        $xml = $this->part($path) ?? throw new RuntimeException("Sheet \"$sheet\" could not be read.");
        if ($dataStart < 1 || $dataStart <= $headerRow) {
            throw new RuntimeException('The data must start below the header row.');
        }

        // Split the sheet around <sheetData>; everything outside it is kept verbatim (bar the ranges re-based below).
        if (preg_match('/<sheetData\s*\/>/', $xml, $m, PREG_OFFSET_CAPTURE)) {
            $pre = substr($xml, 0, $m[0][1]);
            $body = '';
            $post = substr($xml, $m[0][1] + strlen($m[0][0]));
        } elseif (preg_match('/<sheetData\b[^>]*>/', $xml, $m, PREG_OFFSET_CAPTURE)) {
            $start = $m[0][1] + strlen($m[0][0]);
            $end = strpos($xml, '</sheetData>', $start);
            if ($end === false) {
                throw new RuntimeException("Sheet \"$sheet\" is malformed.");
            }
            $pre = substr($xml, 0, $m[0][1]);
            $body = substr($xml, $start, $end - $start);
            $post = substr($xml, $end + strlen('</sheetData>'));
        } else {
            throw new RuntimeException("Sheet \"$sheet\" has no sheetData.");
        }

        // Rows above the data area stay; the first real row at or below it lends its styles and formulas.
        $kept = [];
        $sample = null;
        preg_match_all('/<row\b[^>]*?(?:\/>|>.*?<\/row>)/s', $body, $m);
        foreach ($m[0] as $rowXml) {
            $r = preg_match('/<row\b[^>]*?\br="(\d+)"/', $rowXml, $rm) ? (int) $rm[1] : 0;
            if ($r < $dataStart) {
                $kept[$r] = $rowXml;
                continue;
            }
            if ($sample === null) {
                $parsed = $this->parseRow($rowXml);
                if (! $this->isMarkerRow($parsed)) {
                    $sample = $parsed;
                }
            }
        }
        foreach ($cells as $ref => $text) {
            if (preg_match('/^([A-Z]{1,3})(\d+)$/', strtoupper((string) $ref), $rm) && (int) $rm[2] < $dataStart) {
                $this->patchCell($kept, strtoupper((string) $ref), (string) $text);
            }
        }
        ksort($kept);

        $colStyles = $this->columnStyles($pre);
        $out = implode('', $kept);
        $r = $dataStart - 1;
        $maxCol = 0;
        $wroteFormula = false;
        foreach ($rows as $line) {
            $r++;
            ksort($line);
            $cellsXml = '';
            foreach ($line as $col => $cell) {
                $col = (int) $col;
                $maxCol = max($maxCol, $col);
                $sampleCell = $sample['cells'][$col] ?? null;
                if (($cell['kind'] ?? 'text') === 'formula') {
                    $wroteFormula = $wroteFormula || ($sampleCell['f'] ?? null) !== null;
                }
                $cellsXml .= $this->cellXml(SimpleXlsx::col($col + 1).$r, $cell, $sampleCell, $sample['row'] ?? 0, $colStyles[$col] ?? null, $r);
            }
            $out .= '<row r="'.$r.'">'.$cellsXml.'</row>';
        }
        $lastRow = max($r, $dataStart - 1, ...array_keys($kept ?: [0 => '']));

        // Dimension (at least as wide as the header row), then the ranges that must follow the new data area.
        $headerCols = isset($kept[$headerRow]) ? count($this->parseRow($kept[$headerRow])['cells']) : 0;
        if (isset($kept[$headerRow])) {
            $headerCols = max($headerCols, ...array_map(fn ($c) => $c + 1, array_keys($this->parseRow($kept[$headerRow])['cells']) ?: [0]));
        }
        $lastColLetters = SimpleXlsx::col(max($maxCol + 1, $headerCols, $this->dimensionCols($pre), 1));
        $dimension = '<dimension ref="A1:'.$lastColLetters.max($lastRow, 1).'"/>';
        if (preg_match('/<dimension\s+ref="[^"]*"\s*\/>/', $pre)) {
            $pre = preg_replace('/<dimension\s+ref="[^"]*"\s*\/>/', $dimension, $pre, 1) ?? $pre;
        } elseif (preg_match('/<(sheetViews|sheetFormatPr|cols)\b/', $pre, $dm, PREG_OFFSET_CAPTURE)) {
            // A workbook written without one gets the conventional element, in schema order.
            $pre = substr($pre, 0, $dm[0][1]).$dimension.substr($pre, $dm[0][1]);
        }
        $post = $this->rebaseValidations($post, $dataStart, $lastRow);
        $post = $this->extendConditionalFormats($post, $lastRow);
        $post = $this->dropDataAreaHyperlinks($post, $dataStart);

        $this->set($path, $pre.'<sheetData>'.$out.'</sheetData>'.$post);
        if ($wroteFormula) {
            $this->recalculateOnOpen();
        }
    }

    /** Write the finished workbook to $out: the source zip with only the changed parts replaced. */
    public function save(string $out): void
    {
        if (! copy($this->source, $out)) {
            throw new RuntimeException('Could not write the workbook.');
        }
        $zip = new ZipArchive;
        if ($zip->open($out) !== true) {
            throw new RuntimeException('Could not write the workbook.');
        }
        foreach ($this->removed as $name) {
            $zip->deleteName($name);
        }
        foreach ($this->dirty as $name => $_) {
            if ($this->parts[$name] !== null) {
                $zip->addFromString($name, $this->parts[$name]);
            }
        }
        $zip->close();
    }

    /* ── Cells ───────────────────────────────────────────────────── */

    /** @param  array{v: mixed, kind?: string, format?: ?string}  $cell */
    private function cellXml(string $ref, array $cell, ?array $sampleCell, int $sampleRow, ?int $colStyle, int $r): string
    {
        $kind = $cell['kind'] ?? 'text';
        $v = $cell['v'] ?? null;
        $sampleS = $sampleCell['s'] ?? null;

        if ($kind === 'formula') {
            if ($sampleCell === null || $sampleCell['f'] === null) {
                return $this->cellXml($ref, ['v' => $v, 'kind' => 'text'], $sampleCell, $sampleRow, $colStyle, $r);
            }

            return '<c r="'.$ref.'"'.$sampleCell['attrs'].'>'.$this->readdress($sampleCell['f'], $sampleRow, $r, $ref).'</c>';
        }

        $fallback = $sampleS ?? $colStyle;
        if ($v === null || $v === '') {
            return $fallback !== null ? '<c r="'.$ref.'" s="'.$fallback.'"/>' : '';
        }
        $format = isset($cell['format']) && $cell['format'] !== '' ? (string) $cell['format'] : null;

        if ($kind === 'date' && $format !== 'text' && preg_match('/^\d{4}-\d{2}-\d{2}/', (string) $v)) {
            $s = $this->styleFor($sampleS, $colStyle, $format, 'date');

            return '<c r="'.$ref.'" s="'.$s.'"><v>'.SimpleXlsx::dateSerial(substr((string) $v, 0, 10)).'</v></c>';
        }
        if ($kind === 'time' && $format !== 'text' && preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', (string) $v)) {
            $s = $this->styleFor($sampleS, $colStyle, $format, 'time');

            return '<c r="'.$ref.'" s="'.$s.'"><v>'.SimpleXlsx::timeSerial((string) $v).'</v></c>';
        }
        if ($kind === 'number' && $format !== 'text' && is_numeric($v)) {
            $s = $this->styleFor($sampleS, $colStyle, $format, 'number');

            return '<c r="'.$ref.'"'.($s !== null ? ' s="'.$s.'"' : '').'><v>'.(is_int($v) || is_float($v) ? $v : (string) $v).'</v></c>';
        }

        $text = mb_substr((string) $v, 0, 32767);

        return '<c r="'.$ref.'"'.($fallback !== null ? ' s="'.$fallback.'"' : '').' t="inlineStr"><is><t xml:space="preserve">'.self::esc($text).'</t></is></c>';
    }

    /**
     * The cellXfs index for a date / time / number cell: the sample cell's own
     * style when it already renders that kind (and the wanted format, if one
     * was asked for); otherwise a style derived from it with the right number
     * format, created once and reused.
     */
    private function styleFor(?int $sampleS, ?int $colStyle, ?string $format, string $kind): ?int
    {
        $base = $sampleS ?? $colStyle;
        if ($base !== null) {
            $code = $this->formatCodeOf($base);
            $baseKind = self::kindOfFormat($code);
            $fits = $baseKind === $kind || ($kind === 'number' && $baseKind === 'general');
            if ($fits && ($format === null || self::sameFormat($code, $format))) {
                return $base;
            }
        } elseif ($kind === 'number' && $format === null) {
            return null;
        }
        $format ??= match ($kind) {
            'date' => 'yyyy-mm-dd',
            'time' => 'hh:mm',
            default => '0',
        };

        return $this->ensureStyle($format, $base ?? 0);
    }

    /** A formula element from the sample row, moved to row $to (relative refs to the sample row follow). */
    private function readdress(string $fXml, int $from, int $to, string $ref): string
    {
        if (! preg_match('/^<f\b([^>]*?)(?:\/>|>(.*)<\/f>)$/s', trim($fXml), $m)) {
            return $fXml;
        }
        $attrs = preg_replace('/\sref="[^"]*"/', ' ref="'.$ref.'"', $m[1]) ?? $m[1];
        // Shared formulas are written out in full per row, so the sharing attributes go.
        $attrs = preg_replace('/\s(?:t="shared"|si="\d+")/', '', $attrs) ?? $attrs;
        $body = $from > 0 ? self::shiftRows($m[2] ?? '', $from, $to) : ($m[2] ?? '');

        return '<f'.$attrs.'>'.$body.'</f>';
    }

    /**
     * Move every relative reference to row $from onto row $to. Absolute rows
     * ($A$2), other sheets (Lookup!A2) and function names are left alone.
     */
    public static function shiftRows(string $formula, int $from, int $to): string
    {
        return preg_replace_callback(
            '/(?<![A-Za-z0-9_$!.])(\$?[A-Z]{1,3})'.$from.'(?![0-9])/',
            fn ($m) => $m[1].$to,
            $formula,
        ) ?? $formula;
    }

    /* ── Row parsing ─────────────────────────────────────────────── */

    /**
     * @return array{row: int, cells: array<int, array{s: ?int, attrs: string, f: ?string, text: string}>}
     */
    private function parseRow(string $rowXml): array
    {
        $row = preg_match('/<row\b[^>]*?\br="(\d+)"/', $rowXml, $rm) ? (int) $rm[1] : 0;
        $cells = [];
        $cursor = 0;
        preg_match_all('/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/s', $rowXml, $m, PREG_SET_ORDER);
        foreach ($m as $c) {
            $attrs = $c[1];
            $inner = $c[2] ?? '';
            $col = preg_match('/\br="([A-Z]{1,3})\d+"/', $attrs, $cm) ? self::colIndex($cm[1]) : $cursor;
            $cursor = $col + 1;
            $s = preg_match('/\bs="(\d+)"/', $attrs, $sm) ? (int) $sm[1] : null;
            $t = preg_match('/\bt="([^"]+)"/', $attrs, $tm) ? $tm[1] : null;
            $f = preg_match('/<f\b[^>]*?(?:\/>|>.*?<\/f>)/s', $inner, $fm) ? $fm[0] : null;
            $text = '';
            if ($t === 'inlineStr') {
                preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $inner, $tt);
                $text = self::decode(implode('', $tt[1]));
            } elseif (preg_match('/<v>(.*?)<\/v>/s', $inner, $vm)) {
                $v = self::decode($vm[1]);
                $text = $t === 's' ? ($this->shared()[(int) $v] ?? '') : $v;
            }
            $cells[$col] = [
                's' => $s,
                // Everything but the address, so a re-emitted formula cell keeps its s / t / cm attributes.
                'attrs' => preg_replace('/\sr="[^"]*"/', '', $attrs) ?? $attrs,
                'f' => $f,
                'text' => $text,
            ];
        }

        return ['row' => $row, 'cells' => $cells];
    }

    /** Commcise-style placeholder rows ("Your data starts here: Cell A8") lend no styles. */
    private function isMarkerRow(array $parsed): bool
    {
        foreach ($parsed['cells'] as $cell) {
            if (preg_match('/data starts here/i', $cell['text'])) {
                return true;
            }
        }

        return false;
    }

    /** Default cell style per 0-based column from <cols>, used when the template has no sample row. */
    private function columnStyles(string $pre): array
    {
        $out = [];
        preg_match_all('/<col\s[^>]*>/', $pre, $m);
        foreach ($m[0] as $col) {
            if (! preg_match('/\bstyle="(\d+)"/', $col, $s) || ! preg_match('/\bmin="(\d+)"/', $col, $a) || ! preg_match('/\bmax="(\d+)"/', $col, $b)) {
                continue;
            }
            for ($c = (int) $a[1]; $c <= min((int) $b[1], (int) $a[1] + 512); $c++) {
                $out[$c - 1] = (int) $s[1];
            }
        }

        return $out;
    }

    private function dimensionCols(string $pre): int
    {
        if (preg_match('/<dimension\s+ref="[A-Z]+\d+:([A-Z]+)\d+"/', $pre, $m)) {
            return self::colIndex($m[1]) + 1;
        }

        return 1;
    }

    /** Replace or insert a text cell in the kept rows (title block values such as "Downloaded by"). */
    private function patchCell(array &$kept, string $ref, string $text): void
    {
        preg_match('/^([A-Z]{1,3})(\d+)$/', $ref, $m);
        $row = (int) $m[2];
        $target = self::colIndex($m[1]);
        $cellXml = fn (?int $s) => '<c r="'.$ref.'"'.($s !== null ? ' s="'.$s.'"' : '').' t="inlineStr"><is><t xml:space="preserve">'.self::esc($text).'</t></is></c>';

        if (! isset($kept[$row])) {
            $kept[$row] = '<row r="'.$row.'">'.$cellXml(null).'</row>';

            return;
        }
        $rowXml = $kept[$row];
        if (preg_match('/<c\b[^>]*?\br="'.$ref.'"[^>]*?(?:\/>|>.*?<\/c>)/s', $rowXml, $cm)) {
            $s = preg_match('/\bs="(\d+)"/', $cm[0], $sm) ? (int) $sm[1] : null;
            $kept[$row] = str_replace($cm[0], $cellXml($s), $rowXml);

            return;
        }
        if (preg_match('/<row\b[^>]*\/>$/s', $rowXml)) {
            $rowXml = preg_replace('/\/>$/', '>', $rowXml).'</row>';
        }
        preg_match_all('/<c\b[^>]*?(?:\/>|>.*?<\/c>)/s', $rowXml, $cells, PREG_OFFSET_CAPTURE);
        $at = strrpos($rowXml, '</row>');
        foreach ($cells[0] as [$cx, $off]) {
            if (preg_match('/\br="([A-Z]{1,3})\d+"/', $cx, $cc) && self::colIndex($cc[1]) > $target) {
                $at = $off;
                break;
            }
        }
        $kept[$row] = substr($rowXml, 0, $at).$cellXml(null).substr($rowXml, $at);
    }

    /* ── Ranges that follow the data area ────────────────────────── */

    /**
     * Every list / whole-number validation that covered the data area is
     * re-based to `{col}{dataStart}:{col}{end}` per column, where end stays
     * open-ended (row 1,048,576) when the template's was, else reaches the
     * last row written. A column claimed by an earlier validation is dropped
     * from later ones, so the split ranges a hand-edited template accumulates
     * (E1:E64 + E65:E118 + E119:…) collapse to one rule per column.
     */
    private function rebaseValidations(string $post, int $dataStart, int $lastRow): string
    {
        // Where each column's validation reached across every rule, so the rule that wins a column keeps the furthest reach.
        $ends = [];
        preg_match_all('/<dataValidation\b[^>]*?\ssqref="([^"]*)"|<xm:sqref>([^<]*)<\/xm:sqref>/', $post, $all, PREG_SET_ORDER);
        foreach ($all as $hit) {
            $scratch = [];
            foreach (explode(' ', self::rebaseSqref(self::decode($hit[1] !== '' ? $hit[1] : ($hit[2] ?? '')), $dataStart, $lastRow, $scratch)) as $part) {
                if (preg_match('/^([A-Z]{1,3})\d+(?::[A-Z]{1,3}(\d+))?$/', $part, $pm)) {
                    $c = self::colIndex($pm[1]);
                    $ends[$c] = max($ends[$c] ?? 0, (int) ($pm[2] ?? $dataStart));
                }
            }
        }

        $claimed = [];
        $post = preg_replace_callback('/(<dataValidations\b[^>]*>)(.*?)<\/dataValidations>/s', function ($m) use ($dataStart, $lastRow, &$claimed, $ends) {
            preg_match_all('/<dataValidation\b[^>]*?(?:\/>|>.*?<\/dataValidation>)/s', $m[2], $dvs);
            $out = [];
            foreach ($dvs[0] as $dv) {
                // A validation without a type is Excel's "Any value" leftover: it constrains nothing, so it goes.
                if (! preg_match('/<dataValidation\b[^>]*?\stype="/', $dv)) {
                    continue;
                }
                if (! preg_match('/\ssqref="([^"]*)"/', $dv, $sq)) {
                    $out[] = $dv;

                    continue;
                }
                $new = self::rebaseSqref($sq[1], $dataStart, $lastRow, $claimed, $ends);
                if ($new !== '') {
                    $out[] = str_replace($sq[0], ' sqref="'.$new.'"', $dv);
                }
            }
            if ($out === []) {
                return '';
            }
            $open = preg_replace('/\scount="\d+"/', ' count="'.count($out).'"', $m[1]) ?? $m[1];

            return $open.implode('', $out).'</dataValidations>';
        }, $post) ?? $post;

        $post = preg_replace_callback('/(<x14:dataValidations\b[^>]*>)(.*?)<\/x14:dataValidations>/s', function ($m) use ($dataStart, $lastRow, &$claimed, $ends) {
            preg_match_all('/<x14:dataValidation\b[^>]*?(?:\/>|>.*?<\/x14:dataValidation>)/s', $m[2], $dvs);
            $out = [];
            foreach ($dvs[0] as $dv) {
                if (! preg_match('/<xm:sqref>([^<]*)<\/xm:sqref>/', $dv, $sq)) {
                    $out[] = $dv;

                    continue;
                }
                $new = self::rebaseSqref(self::decode($sq[1]), $dataStart, $lastRow, $claimed, $ends);
                if ($new !== '') {
                    $out[] = str_replace($sq[0], '<xm:sqref>'.$new.'</xm:sqref>', $dv);
                }
            }
            if ($out === []) {
                return '';
            }
            $open = preg_replace('/\scount="\d+"/', ' count="'.count($out).'"', $m[1]) ?? $m[1];

            return $open.implode('', $out).'</x14:dataValidations>';
        }, $post) ?? $post;

        // An extension block left empty is removed rather than shipped hollow.
        $post = preg_replace('/<ext\b[^>]*>\s*<\/ext>/', '', $post) ?? $post;

        return preg_replace('/<extLst>\s*<\/extLst>/', '', $post) ?? $post;
    }

    /**
     * @param  array<int, true>  $claimed  columns already covered by an earlier validation
     * @param  array<int, int>  $ends  the furthest row any validation on a column reached (see rebaseValidations)
     */
    public static function rebaseSqref(string $sqref, int $dataStart, int $lastRow, array &$claimed, array $ends = []): string
    {
        $verbatim = [];
        $byCol = [];
        foreach (preg_split('/\s+/', trim($sqref)) ?: [] as $part) {
            if ($part === '') {
                continue;
            }
            if (preg_match('/^\$?([A-Z]{1,3}):\$?([A-Z]{1,3})$/', $part, $m)) {
                [$c1, $c2, $r1, $r2] = [self::colIndex($m[1]), self::colIndex($m[2]), 1, self::MAX_ROW];
            } elseif (preg_match('/^\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/', $part, $m)) {
                $c1 = self::colIndex($m[1]);
                $r1 = (int) $m[2];
                $c2 = isset($m[3]) && $m[3] !== '' ? self::colIndex($m[3]) : $c1;
                $r2 = isset($m[4]) && $m[4] !== '' ? (int) $m[4] : $r1;
            } else {
                $verbatim[] = $part;

                continue;
            }
            [$c1, $c2] = [min($c1, $c2), max($c1, $c2)];
            [$r1, $r2] = [min($r1, $r2), max($r1, $r2)];
            if ($r2 < $dataStart) {
                // A rule on the title block or the header row itself is not ours to move.
                $verbatim[] = $part;

                continue;
            }
            $end = $r2 >= self::MAX_ROW ? self::MAX_ROW : max($r2, $lastRow, $dataStart);
            for ($c = $c1; $c <= min($c2, $c1 + 512); $c++) {
                $byCol[$c] = max($byCol[$c] ?? 0, $end);
            }
        }
        $parts = $verbatim;
        foreach ($byCol as $c => $end) {
            if (isset($claimed[$c])) {
                continue;
            }
            $claimed[$c] = true;
            $end = max($end, $ends[$c] ?? 0);
            $letters = SimpleXlsx::col($c + 1);
            $parts[] = $end > $dataStart ? "{$letters}{$dataStart}:{$letters}{$end}" : "{$letters}{$dataStart}";
        }

        return implode(' ', $parts);
    }

    /** Multi-row conditional-format ranges that stop short of the last row are stretched to it. */
    private function extendConditionalFormats(string $post, int $lastRow): string
    {
        return preg_replace_callback('/<conditionalFormatting\b[^>]*?\ssqref="([^"]*)"/', function ($m) use ($lastRow) {
            $parts = [];
            foreach (preg_split('/\s+/', trim($m[1])) ?: [] as $part) {
                if (preg_match('/^(\$?[A-Z]{1,3}\$?)(\d+):(\$?[A-Z]{1,3}\$?)(\d+)$/', $part, $r) && (int) $r[4] > (int) $r[2] && (int) $r[4] < $lastRow) {
                    $part = $r[1].$r[2].':'.$r[3].$lastRow;
                }
                $parts[] = $part;
            }

            return str_replace('sqref="'.$m[1].'"', 'sqref="'.implode(' ', $parts).'"', $m[0]);
        }, $post) ?? $post;
    }

    /** Hyperlinks the template's sample rows carried would otherwise land on our data. */
    private function dropDataAreaHyperlinks(string $post, int $dataStart): string
    {
        $post = preg_replace_callback('/<hyperlink\b[^>]*?\sref="[A-Z]{1,3}(\d+)"[^>]*\/>/', fn ($m) => (int) $m[1] >= $dataStart ? '' : $m[0], $post) ?? $post;

        return preg_replace('/<hyperlinks>\s*<\/hyperlinks>/', '', $post) ?? $post;
    }

    /* ── Styles ──────────────────────────────────────────────────── */

    /** @return array<int, string> cellXfs index → xf xml */
    private function xfs(): array
    {
        if ($this->xfs !== null) {
            return $this->xfs;
        }
        $out = [];
        if (preg_match('/<cellXfs\b[^>]*>(.*?)<\/cellXfs>/s', $this->part('xl/styles.xml') ?? '', $m)) {
            preg_match_all('/<xf\b[^>]*?(?:\/>|>.*?<\/xf>)/s', $m[1], $x);
            $out = $x[0];
        }

        return $this->xfs = $out;
    }

    /** @return array<int, string> numFmtId → code */
    private function numFmts(): array
    {
        if ($this->numFmts !== null) {
            return $this->numFmts;
        }
        $out = self::BUILTIN_FORMATS;
        preg_match_all('/<numFmt\s[^>]*>/', $this->part('xl/styles.xml') ?? '', $m);
        foreach ($m[0] as $nf) {
            if (preg_match('/\bnumFmtId="(\d+)"/', $nf, $id) && preg_match('/\bformatCode="([^"]*)"/', $nf, $code)) {
                $out[(int) $id[1]] = self::decode($code[1]);
            }
        }

        return $this->numFmts = $out;
    }

    private function formatCodeOf(int $xf): string
    {
        $xml = $this->xfs()[$xf] ?? '';
        $id = preg_match('/\bnumFmtId="(\d+)"/', $xml, $m) ? (int) $m[1] : 0;

        return $this->numFmts()[$id] ?? 'General';
    }

    /** date | time | number | text | general, from a number-format code. */
    public static function kindOfFormat(string $code): string
    {
        $c = strtolower(preg_replace('/\[[^\]]*]|"[^"]*"|\\\\./', '', $code) ?? $code);
        $c = explode(';', $c)[0];
        if (trim($c) === '@') {
            return 'text';
        }
        if (trim($c) === '' || trim($c) === 'general') {
            return 'general';
        }
        if (preg_match('/[yd]/', $c) || (str_contains($c, 'm') && ! str_contains($c, ':') && ! preg_match('/[0#]/', $c))) {
            return 'date';
        }
        if (preg_match('/[hs]/', $c) && str_contains($c, ':')) {
            return 'time';
        }
        if (preg_match('/[0#?]/', $c)) {
            return 'number';
        }

        return 'general';
    }

    /** "mm/dd/yyyy;@" and "mm/dd/yyyy" are the same format to a reader. */
    private static function sameFormat(string $a, string $b): bool
    {
        $norm = fn (string $s) => strtolower(str_replace('\\', '', explode(';', $s)[0]));

        return $norm($a) === $norm($b);
    }

    /**
     * The index of a cellXfs entry rendering $format on top of $base's font,
     * fill, border and alignment — found if one exists, appended otherwise.
     */
    private function ensureStyle(string $format, int $base): int
    {
        $key = $format.'|'.$base;
        if (isset($this->styleCache[$key])) {
            return $this->styleCache[$key];
        }
        $styles = $this->part('xl/styles.xml') ?? throw new RuntimeException('The workbook has no styles part.');

        // 1. A numFmtId for the format: built-in, already declared, or new.
        $id = null;
        foreach (self::BUILTIN_FORMATS as $bid => $code) {
            if (self::sameFormat($code, $format)) {
                $id = $bid;
                break;
            }
        }
        if ($id === null) {
            foreach ($this->numFmts() as $nid => $code) {
                if ($nid >= 164 && self::sameFormat($code, $format)) {
                    $id = $nid;
                    break;
                }
            }
        }
        if ($id === null) {
            $custom = array_filter(array_keys($this->numFmts()), fn ($k) => $k >= 164);
            $id = $custom === [] ? 164 : max($custom) + 1;
            $tag = '<numFmt numFmtId="'.$id.'" formatCode="'.self::esc($format).'"/>';
            if (preg_match('/<numFmts\b[^>]*?\scount="(\d+)"[^>]*>/', $styles, $m)) {
                $open = str_replace('count="'.$m[1].'"', 'count="'.((int) $m[1] + 1).'"', $m[0]);
                $styles = str_replace($m[0], $open.$tag, $styles);
            } elseif (preg_match('/<numFmts\b[^>]*>/', $styles, $m)) {
                $styles = str_replace($m[0], $m[0].$tag, $styles);
            } else {
                $styles = preg_replace('/<fonts\b/', '<numFmts count="1">'.$tag.'</numFmts><fonts', $styles, 1) ?? $styles;
            }
            $this->numFmts = null;
        }

        // 2. An xf like the base with that number format.
        $xfs = $this->xfs();
        $baseXml = $xfs[$base] ?? $xfs[0] ?? '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
        $want = preg_match('/\bnumFmtId="\d+"/', $baseXml)
            ? preg_replace('/\bnumFmtId="\d+"/', 'numFmtId="'.$id.'"', $baseXml)
            : preg_replace('/^<xf\b/', '<xf numFmtId="'.$id.'"', $baseXml);
        $want = preg_match('/\bapplyNumberFormat="[^"]*"/', $want)
            ? preg_replace('/\bapplyNumberFormat="[^"]*"/', 'applyNumberFormat="1"', $want)
            : preg_replace('/^<xf\b/', '<xf applyNumberFormat="1"', $want);
        $norm = fn (string $s) => preg_replace('/\s+/', ' ', trim($s));
        foreach ($xfs as $i => $xf) {
            if ($norm($xf) === $norm($want)) {
                $this->set('xl/styles.xml', $styles);

                return $this->styleCache[$key] = $i;
            }
        }
        if (! preg_match('/<cellXfs\b[^>]*?\scount="(\d+)"[^>]*>/', $styles, $m)) {
            throw new RuntimeException('The workbook styles have no cellXfs.');
        }
        $open = str_replace('count="'.$m[1].'"', 'count="'.(count($xfs) + 1).'"', $m[0]);
        $styles = str_replace($m[0], $open, $styles);
        $styles = preg_replace('/<\/cellXfs>/', $want.'</cellXfs>', $styles, 1) ?? $styles;
        $this->set('xl/styles.xml', $styles);
        $this->xfs = null;

        return $this->styleCache[$key] = count($xfs);
    }

    /* ── Workbook-level housekeeping ─────────────────────────────── */

    /** Formulas were rewritten: drop the stale calc chain and have Excel recalculate on open. */
    private function recalculateOnOpen(): void
    {
        if ($this->zip->locateName('xl/calcChain.xml') !== false) {
            $this->removed[] = 'xl/calcChain.xml';
            $rels = $this->part('xl/_rels/workbook.xml.rels');
            if ($rels !== null) {
                $this->set('xl/_rels/workbook.xml.rels', preg_replace('/<Relationship\b[^>]*?\bTarget="calcChain\.xml"[^>]*\/>/', '', $rels) ?? $rels);
            }
            $types = $this->part('[Content_Types].xml');
            if ($types !== null) {
                $this->set('[Content_Types].xml', preg_replace('/<Override\b[^>]*?\bPartName="\/xl\/calcChain\.xml"[^>]*\/>/', '', $types) ?? $types);
            }
        }
        $wb = $this->part('xl/workbook.xml') ?? '';
        if (preg_match('/<calcPr\b[^>]*\/>/', $wb, $m)) {
            $tag = str_contains($m[0], 'fullCalcOnLoad')
                ? preg_replace('/fullCalcOnLoad="[^"]*"/', 'fullCalcOnLoad="1"', $m[0])
                : str_replace('<calcPr', '<calcPr fullCalcOnLoad="1"', $m[0]);
            $wb = str_replace($m[0], $tag, $wb);
        } else {
            $wb = str_replace('</sheets>', '</sheets><calcPr fullCalcOnLoad="1"/>', $wb);
        }
        $this->set('xl/workbook.xml', $wb);
    }

    /* ── Parts and helpers ───────────────────────────────────────── */

    private function part(string $name): ?string
    {
        if (array_key_exists($name, $this->parts)) {
            return $this->parts[$name];
        }
        $xml = $this->zip->getFromName($name);
        if ($xml !== false && str_starts_with($xml, "\xEF\xBB\xBF")) {
            $xml = substr($xml, 3);
        }

        return $this->parts[$name] = ($xml === false ? null : $xml);
    }

    private function set(string $name, string $xml): void
    {
        $this->parts[$name] = $xml;
        $this->dirty[$name] = true;
    }

    /** @return list<string> */
    private function shared(): array
    {
        if ($this->shared !== null) {
            return $this->shared;
        }
        $out = [];
        $xml = $this->part('xl/sharedStrings.xml');
        if ($xml !== null) {
            preg_match_all('/<si\b[^>]*?(?:\/>|>(.*?)<\/si>)/s', $xml, $m);
            foreach ($m[1] as $si) {
                preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $si, $t);
                $out[] = self::decode(implode('', $t[1]));
            }
        }

        return $this->shared = $out;
    }

    /** A → 0, AA → 26. */
    public static function colIndex(string $letters): int
    {
        $n = 0;
        foreach (str_split(strtoupper($letters)) as $ch) {
            $n = $n * 26 + (ord($ch) - 64);
        }

        return $n - 1;
    }

    private static function decode(string $s): string
    {
        return html_entity_decode($s, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private static function esc(string $s): string
    {
        $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $s) ?? $s;

        return htmlspecialchars($s, ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }
}
