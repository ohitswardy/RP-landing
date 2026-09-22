<?php

namespace Tests\Unit\Crms;

use App\Support\SimpleXlsx;
use App\Support\XlsxTemplate;
use PHPUnit\Framework\TestCase;
use ZipArchive;

/**
 * The template filler leaves a client's workbook as uploaded except for
 * the data area: sample rows go, our rows arrive in the sample's styles,
 * per-row formulas move with their row, validation ranges follow the data,
 * title-block cells are stamped, and every other part is byte-identical.
 */
class XlsxTemplateTest extends TestCase
{
    /** @var list<string> */
    private array $temp = [];

    protected function tearDown(): void
    {
        foreach ($this->temp as $p) {
            @unlink($p);
        }
        parent::tearDown();
    }

    private function tmp(): string
    {
        return $this->temp[] = tempnam(sys_get_temp_dir(), 'xlt');
    }

    /** A Jefferies-shaped template: Instructions, Data (header row 1, two sample rows, an Errors formula), Lookup with dropdowns. */
    private function jefferiesLike(): string
    {
        $path = $this->tmp();
        SimpleXlsx::write($path, [
            'Instructions' => ['grid' => [['Fill the Data sheet.'], ['Errors must be empty.']], 'widths' => [80]],
            'Data' => [
                'grid' => [
                    array_map(fn ($h) => ['v' => $h, 's' => 'header'], ['Meeting Type', 'Date', 'Start Time', 'Duration', 'Attendees', 'Errors']),
                    ['Incoming Call', ['v' => SimpleXlsx::dateSerial('2026-08-03'), 's' => 'date'], ['v' => SimpleXlsx::timeSerial('16:00'), 's' => 'time'], ['v' => 20, 's' => 'num'], 'a@x.com', ['f' => 'IF(COUNTIF(Lookup!$A$2:$A$3,A2)=0,"Invalid Meeting Type","")&IF(E2="","Attendees required","")']],
                    ['Outgoing Call', ['v' => SimpleXlsx::dateSerial('2026-08-04'), 's' => 'date'], ['v' => SimpleXlsx::timeSerial('10:30'), 's' => 'time'], ['v' => 45, 's' => 'num'], 'b@x.com', ['f' => 'IF(COUNTIF(Lookup!$A$2:$A$3,A3)=0,"Invalid Meeting Type","")&IF(E3="","Attendees required","")']],
                ],
                'widths' => [26, 12, 11, 12, 40, 60],
                'freeze' => 'A2',
                'filter' => 'A1:F1',
                'validations' => [
                    ['type' => 'list', 'sqref' => 'A2:A3', 'formula1' => 'Lookup!$A$2:$A$3'],
                    ['type' => 'whole', 'sqref' => 'D1:D3', 'formula1' => '15', 'formula2' => '480'],
                    ['type' => 'whole', 'sqref' => 'D4:D1048576', 'formula1' => '1', 'formula2' => '480'],
                ],
            ],
            'Lookup' => ['grid' => [[['v' => 'Meeting Type', 's' => 'header']], ['Incoming Call'], ['Outgoing Call']]],
        ]);

        return $path;
    }

    /** A Commcise-shaped template: title block, header on row 3, a "data starts here" marker on row 4, no sample rows. */
    private function commciseLike(): string
    {
        $path = $this->tmp();
        SimpleXlsx::write($path, [
            'Data' => [
                'grid' => [
                    ['', 'Template Date:', '21 Sep 2026 05:19:16 UTC', 'Downloaded by:', 'casy'],
                    [],
                    array_map(fn ($h) => ['v' => $h, 's' => 'header'], ['Interaction Type', 'Interaction Id', 'Interaction Date', 'Start Time', 'Consumers']),
                    ['Your data starts here: Cell A4'],
                ],
                'merges' => ['B1:C1'],
            ],
            'Region' => ['grid' => [['Below is a list of values for: Region.'], [['v' => 'Region', 's' => 'header']], ['UK'], ['Asia']]],
        ]);

        return $path;
    }

