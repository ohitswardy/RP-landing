<?php

namespace Tests\Feature\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\ClientAddress;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\Interaction;
use App\Models\Crms\InteractionType;
use App\Services\Crms\ReportGenerator;
use App\Support\SimpleXlsx;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use ZipArchive;

/**
 * The report workbooks mirror the client's own files: the Generic report is
 * the flat T1C extract (exact column set, headers on row 1) and the Internal
 * report is the legacy Call Report (Bespoke, Official events, Summary,
 * Monthly by firm, Sales, Analysts) — with every author included.
 */
class ReportWorkbookTest extends TestCase
{
    use RefreshDatabase;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);

        $this->client = Client::create(['name' => 'Capital World', 'region' => 'US']);
        $address = ClientAddress::create(['client_id' => $this->client->id, 'name' => '138 Market St, Singapore 048946']);
        $matt = ClientContact::create(['client_id' => $this->client->id, 'firstname' => 'Matt', 'lastname' => 'Hochstetler', 'client_address_id' => $address->id]);
        DB::connection('crms')->table('user')->insert([
            ['id' => 11, 'first_name' => 'Rafael', 'last_name' => 'Garchitorena', 'type' => 'Research'],
            ['id' => 10, 'first_name' => 'Michael', 'last_name' => 'Macale', 'type' => 'Sales'],
        ]);
        $corp = Corporate::create(['name' => 'Globe Telecom', 'ticker' => 'GLO']);
        $analyst = InteractionType::create(['type' => 'Analyst Interaction', 'meeting_type' => "1x1\nVideo1x1"]);
        $ndr = InteractionType::create(['type' => 'Non Deal Roadshow']);

        Interaction::create([
            'client_id' => $this->client->id, 'user_id' => 11, 'interactions_type_id' => $analyst->id,
            'interaction_date' => '2026-01-06 00:00:00', 'time_start' => '09:30', 'time_end' => '10:30', 'duration' => '60',
            'meeting_type' => 'Video1x1', 'description' => 'Strat update',
            'client_contact' => [['id' => $matt->id, 'name' => 'Matt Hochstetler']],
            'sellside_contact' => [['id' => 1, 'name' => 'Rafael Garchitorena'], ['id' => 2, 'name' => 'Carl Sy, CFA']],
            'form' => [
                ['internalName' => 'initiated_by', 'value' => 'Investor'],
                ['internalName' => 'corporate', 'options' => ['type' => 'Lookup', 'value' => 'Corporate'], 'value' => [['id' => $corp->id, 'ticker' => 'GLO', 'name' => 'Globe Telecom']]],
            ],
        ]);
        Interaction::create([
            'client_id' => $this->client->id, 'user_id' => 10, 'interactions_type_id' => $ndr->id,
            'interaction_date' => '2026-02-10 00:00:00', 'duration' => '90', 'description' => 'NDR with Globe',
            'client_contact' => [], 'sellside_contact' => [['id' => 3, 'name' => 'Michael Macale']], 'form' => [],
        ]);
    }

    public function test_generic_report_is_the_t1c_extract(): void
    {
        $report = app(ReportGenerator::class)->build('generic', '2026-01-01', '2026-03-31');
        $sheet = $report['sheets']['Extract'];

        $this->assertSame([
            'Type__c', 'T1C_BASE__LOCATION__C', 'T1C_BASE__CITY__C', 'T1C_BASE__MEETING_DATE__C', 'T1C_BASE__NOTES__C',
            'T1C_BASE__SUBJECT_MEETING_OBJECTIVES__C', 'T1C_BASE__TIME_SPENT_MIN__C', 'LINE_OF_BUSINESS__C', 'SOLICITED__C',
            'T_E_EXPENSE__C', 'T_E_DESCRIPTION__C', 'OWNER__C', 'SOURCE__C', 'Topics (Tickers)',
            'Contact [Person(s) who attended from the client]', 'OJ Contact Id', 'Internal Attendee (Jefferies)', 'Client/Firm',
        ], $sheet['headers']);

        $this->assertSame([
            'Analyst Interaction - Video1x1', '138 Market St, Singapore 048946', '', '06/01/2026', 'Strat update',
            'Analyst Interaction - Video1x1 with Matt Hochstetler about GLO (60 mins)', 60, 'Equity', 'Yes',
            'False', '', 'Rafael Garchitorena', 'Regis', 'GLO',
            'Matt Hochstetler', '', 'Rafael Garchitorena | Carl Sy, CFA', 'Capital World',
        ], $sheet['rows'][0]);
        $this->assertSame('Non Deal Roadshow', $sheet['rows'][1][0], 'no sub-type means no " - " suffix');
    }

    public function test_internal_report_is_the_call_report(): void
    {
        $report = app(ReportGenerator::class)->build('internal', '2026-01-01', '2026-03-31');
        $sheets = $report['sheets'];

        $this->assertSame('Call Report (2026-01-01 to 2026-03-31).xlsx', $report['filename']);
        $this->assertSame(['Bespoke', 'Official events', 'Summary', 'Monthly by firm', 'Sales', 'Analysts'], array_keys($sheets));

        $this->assertSame(['Date', 'Firm', 'Investor', 'Broker', 'Description of interaction', 'Stocks', 'Initiated by', 'Interaction type', 'Meeting Type', 'Duration', 'Time'], $sheets['Bespoke']['headers']);
        $this->assertSame(['06/01/2026', 'Capital World', 'Matt Hochstetler', 'Rafael Garchitorena, Carl Sy, CFA', 'Strat update', 'GLO', 'Investor', 'Analyst Interaction', 'Video1x1', 60, '09:30 HKT'], $sheets['Bespoke']['rows'][0]);
        $this->assertCount(2, $sheets['Bespoke']['rows']);

        // Official events is the corporate-access subset, without the Meeting Type column.
        $this->assertNotContains('Meeting Type', $sheets['Official events']['headers']);
        $this->assertCount(1, $sheets['Official events']['rows']);
        $this->assertSame('Non Deal Roadshow', $sheets['Official events']['rows'][0][7]);

        // Summary: ranked blocks side by side with live totals.
        $text = json_encode($sheets['Summary']['grid']);
        foreach (['Minutes by client firm', 'Minutes by interaction type', 'Minutes by Regis attendee', 'Corporate access by client firm', 'Corporate access by type'] as $band) {
            $this->assertStringContainsString($band, $text);
        }
        $this->assertMatchesRegularExpression('/"f":"SUM\(C\d+:C\d+\)"/', $text);

        // Monthly pivot spans every month in range and closes with a Total column.
        $header = array_map(fn ($c) => $c['v'], $sheets['Monthly by firm']['grid'][3]);
        $this->assertSame(['Client firm', 'Jan-26', 'Feb-26', 'Mar-26', 'Total'], $header);
        $this->assertSame('Capital World', $sheets['Monthly by firm']['grid'][4][0]['v']);
        $this->assertSame(60, $sheets['Monthly by firm']['grid'][4][1]['v']);
        $this->assertSame(90, $sheets['Monthly by firm']['grid'][4][2]['v']);

        // People sheets group by the logging user's desk: Research → Analysts, Sales → Sales.
        $names = fn (array $sheet) => array_values(array_filter(array_map(fn ($row) => $row[0]['v'] ?? null, $sheet['grid']), fn ($v) => in_array($v, ['Rafael Garchitorena', 'Michael Macale'], true)));
        $this->assertSame(['Rafael Garchitorena'], $names($sheets['Analysts']));
        $this->assertSame(['Michael Macale'], $names($sheets['Sales']));
    }

    public function test_workbook_is_a_well_formed_styled_package(): void
    {
        $report = app(ReportGenerator::class)->build('internal', '2026-01-01', '2026-03-31');
        $path = tempnam(sys_get_temp_dir(), 'xlsx');
        SimpleXlsx::write($path, $report['sheets']);

        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path));
        foreach (['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet6.xml'] as $part) {
            $xml = $zip->getFromName($part);
            $this->assertNotFalse($xml, "$part missing");
            $this->assertNotFalse(simplexml_load_string($xml), "$part is not well-formed XML");
        }
        $sheet1 = $zip->getFromName('xl/worksheets/sheet1.xml');
        $this->assertStringContainsString('state="frozen"', $sheet1);
        $this->assertStringContainsString('<autoFilter ref="A1:K1"/>', $sheet1);
        $this->assertStringContainsString('<c r="J2" s="5"><v>60</v></c>', $sheet1, 'minutes are numeric cells');
        $this->assertStringContainsString('<definedName name="_xlnm._FilterDatabase"', $zip->getFromName('xl/workbook.xml'));
        $this->assertStringContainsString('<mergeCell ref="A4:D4"/>', $zip->getFromName('xl/worksheets/sheet3.xml'));
        $zip->close();
        unlink($path);
    }
}
