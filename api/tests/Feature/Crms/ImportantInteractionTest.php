<?php

namespace Tests\Feature\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\Interaction;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The important mark: set on save or toggled on its own, filterable on the
 * list, and surfaced on the dashboard shelf regardless of the date range.
 */
class ImportantInteractionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
        ]]);
        $this->seed(RbacSeeder::class);
    }

    private function admin(): User
    {
        return User::factory()->create([
            'kind' => User::KIND_STAFF,
            'role_id' => Role::where('name', 'Administrator')->value('id'),
            'password' => 'password',
        ]);
    }

    private function payload(int $clientId, array $extra = []): array
    {
        return [
            'clientId' => $clientId, 'date' => '2026-09-10',
            'clientContactIds' => [], 'sellsideContactIds' => [], 'form' => [],
        ] + $extra;
    }

    public function test_important_is_saved_with_the_form_and_toggled_on_its_own(): void
    {
        $admin = $this->admin();
        $client = Client::create(['name' => 'AIA Investment Management']);

        $id = $this->actingAs($admin)
            ->postJson('/api/crms/interactions', $this->payload($client->id, ['important' => true, 'importantNote' => '  Mandate review next quarter  ']))
            ->assertCreated()
            ->assertJsonPath('item.important', true)
            ->assertJsonPath('item.importantNote', 'Mandate review next quarter')
            ->json('item.id');

        $firstMarkedAt = Interaction::find($id)->important_at;
        $this->assertNotNull($firstMarkedAt);

        // Re-saving the form keeps the original mark time.
        $this->actingAs($admin)
            ->putJson("/api/crms/interactions/$id", $this->payload($client->id, ['important' => true, 'importantNote' => 'Mandate review next quarter']))
            ->assertOk()->assertJsonPath('item.important', true);
        $this->assertEquals($firstMarkedAt, Interaction::find($id)->important_at);

        // The quick toggle: clearing drops the note and the mark time.
        $this->actingAs($admin)
            ->postJson("/api/crms/interactions/$id/important", ['important' => false])
            ->assertOk()->assertJsonPath('item.important', false)->assertJsonPath('item.importantNote', null)
            ->assertJsonPath('audit.action', 'CRMS · Cleared important mark');
        $this->assertNull(Interaction::find($id)->important_at);

        // Marking again without a note is fine; a later call may add one.
        $this->actingAs($admin)->postJson("/api/crms/interactions/$id/important", ['important' => true])->assertOk();
        $this->actingAs($admin)->postJson("/api/crms/interactions/$id/important", ['important' => true, 'note' => 'Escalated by sales'])
            ->assertOk()->assertJsonPath('item.importantNote', 'Escalated by sales');

        $this->actingAs($admin)->postJson("/api/crms/interactions/$id/important", ['important' => 'maybe'])->assertStatus(422);
    }

    public function test_the_list_filters_and_the_dashboard_pins_important_interactions(): void
    {
        $admin = $this->admin();
        $client = Client::create(['name' => 'Schroders']);

        $plain = Interaction::create(['client_id' => $client->id, 'interaction_date' => '2026-09-01 00:00:00', 'form' => [], 'client_contact' => [], 'sellside_contact' => []]);
        $old = Interaction::create(['client_id' => $client->id, 'interaction_date' => '2024-01-15 00:00:00', 'form' => [], 'client_contact' => [], 'sellside_contact' => []]);
        $old->markImportant(true, 'Long-standing mandate')->save();

        $list = $this->actingAs($admin)->getJson('/api/crms/interactions?important=1')->assertOk()->json();
        $this->assertSame(1, $list['total']);
        $this->assertSame((string) $old->id, $list['items'][0]['id']);

        $this->actingAs($admin)->getJson('/api/crms/interactions')->assertOk()->assertJsonPath('total', 2);

        // Outside the summary's date range, yet still on the shelf.
        $summary = $this->actingAs($admin)->getJson('/api/crms/dashboard/summary?from=2026-09-01&to=2026-09-30')->assertOk()->json();
        $this->assertSame(1, $summary['totals']['interactions']);
        $this->assertSame(1, $summary['totals']['important']);
        $this->assertCount(1, $summary['important']);
        $this->assertSame('Long-standing mandate', $summary['important'][0]['importantNote']);
        $this->assertSame('Schroders', $summary['important'][0]['clientName']);
        $this->assertNotSame((string) $plain->id, $summary['important'][0]['id']);
    }

    public function test_analysts_without_the_manage_key_cannot_toggle(): void
    {
        $client = Client::create(['name' => 'FIM Partners']);
        $i = Interaction::create(['client_id' => $client->id, 'interaction_date' => '2026-09-01 00:00:00', 'form' => [], 'client_contact' => [], 'sellside_contact' => []]);

        $viewer = User::factory()->create(['kind' => User::KIND_STAFF, 'role_id' => Role::where('name', 'Editor')->value('id'), 'password' => 'password']);
        $this->actingAs($viewer)->postJson("/api/crms/interactions/{$i->id}/important", ['important' => true])->assertStatus(403);
        $this->assertFalse(Interaction::find($i->id)->important);
    }
}