    private function sheetXml(string $path, string $part): string
    {
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path));
        $xml = $zip->getFromName($part);
        $zip->close();
        $this->assertNotFalse($xml, "$part is missing");

        return $xml;
    }

    public function test_rows_replace_the_sample_area_and_formulas_follow_their_row(): void
    {
        $src = $this->jefferiesLike();
        $book = XlsxTemplate::open($src);
        $this->assertSame(['Instructions', 'Data', 'Lookup'], array_keys($book->sheets()));
        $this->assertSame(['Meeting Type', 'Date', 'Start Time', 'Duration', 'Attendees', 'Errors'], array_values($book->rowText('Data', 1)));

        $rows = [];
        foreach ([['Incoming Call', '2026-09-01', '09:00', 30, 'x@y.com'], ['Outgoing Call', '2026-09-02', '14:15', 60, 'p@q.com,r@q.com'], ['Incoming Call', '2026-09-03', '08:00', 15, '']] as [$type, $date, $time, $mins, $who]) {
            $rows[] = [
                0 => ['v' => $type, 'kind' => 'text'],
                1 => ['v' => $date, 'kind' => 'date', 'format' => 'mm/dd/yyyy'],
                2 => ['v' => $time, 'kind' => 'time', 'format' => 'h:mm'],
                3 => ['v' => $mins, 'kind' => 'number'],
                4 => ['v' => $who, 'kind' => 'text'],
                5 => ['v' => null, 'kind' => 'formula'],
            ];
        }
        $book->fill('Data', 1, 2, $rows);
        $out = $this->tmp();
        $book->save($out);

        $data = $this->sheetXml($out, 'xl/worksheets/sheet2.xml');
        $this->assertStringContainsString('<dimension ref="A1:F4"/>', $data);
        preg_match_all('/<row r="(\d+)"/', $data, $m);
        $this->assertSame(['1', '2', '3', '4'], $m[1], 'header kept, two samples replaced by three rows');
        $this->assertStringContainsString('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Meeting Type</t></is></c>', $data, 'the header row is untouched');
        $this->assertStringContainsString('<c r="B2" s="'.SimpleXlsx::STYLES['date'].'"><v>'.SimpleXlsx::dateSerial('2026-09-01').'</v></c>', $data, 'a date reuses the sample cell style when it already renders mm/dd/yyyy');
        $this->assertStringContainsString('<c r="C3" s="'.SimpleXlsx::STYLES['time'].'"><v>'.SimpleXlsx::timeSerial('14:15').'</v></c>', $data);
        $this->assertStringContainsString('<c r="D4" s="'.SimpleXlsx::STYLES['num'].'"><v>15</v></c>', $data);
        $this->assertStringContainsString('<c r="E2" t="inlineStr"><is><t xml:space="preserve">x@y.com</t></is></c>', $data);
        $this->assertStringContainsString('<c r="F4"><f>IF(COUNTIF(Lookup!$A$2:$A$3,A4)=0,&quot;Invalid Meeting Type&quot;,&quot;&quot;)&amp;IF(E4=&quot;&quot;,&quot;Attendees required&quot;,&quot;&quot;)</f></c>', $data, 'the formula moves to row 4 and keeps its absolute lookup');
        $this->assertStringNotContainsString('a@x.com', $data, 'sample data is gone');

        // Validations: the list follows the data; the two whole-number rules on D collapse to one open-ended rule.
        $this->assertStringContainsString('sqref="A2:A4"', $data);
        $this->assertStringContainsString('sqref="D2:D1048576"', $data);
        $this->assertSame(2, preg_match_all('/<dataValidation /', $data));
        $this->assertStringContainsString('<dataValidations count="2">', $data);

        // Everything else is byte-identical.
        foreach (['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet3.xml', 'xl/styles.xml', '[Content_Types].xml'] as $part) {
            $this->assertSame($this->sheetXml($src, $part), $this->sheetXml($out, $part), "$part changed");
        }
        $this->assertStringContainsString('fullCalcOnLoad="1"', $this->sheetXml($out, 'xl/workbook.xml'), 'Excel recalculates the moved formulas on open');
    }

    public function test_marker_row_templates_get_new_styles_and_stamped_title_cells(): void
    {
        $src = $this->commciseLike();
        $book = XlsxTemplate::open($src);
        $book->fill('Data', 3, 4, [
            [0 => ['v' => 'Analyst Call - 2x1', 'kind' => 'text'], 1 => ['v' => 'REGIS-7', 'kind' => 'text'], 2 => ['v' => '2026-08-06', 'kind' => 'date'], 3 => ['v' => '07:10:00', 'kind' => 'time', 'format' => 'hh:mm:ss'], 4 => ['v' => 'A|B', 'kind' => 'text']],
        ], ['C1' => '22 Sep 2026 03:00:00 UTC', 'E1' => 'Regis CRMS', 'F2' => 'added']);
        $out = $this->tmp();
        $book->save($out);

        $data = $this->sheetXml($out, 'xl/worksheets/sheet1.xml');
        $this->assertStringNotContainsString('data starts here', $data);
        $this->assertStringContainsString('<c r="C1" t="inlineStr"><is><t xml:space="preserve">22 Sep 2026 03:00:00 UTC</t></is></c>', $data);
        $this->assertStringContainsString('<c r="E1" t="inlineStr"><is><t xml:space="preserve">Regis CRMS</t></is></c>', $data);
        $this->assertStringContainsString('<row r="2"><c r="F2" t="inlineStr"><is><t xml:space="preserve">added</t></is></c></row>', $data, 'a cell on an empty row is created in place');
        $this->assertStringContainsString('<c r="A4" t="inlineStr"><is><t xml:space="preserve">Analyst Call - 2x1</t></is></c>', $data);
        $this->assertStringContainsString('<mergeCell ref="B1:C1"/>', $data, 'merges survive');

        // No sample style existed, so the date and time got styles of their own with the requested formats
        // (the number formats themselves already exist in this workbook, so they are reused rather than declared twice).
        $styles = $this->sheetXml($out, 'xl/styles.xml');
        preg_match('/<numFmt numFmtId="(\d+)" formatCode="yyyy\\\\?-mm\\\\?-dd[^"]*"\/>/', $styles, $dateFmt);
        preg_match('/<numFmt numFmtId="(\d+)" formatCode="hh:mm:ss"\/>/', $styles, $timeFmt);
        $this->assertNotEmpty($dateFmt);
        $this->assertNotEmpty($timeFmt);
        $this->assertSame(1, preg_match_all('/formatCode="yyyy\\\\?-mm\\\\?-dd[^"]*"/', $styles), 'the existing format is reused, not duplicated');
        preg_match('/<c r="C4" s="(\d+)"><v>'.SimpleXlsx::dateSerial('2026-08-06').'<\/v><\/c>/', $data, $dm);
        $this->assertNotEmpty($dm, 'the date is a real serial with a style');
        preg_match('/<c r="D4" s="(\d+)"><v>'.SimpleXlsx::timeSerial('07:10:00').'<\/v><\/c>/', $data, $tm);
        $this->assertNotEmpty($tm, 'the time is a real serial with a style');
        preg_match('/<cellXfs count="(\d+)">(.*?)<\/cellXfs>/s', $styles, $cm);
        preg_match_all('/<xf\b[^>]*?(?:\/>|>.*?<\/xf>)/s', $cm[2], $xfs);
        $this->assertSame(count(SimpleXlsx::STYLES) + 2, (int) $cm[1], 'two styles were appended, none overwritten');
        $this->assertStringContainsString('numFmtId="'.$dateFmt[1].'"', $xfs[0][(int) $dm[1]]);
        $this->assertStringContainsString('numFmtId="'.$timeFmt[1].'"', $xfs[0][(int) $tm[1]]);
        $this->assertSame($this->sheetXml($src, 'xl/worksheets/sheet2.xml'), $this->sheetXml($out, 'xl/worksheets/sheet2.xml'), 'the Region tab is untouched');
    }

    public function test_zero_rows_leaves_the_header_and_re_bases_ranges_to_the_start_row(): void
    {
        $book = XlsxTemplate::open($this->jefferiesLike());
        $book->fill('Data', 1, 2, []);
        $out = $this->tmp();
        $book->save($out);
        $data = $this->sheetXml($out, 'xl/worksheets/sheet2.xml');
        $this->assertStringContainsString('<dimension ref="A1:F1"/>', $data);
        $this->assertSame(1, preg_match_all('/<row r="/', $data));
        $this->assertStringContainsString('sqref="A2:A3"', $data, 'a range never shrinks below what the template had');
        $this->assertStringContainsString('sqref="D2:D1048576"', $data, 'the column keeps its open-ended reach whichever rule wins it');
    }

    public function test_row_shifting_and_sqref_rebasing_rules(): void
    {
        $this->assertSame('IF(A9="",B9,$C$2)&Lookup!A2&LOG10(D9)', XlsxTemplate::shiftRows('IF(A2="",B2,$C$2)&Lookup!A2&LOG10(D2)', 2, 9));
        $this->assertSame('SUM(A12:A12)+A120', XlsxTemplate::shiftRows('SUM(A2:A2)+A120', 2, 12), 'row 120 is not row 2');

        $claimed = [];
        $this->assertSame('E2:E1048576', XlsxTemplate::rebaseSqref('E119:E1048576 E1:E64', 2, 40, $claimed));
        $this->assertSame('', XlsxTemplate::rebaseSqref('E65:E118', 2, 40, $claimed), 'a column already claimed drops out');
        $this->assertSame('B2:B40', XlsxTemplate::rebaseSqref('B1:B10 B12:B30', 2, 40, $claimed), 'a bounded range stretches to the last row written');
        $this->assertSame('F1 G2:G40', XlsxTemplate::rebaseSqref('F1 G5', 2, 40, $claimed), 'a rule above the data area is kept as written');
        $this->assertSame('A8', XlsxTemplate::rebaseSqref('A8', 8, 7, $claimed), 'with no rows the range is the start row alone');
    }

    public function test_bad_input_is_refused_plainly(): void
    {
        $this->expectException(\RuntimeException::class);
        $bad = $this->tmp();
        file_put_contents($bad, 'not a workbook');
        XlsxTemplate::open($bad);
    }

    public function test_unknown_sheet_and_inverted_rows_are_refused(): void
    {
        $book = XlsxTemplate::open($this->jefferiesLike());
        try {
            $book->fill('Nope', 1, 2, []);
            $this->fail('unknown sheet accepted');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('no sheet named "Nope"', $e->getMessage());
        }
        $this->expectException(\RuntimeException::class);
        $book->fill('Data', 3, 2, []);
    }
}
