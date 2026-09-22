<?php

namespace Tests\Feature\Cms;

use App\Models\HomePage;
use App\Models\MediaAsset;
use App\Models\ServiceLine;
use App\Support\HomeDefaults;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class MediaModuleTest extends CmsTestCase
{
    public function test_upload_list_and_delete_with_audit(): void
    {
        Storage::fake('public');
        $this->actingAsStaff('Editor');

        $created = $this->post('/api/cms/media', [
            'file' => UploadedFile::fake()->image('boardroom.jpg', 640, 480),
            'label' => 'Boardroom',
        ])->assertCreated();
        $created->assertJsonPath('item.label', 'Boardroom')
            ->assertJsonPath('item.kind', 'photo')
            ->assertJsonPath('item.usedBy', 'Media library')
            ->assertJsonPath('audit.action', 'Uploaded image');
        $path = $created->json('item.path');
        $this->assertStringStartsWith('/api/media/site/', $path);
        Storage::disk('public')->assertExists(substr($path, strlen('/api/media/')));

        $this->getJson('/api/cms/media')->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.path', $path);

        $this->deleteJson('/api/cms/media/'.$created->json('item.id'))->assertOk()
            ->assertJsonPath('audit.action', 'Deleted image');
        Storage::disk('public')->assertMissing(substr($path, strlen('/api/media/')));
        $this->assertSame(0, MediaAsset::count());
    }

    public function test_upload_refuses_non_images_and_oversize_files(): void
    {
        Storage::fake('public');
        $this->actingAsStaff('Editor');

        $json = ['Accept' => 'application/json'];
        $this->post('/api/cms/media', ['file' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf')], $json)
            ->assertStatus(422);
        $this->post('/api/cms/media', ['file' => UploadedFile::fake()->image('huge.jpg')->size(9000)], $json)
            ->assertStatus(422);
    }

    public function test_delete_is_refused_while_content_still_references_the_image(): void
    {
        Storage::fake('public');
        $this->actingAsStaff('Editor');

        $asset = MediaAsset::create(['path' => '/api/media/site/hero.jpg', 'label' => 'Hero', 'kind' => 'photo', 'used_by' => 'Landing page']);
        Storage::disk('public')->put('site/hero.jpg', 'jpeg-bytes');

        $home = HomePage::current();
        $content = $home->content ?? HomeDefaults::content();
        $content['hero']['image'] = '/api/media/site/hero.jpg';
        $home->update(['content' => $content]);
        ServiceLine::create(['slug' => 'research', 'title' => 'Research Advisory', 'dek' => '', 'live' => true, 'position' => 0, 'hero_images' => ['/api/media/site/hero.jpg']]);

        $res = $this->deleteJson("/api/cms/media/{$asset->id}")->assertStatus(409);
        $refs = $res->json('references');
        $this->assertContains('Landing page', $refs);
        $this->assertContains('Service line: Research Advisory', $refs);
        Storage::disk('public')->assertExists('site/hero.jpg');
        $this->assertSame(1, MediaAsset::count());

        // Unreferenced once the pages move on.
        $home->update(['content' => HomeDefaults::content()]);
        ServiceLine::query()->update(['hero_images' => json_encode([])]);
        $this->deleteJson("/api/cms/media/{$asset->id}")->assertOk();
        Storage::disk('public')->assertMissing('site/hero.jpg');
    }
}
