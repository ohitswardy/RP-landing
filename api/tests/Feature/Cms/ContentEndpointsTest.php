<?php

namespace Tests\Feature\Cms;

use App\Models\Article;
use App\Models\CareerPost;
use App\Models\ServiceLine;
use App\Models\StaffMember;
use App\Models\WatchSymbol;
use App\Support\ContactDefaults;
use Illuminate\Support\Facades\Cache;

/**
 * The public read models added for the landing site: readable insight
 * notes, the search index, the ribbon watchlist, open careers, and the
 * contact page's social links.
 */
class ContentEndpointsTest extends CmsTestCase
{
    private function note(array $over = []): Article
    {
        static $n = 0;
        $n++;

        return Article::create($over + [
            'tag' => 'Banks', 'title' => "Note $n", 'slug' => "note-$n", 'author' => 'A',
            'date' => '2026-09-0'.min(9, $n), 'status' => 'published', 'reads' => 0,
            'excerpt' => "Excerpt $n", 'body' => "<p>Body $n</p>",
        ]);
    }

    public function test_a_published_note_is_readable_by_slug_with_related_notes_but_a_draft_is_404(): void
    {
        $lead = $this->note(['slug' => 'bdo-2q', 'tag' => 'Banks', 'date' => '2026-09-09']);
        $sameTag = $this->note(['tag' => 'Banks', 'date' => '2026-09-08']);
        $this->note(['tag' => 'Property', 'date' => '2026-09-07']);
        $this->note(['tag' => 'Property', 'date' => '2026-09-06']);
        $this->note(['tag' => 'Property', 'date' => '2026-09-05']);
        $draft = $this->note(['slug' => 'draft-note', 'status' => 'review']);

        $res = $this->getJson('/api/content/insights/bdo-2q')->assertOk()
            ->assertJsonPath('article.slug', 'bdo-2q')
            ->assertJsonPath('article.title', $lead->title)
            ->assertJsonPath('article.body', '<p>Body 1</p>')
            ->assertJsonCount(3, 'related')
            ->assertJsonPath('related.0.id', (string) $sameTag->id);
        $this->assertArrayNotHasKey('body', $res->json('related.0'));
        $this->assertNotContains($draft->slug, array_column($res->json('related'), 'slug'));

        $this->getJson('/api/content/insights/draft-note')->assertNotFound();
        $this->getJson('/api/content/insights/no-such-note')->assertNotFound();

        // The list carries slugs, no bodies, and no drafts.
        $list = $this->getJson('/api/content/insights')->assertOk();
        $this->assertSame('bdo-2q', $list->json('articles.0.slug'));
        $this->assertArrayNotHasKey('body', $list->json('articles.0'));
        $this->assertNotContains('draft-note', array_column($list->json('articles'), 'slug'));
    }

    public function test_the_cms_generates_unique_slugs_and_sanitizes_bodies(): void
    {
        $this->actingAsStaff('Editor');

        $first = $this->postJson('/api/cms/articles', [
            'tag' => 'Banks', 'title' => 'BDO: 2Q results!', 'author' => 'A', 'status' => 'published',
            'body' => '<h2>Heading</h2><p onclick="x()">Body</p><script>bad()</script>',
        ])->assertCreated();
        $first->assertJsonPath('item.slug', 'bdo-2q-results')
            ->assertJsonPath('item.body', '<h2>Heading</h2><p>Body</p>');
        $this->assertArrayHasKey('audit', $first->json());

        $second = $this->postJson('/api/cms/articles', [
            'tag' => 'Banks', 'title' => 'BDO 2Q results', 'author' => 'A', 'status' => 'review',
        ])->assertCreated();
        $second->assertJsonPath('item.slug', 'bdo-2q-results-2');

        // Renaming keeps the slug; typing a new one changes it (and stays unique).
        $this->putJson('/api/cms/articles/'.$second->json('item.id'), ['title' => 'Renamed'])
            ->assertOk()->assertJsonPath('item.slug', 'bdo-2q-results-2');
        // A wanted slug another note holds gets the suffix; the note's own suffix does not count as taken.
        $this->putJson('/api/cms/articles/'.$second->json('item.id'), ['slug' => 'bdo-2q-results'])
            ->assertOk()->assertJsonPath('item.slug', 'bdo-2q-results-2');
        $this->putJson('/api/cms/articles/'.$second->json('item.id'), ['slug' => 'fresh-slug'])
            ->assertOk()->assertJsonPath('item.slug', 'fresh-slug');
        $this->putJson('/api/cms/articles/'.$second->json('item.id'), ['slug' => 'Not A Slug'])
            ->assertStatus(422);
    }

