<?php

namespace Tests\Feature\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\Interaction;
use App\Models\Crms\InteractionType;
use App\Models\Crms\ReportTemplate;
use App\Models\Role;
use App\Models\User;
use App\Services\Crms\ReportSources;
use App\Support\SimpleXlsx;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

/**
 * Imported report templates end to end: an administrator uploads a client's
 * workbook with a column map from the Form builder, previews the map against
 * real rows, and By Client then fills that workbook in place; the built-in
 * bindings and the catalog stay consistent; removing the binding removes
 * the workbook.
 */
class ReportLayoutTest extends TestCase
{
    use RefreshDatabase;

    private Client $schroders;

    private Client $local;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);
        $this->seed(RbacSeeder::class);
        Storage::fake('local');

        $this->admin = User::factory()->create(['kind' => User::KIND_STAFF, 'role_id' => Role::where('name', 'Administrator')->value('id')]);
        $this->schroders = Client::create(['name' => 'Schroders Investment Management', 'region' => 'Singapore', 'client_type' => 'Foreign']);
        $this->local = Client::create(['name' => 'AIA Philippines', 'region' => 'Philippines', 'client_type' => 'Local']);
        $siew = ClientContact::create(['client_id' => $this->schroders->id, 'firstname' => 'Siew Ling', 'lastname' => 'Tan', 'email' => 'siewling.tan@schroders.com']);
        DB::connection('crms')->table('user')->insert([['id' => 11, 'first_name' => 'Rafael', 'last_name' => 'Garchitorena', 'email' => 'rafael.garchitorena@regis.ph', 'type' => 'Research']]);
        $bdo = Corporate::create(['name' => 'BDO Unibank, Inc.', 'ticker' => 'BDO', 'identifiers1' => 'BDO PM', 'sector_schroders' => 'Financials - Banks']);
        $call = InteractionType::create(['type' => 'Analyst Call', 'meeting_type' => "2x1\n(Initiated by Asset Mgr.)"]);

        Interaction::create([
            'client_id' => $this->schroders->id, 'user_id' => 11, 'interactions_type_id' => $call->id,
            'interaction_date' => '2026-08-06 00:00:00', 'time_start' => '15:10', 'time_end' => '16:10', 'duration' => '60',
            'meeting_type' => '(Initiated by Asset Mgr.)', 'description' => '<p>Banks &amp; NBFCs</p>',
            'client_contact' => [['id' => $siew->id, 'name' => 'Siew Ling Tan', 'email' => 'siewling.tan@schroders.com']],
            'sellside_contact' => [['id' => 2, 'name' => 'Rafael Garchitorena', 'email' => 'rafael.garchitorena@regis.ph']],
            'form' => [
                ['internalName' => 'corporate', 'options' => ['type' => 'Lookup', 'value' => 'Corporate'], 'value' => [['id' => $bdo->id, 'ticker' => 'BDO', 'name' => 'BDO Unibank, Inc.']]],
                ['internalName' => 'contract_id', 'value' => 'CT-9'],
            ],
        ]);
        Interaction::create([
            'client_id' => $this->local->id, 'user_id' => 11, 'interactions_type_id' => $call->id,
            'interaction_date' => '2026-08-07 00:00:00', 'duration' => '30', 'description' => 'Local row', 'client_contact' => [], 'sellside_contact' => [], 'form' => [],
        ]);
    }

    /** A Commcise-shaped workbook: title block, header on row 3, marker on row 4, a Region tab. */
    private function workbook(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'tpl');
        SimpleXlsx::write($path, [
            'Data' => ['grid' => [
                ['', 'Template Date:', 'old', 'Downloaded by:', 'casy'],
                [],
                array_map(fn ($h) => ['v' => $h, 's' => 'header'], ['Interaction Type', 'Interaction Id', 'Interaction Date', 'Start Time', 'Duration', 'Consumers', 'Company Identifiers', 'Contract Id', 'Sectors']),
                ['Your data starts here: Cell A4'],
            ]],
            'Region' => ['grid' => [[['v' => 'Region', 's' => 'header']], ['Asia']]],
        ]);
        $file = UploadedFile::fake()->createWithContent('2026-09-21-Schroders-Commcise Template.xlsx', file_get_contents($path));
        @unlink($path);

        return $file;
    }

    private function layout(array $overrides = []): array
    {
        return array_replace([
            'title' => 'Schroders Commcise Template',
            'sheet' => 'Data',
            'headerRow' => 3,
            'dataStart' => 4,
            'scope' => 'client',
            'columns' => [
                ['index' => 0, 'header' => 'Interaction Type', 'source' => 'derived.commcise_type', 'separator' => '|'],
                ['index' => 1, 'header' => 'Interaction Id', 'source' => 'interaction.reference'],
                ['index' => 2, 'header' => 'Interaction Date', 'source' => 'interaction.date_utc', 'format' => 'yyyy-mm-dd'],
                ['index' => 3, 'header' => 'Start Time', 'source' => 'interaction.time_start_utc', 'format' => 'hh:mm:ss'],
                ['index' => 4, 'header' => 'Duration', 'source' => 'interaction.minutes'],
                ['index' => 5, 'header' => 'Consumers', 'source' => 'contacts.names', 'separator' => '|'],
                ['index' => 6, 'header' => 'Company Identifiers', 'source' => 'corporates.bloomberg', 'separator' => '|'],
                ['index' => 7, 'header' => 'Contract Id', 'source' => 'form.contract_id'],
                ['index' => 8, 'header' => 'Sectors', 'source' => 'const', 'text' => 'Financials'],
            ],
            'cells' => [['ref' => 'C1', 'source' => 'meta.generated_at_utc'], ['ref' => 'E1', 'source' => 'meta.generated_by']],
        ], $overrides);
    }

    private function import(array $layout, ?UploadedFile $file = null)
    {
        $payload = ['clientId' => $this->schroders->id, 'layout' => json_encode($layout)];
        if ($file) {
            $payload['file'] = $file;
        }

        return $this->actingAs($this->admin)->post('/api/crms/report-templates/layout', $payload, ['Accept' => 'application/json']);
    }

    public function test_the_import_stores_the_workbook_and_the_map_and_by_client_fills_it_in_place(): void
    {
        $res = $this->import($this->layout(), $this->workbook());
        $res->assertCreated()
            ->assertJsonPath('item.code', 'custom')
            ->assertJsonPath('item.layout.sheet', 'Data')
            ->assertJsonPath('item.layout.sheets', ['Data', 'Region'])
            ->assertJsonPath('item.layout.headerRow', 3)
            ->assertJsonPath('item.layout.dataStart', 4)
            ->assertJsonPath('item.layout.columns.7.source', 'form.contract_id')
            ->assertJsonPath('item.layout.cells.1.source', 'meta.generated_by')
            ->assertJsonPath('audit.action', 'CRMS · Imported report template');

        $template = ReportTemplate::where('client_id', $this->schroders->id)->firstOrFail();
        $this->assertTrue($template->hasLayout());
        $this->assertSame('2026-09-21-Schroders-Commcise Template.xlsx', $template->layout_name);
        Storage::disk('local')->assertExists($template->layout_file);
        $this->assertStringStartsWith(ReportTemplate::LAYOUT_DIR.'/client-'.$this->schroders->id.'-', $template->layout_file);

        $download = $this->actingAs($this->admin)->postJson('/api/crms/reports/generate', ['type' => 'client', 'clientId' => $this->schroders->id, 'from' => '2026-08-01', 'to' => '2026-08-31']);
        $download->assertOk();
        $this->assertStringContainsString('Aug 2026 - Schroders Commcise Template.xlsx', $download->headers->get('Content-Disposition'));

        $path = tempnam(sys_get_temp_dir(), 'out');
        file_put_contents($path, $download->getFile()->getContent());
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path));
        $data = $zip->getFromName('xl/worksheets/sheet1.xml');
        $region = $zip->getFromName('xl/worksheets/sheet2.xml');
        $zip->close();
        @unlink($path);

        $this->assertStringContainsString('<c r="A3" s="1" t="inlineStr"><is><t xml:space="preserve">Interaction Type</t></is></c>', $data, 'the header row is the template\'s own');
        $this->assertStringNotContainsString('data starts here', $data);
        $this->assertStringContainsString('<t xml:space="preserve">Analyst Call (Initiated by Asset Mgr.)</t>', $data, 'Commcise vocabulary');
        $this->assertStringContainsString('<t xml:space="preserve">REGIS-', $data);
        $this->assertStringContainsString('<v>'.SimpleXlsx::dateSerial('2026-08-06').'</v>', $data, 'a real date cell (15:10 PH is 07:10 UTC, same day)');
        $this->assertStringContainsString('<v>'.SimpleXlsx::timeSerial('07:10:00').'</v>', $data, 'UTC start time');
        $this->assertStringContainsString('<c r="E4"><v>60</v></c>', $data, 'duration is numeric');
        $this->assertStringContainsString('<t xml:space="preserve">Siew Ling Tan</t>', $data);
        $this->assertStringContainsString('<t xml:space="preserve">BDO PM</t>', $data);
        $this->assertStringContainsString('<t xml:space="preserve">CT-9</t>', $data, 'a form-builder field');
        $this->assertStringContainsString('<t xml:space="preserve">Financials</t>', $data, 'fixed text');
        $this->assertStringNotContainsString('Local row', $data, 'the Local client is not in this client\'s file');
        $this->assertStringContainsString(' UTC</t>', $data, 'Template Date stamped');
        $this->assertStringContainsString('<t xml:space="preserve">'.$this->admin->name.'</t>', $data, 'Downloaded by stamped');
        $this->assertStringNotContainsString('>casy<', $data);
        $this->assertStringContainsString('<t xml:space="preserve">Asia</t>', $region, 'the reference tab is untouched');
    }

    public function test_the_scope_widens_the_rows_and_the_map_can_change_without_a_new_workbook(): void
    {
        $this->import($this->layout(), $this->workbook())->assertCreated();
        $first = ReportTemplate::where('client_id', $this->schroders->id)->firstOrFail();

        $this->import($this->layout(['scope' => 'all', 'title' => 'Everyone']))->assertOk()
            ->assertJsonPath('item.layout.scope', 'all')
            ->assertJsonPath('audit.action', 'CRMS · Updated imported report template');
        $second = ReportTemplate::where('client_id', $this->schroders->id)->firstOrFail();
        $this->assertSame($first->layout_file, $second->layout_file, 'the workbook already on the server is kept');
        $this->assertSame(1, ReportTemplate::count(), 'one binding per client');

        $download = $this->actingAs($this->admin)->postJson('/api/crms/reports/generate', ['type' => 'client', 'clientId' => $this->schroders->id, 'from' => '2026-08-01', 'to' => '2026-09-30']);
        $download->assertOk();
        $this->assertStringContainsString('Everyone (2026-08-01 to 2026-09-30).xlsx', $download->headers->get('Content-Disposition'));
        $path = tempnam(sys_get_temp_dir(), 'out');
        file_put_contents($path, $download->getFile()->getContent());
        $zip = new ZipArchive;
        $zip->open($path);
        $data = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        @unlink($path);
        $this->assertSame(2, preg_match_all('/<t xml:space="preserve">REGIS-\d+<\/t>/', $data), 'both clients\' rows with scope = all');
    }

    public function test_preview_shows_the_map_against_real_rows(): void
    {
        $res = $this->actingAs($this->admin)->postJson('/api/crms/report-templates/layout/preview', [
            'clientId' => $this->schroders->id,
            'scope' => 'client',
            'columns' => [
                ['index' => 0, 'source' => 'derived.commcise_type'],
                ['index' => 1, 'source' => 'contacts.emails', 'separator' => '|'],
                ['index' => 2, 'source' => 'interaction.time_start_utc'],
                ['index' => 3, 'source' => 'corporates.sector_schroders'],
                ['index' => 4, 'source' => 'formula'],
                ['index' => 5, 'source' => 'nonsense.key'],
            ],
        ]);
        $res->assertOk()->assertJsonPath('total', 1)
            ->assertJsonPath('rows.0', ['Analyst Call (Initiated by Asset Mgr.)', 'siewling.tan@schroders.com', '07:10:00', 'Financials - Banks', '(template formula)', '']);
    }

    public function test_bad_imports_are_refused_with_a_reason(): void
    {
        $this->import($this->layout(['sheet' => 'Nope']), $this->workbook())->assertStatus(422)->assertJsonPath('message', 'The workbook has no sheet named "Nope".');
        $this->import($this->layout(['headerRow' => 2, 'dataStart' => 3]), $this->workbook())->assertStatus(422)->assertJsonPath('message', 'Row 2 of "Data" has no header cells.');
        $this->import($this->layout(['columns' => [['index' => 0, 'source' => 'made.up']]]), $this->workbook())->assertStatus(422)->assertJsonPath('message', 'Unknown data source "made.up".');
        $this->import($this->layout())->assertStatus(422)->assertJsonPath('message', 'Choose the Excel template to import.');
        $this->import($this->layout(), UploadedFile::fake()->createWithContent('notes.xlsx', 'plain text'))->assertStatus(422);

        $analyst = User::factory()->create(['kind' => User::KIND_STAFF, 'role_id' => Role::where('name', 'Analyst')->value('id')]);
        $this->actingAs($analyst)->post('/api/crms/report-templates/layout', ['clientId' => $this->schroders->id, 'layout' => json_encode($this->layout()), 'file' => $this->workbook()], ['Accept' => 'application/json'])->assertStatus(403);
    }

    public function test_bindings_and_the_catalog_stay_consistent(): void
    {
        // `custom` cannot be bound by hand.
        $this->actingAs($this->admin)->postJson('/api/crms/report-templates', ['clientId' => $this->schroders->id, 'code' => 'custom'])->assertStatus(422);

        $this->import($this->layout(), $this->workbook())->assertCreated();
        $template = ReportTemplate::where('client_id', $this->schroders->id)->firstOrFail();
        $file = $template->layout_file;

        // The original can be fetched back, and the bootstrap carries the layout and the catalog.
        $this->actingAs($this->admin)->get('/api/crms/report-templates/'.$template->id.'/layout/file')->assertOk()->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $boot = $this->actingAs($this->admin)->getJson('/api/crms/bootstrap')->assertOk();
        $this->assertSame('custom', $boot->json('reportTemplates.0.code'));
        $this->assertSame('Data', $boot->json('reportTemplates.0.layout.sheet'));
        $keys = array_column($boot->json('meta.reportSources'), 'key');
        $this->assertContains('derived.commcise_type', $keys);
        $this->assertContains('formula', $keys);
        // The Jefferies upload is described even before a "Jefferies" client row exists to bind it to.
        $this->assertSame('jefferies', $boot->json('meta.jefferies.bundled.key'));
        $this->assertSame('Data', $boot->json('meta.jefferies.bundled.sheet'));
        $this->assertNull($boot->json('meta.jefferies.clientId'));
        $this->assertNull($boot->json('meta.jefferies.templateId'));
        foreach (ReportSources::catalog() as $s) {
            $this->assertTrue(ReportSources::isValid($s['key']), $s['key']);
            $this->assertContains($s['kind'], ReportSources::KINDS, $s['key']);
        }
        $this->assertTrue(ReportSources::isValid('form.contract_id'));
        $this->assertFalse(ReportSources::isValid('form.Bad Name'));

        // Moving to a built-in layout drops the workbook; deleting the binding does too.
        $this->actingAs($this->admin)->putJson('/api/crms/report-templates/'.$template->id, ['clientId' => $this->schroders->id, 'code' => 'commcise', 'active' => true])->assertOk()->assertJsonPath('item.layout', null);
        Storage::disk('local')->assertMissing($file);
        $this->import($this->layout(), $this->workbook())->assertOk();
        $file = ReportTemplate::where('client_id', $this->schroders->id)->value('layout_file');
        Storage::disk('local')->assertExists($file);
        $this->actingAs($this->admin)->deleteJson('/api/crms/report-templates/'.$template->id)->assertOk();
        Storage::disk('local')->assertMissing($file);
        $this->assertSame(0, ReportTemplate::count());
    }
}
