<?php

namespace Tests\Feature\Portal;

use App\Models\Report;
use App\Models\User;
use App\Support\AccountGate;
use Illuminate\Support\Facades\Storage;

/**
 * The coverage mandate: sector_prefs / preferred_analysts narrow the catalog
 * everywhere (list, company registry, PDF stream), empty prefs mean the
 * whole shelf, and the client middleware re-checks the account each call.
 */
class PortalCoverageTest extends PortalTestCase
{
    public function test_scope_visible_to_matches_sector_or_analyst_case_insensitively(): void
    {
        $banks = $this->report(['category' => 'Banks', 'analyst' => 'C. Resullar, CFA']);
        $power = $this->report(['category' => ' power ', 'analyst' => 'P. Garcia']);
        $macro = $this->report(['category' => 'Macro / Strategy', 'analyst' => 'C. Sy, CFA']);

        $everything = $this->client();
        $this->assertFalse($everything->hasCoverageFilter());
        $this->assertEqualsCanonicalizing([$banks->id, $power->id, $macro->id], Report::visibleTo($everything)->pluck('id')->all());

        $bySector = $this->client(['sector_prefs' => ['BANKS', ' Power']]);
        $this->assertEqualsCanonicalizing([$banks->id, $power->id], Report::visibleTo($bySector)->pluck('id')->all());
        $this->assertTrue($banks->isVisibleTo($bySector));
        $this->assertFalse($macro->isVisibleTo($bySector));

        $byAnalyst = $this->client(['preferred_analysts' => ['c. sy, cfa']]);
        $this->assertSame([$macro->id], Report::visibleTo($byAnalyst)->pluck('id')->all());

        // Either half admits a report: sector OR analyst.
        $both = $this->client(['sector_prefs' => ['Banks'], 'preferred_analysts' => ['P. Garcia']]);
        $this->assertEqualsCanonicalizing([$banks->id, $power->id], Report::visibleTo($both)->pluck('id')->all());

        // Blank entries do not count as a filter.
        $blank = $this->client(['sector_prefs' => ['', '  '], 'preferred_analysts' => null]);
        $this->assertFalse($blank->hasCoverageFilter());

        // Staff always see everything.
        $this->assertCount(3, Report::visibleTo($this->staff())->get());
    }

    public function test_portal_reports_prunes_catalog_companies_and_trending_to_the_mandate(): void
    {
        $ali = $this->company('Ayala Land', 'ALI');
        $mer = $this->company('Meralco', 'MER');
        $bdo = $this->company('BDO Unibank', 'BDO');
        $banks = $this->report(['category' => 'Banks', 'company_id' => $bdo->id]);
        $property = $this->report(['category' => 'Property', 'company_id' => $ali->id]);
        $this->report(['category' => 'Power', 'company_id' => $mer->id]);

        $client = $this->client(['sector_prefs' => ['Banks', 'Property']]);
        $res = $this->actingAs($client)->getJson('/api/portal/reports')->assertOk();

        $this->assertEqualsCanonicalizing([(string) $banks->id, (string) $property->id], array_column($res->json('reports'), 'id'));
        $this->assertEqualsCanonicalizing(['ALI', 'BDO'], array_column($res->json('companies'), 'symbol'));
        $this->assertArrayNotHasKey('reportTypes', $res->json());
        $this->assertSame(['metric', 'windowMonths', 'entries'], array_keys($res->json('trending')));

        // Unrestricted client: whole catalog, whole registry.
        $all = $this->actingAs($this->client())->getJson('/api/portal/reports')->assertOk();
        $this->assertCount(3, $all->json('reports'));
        $this->assertCount(3, $all->json('companies'));

        // Staff tokens do not enter the portal.
        $this->actingAs($this->staff())->getJson('/api/portal/reports')->assertStatus(403);
    }

    public function test_pdf_stream_honours_coverage_and_missing_files(): void
    {
        Storage::fake();
        Storage::put('reports/banks.pdf', "%PDF-1.4\n%fake\n");

        $banks = $this->report(['category' => 'Banks', 'file_path' => 'reports/banks.pdf', 'file_name' => 'banks.pdf']);
        $power = $this->report(['category' => 'Power', 'file_path' => 'reports/power.pdf']); // not on disk
        $noFile = $this->report(['category' => 'Banks', 'file_path' => null, 'file_url' => '/reports/sample.pdf']);

        $client = $this->client(['sector_prefs' => ['Banks']]);

        $this->actingAs($client)->get("/api/reports/{$banks->id}/file")
            ->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->actingAs($client)->getJson("/api/reports/{$power->id}/file")->assertStatus(403);
        $this->actingAs($client)->getJson("/api/reports/{$noFile->id}/file")->assertStatus(404);

        // Off the mandate the file simply does not exist for this client; on it, a missing blob is a 404.
        $open = $this->client();
        $this->actingAs($open)->getJson("/api/reports/{$power->id}/file")->assertStatus(404);
        $this->actingAs($open)->get("/api/reports/{$banks->id}/file")->assertOk();

        // Staff read every PDF; a suspended account reads none; anonymous is refused.
        $this->actingAs($this->staff('Analyst'))->get("/api/reports/{$banks->id}/file")->assertOk();
        $this->actingAs($this->client(['suspended' => true]))->getJson("/api/reports/{$banks->id}/file")->assertStatus(403);
        $this->guest()->getJson("/api/reports/{$banks->id}/file")->assertStatus(401);
    }

    public function test_client_middleware_rechecks_status_and_suspension_on_every_request(): void
    {
        $client = $this->client();
        $token = $this->portalToken($client);
        $this->withToken($token)->getJson('/api/portal/reports')->assertOk();

        $client->forceFill(['status' => User::STATUS_PENDING])->save();
        $this->withToken($token)->getJson('/api/portal/reports')
            ->assertStatus(403)->assertJsonPath('message', 'Your registration is with us for review. You will receive an email once it is approved.');

        $client->forceFill(['status' => User::STATUS_DECLINED])->save();
        $this->withToken($token)->getJson('/api/portal/bookmarks')
            ->assertStatus(403)->assertJsonPath('message', 'This application was not approved. Contact your Regis coverage for help.');

        $client->forceFill(['status' => User::STATUS_APPROVED, 'suspended' => true])->save();
        $this->withToken($token)->postJson('/api/portal/activity', ['event' => 'view'])
            ->assertStatus(403)->assertJsonPath('message', AccountGate::CLIENT_SUSPENDED);

        $client->forceFill(['suspended' => false])->save();
        $this->withToken($token)->getJson('/api/portal/reports')->assertOk();
    }

    public function test_staff_middleware_rejects_a_suspended_session_at_once(): void
    {
        $admin = $this->staff('Administrator');
        $token = $this->cmsToken($admin);
        $this->withToken($token)->getJson('/api/cms/access')->assertOk();

        $admin->forceFill(['suspended' => true])->save();
        $this->withToken($token)->getJson('/api/cms/access')
            ->assertStatus(403)->assertJsonPath('message', AccountGate::STAFF_SUSPENDED);
        $this->withToken($token)->getJson('/api/me')->assertStatus(403);
    }
}