    public function test_search_index_lists_only_visible_rows_and_is_cached(): void
    {
        Cache::flush();
        // The staff_members migration backfills the legacy roster; hide it so only ours count.
        StaffMember::query()->update(['visible' => false]);
        StaffMember::create(['name' => 'Ana Cruz', 'roles' => ['Head of Research'], 'bio' => [], 'sectors' => ['Banks'], 'team' => 'Research', 'visible' => true, 'position' => 0]);
        StaffMember::create(['name' => 'Hidden Person', 'roles' => ['Analyst'], 'bio' => [], 'sectors' => [], 'team' => 'Research', 'visible' => false, 'position' => 1]);
        ServiceLine::create(['slug' => 'research', 'title' => 'Research Advisory', 'dek' => 'Conviction-led research.', 'live' => true, 'position' => 0]);
        ServiceLine::create(['slug' => 'dark', 'title' => 'Unpublished', 'dek' => '', 'live' => false, 'position' => 1]);
        $this->note(['slug' => 'live-note']);
        $this->note(['slug' => 'draft-note', 'status' => 'review']);

        $res = $this->getJson('/api/content/search')->assertOk();
        $res->assertJsonCount(1, 'people')
            ->assertJsonPath('people.0.name', 'Ana Cruz')
            ->assertJsonPath('people.0.role', 'Head of Research')
            ->assertJsonPath('people.0.team', 'Research')
            ->assertJsonPath('people.0.anchor', '/about#ana-cruz')
            ->assertJsonCount(1, 'services')
            ->assertJsonPath('services.0.slug', 'research')
            ->assertJsonPath('services.0.summary', 'Conviction-led research.')
            ->assertJsonCount(1, 'insights')
            ->assertJsonPath('insights.0.slug', 'live-note')
            ->assertJsonPath('insights.0.tag', 'Banks');
        $this->assertContains('/insights', array_column($res->json('pages'), 'path'));

        // Cached: a note published now does not appear until the minute is up.
        $this->note(['slug' => 'later-note']);
        $this->getJson('/api/content/search')->assertOk()->assertJsonCount(1, 'insights');
        Cache::flush();
        $this->getJson('/api/content/search')->assertOk()->assertJsonCount(2, 'insights');
    }

    public function test_watchlist_is_public_in_ribbon_order_and_mutations_audit(): void
    {
        WatchSymbol::create(['sym' => 'ALI', 'name' => 'Ayala Land', 'pinned' => false, 'position' => 0]);
        WatchSymbol::create(['sym' => 'BDO', 'name' => 'BDO Unibank', 'pinned' => true, 'position' => 1]);

        $this->getJson('/api/content/watchlist')->assertOk()
            ->assertJsonCount(2, 'symbols')
            ->assertJsonPath('symbols.0.sym', 'BDO')
            ->assertJsonPath('symbols.0.pinned', true)
            ->assertJsonPath('symbols.1.sym', 'ALI');

        $this->actingAsStaff('Editor');
        $created = $this->postJson('/api/cms/watchlist', ['sym' => 'SM'])->assertCreated();
        $this->assertArrayHasKey('audit', $created->json());
        $this->putJson('/api/cms/watchlist/'.$created->json('item.id'), ['pinned' => true])
            ->assertOk()->assertJsonPath('item.pinned', true)->assertJsonPath('audit.action', 'Pinned ribbon symbol');
        $this->putJson('/api/cms/watchlist/reorder', ['ids' => [(int) $created->json('item.id'), 1, 2]])
            ->assertOk()->assertJsonPath('items.0.sym', 'SM')->assertJsonPath('audit.action', 'Reordered ribbon symbols');
        $this->deleteJson('/api/cms/watchlist/'.$created->json('item.id'))->assertOk()->assertJsonPath('audit.action', 'Removed ribbon symbol');
    }

