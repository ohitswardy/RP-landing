<?php

namespace App\Support;

use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

/**
 * Minimal XLSX writer (inline strings, numbers, formulas and a fixed style
 * palette) so exports open natively in Excel without pulling in a
 * spreadsheet dependency. One sheet for the client-log export; several for
 * the CRMS consumption reports.
 *
 * A sheet is either the simple shape — `headers` + iterable `rows`, laid out
 * as a styled table with the header row frozen and filtered — or a `grid`:
 * a list of rows whose cells are scalars or `['v' => value, 's' => style,
 * 'f' => formula]`, plus optional `widths`, `freeze`, `filter`, `merges`
 * and `gridlines`. Styles are the names in STYLES.
 */
class SimpleXlsx
{
    /** Style name → cellXfs index in styles.xml (see styles()). */
    public const STYLES = [
        'text' => 0,
        'header' => 1,
        'title' => 2,
        'subtitle' => 3,
        'label' => 4,
        'num' => 5,
        'total' => 6,
        'totalLabel' => 7,
        'muted' => 8,
        'wrap' => 9,
        'pct' => 10,
        'totalPct' => 11,
        'name' => 12,
        'subhead' => 13,
        'subheadNum' => 14,
        'numBold' => 15,
        'date' => 16,      // mm/dd/yyyy (US, as Jefferies asks)
        'time' => 17,      // h:mm
        'isoDate' => 18,   // yyyy-mm-dd
        'clock' => 19,     // hh:mm:ss
        'bold' => 20,
    ];

    /** Days since 1899-12-30 for a Y-m-d string, the serial Excel stores a date as. */
    public static function dateSerial(string $ymd): int
    {
        return (int) floor((strtotime($ymd.' UTC') - strtotime('1899-12-30 UTC')) / 86400);
    }

    /** Fraction of a day for "H:i" or "H:i:s", the serial Excel stores a time as. */
    public static function timeSerial(string $hms): float
    {
        $parts = array_map('intval', explode(':', $hms) + [0, 0, 0]);

        return round(($parts[0] * 3600 + $parts[1] * 60 + $parts[2]) / 86400, 10);
    }

    private const NAVY = 'FF14213D';

    private const AMBER = 'FFD9A441';

    private const GREY = 'FF6B7280';

    private const BONE = 'FFF4F1EA';

    /**
     * Build a single-sheet workbook and return it as a download.
     *
     * @param  list<string>  $headers
     * @param  iterable<array>  $rows
     */
    public static function download(string $filename, array $headers, iterable $rows, string $sheetName = 'Client logs'): BinaryFileResponse
    {
        return self::downloadSheets($filename, [$sheetName => ['headers' => $headers, 'rows' => $rows]]);
    }

