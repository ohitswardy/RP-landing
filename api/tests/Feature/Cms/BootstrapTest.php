<?php

namespace Tests\Feature\Cms;

use App\Models\Article;
use App\Models\CareerPost;
use App\Models\MediaAsset;
use App\Models\Subscriber;
use App\Models\WatchSymbol;

class BootstrapTest extends CmsTestCase
{
    public const COLLECTIONS = [
        'articles', 'reports', 'companies', 'reportTypes', 'trendingRules', 'people', 'services',
        'servicePage', 'homePage', 'aboutPage', 'contactPage', 'insightsPage', 'careers', 'watchlist',
        'newsletters', 'subscribers', 'pages', 'media', 'audit',
    ];

    public function test_every_collection_is_present_with_its_wire_shape(): void
    {
        $this->actingAsStaff();

        Article::create(['tag' => 'Banks', 'title' => 'BDO 2Q', 'slug' => 'bdo-2q', 'author' => 'A', 'date' => '2026-09-01', 'status' => 'published', 'reads' => 0, 'excerpt' => 'x', 'body' => '<p>x</p>']);
        CareerPost::create(['title' => 'Analyst', 'dept' => 'Research', 'type' => 'Full-time', 'location' => 'Makati', 'posted' => '2026-09-01', 'status' => 'open', 'applicants' => 0, 'summary' => 'Cover banks.']);
        WatchSymbol::create(['sym' => 'BDO', 'name' => 'BDO Unibank', 'pinned' => true, 'position' => 0]);
        MediaAsset::create(['path' => '/api/media/site/a.jpg', 'label' => 'A', 'kind' => 'photo', 'used_by' => 'Test']);
        Subscriber::create(['email' => 'sub@example.com', 'joined' => '2026-01-01', 'verified' => true, 'source' => 'cms']);

        $res = $this->getJson('/api/cms/bootstrap')->assertOk();
        foreach (self::COLLECTIONS as $key) {
            $this->assertArrayHasKey($key, $res->json(), "bootstrap is missing `$key`");
        }

        $res->assertJsonPath('articles.0.slug', 'bdo-2q')
            ->assertJsonPath('articles.0.body', '<p>x</p>')
            ->assertJsonPath('careers.0.summary', 'Cover banks.')
            ->assertJsonPath('watchlist.0.sym', 'BDO')
            ->assertJsonPath('watchlist.0.pinned', true)
            ->assertJsonPath('media.0.path', '/api/media/site/a.jpg')
            ->assertJsonPath('subscribers.0.verified', true)
            ->assertJsonPath('subscribers.0.source', 'cms');
        $this->assertArrayHasKey('verifiedAt', $res->json('subscribers.0'));
        $this->assertArrayHasKey('unsubscribedAt', $res->json('subscribers.0'));
        $this->assertArrayHasKey('social', $res->json('contactPage'));
        $this->assertSame([], $res->json('contactPage.social'));
    }
}
