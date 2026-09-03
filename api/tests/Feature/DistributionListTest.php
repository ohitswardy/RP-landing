<?php

namespace Tests\Feature;

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
        Sanctum::actingAs(User::where('email', 'e.dagal@regis.ph')->firstOrFail(), ['cms']);
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

    public function test_lists_require_the_email_desk_permission(): void
    {
        Sanctum::actingAs(User::where('email', 'p.garcia@regis.ph')->firstOrFail(), ['cms']);
        $this->getJson('/api/cms/distribution-lists')->assertOk(); // Analysts hold email.manage

        $client = User::where('kind', User::KIND_CLIENT)->firstOrFail();
        Sanctum::actingAs($client, ['portal']);
        $this->getJson('/api/cms/distribution-lists')->assertForbidden();
    }
}
