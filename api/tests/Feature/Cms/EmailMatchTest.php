<?php

namespace Tests\Feature\Cms;

use App\Models\Company;
use App\Models\Report;
use Illuminate\Support\Facades\DB;

/**
 * The Email desk matcher's two sources: users.sector_prefs / preferred_analysts,
 * and the CRMS sector groups reached through client_contact.portal_user_id.
 */
class EmailMatchTest extends CmsTestCase
{
    private function crmsSchema(): void
    {
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);
    }

    private function report(): Report
    {
        $company = Company::create(['name' => 'BDO Unibank', 'symbol' => 'BDO', 'type' => 'Local']);

        return Report::create([
            'title' => 'BDO 2Q', 'category' => 'Banks', 'company_id' => $company->id, 'analyst' => 'Paolo Garcia',
            'date' => '2026-09-01', 'pages' => 1, 'summary' => 's', 'file_name' => 'a.pdf', 'file_size' => 1,
        ]);
    }

    public function test_match_survives_an_empty_crms_database(): void
    {
        $this->actingAsStaff('Analyst');
        $report = $this->report();
        $byPrefs = $this->client(['sector_prefs' => ['banks']]);
        $this->client(['sector_prefs' => ['Property']]);
        $this->client(['sector_prefs' => ['Banks'], 'client_type' => 'Foreign']);

        // No CRMS tables at all: prefs still match, nothing crashes.
        $this->getJson("/api/cms/email-blasts/match?report={$report->id}")->assertOk()
            ->assertJsonCount(1, 'clients')
            ->assertJsonPath('clients.0.id', (string) $byPrefs->id)
            ->assertJsonPath('clients.0.via', 'prefs');
    }

    public function test_sector_group_membership_matches_through_the_linked_portal_account(): void
    {
        $this->crmsSchema();
        $this->actingAsStaff('Analyst');
        $report = $this->report();

        $byPrefs = $this->client(['sector_prefs' => ['Banks']]);
        $byGroup = $this->client(['sector_prefs' => []]);
        $both = $this->client(['preferred_analysts' => ['paolo garcia']]);
        $unlinked = $this->client();
        $foreign = $this->client(['client_type' => 'Foreign']);

        $crms = DB::connection('crms');
        $crms->table('client')->insert(['id' => 1, 'name' => 'Lakefield']);
        $crms->table('corporate')->insert([
            ['id' => 10, 'name' => 'BDO Unibank, Inc.', 'ticker' => 'bdo'],
            ['id' => 11, 'name' => 'Ayala Land', 'ticker' => 'ALI'],
        ]);
        $crms->table('sector_group')->insert([
            ['id' => 5, 'name' => 'Domestic banks', 'scope' => 'domestic', 'position' => 0],
            ['id' => 6, 'name' => 'Property', 'scope' => 'domestic', 'position' => 1],
        ]);
        $crms->table('sector_group_corporate')->insert([
            ['sector_group_id' => 5, 'corporate_id' => 10],
            ['sector_group_id' => 6, 'corporate_id' => 11],
        ]);
        $crms->table('client_contact')->insert([
            ['id' => 100, 'client_id' => 1, 'firstname' => 'G', 'lastname' => 'One', 'portal_user_id' => $byGroup->id],
            ['id' => 101, 'client_id' => 1, 'firstname' => 'B', 'lastname' => 'Both', 'portal_user_id' => $both->id],
            ['id' => 102, 'client_id' => 1, 'firstname' => 'P', 'lastname' => 'Property', 'portal_user_id' => $unlinked->id],
            ['id' => 103, 'client_id' => 1, 'firstname' => 'F', 'lastname' => 'Foreign', 'portal_user_id' => $foreign->id],
            ['id' => 104, 'client_id' => 1, 'firstname' => 'N', 'lastname' => 'NoPortal', 'portal_user_id' => null],
        ]);
        $crms->table('client_contact_sector_group')->insert([
            ['client_contact_id' => 100, 'sector_group_id' => 5],
            ['client_contact_id' => 101, 'sector_group_id' => 5],
            ['client_contact_id' => 102, 'sector_group_id' => 6], // wrong group
            ['client_contact_id' => 103, 'sector_group_id' => 5], // Foreign client: never on the Local leg
            ['client_contact_id' => 104, 'sector_group_id' => 5],
        ]);

        $res = $this->getJson("/api/cms/email-blasts/match?report={$report->id}")->assertOk()->assertJsonCount(3, 'clients');
        $via = collect($res->json('clients'))->pluck('via', 'id')->all();
        $this->assertSame([
            (string) $byPrefs->id => 'prefs',
            (string) $byGroup->id => 'sectorGroup',
            (string) $both->id => 'both',
        ], $via);
    }
}
