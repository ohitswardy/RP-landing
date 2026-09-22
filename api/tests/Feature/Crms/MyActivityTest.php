<?php

namespace Tests\Feature\Crms;

use App\Models\AuditEntry;
use App\Models\Crms\Client;
use App\Models\Crms\Event;
use App\Models\Crms\EventAttendee;
use App\Models\Crms\Interaction;
use App\Models\Crms\OneOffMeeting;
use App\Models\Crms\SellsideContact;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * My Activity: the signed-in staff member's own interactions, meetings,
 * attended events and ledger rows, merged and paged; plus the legacy-user
 * match that decides whether interactions.user_id can be stamped at all.
 */
class MyActivityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);
        $this->seed(RbacSeeder::class);
    }

    private function staff(string $role, string $email): User
    {
        return User::factory()->create([
            'kind' => User::KIND_STAFF,
            'email' => $email,
            'role_id' => Role::where('name', $role)->value('id'),
            'password' => 'password',
        ]);
    }

    private function interactionPayload(int $clientId, array $extra = []): array
    {
        return ['clientId' => $clientId, 'date' => '2026-09-10', 'clientContactIds' => [], 'sellsideContactIds' => [], 'form' => []] + $extra;
    }

    public function test_feed_merges_the_users_interactions_meetings_events_and_ledger_rows(): void
    {
        $me = $this->staff('Analyst', 'analyst@regis.ph');
        $other = $this->staff('Administrator', 'admin@regis.ph');

        // Legacy authors: me (id 7) and a colleague (id 8), matched by email.
        DB::connection('crms')->table('user')->insert([
            ['id' => 7, 'first_name' => 'Ana', 'last_name' => 'Lyst', 'email' => 'Analyst@Regis.ph', 'type' => 'Research'],
            ['id' => 8, 'first_name' => 'Ad', 'last_name' => 'Min', 'email' => 'admin@regis.ph', 'type' => 'Sales'],
        ]);
        $client = Client::create(['name' => 'Schroders']);
        $mine = Interaction::create(['client_id' => $client->id, 'user_id' => 7, 'interaction_date' => '2026-09-05 00:00:00', 'duration' => '45', 'important' => true, 'client_contact' => [], 'sellside_contact' => [], 'form' => []]);
        Interaction::create(['client_id' => $client->id, 'user_id' => 7, 'interaction_date' => '2026-08-20 00:00:00', 'duration' => '30', 'client_contact' => [], 'sellside_contact' => [], 'form' => []]);
        Interaction::create(['client_id' => $client->id, 'user_id' => 8, 'interaction_date' => '2026-09-06 00:00:00', 'duration' => '60', 'client_contact' => [], 'sellside_contact' => [], 'form' => []]); // colleague's
        Interaction::create(['client_id' => $client->id, 'user_id' => 7, 'interaction_date' => '2025-01-06 00:00:00', 'duration' => '60', 'client_contact' => [], 'sellside_contact' => [], 'form' => []]); // out of range

        $meeting = OneOffMeeting::create(['client_id' => $client->id, 'user_id' => 7, 'start_date' => '2026-09-08 00:00:00', 'location' => 'Makati', 'classification' => 'expert_meeting', 'client_contact' => [], 'corporate_contact' => []]);

        // Two roadshows I am on: one through the Regis tab (`bank`), one through the header snapshot list.
        $meDir = SellsideContact::create(['name' => 'Ana Lyst', 'email' => 'analyst@regis.ph', 'type' => 'Analyst']);
        $tabbed = Event::create(['category' => 2, 'start_date' => '2026-09-01 00:00:00', 'end_date' => '2026-09-02 00:00:00', 'client_id' => $client->id, 'client_contact' => [], 'sellside_contact' => []]);
        EventAttendee::create(['roadshow_id' => $tabbed->id, 'sellside_contact_id' => $meDir->id, 'email' => 'analyst@regis.ph']);
        $headed = Event::create(['category' => 3, 'start_date' => '2026-07-14 00:00:00', 'end_date' => '2026-07-14 00:00:00', 'client_contact' => [], 'sellside_contact' => [['id' => 999, 'name' => 'Ana Lyst', 'email' => 'ANALYST@regis.ph']]]);
        Event::create(['category' => 1, 'start_date' => '2026-09-03 00:00:00', 'client_contact' => [], 'sellside_contact' => [['id' => 5, 'name' => 'Someone Else', 'email' => 'else@regis.ph']]]); // not mine

        AuditEntry::create(['user_id' => $me->id, 'actor' => $me->name, 'action' => 'CRMS · Created Reverse Roadshow', 'target' => 'Schroders', 'at' => '2026-08-30 09:00:00']);
        AuditEntry::create(['user_id' => $me->id, 'actor' => $me->name, 'action' => 'CRMS · Generated report', 'target' => 'internal', 'at' => '2026-09-09 09:00:00']);
        AuditEntry::create(['user_id' => $other->id, 'actor' => $other->name, 'action' => 'CRMS · Created Company Roadshow', 'target' => 'Ayala', 'at' => '2026-09-09 10:00:00']);
        AuditEntry::create(['user_id' => $me->id, 'actor' => $me->name, 'action' => 'Updated home page', 'target' => 'hero', 'at' => '2026-09-09 11:00:00']); // CMS, not CRMS

        $res = $this->actingAs($me)->getJson('/api/crms/my-activity?from=2026-07-01&to=2026-09-30&perPage=4')
            ->assertOk()
            ->assertJsonPath('profile.email', 'analyst@regis.ph')
            ->assertJsonPath('profile.role', 'Analyst')
            ->assertJsonPath('profile.legacyUser.matched', true)
            ->assertJsonPath('profile.legacyUser.id', '7')
            ->assertJsonPath('profile.legacyUser.name', 'Ana Lyst')
            ->assertJsonPath('profile.legacyUser.type', 'Research')
            ->assertJsonPath('totals.interactions', 2)
            ->assertJsonPath('totals.minutes', 75)
            ->assertJsonPath('totals.important', 1)
            ->assertJsonPath('totals.meetingsCreated', 1)
            ->assertJsonPath('totals.eventsCreated', 1)
            ->assertJsonPath('totals.eventsAttended', 2)
            ->assertJsonPath('totals.actions', 2)
            ->assertJsonPath('feed.total', 7)
            ->assertJsonPath('feed.pages', 2)
            ->assertJsonPath('feed.page', 1);

        // Newest first across every source, with links into the owning module.
        $keys = array_column($res->json('feed.items'), 'key');
        $this->assertSame(['audit:'.AuditEntry::where('target', 'internal')->value('id'), 'meeting:'.$meeting->id, 'interaction:'.$mine->id, 'event:'.$tabbed->id], $keys);
        $this->assertSame('/crms/interactions/'.$mine->id, $res->json('feed.items.2.href'));
        $this->assertSame(45, $res->json('feed.items.2.minutes'));
        $this->assertTrue($res->json('feed.items.2.important'));
        $this->assertSame('/crms/events/reverse-roadshows/'.$tabbed->id, $res->json('feed.items.3.href'));
        $this->assertSame('/crms/events/meetings/'.$meeting->id, $res->json('feed.items.1.href'));
        $this->assertSame('Generated report', $res->json('feed.items.0.title'));
        $this->assertNull($res->json('feed.items.0.href'));

        $page2 = $this->actingAs($me)->getJson('/api/crms/my-activity?from=2026-07-01&to=2026-09-30&perPage=4&page=2')->assertOk();
        $this->assertSame(['audit:'.AuditEntry::where('target', 'Schroders')->value('id'), 'interaction:'.Interaction::where('duration', '30')->where('user_id', 7)->value('id'), 'event:'.$headed->id], array_column($page2->json('feed.items'), 'key'));
        $this->assertSame('/crms/events/analyst-marketing/'.$headed->id, $page2->json('feed.items.2.href'));
    }

    public function test_editor_cannot_read_my_activity(): void
    {
        $editor = $this->staff('Editor', 'editor@regis.ph');
        $this->actingAs($editor)->getJson('/api/crms/my-activity')->assertStatus(403);
    }

    public function test_unmatched_legacy_user_is_reported_and_logged_once_per_request(): void
    {
        $me = $this->staff('Administrator', 'newhire@regis.ph');
        $client = Client::create(['name' => 'AIA']);
        Log::spy();

        // Bootstrap says so up front, so the interaction form can warn before the save.
        $this->actingAs($me)->getJson('/api/crms/bootstrap')->assertOk()
            ->assertJsonPath('meta.legacyUserMatched', false)
            ->assertJsonPath('meta.legacyUserId', null);

        // The create stamps no author and says so in meta; legacyUserId() is called
        // several times on the way (store + authorMeta) but warns once.
        $res = $this->actingAs($me)->postJson('/api/crms/interactions', $this->interactionPayload($client->id))
            ->assertCreated()
            ->assertJsonPath('item.authorId', null)
            ->assertJsonPath('meta.legacyUserMatched', false);

        Log::shouldHaveReceived('warning')->twice(); // once for the bootstrap request, once for the store
        $this->assertDatabaseHas('audit_entries', ['action' => 'CRMS · Logged interaction', 'user_id' => $me->id]);

        // My Activity still works off the ledger alone.
        $this->actingAs($me)->getJson('/api/crms/my-activity?from=2026-01-01&to=2026-12-31')->assertOk()
            ->assertJsonPath('profile.legacyUser.matched', false)
            ->assertJsonPath('profile.legacyUser.id', null)
            ->assertJsonPath('totals.interactions', 0)
            ->assertJsonPath('totals.actions', 1)
            ->assertJsonPath('feed.items.0.title', 'Logged interaction')
            ->assertJsonPath('feed.items.0.kind', 'audit');
        $this->assertNotNull($res->json('item.id'));
    }

    public function test_matched_legacy_user_stamps_the_author_and_does_not_warn(): void
    {
        $me = $this->staff('Administrator', 'veteran@regis.ph');
        DB::connection('crms')->table('user')->insert(['id' => 3, 'first_name' => 'Vet', 'last_name' => 'Eran', 'email' => 'VETERAN@regis.ph', 'type' => 'Sales']);
        $client = Client::create(['name' => 'AIA']);
        Log::spy();

        $this->actingAs($me)->getJson('/api/crms/bootstrap')->assertOk()
            ->assertJsonPath('meta.legacyUserMatched', true)
            ->assertJsonPath('meta.legacyUserId', '3');
        $this->actingAs($me)->postJson('/api/crms/interactions', $this->interactionPayload($client->id))
            ->assertCreated()
            ->assertJsonPath('item.authorId', '3')
            ->assertJsonPath('meta.legacyUserMatched', true)
            ->assertJsonPath('meta.legacyUserId', '3');

        Log::shouldNotHaveReceived('warning');
    }

    public function test_bootstrap_carries_the_legacy_event_category_names_when_the_table_has_rows(): void
    {
        $me = $this->staff('Administrator', 'a@regis.ph');

        // Empty table: enum only.
        $this->actingAs($me)->getJson('/api/crms/bootstrap')->assertOk()
            ->assertJsonPath('meta.eventCategories.0.slug', 'roadshows')
            ->assertJsonPath('meta.eventCategories.0.id', '1')
            ->assertJsonPath('meta.eventCategories.0.legacyName', null)
            ->assertJsonPath('meta.eventCategories.3.slug', 'meetings');

        // Production rows: the legacy names ride along, the labels the routes depend on do not change.
        DB::connection('crms')->table('event_category')->insert([
            ['id' => 1, 'name' => 'Roadshow'], ['id' => 2, 'name' => 'Reverse Roadshow'], ['id' => 3, 'name' => 'Meeting'],
        ]);
        $this->actingAs($me)->getJson('/api/crms/bootstrap')->assertOk()
            ->assertJsonPath('meta.eventCategories.2.slug', 'analyst-marketing')
            ->assertJsonPath('meta.eventCategories.2.label', 'Analyst Marketing')
            ->assertJsonPath('meta.eventCategories.2.legacyName', 'Meeting');
    }
}