    /**
     * Build a workbook with one worksheet per entry of $sheets, keyed by
     * sheet name, and return it as a download.
     *
     * @param  array<string, array>  $sheets
     */
    public static function downloadSheets(string $filename, array $sheets): BinaryFileResponse
    {
        $path = tempnam(sys_get_temp_dir(), 'xlsx');
        self::write($path, $sheets);

        return response()
            ->download($path, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])
            ->deleteFileAfterSend(true);
    }

    /**
     * Write the workbook to $path.
     *
     * @param  array<string, array>  $sheets
     */
    public static function write(string $path, array $sheets): void
    {
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not open a temporary file for the export.');
        }

        $names = array_keys($sheets);
        $count = count($names);

        $types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
        for ($i = 1; $i <= $count; $i++) {
            $types .= '<Override PartName="/xl/worksheets/sheet'.$i.'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }
        $zip->addFromString('[Content_Types].xml', $types.'</Types>');

        $zip->addFromString('_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>');

        $normalised = [];
        foreach (array_values($sheets) as $i => $sheet) {
            $normalised[$i] = isset($sheet['grid']) ? $sheet : self::tableToGrid($sheet);
        }

        $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
        $defined = '';
        foreach ($names as $i => $name) {
            $n = $i + 1;
            $safe = mb_substr(preg_replace('/[\[\]\*\/\\\\\?:]/', ' ', $name), 0, 31);
            $workbook .= '<sheet name="'.self::esc($safe).'" sheetId="'.$n.'" r:id="rId'.$n.'"/>';
            $rels .= '<Relationship Id="rId'.$n.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'.$n.'.xml"/>';
            if (! empty($normalised[$i]['filter'])) {
                $defined .= '<definedName name="_xlnm._FilterDatabase" localSheetId="'.$i.'" hidden="1">'
                    ."'".self::esc(str_replace("'", "''", $safe))."'!".self::absolute($normalised[$i]['filter']).'</definedName>';
            }
        }
        $workbook .= '</sheets>';
        if ($defined !== '') {
            $workbook .= '<definedNames>'.$defined.'</definedNames>';
        }
        $zip->addFromString('xl/workbook.xml', $workbook.'</workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', $rels.'</Relationships>');
        $zip->addFromString('xl/styles.xml', self::styles());

        foreach ($normalised as $i => $sheet) {
            $zip->addFromString('xl/worksheets/sheet'.($i + 1).'.xml', self::worksheet($sheet));
        }
        $zip->close();
    }

    /** The simple `headers` + `rows` shape as a styled, frozen, filtered table. */
    private static function tableToGrid(array $sheet): array
    {
        $headers = array_values($sheet['headers'] ?? []);
        $widths = array_map(fn ($h) => max(10, min(48, mb_strlen((string) $h) + 4)), $headers);
        $grid = [array_map(fn ($h) => ['v' => $h, 's' => 'header'], $headers)];
        $n = 0;
        foreach ($sheet['rows'] as $row) {
            $row = array_values($row);
            $grid[] = array_map(fn ($v) => is_int($v) || is_float($v) ? ['v' => $v, 's' => 'num'] : $v, $row);
            $n++;
            if ($n <= 200) {
                foreach ($row as $c => $v) {
                    $len = mb_strlen((string) (is_array($v) ? ($v['v'] ?? '') : $v));
                    $widths[$c] = max($widths[$c] ?? 10, min(60, $len + 2));
                }
            }
        }
        $last = self::col(max(count($headers), 1));

        return [
            'grid' => $grid,
            'widths' => $sheet['widths'] ?? $widths,
            'freeze' => $sheet['freeze'] ?? 'A2',
            'filter' => $sheet['filter'] ?? ($n > 0 ? "A1:{$last}1" : null),
            'merges' => $sheet['merges'] ?? [],
            'gridlines' => $sheet['gridlines'] ?? true,
        ];
    }

    private static function worksheet(array $sheet): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

        $view = '<sheetView workbookViewId="0"'.(($sheet['gridlines'] ?? true) ? '' : ' showGridLines="0"').'>';
        if (! empty($sheet['freeze']) && preg_match('/^([A-Z]+)(\d+)$/', $sheet['freeze'], $m)) {
            $x = self::colIndex($m[1]) - 1;
            $y = (int) $m[2] - 1;
            if ($x > 0 || $y > 0) {
                $pane = $x > 0 && $y > 0 ? 'bottomRight' : ($y > 0 ? 'bottomLeft' : 'topRight');
                $view .= '<pane'.($x > 0 ? ' xSplit="'.$x.'"' : '').($y > 0 ? ' ySplit="'.$y.'"' : '')
                    .' topLeftCell="'.$sheet['freeze'].'" activePane="'.$pane.'" state="frozen"/>'
                    .'<selection pane="'.$pane.'" activeCell="'.$sheet['freeze'].'" sqref="'.$sheet['freeze'].'"/>';
            }
        }
        $xml .= '<sheetViews>'.$view.'</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';

        if (! empty($sheet['widths'])) {
            $xml .= '<cols>';
            foreach (array_values($sheet['widths']) as $i => $w) {
                if ($w !== null) {
                    $xml .= '<col min="'.($i + 1).'" max="'.($i + 1).'" width="'.round((float) $w, 2).'" customWidth="1"/>';
                }
            }
            $xml .= '</cols>';
        }

        $xml .= '<sheetData>';
        $r = 0;
        foreach ($sheet['grid'] as $cells) {
            $r++;
            $xml .= self::row($r, $cells);
        }
        $xml .= '</sheetData>';

        if (! empty($sheet['filter'])) {
            $xml .= '<autoFilter ref="'.$sheet['filter'].'"/>';
        }
        if (! empty($sheet['merges'])) {
            $xml .= '<mergeCells count="'.count($sheet['merges']).'">';
            foreach ($sheet['merges'] as $ref) {
                $xml .= '<mergeCell ref="'.$ref.'"/>';
            }
            $xml .= '</mergeCells>';
        }
        /* Dropdowns and numeric bounds, as ['type' => 'list'|'whole', 'sqref' => ..., 'formula1' => ..., 'formula2' => ..., 'error' => ...].
           A list formula is either an inline "a,b,c" (quoted) or a range, which may sit on another sheet. */
        if (! empty($sheet['validations'])) {
            $xml .= '<dataValidations count="'.count($sheet['validations']).'">';
            foreach ($sheet['validations'] as $dv) {
                $xml .= '<dataValidation type="'.$dv['type'].'" allowBlank="1" showInputMessage="1" showErrorMessage="1"'
                    .(isset($dv['error']) ? ' errorTitle="Invalid value" error="'.self::esc($dv['error']).'"' : '')
                    .' sqref="'.$dv['sqref'].'">'
                    .'<formula1>'.self::esc((string) $dv['formula1']).'</formula1>'
                    .(isset($dv['formula2']) ? '<formula2>'.self::esc((string) $dv['formula2']).'</formula2>' : '')
                    .'</dataValidation>';
            }
            $xml .= '</dataValidations>';
        }
        $xml .= '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>'
            .'<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>';

        return $xml.'</worksheet>';
    }

    private static function row(int $r, iterable $cells): string
    {
        $xml = '<row r="'.$r.'">';
        $c = 0;
        foreach ($cells as $cell) {
            $c++;
            $ref = self::col($c).$r;
            if (is_array($cell)) {
                $value = $cell['v'] ?? null;
                $style = self::STYLES[$cell['s'] ?? 'text'] ?? 0;
                $formula = $cell['f'] ?? null;
            } else {
                $value = $cell;
                $style = 0;
                $formula = null;
            }
            $s = $style ? ' s="'.$style.'"' : '';

            if ($formula !== null) {
                $xml .= '<c r="'.$ref.'"'.$s.'><f>'.self::esc(ltrim($formula, '=')).'</f></c>';
            } elseif ($value === null || $value === '') {
                $xml .= $s ? '<c r="'.$ref.'"'.$s.'/>' : '';
            } elseif (is_int($value) || is_float($value)) {
                $xml .= '<c r="'.$ref.'"'.$s.'><v>'.$value.'</v></c>';
            } else {
                $xml .= '<c r="'.$ref.'"'.$s.' t="inlineStr"><is><t xml:space="preserve">'.self::esc((string) $value).'</t></is></c>';
            }
        }

        return $xml.'</row>';
    }

    private static function styles(): string
    {
        $font = fn (string $extra = '', string $sz = '10') => '<font>'.$extra.'<sz val="'.$sz.'"/><name val="Arial"/><family val="2"/></font>';
        $fonts = [
            $font(),                                                        // 0 body
            $font('<b/><color rgb="FFFFFFFF"/>'),                           // 1 header
            $font('<b/><color rgb="'.self::NAVY.'"/>', '15'),               // 2 title
            $font('<color rgb="'.self::GREY.'"/>', '9'),                    // 3 subtitle / muted
            $font('<b/><color rgb="'.self::NAVY.'"/>'),                     // 4 label
            $font('<b/>'),                                                  // 5 total
            $font('<b/><color rgb="'.self::NAVY.'"/>', '12'),               // 6 person name
        ];
        $fills = [
            '<fill><patternFill patternType="none"/></fill>',
            '<fill><patternFill patternType="gray125"/></fill>',
            '<fill><patternFill patternType="solid"><fgColor rgb="'.self::NAVY.'"/><bgColor indexed="64"/></patternFill></fill>',
            '<fill><patternFill patternType="solid"><fgColor rgb="'.self::BONE.'"/><bgColor indexed="64"/></patternFill></fill>',
        ];
        $borders = [
            '<border><left/><right/><top/><bottom/><diagonal/></border>',
            '<border><left/><right/><top/><bottom style="medium"><color rgb="'.self::AMBER.'"/></bottom><diagonal/></border>',
            '<border><left/><right/><top style="thin"><color rgb="'.self::NAVY.'"/></top><bottom style="double"><color rgb="'.self::NAVY.'"/></bottom><diagonal/></border>',
            '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>',
        ];
        $xf = fn (int $font, int $fill = 0, int $border = 0, int $numFmt = 0, string $align = '') => '<xf numFmtId="'.$numFmt.'" fontId="'.$font.'" fillId="'.$fill.'" borderId="'.$border.'" xfId="0"'
            .($numFmt ? ' applyNumberFormat="1"' : '').($font ? ' applyFont="1"' : '').($fill ? ' applyFill="1"' : '').($border ? ' applyBorder="1"' : '')
            .($align !== '' ? ' applyAlignment="1"><alignment '.$align.'/></xf>' : '/>');
        $xfs = [
            $xf(0),                                                         // 0 text
            $xf(1, 2, 0, 0, 'vertical="center"'),                           // 1 header
            $xf(2, 0, 0, 0, 'vertical="center"'),                           // 2 title
            $xf(3),                                                         // 3 subtitle
            $xf(4, 3, 1, 0, 'vertical="center"'),                           // 4 label (section band)
            $xf(0, 0, 0, 164),                                              // 5 num
            $xf(5, 0, 2, 164),                                              // 6 total
            $xf(5, 0, 2),                                                   // 7 totalLabel
            $xf(3),                                                         // 8 muted
            $xf(0, 0, 0, 0, 'wrapText="1" vertical="top"'),                 // 9 wrap
            $xf(0, 0, 0, 165),                                              // 10 pct
            $xf(5, 0, 2, 165),                                              // 11 totalPct
            $xf(6, 0, 1, 0, 'vertical="center"'),                           // 12 person name
            $xf(4, 0, 3),                                                   // 13 subhead
            $xf(4, 0, 3, 0, 'horizontal="right"'),                          // 14 subheadNum
            $xf(5, 0, 0, 164),                                              // 15 numBold (row totals)
            $xf(0, 0, 0, 166),                                              // 16 date mm/dd/yyyy
            $xf(0, 0, 0, 167),                                              // 17 time h:mm
            $xf(0, 0, 0, 168),                                              // 18 isoDate yyyy-mm-dd
            $xf(0, 0, 0, 169),                                              // 19 clock hh:mm:ss
            $xf(5),                                                         // 20 bold
        ];

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<numFmts count="6"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="0.0%"/>'
            .'<numFmt numFmtId="166" formatCode="mm/dd/yyyy"/><numFmt numFmtId="167" formatCode="h:mm"/>'
            .'<numFmt numFmtId="168" formatCode="yyyy\-mm\-dd"/><numFmt numFmtId="169" formatCode="hh:mm:ss"/></numFmts>'
            .'<fonts count="'.count($fonts).'">'.implode('', $fonts).'</fonts>'
            .'<fills count="'.count($fills).'">'.implode('', $fills).'</fills>'
            .'<borders count="'.count($borders).'">'.implode('', $borders).'</borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="'.count($xfs).'">'.implode('', $xfs).'</cellXfs>'
            .'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            .'</styleSheet>';
    }

    /** 1 → A, 27 → AA. */
    public static function col(int $n): string
    {
        $s = '';
        while ($n > 0) {
            $n--;
            $s = chr(65 + ($n % 26)).$s;
            $n = intdiv($n, 26);
        }

        return $s;
    }

    private static function colIndex(string $letters): int
    {
        $n = 0;
        foreach (str_split($letters) as $ch) {
            $n = $n * 26 + (ord($ch) - 64);
        }

        return $n;
    }

    /** A1:K1 → $A$1:$K$1 for a defined name. */
    private static function absolute(string $ref): string
    {
        return preg_replace('/([A-Z]+)(\d+)/', '\$$1\$$2', $ref);
    }

    private static function esc(string $s): string
    {
        // Strip control characters Excel refuses, keep tabs and newlines.
        $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $s) ?? $s;

        return htmlspecialchars($s, ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }
}
