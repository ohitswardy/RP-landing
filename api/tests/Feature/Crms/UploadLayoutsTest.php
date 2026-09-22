<?php

namespace Tests\Feature\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\Interaction;
use App\Models\Crms\InteractionType;
use App\Models\Crms\ReportTemplate;
use App\Services\Crms\BundledTemplates;
use App\Services\Crms\ReportGenerator;
use App\Services\Crms\UploadLayouts;
use App\Support\SimpleXlsx;
use App\Support\XlsxTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\CrmsConfigSeeder;
use Database\Seeders\RbacSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

/**
 * The third-party upload files are the clients' own workbooks, filled in
 * place: Jefferies' bulk-upload template (Instructions, Data A–N with the
 * Errors validator, Lookup) with the foreign book, and the Schroders / JPM
 * Commcise templates (28 columns from A8, seven reference tabs) with that
 * client's rows. Everything the client put in the file comes back as sent.
 */
class UploadLayoutsTest extends TestCase
{
    use RefreshDatabase;

    private Client $schroders;

    private Client $jpm;

    private Client $local;

    private Interaction $call;

    /** @var list<string> */
    private array $temp = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);

        $this->schroders = Client::create(['name' => 'Schroders Investment Management', 'region' => 'Singapore', 'client_type' => 'Foreign']);
        $this->jpm = Client::create(['name' => 'JP Morgan Asset Management', 'region' => 'Hong Kong', 'client_type' => 'Foreign']);
        $this->local = Client::create(['name' => 'AIA Philippines', 'region' => 'Philippines', 'client_type' => 'Local']);
        ReportTemplate::create(['client_id' => $this->schroders->id, 'code' => 'commcise', 'is_active' => true]);
        ReportTemplate::create(['client_id' => $this->jpm->id, 'code' => 'commcise', 'is_active' => true]);

        $siew = ClientContact::create(['client_id' => $this->schroders->id, 'firstname' => 'Siew Ling', 'lastname' => 'Tan', 'email' => 'siewling.tan@schroders.com']);
        $ong = ClientContact::create(['client_id' => $this->jpm->id, 'firstname' => 'Changqi', 'lastname' => 'Ong', 'email' => 'changqi.ong@jpmorgan.com']);
        DB::connection('crms')->table('user')->insert([
            ['id' => 11, 'first_name' => 'Rafael', 'last_name' => 'Garchitorena', 'email' => 'rafael.garchitorena@regis.ph', 'type' => 'Research'],
            ['id' => 10, 'first_name' => 'Michael', 'last_name' => 'Macale', 'email' => 'michael.macale@regis.ph', 'type' => 'Sales'],
        ]);
        $bdo = Corporate::create(['name' => 'BDO Unibank, Inc.', 'ticker' => 'BDO', 'identifiers1' => 'BDO PM', 'identifiers2' => 'BDO.PS', 'sector_schroders' => 'Financials - Banks', 'sector_jpmorgan' => 'Financials - Banks']);
        $sevn = Corporate::create(['name' => 'Philippine Seven Corporation', 'ticker' => 'SEVN', 'sector_generic' => 'Services (Retail)']);
        $analystCall = InteractionType::create(['type' => 'Analyst Call', 'meeting_type' => "2x1\nGroup\n(Initiated by Asset Mgr.)", 'client_id' => $this->schroders->id]);
        $ndr = InteractionType::create(['type' => 'Roadshow: Non-Deal', 'meeting_type' => "1x1\n2x1\nGroup", 'client_id' => $this->jpm->id]);
        $analystInteraction = InteractionType::create(['type' => 'Analyst Interaction', 'meeting_type' => "1x1\nCall1x1"]);

        $this->call = Interaction::create([
            'client_id' => $this->schroders->id, 'user_id' => 11, 'interactions_type_id' => $analystCall->id,
            'interaction_date' => '2026-08-06 00:00:00', 'time_start' => '15:10', 'time_end' => '16:10', 'duration' => '60',
            'meeting_type' => '(Initiated by Asset Mgr.)', 'description' => '<p>Banks &amp; NBFCs</p>',
            'client_contact' => [['id' => $siew->id, 'name' => 'Siew Ling Tan', 'email' => 'siewling.tan@schroders.com']],
            'sellside_contact' => [['id' => 2, 'name' => 'Rafael Garchitorena', 'email' => 'rafael.garchitorena@regis.ph'], ['id' => 24, 'name' => 'Clarence Lee', 'email' => 'Clarence.Lee@jefferies.com']],
            'form' => [
                ['internalName' => 'corporate', 'options' => ['type' => 'Lookup', 'value' => 'Corporate'], 'value' => [['id' => $bdo->id, 'ticker' => 'BDO', 'name' => 'BDO Unibank, Inc.']]],
                ['internalName' => 'corporate_contact', 'options' => ['type' => 'Lookup', 'value' => 'CorporateContact'], 'value' => [['id' => 5, 'name' => 'Nestor Tan', 'email' => 'nvtan@bdo.com.ph', 'position' => 'President and CEO']]],
                ['internalName' => 'sector', 'options' => ['type' => 'Static', 'value' => []], 'value' => ['Financials - Banks']],
                ['internalName' => 'asset_class', 'value' => 'LI'],
                ['internalName' => 'initiated_by', 'value' => 'Investor'],
            ],
        ]);
        // 02:00 local is the previous day in UTC; a reverse roadshow with a ticker that has no Bloomberg code yet.
        Interaction::create([
            'client_id' => $this->jpm->id, 'user_id' => 10, 'interactions_type_id' => $ndr->id,
            'interaction_date' => '2026-08-12 00:00:00', 'time_start' => '02:00', 'duration' => '60', 'meeting_type' => '1x1', 'description' => 'Reverse roadshow',
            'client_contact' => [['id' => $ong->id, 'name' => 'Changqi Ong', 'email' => 'changqi.ong@jpmorgan.com']],
            'sellside_contact' => [['id' => 3, 'name' => 'Michael Macale', 'email' => 'michael.macale@regis.ph']],
            'form' => [
                ['internalName' => 'corporate', 'options' => ['type' => 'Lookup', 'value' => 'Corporate'], 'value' => [['id' => $sevn->id, 'ticker' => 'SEVN', 'name' => 'Philippine Seven Corporation']]],
                ['internalName' => 'asset_class', 'value' => 'Equity'],
            ],
        ]);
        // A macro call with no ticker, logged as a 10-minute chat: Jefferies wants a GICS bucket and at least 15 minutes.
        Interaction::create([
            'client_id' => $this->jpm->id, 'user_id' => 11, 'interactions_type_id' => $analystInteraction->id,
            'interaction_date' => '2026-08-14 00:00:00', 'time_start' => '10:30', 'duration' => '10', 'meeting_type' => 'Call1x1', 'description' => 'Quick catch-up on Phils macro / politics',
            'client_contact' => [['id' => $ong->id, 'name' => 'Changqi Ong', 'email' => 'changqi.ong@jpmorgan.com']],
            'sellside_contact' => [['id' => 2, 'name' => 'Rafael Garchitorena', 'email' => 'rafael.garchitorena@regis.ph']],
            'form' => [['internalName' => 'sector', 'value' => ['Macro/Strategy']], ['internalName' => 'initiated_by', 'value' => 'Broker']],
        ]);
        // Local clients stay out of the Jefferies file.
        Interaction::create([
            'client_id' => $this->local->id, 'user_id' => 11, 'interactions_type_id' => $analystInteraction->id,
            'interaction_date' => '2026-08-06 00:00:00', 'time_start' => '13:30', 'duration' => '15', 'meeting_type' => 'Call1x1', 'description' => 'AREIT public float',
            'client_contact' => [], 'sellside_contact' => [], 'form' => [],
        ]);
    }

    protected function tearDown(): void
    {
        foreach ($this->temp as $p) {
            @unlink($p);
        }
        parent::tearDown();
    }

    /** Every XML part of a workbook, by name. @return array<string, string> */
    private function parts(string $path): array
    {
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path), "cannot open $path");
        $out = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            $out[$name] = $zip->getFromIndex($i);
        }
        $zip->close();

        return $out;
    }

    private function generated(array $report): array
    {
        $this->assertArrayHasKey('path', $report, 'the client workbook is filled in place, not rebuilt');
        $this->temp[] = $report['path'];

        return $this->parts($report['path']);
    }

    private function rows(string $sheetXml): array
    {
        preg_match('/<sheetData>(.*?)<\/sheetData>/s', $sheetXml, $m);
        preg_match_all('/<row\b[^>]*?(?:\/>|>.*?<\/row>)/s', $m[1], $rows);
        $out = [];
        foreach ($rows[0] as $r) {
            preg_match('/<row\b[^>]*?\br="(\d+)"/', $r, $n);
            $out[(int) $n[1]] = $r;
        }

        return $out;
    }

    /** The text of one inline-string cell, or null when the cell is empty / absent. */
    private function text(string $rowXml, string $ref): ?string
    {
        if (preg_match('/<c r="'.$ref.'"[^>]*t="inlineStr"><is><t xml:space="preserve">(.*?)<\/t><\/is><\/c>/s', $rowXml, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES | ENT_XML1, 'UTF-8');
        }

        return null;
    }

    private function number(string $rowXml, string $ref): ?float
    {
        return preg_match('/<c r="'.$ref.'"[^>]*><v>([^<]*)<\/v><\/c>/', $rowXml, $m) ? (float) $m[1] : null;
    }

    public function test_bundled_templates_are_the_clients_workbooks_with_the_headers_the_maps_name(): void
    {
        foreach ([BundledTemplates::JEFFERIES, BundledTemplates::SCHRODERS, BundledTemplates::JPM] as $key) {
            $layout = BundledTemplates::layout($key);
            $book = XlsxTemplate::open(BundledTemplates::path($key));
            $this->assertSame($layout['sheets'], array_keys($book->sheets()), "$key tabs");
            $headers = $book->rowText($layout['sheet'], $layout['headerRow']);
            foreach ($layout['columns'] as $c) {
                $this->assertSame($c['header'], $headers[$c['index']] ?? null, "$key column ".$c['index']);
            }
        }
        // The Jefferies template ships without last month's rows: header plus the styled sample row only.
        $data = $this->parts(BundledTemplates::path(BundledTemplates::JEFFERIES))['xl/worksheets/sheet2.xml'];
        $this->assertSame([1, 2], array_keys($this->rows($data)));
        $this->assertStringNotContainsString('t="s"', $this->rows($data)[2], 'the sample row keeps styles and the formula, not values');
        $this->assertStringContainsString('<f t="array"', $this->rows($data)[2]);
    }

    public function test_jefferies_upload_is_jefferies_own_workbook_filled_with_the_foreign_book(): void
    {
        $report = app(ReportGenerator::class)->build('jefferies', '2026-08-01', '2026-08-31');
        $this->assertSame('Aug 2026 - Regis Interactions.xlsx', $report['filename']);

        $out = $this->generated($report);
        $tpl = $this->parts(BundledTemplates::path(BundledTemplates::JEFFERIES));
        foreach (['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet3.xml', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/comments1.xml', 'xl/theme/theme1.xml'] as $part) {
            $this->assertSame($tpl[$part], $out[$part], "$part (Instructions, Lookup, styles…) is Jefferies' own, untouched");
        }
        $this->assertArrayNotHasKey('xl/calcChain.xml', $out);

        $rows = $this->rows($out['xl/worksheets/sheet2.xml']);
        $this->assertSame([1, 2, 3, 4], array_keys($rows), 'the header and three foreign rows; the Local client is excluded');
        $this->assertSame($this->rows($tpl['xl/worksheets/sheet2.xml'])[1], $rows[1], 'the header row is byte-identical to the template');

        $r = $rows[2];
        $this->assertSame(['Incoming Call', 'N/A'], [$this->text($r, 'A2'), $this->text($r, 'B2')]);
        $this->assertStringContainsString('<c r="C2" s="19"><v>'.SimpleXlsx::dateSerial('2026-08-06').'</v></c>', $r, 'a real date in the template\'s own mm/dd/yyyy style');
        $this->assertStringContainsString('<c r="D2" s="17"><v>'.SimpleXlsx::timeSerial('15:10').'</v></c>', $r, 'a real time in the template\'s own h:mm style');
        $this->assertStringContainsString('<c r="E2" s="18"><v>60</v></c>', $r);
        $this->assertSame('rafael.garchitorena@regis.ph', $this->text($r, 'F2'));
        $this->assertSame('rafael.garchitorena@regis.ph', $this->text($r, 'G2'), 'Jefferies staff on the row are not internal attendees');
        $this->assertSame('siewling.tan@schroders.com', $this->text($r, 'H2'));
        $this->assertStringContainsString('<c r="I2" s="1"/><c r="J2" s="1"/>', $r, 'address fields stay empty for a call, in the template\'s cell style');
        $this->assertSame('BDO PM', $this->text($r, 'K2'));
        $this->assertNull($this->text($r, 'L2'), 'GICS is only filled when no ticker applies');
        $this->assertSame('Banks & NBFCs', $this->text($r, 'M2'), 'rich text is flattened');
        $this->assertStringContainsString('<c r="N2" s="8" cm="1" t="str"><f t="array" aca="1" ref="N2" ca="1">_xlfn.TEXTJOIN(', $r, 'Jefferies\' own Errors formula, as an array formula on this row');
        $this->assertStringContainsString('COUNTIF(Lookup!$A$2:$A$13, A2) = 0', $r);

        $r = $rows[3];
        $this->assertSame(['Corporate Access One Off', 'In Person'], [$this->text($r, 'A3'), $this->text($r, 'B3')], 'a 1x1 non-deal roadshow is in-person corporate access');
        $this->assertSame('michael.macale@regis.ph', $this->text($r, 'F3'));
        $this->assertSame('SEVN PM', $this->text($r, 'K3'), 'a bare PSE ticker gets the Bloomberg exchange suffix');
        $this->assertStringContainsString('ref="N3"', $r);
        $this->assertStringContainsString('COUNTIF(Lookup!$A$2:$A$13, A3) = 0', $r);

        $r = $rows[4];
        $this->assertSame(['Outgoing Call', 'N/A'], [$this->text($r, 'A4'), $this->text($r, 'B4')], 'broker-initiated calls are outgoing');
        $this->assertSame(15.0, $this->number($r, 'E4'), 'ten minutes is reported at the 15-minute floor Jefferies accepts');
        $this->assertNull($this->text($r, 'K4'));
        $this->assertSame('Economics & Strategy', $this->text($r, 'L4'));
        $this->assertStringContainsString('ISBLANK(D4)', $r);
        $this->assertStringNotContainsString('A2)', $r, 'the formula follows its own row');

        $data = $out['xl/worksheets/sheet2.xml'];
        $this->assertStringContainsString('<dimension ref="A1:N4"/>', $data);
        $this->assertStringContainsString('sqref="E2:E1048576"', $data, 'Jefferies\' Duration rule follows the data');
        $this->assertStringContainsString('<xm:sqref>A2:A1048576</xm:sqref>', $data, 'the Meeting Type dropdown follows the data');
        $this->assertStringContainsString('<xm:f>Lookup!$A$2:$A$12</xm:f>', $data);
        $this->assertStringContainsString('<xm:sqref>B2:B1048576</xm:sqref>', $data);
        $this->assertSame(1, preg_match_all('/<dataValidation /', $data), 'the "Any value" leftover is gone; the Duration rule stays');
        $this->assertStringContainsString('fullCalcOnLoad="1"', $out['xl/workbook.xml']);
    }

    public function test_jefferies_kind_covers_every_legacy_interaction_type(): void
    {
        $layouts = new UploadLayouts;
        $cases = [
            ['Analyst Interaction', 'Video1x1', 'Investor', ['Incoming Call', 'N/A']],
            ['Sales Interaction', 'Email', null, ['IB/Email Ideas', 'Email']],
            ['Bespoke', 'Call1x1', null, ['Bespoke Client Request', 'Email']],
            ['Custom Work', 'Delivered', null, ['Bespoke Client Request', 'Email']],
            ['Research Model', 'Delivered', null, ['Model Request', 'Email']],
            ['Model', '(Bespoke)', null, ['Model Request', 'Email']],
            ['Deal Related', 'Testing Of Waters', null, ['Testing The Waters', 'N/A']],
            ['Deal Related', 'Wall Cross', null, ['Testing The Waters', 'N/A']],
            ['Deal Related', 'Video1x1', null, ['ECM Deal Call/Meeting', 'Virtual']],
            ['Roadshow: Deal', '1x1', null, ['ECM Deal Call/Meeting', 'In Person']],
            ['Non Deal Roadshow', 'Group', null, ['Corporate Access One Off', 'In Person']],
            ['Conference', 'VideoGroup', null, ['Corporate Access One Off', 'Virtual']],
            ['Field Trip', '1x1', null, ['Corporate Access One Off', 'In Person']],
            ['Expert Meeting', '1x1', null, ['Corporate Access One Off', 'In Person']],
            ['Idea Dinner', 'Group', null, ['Social Meeting', 'In Person']],
            ['Social', '1x1', null, ['Social Meeting', 'In Person']],
            ['Client Management Meeting', '1x1', null, ['One-Off Client Meeting', 'In Person']],
            ['Sales Meeting', 'Group', null, ['One-Off Client Meeting', 'In Person']],
            ['Analyst Meeting', 'Call1x1', 'Investor', ['Incoming Call', 'N/A']],
            ['Written Report', '', null, ['IB/Email Ideas', 'Email']],
            ['Note', 'Viewed', null, ['IB/Email Ideas', 'Email']],
            ['Macro Call', '', 'Broker', ['Outgoing Call', 'N/A']],
        ];
        foreach ($cases as [$type, $sub, $initiated, $expected]) {
            $i = new Interaction(['meeting_type' => $sub, 'form' => $initiated ? [['internalName' => 'initiated_by', 'value' => $initiated]] : []]);
            $i->setRelation('type', new InteractionType(['type' => $type]));
            $this->assertSame($expected, $layouts->jefferiesKind($i), "$type / $sub");
        }
    }

    public function test_commcise_upload_is_schroders_own_template_filled_from_a8(): void
    {
        $report = app(ReportGenerator::class)->build('client', '2026-08-01', '2026-08-31', $this->schroders, 'Carl Sy');
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}-Schroders-Commcise Template_\d{14}\.xlsx$/', $report['filename'], 'named the way Commcise names its downloads');

        $out = $this->generated($report);
        $tpl = $this->parts(BundledTemplates::path(BundledTemplates::SCHRODERS));
        foreach (['sheet2', 'sheet3', 'sheet4', 'sheet5', 'sheet6', 'sheet7', 'sheet8'] as $sheet) {
            $this->assertSame($tpl["xl/worksheets/$sheet.xml"], $out["xl/worksheets/$sheet.xml"], "$sheet (BuysideContacts, ClientInteractionType, Region, Roles, Rules…) is Schroders' own, untouched");
        }
        $this->assertSame($tpl['xl/workbook.xml'], $out['xl/workbook.xml']);
        $this->assertSame($tpl['xl/sharedStrings.xml'], $out['xl/sharedStrings.xml']);

        $data = $out['xl/worksheets/sheet1.xml'];
        $rows = $this->rows($data);
        $tplRows = $this->rows($tpl['xl/worksheets/sheet1.xml']);
        $this->assertSame([1, 2, 4, 5, 6, 7, 8], array_keys($rows), 'seven header rows and one Schroders interaction from row 8');
        foreach ([4, 5, 6, 7] as $n) {
            $this->assertSame($tplRows[$n], $rows[$n], "header row $n is byte-identical to the template");
        }
        $this->assertStringNotContainsString('Your data starts here', implode('', $rows), 'the marker row is replaced by data; Commcise\'s own rule about it stays in the conditional formats');
        $this->assertStringContainsString('<c r="F1" s="3" t="inlineStr"><is><t xml:space="preserve">', $rows[1]);
        $this->assertStringContainsString(' UTC</t>', $rows[1], 'Template Date stamped');
        $this->assertSame('Carl Sy', $this->text($rows[2], 'F2'), 'Downloaded by stamped');
        $this->assertStringContainsString('<v>3</v>', $rows[2], 'the https://schroders.commcise.com/ cell is untouched');

        $r = $rows[8];
        $this->assertSame('Analyst Call (Initiated by Asset Mgr.)', $this->text($r, 'A8'));
        $this->assertStringContainsString('<c r="A8" s="3" t="inlineStr">', $r, 'data cells take the template\'s column style');
        $this->assertSame('Banks & NBFCs', $this->text($r, 'B8'));
        $this->assertSame('REGIS-'.$this->call->id, $this->text($r, 'C8'));
        $this->assertSame((float) SimpleXlsx::dateSerial('2026-08-06'), $this->number($r, 'D8'), 'a real date cell');
        $this->assertSame(SimpleXlsx::timeSerial('07:10:00'), $this->number($r, 'E8'), '15:10 Manila is 07:10 UTC');
        $this->assertSame(60.0, $this->number($r, 'F8'));
        $this->assertSame(['Virtual', null, 'NotApplicable'], [$this->text($r, 'G8'), $this->text($r, 'H8'), $this->text($r, 'I8')], 'a call is remote, so the location type is not applicable');
        $this->assertSame(['Siew Ling Tan', 'siewling.tan@schroders.com'], [$this->text($r, 'J8'), $this->text($r, 'K8')]);
        $this->assertSame(['Rafael Garchitorena', 'rafael.garchitorena@regis.ph'], [$this->text($r, 'L8'), $this->text($r, 'M8')], 'only Regis people are sellside contacts');
        $this->assertSame(['Nestor Tan', 'nvtan@bdo.com.ph', 'CEO'], [$this->text($r, 'N8'), $this->text($r, 'O8'), $this->text($r, 'P8')]);
        $this->assertSame(['BDO Unibank, Inc.', 'Ticker', 'BDO PM', 'N'], [$this->text($r, 'Q8'), $this->text($r, 'R8'), $this->text($r, 'S8'), $this->text($r, 'T8')]);
        $this->assertSame('FI', $this->text($r, 'X8'), 'legacy LI is fixed income');
        $this->assertSame('Asia', $this->text($r, 'Y8'));
        $this->assertSame('Financials - Banks', $this->text($r, 'Z8'));

        $this->assertStringContainsString('<dimension ref="A1:AB8"/>', $data);
        $this->assertStringContainsString('<conditionalFormatting sqref="A8:A10000 B8:B10000 C8:C10000 D8:D10000 J8:J10000">', $data, 'Commcise\'s own highlighting rules stay');
        $this->assertStringContainsString('<mergeCell ref="U4:AB4" />', $data, 'the title bands stay merged');
        $styles = $out['xl/styles.xml'];
        $this->assertMatchesRegularExpression('/formatCode="yyyy-mm-dd"/', $styles, 'the ISO date style is added to the template\'s styles');
        $this->assertMatchesRegularExpression('/formatCode="hh:mm:ss"/', $styles);
    }

    public function test_commcise_upload_for_jpm_is_jpm_own_template_with_its_region_list_and_utc_date_shift(): void
    {
        $report = app(ReportGenerator::class)->build('client', '2026-08-01', '2026-08-31', $this->jpm);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}-JPM-Commcise Template_\d{14}\.xlsx$/', $report['filename']);

        $out = $this->generated($report);
        $tpl = $this->parts(BundledTemplates::path(BundledTemplates::JPM));
        $this->assertSame($tpl['xl/worksheets/sheet6.xml'], $out['xl/worksheets/sheet6.xml'], 'JPM\'s Region tab is its own');
        $this->assertStringContainsString('APAC - Philippines', $this->parts(BundledTemplates::path(BundledTemplates::JPM))['xl/sharedStrings.xml']);
        $this->assertSame($tpl['xl/worksheets/sheet2.xml'], $out['xl/worksheets/sheet2.xml'], 'JPM\'s BuysideContacts tab is its own');

        $rows = $this->rows($out['xl/worksheets/sheet1.xml']);
        $this->assertSame([1, 2, 4, 5, 6, 7, 8, 9], array_keys($rows), 'two JPM interactions');
        $this->assertStringContainsString('<v>3</v>', $rows[2], 'the https://jpmam.commcise.com/ cell is untouched');

        $ndr = $rows[8];
        $this->assertSame('Roadshow: Non-Deal - 1x1', $this->text($ndr, 'A8'));
        $this->assertSame((float) SimpleXlsx::dateSerial('2026-08-11'), $this->number($ndr, 'D8'), '02:00 Manila on the 12th is 18:00 UTC on the 11th');
        $this->assertSame(SimpleXlsx::timeSerial('18:00:00'), $this->number($ndr, 'E8'));
        $this->assertSame(['Philippine Seven Corporation', 'Ticker', 'SEVN PM'], [$this->text($ndr, 'Q8'), $this->text($ndr, 'R8'), $this->text($ndr, 'S8')]);
        $this->assertSame('Equity', $this->text($ndr, 'X8'));
        $this->assertSame('APAC - Philippines', $this->text($ndr, 'Y8'));
        $this->assertSame('Services (Retail)', $this->text($ndr, 'Z8'), 'falls back to the corporate sector when the form has none');

        $macro = $rows[9];
        $this->assertSame('Analyst Interaction - Call1x1', $this->text($macro, 'A9'), 'a type outside the Commcise list keeps the CRMS spelling for the desk to map');
        $this->assertSame('Virtual', $this->text($macro, 'G9'));
        $this->assertSame('NotApplicable', $this->text($macro, 'I9'));
    }

    public function test_the_generate_endpoint_streams_the_filled_workbook(): void
    {
        $this->seed(RbacSeeder::class);
        $admin = User::factory()->create(['kind' => User::KIND_STAFF, 'role_id' => Role::where('name', 'Administrator')->value('id')]);
        $res = $this->actingAs($admin)->postJson('/api/crms/reports/generate', ['type' => 'jefferies', 'from' => '2026-08-01', 'to' => '2026-08-31']);
        $res->assertOk()->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringContainsString('Aug 2026 - Regis Interactions.xlsx', $res->headers->get('Content-Disposition'));
        $this->assertStringStartsWith("PK\x03\x04", $res->getFile()->getContent());
    }

    /**
     * The Jefferies upload is bound to the "Jefferies" client row like any
     * client template: the seeder binds the bundled workbook there, a newer
     * workbook imported on that client takes over the Jefferies type, and
     * removing the import falls back to the bundle.
     */
    public function test_the_jefferies_upload_is_bound_to_the_jefferies_client_and_an_import_takes_over(): void
    {
        $jefferies = Client::create(['name' => 'Jefferies ', 'client_type' => 'Foreign']);
        $this->assertSame($jefferies->id, Client::jefferiesId());
        $this->assertNull(ReportTemplate::jefferies(), 'unbound until seeded');

        (new \ReflectionMethod(CrmsConfigSeeder::class, 'reportTemplates'))->invoke(new CrmsConfigSeeder);
        $bound = ReportTemplate::where('client_id', $jefferies->id)->firstOrFail();
        $this->assertSame('jefferies', $bound->code);
        $this->assertSame('jefferies', $bound->load('client')->toWire()['bundled']['key'], 'shown like Schroders / JPM: the bundled workbook, described');
        $this->assertSame('Aug 2026 - Regis Interactions.xlsx', $bound->toWire()['bundled']['file']);
        $this->assertTrue(ReportTemplate::jefferies()?->is($bound));
        $this->assertSame('commcise', ReportTemplate::where('client_id', $this->schroders->id)->value('code'), 'the other bindings are untouched');

        // Bound to the bundle, the upload is still Jefferies' file as sent.
        $out = $this->generated(app(ReportGenerator::class)->build('jefferies', '2026-08-01', '2026-08-31'));
        $tpl = $this->parts(BundledTemplates::path(BundledTemplates::JEFFERIES));
        $this->assertSame($tpl['xl/worksheets/sheet1.xml'], $out['xl/worksheets/sheet1.xml']);
        // …and By client on the Jefferies row produces the same foreign-book upload rather than a generic extract.
        $byClient = app(ReportGenerator::class)->build('client', '2026-08-01', '2026-08-31', $jefferies->fresh());
        $this->assertSame('Aug 2026 - Regis Interactions.xlsx', $byClient['filename']);
        $this->assertSame([1, 2, 3, 4], array_keys($this->rows($this->generated($byClient)['xl/worksheets/sheet2.xml'])), 'three foreign rows, whichever door');

        // A newer workbook imported on the Jefferies client (rows: every Foreign client) takes over the Jefferies type.
        $this->seed(RbacSeeder::class);
        Storage::fake('local');
        $admin = User::factory()->create(['kind' => User::KIND_STAFF, 'role_id' => Role::where('name', 'Administrator')->value('id')]);
        $path = tempnam(sys_get_temp_dir(), 'tpl');
        SimpleXlsx::write($path, [
            'Upload' => ['grid' => [array_map(fn ($h) => ['v' => $h, 's' => 'header'], ['Meeting Type', 'Date', 'External Attendee'])]],
            'Lookup' => ['grid' => [[['v' => 'Meeting Type', 's' => 'header']], ['Incoming Call']]],
        ]);
        $file = UploadedFile::fake()->createWithContent('Regis Interactions v2.xlsx', file_get_contents($path));
        @unlink($path);
        $layout = ['title' => 'Regis Interactions', 'sheet' => 'Upload', 'headerRow' => 1, 'dataStart' => 2, 'scope' => 'foreign', 'cells' => [], 'columns' => [
            ['index' => 0, 'header' => 'Meeting Type', 'source' => 'derived.jefferies_type'],
            ['index' => 1, 'header' => 'Date', 'source' => 'interaction.date', 'format' => 'yyyy-mm-dd'],
            ['index' => 2, 'header' => 'External Attendee', 'source' => 'contacts.emails', 'separator' => ','],
        ]];
        $this->actingAs($admin)->post('/api/crms/report-templates/layout', ['clientId' => $jefferies->id, 'file' => $file, 'layout' => json_encode($layout)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('item.code', 'custom')->assertJsonPath('item.layout.scope', 'foreign');
        $this->assertSame('custom', ReportTemplate::jefferies()?->code);

        $report = app(ReportGenerator::class)->build('jefferies', '2026-08-01', '2026-08-31');
        $this->assertSame('Aug 2026 - Regis Interactions.xlsx', $report['filename'], 'the desk\'s file name, whichever workbook');
        $data = $this->generated($report)['xl/worksheets/sheet1.xml'];
        $rows = $this->rows($data);
        $this->assertSame([1, 2, 3, 4], array_keys($rows), 'the three foreign rows; the Local client stays out');
        $this->assertSame('Meeting Type', $this->text($rows[1], 'A1'), 'the imported workbook, not the bundle');
        $this->assertSame(['Incoming Call', 'siewling.tan@schroders.com'], [$this->text($rows[2], 'A2'), $this->text($rows[2], 'C2')]);

        // Removing the import falls back to the bundled workbook; only one client may hold the Jefferies binding.
        $this->actingAs($admin)->deleteJson('/api/crms/report-templates/'.$bound->id)->assertOk();
        $this->assertNull(ReportTemplate::jefferies());
        $out = $this->generated(app(ReportGenerator::class)->build('jefferies', '2026-08-01', '2026-08-31'));
        $this->assertSame($tpl['xl/worksheets/sheet1.xml'], $out['xl/worksheets/sheet1.xml']);
        $this->actingAs($admin)->postJson('/api/crms/report-templates', ['clientId' => $jefferies->id, 'code' => 'jefferies'])->assertCreated()->assertJsonPath('item.bundled.key', 'jefferies');
        $this->actingAs($admin)->postJson('/api/crms/report-templates', ['clientId' => $this->local->id, 'code' => 'jefferies'])->assertStatus(422);
        $this->assertSame($jefferies->id, (int) ReportTemplate::jefferies()?->client_id);
    }
}
