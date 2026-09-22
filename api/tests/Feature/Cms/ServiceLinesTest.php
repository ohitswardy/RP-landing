<?php

namespace Tests\Feature\Cms;

use App\Models\ServiceLine;

class ServiceLinesTest extends CmsTestCase
{
    public function test_service_lines_can_be_created_with_unique_slugs_and_deleted(): void
    {
        $this->actingAsStaff('Editor');

        $first = $this->postJson('/api/cms/services', [
            'title' => 'Capital Markets',
            'dek' => 'ECM and DCM execution.',
            'pillars' => [['title' => 'IPOs', 'body' => 'Bookbuilding.']],
            'proof' => [['value' => '12', 'label' => 'deals']],
            'live' => true,
        ])->assertCreated();
        $first->assertJsonPath('item.slug', 'capital-markets')
            ->assertJsonPath('item.live', true)
            ->assertJsonPath('item.pillars.0.title', 'IPOs')
            ->assertJsonPath('item.eyebrow', 'Service')
            ->assertJsonPath('audit.action', 'Added service line');

        $second = $this->postJson('/api/cms/services', ['title' => 'Capital Markets'])->assertCreated();
        $second->assertJsonPath('item.slug', 'capital-markets-2')->assertJsonPath('item.live', false);
        $this->assertSame(1, (int) $second->json('item.position'));

        $this->postJson('/api/cms/services', ['title' => 'Advisory', 'slug' => 'Bad Slug'])->assertStatus(422);
        $this->postJson('/api/cms/services', ['title' => 'Advisory', 'slug' => 'capital-markets'])
            ->assertCreated()->assertJsonPath('item.slug', 'capital-markets-3');

        // Public page only shows live lines.
        $this->getJson('/api/content/services')->assertOk()->assertJsonCount(1, 'services')
            ->assertJsonPath('services.0.slug', 'capital-markets');

        // Unpublished lines can go; the last live one cannot.
        $this->deleteJson('/api/cms/services/'.$second->json('item.id'))->assertOk()
            ->assertJsonPath('audit.action', 'Deleted service line');
        $this->deleteJson('/api/cms/services/'.$first->json('item.id'))->assertStatus(409);
        $this->assertSame(2, ServiceLine::count());

        // Publish another, then the first may go.
        $third = ServiceLine::where('slug', 'capital-markets-3')->firstOrFail();
        $this->putJson("/api/cms/services/{$third->id}", ['live' => true])->assertOk();
        $this->deleteJson('/api/cms/services/'.$first->json('item.id'))->assertOk();
        $this->getJson('/api/content/services')->assertOk()->assertJsonPath('services.0.slug', 'capital-markets-3');
    }

    public function test_service_writes_need_the_services_key(): void
    {
        $line = ServiceLine::create(['slug' => 'research', 'title' => 'Research', 'dek' => '', 'live' => true, 'position' => 0]);

        $this->actingAsStaff('Analyst');
        $this->postJson('/api/cms/services', ['title' => 'X'])->assertForbidden();
        $this->deleteJson("/api/cms/services/{$line->id}")->assertForbidden();
    }
}