    public function test_careers_lists_open_postings_newest_first(): void
    {
        CareerPost::create(['title' => 'Old', 'dept' => 'Research', 'type' => 'Full-time', 'location' => 'Makati', 'posted' => '2026-08-01', 'status' => 'open', 'applicants' => 0]);
        CareerPost::create(['title' => 'New', 'dept' => 'Sales', 'type' => 'Contract', 'location' => 'Makati', 'posted' => '2026-09-01', 'status' => 'open', 'applicants' => 0, 'summary' => 'Sell.', 'body' => '<p>Details</p>']);
        CareerPost::create(['title' => 'Closed', 'dept' => 'Sales', 'type' => 'Contract', 'location' => 'Makati', 'posted' => '2026-09-10', 'status' => 'closed', 'applicants' => 0]);

        $this->getJson('/api/content/careers')->assertOk()
            ->assertJsonCount(2, 'careers')
            ->assertJsonPath('careers.0.title', 'New')
            ->assertJsonPath('careers.0.summary', 'Sell.')
            ->assertJsonPath('careers.0.body', '<p>Details</p>')
            ->assertJsonPath('careers.1.title', 'Old');

        $this->actingAsStaff('Editor');
        $created = $this->postJson('/api/cms/careers', [
            'title' => 'Associate', 'dept' => 'Research', 'type' => 'Full-time', 'location' => 'Makati',
            'summary' => 'Cover property.', 'body' => '<p>Real</p><script>x()</script>',
        ])->assertCreated();
        $created->assertJsonPath('item.summary', 'Cover property.')->assertJsonPath('item.body', '<p>Real</p>');
        $this->assertArrayHasKey('audit', $created->json());
        $this->putJson('/api/cms/careers/'.$created->json('item.id'), ['status' => 'closed'])
            ->assertOk()->assertJsonPath('audit.action', 'Closed posting');
        $this->getJson('/api/content/careers')->assertOk()->assertJsonCount(2, 'careers');
    }

    public function test_contact_page_social_links_round_trip_and_default_empty(): void
    {
        $this->getJson('/api/content/contact')->assertOk()->assertJsonPath('copy.social', []);

        $this->actingAsStaff('Editor');
        $doc = ContactDefaults::content();
        $doc['social'] = [
            ['label' => 'LinkedIn', 'href' => 'https://www.linkedin.com/company/regis-partners'],
            ['label' => 'Email', 'href' => 'mailto:info@regis.ph'],
        ];
        $this->putJson('/api/cms/contact-page', $doc)->assertOk()
            ->assertJsonPath('item.social.0.label', 'LinkedIn')
            ->assertJsonCount(2, 'item.social');

        $this->getJson('/api/content/contact')->assertOk()
            ->assertJsonPath('copy.social.1.href', 'mailto:info@regis.ph');

        // A document saved without the key (older CMS build) still validates and clears the list.
        unset($doc['social']);
        $this->putJson('/api/cms/contact-page', $doc)->assertOk()->assertJsonPath('item.social', []);

        $doc['social'] = [['label' => 'Bad', 'href' => 'javascript:alert(1)']];
        $this->putJson('/api/cms/contact-page', $doc)->assertStatus(422);
    }
}
