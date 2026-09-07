<?php

namespace App\Support;

use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

/**
 * Minimal XLSX writer (inline strings only) so exports open natively in
 * Excel without pulling in a spreadsheet dependency. One sheet for the
 * client-log export; several for the CRMS consumption reports.
 */
class SimpleXlsx
{
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
     * sheet name, each holding `headers` and iterable `rows`.
     *
     * @param  array<string, array{headers: list<string>, rows: iterable<array>}>  $sheets
     */
    public static function downloadSheets(string $filename, array $sheets): BinaryFileResponse
    {
        $path = tempnam(sys_get_temp_dir(), 'xlsx');
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not open a temporary file for the export.');
        }

        $names = array_keys($sheets);
        $count = count($names);

        $types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
        for ($i = 1; $i <= $count; $i++) {
            $types .= '<Override PartName="/xl/worksheets/sheet'.$i.'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }
        $zip->addFromString('[Content_Types].xml', $types.'</Types>');

        $zip->addFromString('_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>');

        $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
        foreach ($names as $i => $name) {
            $n = $i + 1;
            $safe = htmlspecialchars(mb_substr(preg_replace('/[\[\]\*\/\\\\\?:]/', ' ', $name), 0, 31), ENT_XML1 | ENT_COMPAT, 'UTF-8');
            $workbook .= '<sheet name="'.$safe.'" sheetId="'.$n.'" r:id="rId'.$n.'"/>';
            $rels .= '<Relationship Id="rId'.$n.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'.$n.'.xml"/>';
        }
        $zip->addFromString('xl/workbook.xml', $workbook.'</sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', $rels.'</Relationships>');

        foreach (array_values($sheets) as $i => $sheet) {
            $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
                .self::row($sheet['headers']);
            foreach ($sheet['rows'] as $cells) {
                $xml .= self::row($cells);
            }
            $xml .= '</sheetData></worksheet>';
            $zip->addFromString('xl/worksheets/sheet'.($i + 1).'.xml', $xml);
        }
        $zip->close();

        return response()
            ->download($path, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])
            ->deleteFileAfterSend(true);
    }

    private static function row(array $cells): string
    {
        $xml = '<row>';
        foreach ($cells as $cell) {
            $xml .= '<c t="inlineStr"><is><t xml:space="preserve">'
                .htmlspecialchars((string) $cell, ENT_XML1 | ENT_COMPAT, 'UTF-8')
                .'</t></is></c>';
        }

        return $xml.'</row>';
    }
}
