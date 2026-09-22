<?php

namespace Tests\Feature\Portal;

use App\Models\ClientActivity;
use App\Support\ClientLog;
use Illuminate\Support\Facades\DB;

/**
 * The consumption ledger: beacons append hash-chained rows, verify walks
 * the chain, and any edit behind the API's back is named by row.
 */
class ClientLogChainTest extends PortalTestCase
{
    public function test_activity_beacons_append_a_valid_hash_chain(): void
    {
        $report = $this->report(['title' => 'Banks deposit war']);
        $client = $this->client(['firm' => 'ARQ Capital']);

        $this->actingAs($client)->postJson('/api/portal/activity', ['event' => 'view', 'reportId' => $report->id, 'context' => 'viewer'])
            ->assertCreated()->assertJsonPath('ok', true);
        $this->actingAs($client)->postJson('/api/portal/activity', ['event' => 'download', 'reportId' => $report->id, 'context' => 'card'])
            ->assertCreated();
        $this->actingAs($client)->postJson('/api/portal/activity', ['event' => 'click', 'context' => 'new-tab'])
            ->assertCreated();

        $rows = ClientActivity::orderBy('id')->get();
        $this->assertCount(3, $rows);
        $this->assertNull($rows[0]->prev_hash, 'the first row anchors the chain');
        $this->assertSame($rows[0]->hash, $rows[1]->prev_hash);
        $this->assertSame($rows[1]->hash, $rows[2]->prev_hash);
        $this->assertSame(64, strlen($rows[0]->hash));
        $this->assertCount(3, $rows->pluck('hash')->unique());

        // Actor snapshot and event payload as recorded.
        $this->assertSame('ARQ Capital', $rows[0]->actor_firm);
        $this->assertSame($client->email, $rows[0]->actor_email);
        $this->assertSame('Banks deposit war', $rows[0]->target);
        $this->assertSame('viewer', $rows[0]->context);
        $this->assertSame('download', $rows[1]->event);
        $this->assertNull($rows[2]->report_id);
        $this->assertSame('', $rows[2]->target);

        $this->assertSame(['intact' => true, 'checked' => 3, 'brokenAt' => null], ClientLog::verify());

        // Invalid events and unknown reports are refused before anything is written.
        $this->actingAs($client)->postJson('/api/portal/activity', ['event' => 'login'])->assertStatus(422);
        $this->actingAs($client)->postJson('/api/portal/activity', ['event' => 'view', 'reportId' => 999999])->assertStatus(422);
        $this->assertDatabaseCount('client_activities', 3);
    }

    public function test_verify_endpoint_passes_and_then_names_the_first_tampered_row(): void
    {
        $report = $this->report();
        $client = $this->client();
        foreach (['view', 'view', 'download', 'view'] as $event) {
            $this->actingAs($client)->postJson('/api/portal/activity', ['event' => $event, 'reportId' => $report->id])->assertCreated();
        }

        $admin = $this->staff('Administrator');
        $this->actingAs($admin)->getJson('/api/cms/client-logs/verify')
            ->assertOk()->assertExactJson(['intact' => true, 'checked' => 4, 'brokenAt' => null]);

        // An edit made straight in the database: row 3's event is rewritten.
        $third = ClientActivity::orderBy('id')->skip(2)->first();
        DB::table('client_activities')->where('id', $third->id)->update(['event' => 'click']);

        $this->actingAs($admin)->getJson('/api/cms/client-logs/verify')
            ->assertOk()
            ->assertJsonPath('intact', false)
            ->assertJsonPath('checked', 2)
            ->assertJsonPath('brokenAt', (string) $third->id);

        // Re-linking the chain by hand does not help: the HMAC is keyed by APP_KEY.
        DB::table('client_activities')->where('id', $third->id)->update(['event' => 'download', 'hash' => str_repeat('0', 64)]);
        $this->actingAs($admin)->getJson('/api/cms/client-logs/verify')->assertJsonPath('brokenAt', (string) $third->id);

        // Only logs.view may read the ledger; Analysts and clients are refused.
        $this->actingAs($this->staff('Analyst'))->getJson('/api/cms/client-logs/verify')->assertStatus(403);
        $this->actingAs($client)->getJson('/api/cms/client-logs/verify')->assertStatus(403);
    }

    public function test_beacons_off_the_mandate_are_refused_and_the_ledger_lists_them(): void
    {
        $banks = $this->report(['category' => 'Banks']);
        $power = $this->report(['category' => 'Power']);
        $client = $this->client(['sector_prefs' => ['Banks']]);

        $this->actingAs($client)->postJson('/api/portal/activity', ['event' => 'view', 'reportId' => $power->id])
            ->assertStatus(403);
        $this->actingAs($client)->postJson('/api/portal/activity', ['event' => 'view', 'reportId' => $banks->id])
            ->assertCreated();

        $admin = $this->staff('Administrator');
        $page = $this->actingAs($admin)->getJson('/api/cms/client-logs?event=view')->assertOk();
        $this->assertSame(1, $page->json('total'));
        $this->assertSame((string) $banks->id, $page->json('items.0.reportId'));
        $this->assertSame(1, $page->json('summary.views'));
        $this->assertSame((string) $client->id, $page->json('clients.0.id'));
    }
}
