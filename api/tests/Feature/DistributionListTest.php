<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DistributionListTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RbacSeeder::class);
        Sanctum::actingAs($this->staff('Administrator', 'Edward S. Dagal', 'e.dagal@regis.ph'), ['cms']);
    }

    /** RbacSeeder seeds only the super admin; every other actor is built here. */
    private function staff(string $role, string $name, string $email): User
    {
        return User::factory()->create([
            'name' => $name,
            'email' => $email,
            'outlook_email' => $email,
            'kind' => User::KIND_STAFF,
            'status' => User::STATUS_APPROVED,
            'role_id' => Role::where('name', $role)->value('id'),
        ]);
    }

    public function test_lists_are_created_deduplicated_and_served_with_the_audience(): void
    {
        $created = $this->postJson('/api/cms/distribution-lists', [
            'name' => 'Local banks desk',
            'description' => 'Local clients following Banks.',
            'contacts' => [
                ['email' => 'K.Villaruel@arqcapital.ph', 'name' => 'Katrina', 'userId' => '1', 'source' => 'client'],
                ['email' => 'k.villaruel@arqcapital.ph', 'name' => 'Katrina again', 'source' => 'client'],
                ['email' => 'desk@example.com', 'source' => 'manual'],
            ],
        ])->assertCreated();

        $created->assertJsonPath('item.count', 2)
            ->assertJsonPath('item.contacts.0.email', 'k.villaruel@arqcapital.ph')
            ->assertJsonPath('item.createdByName', 'Edward S. Dagal');

        $this->postJson('/api/cms/distribution-lists', ['name' => 'Local banks desk', 'contacts' => []])
            ->assertStatus(422);

        $this->getJson('/api/cms/email-blasts/audience')
            ->assertOk()
            ->assertJsonPath('lists.0.name', 'Local banks desk')
            ->assertJsonPath('dispatch.graphReady', false)
            ->assertJsonPath('dispatch.sender', 'e.dagal@regis.ph');
    }

    public function test_lists_can_be_renamed_and_deleted(): void
    {
        $id = $this->postJson('/api/cms/distribution-lists', [
            'name' => 'Foreign funds', 'contacts' => [['email' => 'nyc@fund.com', 'source' => 'client']],
        ])->assertCreated()->json('item.id');

        $this->putJson("/api/cms/distribution-lists/{$id}", [
            'name' => 'Foreign funds (NY)', 'contacts' => [],
        ])->assertOk()->assertJsonPath('item.name', 'Foreign funds (NY)')->assertJsonPath('item.count', 0);

        $this->deleteJson("/api/cms/distribution-lists/{$id}")->assertOk();
        $this->getJson('/api/cms/distribution-lists')->assertOk()->assertJsonCount(0, 'items');
    }

    public function test_lists_are_private_to_the_staff_member_who_made_them(): void
    {
        $mine = $this->postJson('/api/cms/distribution-lists', [
            'name' => 'Banks coverage', 'contacts' => [['email' => 'a@fund.com', 'source' => 'client']],
        ])->assertCreated()->json('item');
        $this->assertSame('Edward S. Dagal', $mine['createdByName']);
        $this->assertNotNull($mine['ownerId']);

        // An Analyst with the desk sees none of it and may not touch it…
        Sanctum::actingAs($this->staff('Analyst', 'Paolo Gabriel D. Garcia', 'p.garcia@regis.ph'), ['cms']);
        $this->getJson('/api/cms/distribution-lists')->assertOk()->assertJsonCount(0, 'items');
        $this->getJson('/api/cms/email-blasts/audience')->assertOk()->assertJsonCount(0, 'lists');
        $this->putJson("/api/cms/distribution-lists/{$mine['id']}", ['name' => 'Hijacked', 'contacts' => []])->assertForbidden();
        $this->deleteJson("/api/cms/distribution-lists/{$mine['id']}")->assertForbidden();

        // …but may reuse the same name for a list of their own.
        $this->postJson('/api/cms/distribution-lists', ['name' => 'Banks coverage', 'contacts' => []])->assertCreated();
        $this->postJson('/api/cms/distribution-lists', ['name' => 'Banks coverage', 'contacts' => []])->assertStatus(422);
        $this->getJson('/api/cms/distribution-lists')->assertOk()->assertJsonCount(1, 'items');
    }

    public function test_an_ownerless_list_is_shared_until_someone_edits_it(): void
    {
        $id = \App\Models\DistributionList::create(['name' => 'Legacy circulation', 'contacts' => [], 'created_by' => null])->id;

        $analyst = $this->staff('Analyst', 'Paolo Gabriel D. Garcia', 'p.garcia@regis.ph');
        Sanctum::actingAs($analyst, ['cms']);
        $this->getJson('/api/cms/distribution-lists')->assertOk()->assertJsonPath('items.0.ownerId', null);

        $this->putJson("/api/cms/distribution-lists/{$id}", ['name' => 'Legacy circulation', 'contacts' => []])
            ->assertOk()->assertJsonPath('item.ownerId', (string) $analyst->id);

        Sanctum::actingAs($this->staff('Analyst', 'Someone Else', 'else@regis.ph'), ['cms']);
        $this->getJson('/api/cms/distribution-lists')->assertOk()->assertJsonCount(0, 'items');
    }

    public function test_lists_require_the_email_desk_permission(): void
    {
        Sanctum::actingAs($this->staff('Analyst', 'Paolo Gabriel D. Garcia', 'p.garcia@regis.ph'), ['cms']);
        $this->getJson('/api/cms/distribution-lists')->assertOk(); // Analysts hold email.manage

        $client = User::factory()->create([
            'kind' => User::KIND_CLIENT,
            'status' => User::STATUS_APPROVED,
            'client_type' => 'Local',
            'firm' => 'ARQ Capital',
            'sector_prefs' => ['Banks'],
        ]);
        Sanctum::actingAs($client, ['portal']);
        $this->getJson('/api/cms/distribution-lists')->assertForbidden();
    }
}
