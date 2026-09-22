<?php

namespace Tests\Feature\Cms;

use Illuminate\Support\Facades\DB;

/**
 * The CRMS research hierarchy as the Email desk's audience call serves it:
 * every sector per scope with its tickers, and only the contacts a blast can
 * reach — those linked to an approved, unsuspended portal account.
 */
class ResearchAudienceTest extends CmsTestCase
{
    private function crmsSchema(): void
    {
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);
    }

    public function test_audience_survives_an_empty_crms_database(): void
    {
        $this->actingAsStaff('Analyst');
        $this->getJson('/api/cms/email-blasts/audience')->assertOk()->assertJsonCount(0, 'research');
    }

    public function test_research_sectors_carry_tickers_and_reachable_contacts_only(): void
    {
        $this->crmsSchema();
        $this->actingAsStaff('Analyst');

        $linked = $this->client(['name' => 'Katrina Villaruel', 'email' => 'K.Villaruel@arqcapital.ph']);
        $suspended = $this->client(['suspended' => true]);
        $pending = $this->client(['status' => 'pending']);

        $crms = DB::connection('crms');
        $crms->table('client')->insert(['id' => 1, 'name' => 'ARQ Capital']);
        $crms->table('corporate')->insert([
            ['id' => 10, 'name' => 'BDO Unibank, Inc.', 'ticker' => 'BDO'],
            ['id' => 11, 'name' => 'Apex Mining Co., Inc.', 'ticker' => 'APX PM'],
        ]);
        $crms->table('sector_group')->insert([
            ['id' => 5, 'name' => 'Strategy', 'scope' => 'domestic', 'position' => 0],
            ['id' => 6, 'name' => 'Banks', 'scope' => 'domestic', 'position' => 1],
            ['id' => 7, 'name' => 'Mining', 'scope' => 'domestic', 'position' => 2],
            ['id' => 8, 'name' => 'Banks', 'scope' => 'foreign', 'position' => 1],
        ]);
        $crms->table('sector_group_corporate')->insert([
            ['sector_group_id' => 6, 'corporate_id' => 10],
            ['sector_group_id' => 7, 'corporate_id' => 11],
            ['sector_group_id' => 8, 'corporate_id' => 10],
        ]);
        $crms->table('client_contact')->insert([
            ['id' => 100, 'client_id' => 1, 'firstname' => 'Katrina', 'lastname' => 'Villaruel', 'email' => null, 'portal_user_id' => $linked->id],
            ['id' => 101, 'client_id' => 1, 'firstname' => 'S', 'lastname' => 'Suspended', 'email' => null, 'portal_user_id' => $suspended->id],
            ['id' => 102, 'client_id' => 1, 'firstname' => 'P', 'lastname' => 'Pending', 'email' => null, 'portal_user_id' => $pending->id],
            ['id' => 103, 'client_id' => 1, 'firstname' => 'N', 'lastname' => 'NoPortal', 'email' => 'n@arq.ph', 'portal_user_id' => null],
        ]);
        $crms->table('client_contact_sector_group')->insert([
            ['client_contact_id' => 100, 'sector_group_id' => 6],
            ['client_contact_id' => 101, 'sector_group_id' => 6],
            ['client_contact_id' => 102, 'sector_group_id' => 6],
            ['client_contact_id' => 103, 'sector_group_id' => 6],
            ['client_contact_id' => 100, 'sector_group_id' => 7],
        ]);

        $research = $this->getJson('/api/cms/email-blasts/audience')->assertOk()->json('research');
        $this->assertCount(4, $research);

        // Ordered by scope then position; the ticker-less lead sector is served as such.
        $this->assertSame(['domestic', 'domestic', 'domestic', 'foreign'], array_column($research, 'scope'));
        $this->assertSame('Strategy', $research[0]['name']);
        $this->assertSame([], $research[0]['tickers']);
        $this->assertSame(0, $research[0]['contactCount']);

        $banks = $research[1];
        $this->assertSame(['BDO'], $banks['tickers']);
        $this->assertSame(4, $banks['contactCount']);
        $this->assertSame(3, $banks['unlinkedCount']); // suspended, pending, and no portal account at all
        $this->assertSame([[
            'email' => 'k.villaruel@arqcapital.ph', 'name' => 'Katrina Villaruel', 'userId' => (string) $linked->id, 'source' => 'client',
        ]], $banks['recipients']);

        // Legacy exchange suffixes are stripped for display.
        $this->assertSame(['APX'], $research[2]['tickers']);
        $this->assertSame(1, $research[2]['contactCount']);
    }
}
