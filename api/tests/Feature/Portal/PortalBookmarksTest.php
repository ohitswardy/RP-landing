<?php

namespace Tests\Feature\Portal;

/**
 * Server-side bookmarks: per account, toggled, listed, removed and cleared,
 * and fenced by the same coverage rule as the catalog.
 */
class PortalBookmarksTest extends PortalTestCase
{
    public function test_toggle_list_remove_and_clear_are_per_account(): void
    {
        $a = $this->report();
        $b = $this->report();
        $client = $this->client();
        $other = $this->client();

        $this->actingAs($client)->getJson('/api/portal/bookmarks')->assertOk()->assertExactJson(['marks' => []]);

        $on = $this->actingAs($client)->putJson("/api/portal/bookmarks/{$a->id}")
            ->assertOk()->assertJsonPath('saved', true);
        $this->assertNotNull($on->json('savedAt'));
        $this->actingAs($client)->putJson("/api/portal/bookmarks/{$b->id}")->assertOk()->assertJsonPath('saved', true);

        $marks = $this->actingAs($client)->getJson('/api/portal/bookmarks')->assertOk()->json('marks');
        $this->assertEqualsCanonicalizing([(string) $a->id, (string) $b->id], array_map('strval', array_keys($marks)));
        $this->assertSame($on->json('savedAt'), $marks[(string) $a->id]);

        // Another account sees none of it.
        $this->actingAs($other)->getJson('/api/portal/bookmarks')->assertOk()->assertExactJson(['marks' => []]);

        // Toggling again removes; the row is gone, not flagged.
        $this->actingAs($client)->putJson("/api/portal/bookmarks/{$a->id}")
            ->assertOk()->assertJsonPath('saved', false)->assertJsonPath('savedAt', null);
        $this->assertDatabaseMissing('bookmarks', ['user_id' => $client->id, 'report_id' => $a->id]);

        $this->actingAs($client)->deleteJson("/api/portal/bookmarks/{$b->id}")->assertOk()->assertJsonPath('ok', true);
        $this->assertDatabaseCount('bookmarks', 0);

        $this->actingAs($client)->putJson("/api/portal/bookmarks/{$a->id}")->assertOk();
        $this->actingAs($other)->putJson("/api/portal/bookmarks/{$a->id}")->assertOk();
        $this->actingAs($client)->deleteJson('/api/portal/bookmarks')->assertOk();
        $this->assertDatabaseCount('bookmarks', 1);
        $this->assertDatabaseHas('bookmarks', ['user_id' => $other->id, 'report_id' => $a->id]);

        $this->actingAs($client)->putJson('/api/portal/bookmarks/999999')->assertStatus(404);
    }

    public function test_bookmarks_respect_the_coverage_mandate(): void
    {
        $banks = $this->report(['category' => 'Banks']);
        $power = $this->report(['category' => 'Power']);
        $client = $this->client(['sector_prefs' => ['Banks']]);

        $this->actingAs($client)->putJson("/api/portal/bookmarks/{$power->id}")
            ->assertStatus(403)->assertJsonPath('message', 'That report is outside your coverage.');
        $this->actingAs($client)->putJson("/api/portal/bookmarks/{$banks->id}")->assertOk();

        // A mark saved before the mandate narrowed is hidden, not surfaced.
        $client->forceFill(['sector_prefs' => []])->save();
        $this->actingAs($client)->putJson("/api/portal/bookmarks/{$power->id}")->assertOk();
        $client->forceFill(['sector_prefs' => ['Banks']])->save();

        $marks = $this->actingAs($client)->getJson('/api/portal/bookmarks')->assertOk()->json('marks');
        $this->assertSame([(string) $banks->id], array_map('strval', array_keys($marks)));

        // Staff and anonymous callers are not portal clients.
        $this->actingAs($this->staff())->getJson('/api/portal/bookmarks')->assertStatus(403);
        $this->guest()->getJson('/api/portal/bookmarks')->assertStatus(401);
    }
}
