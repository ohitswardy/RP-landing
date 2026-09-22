<?php

namespace Tests\Feature\Portal;

use App\Models\PortalSetting;
use App\Support\Trending;

/**
 * Trending Content ranks straight off the ledger under the singleton rules
 * the CMS edits: metric, trailing window, slot count, minimum events.
 */
class TrendingTest extends PortalTestCase
{
    /** Post $n beacons of $event against $report from $client. */
    private function beacons($client, $report, string $event, int $n): void
    {
        for ($i = 0; $i < $n; $i++) {
            $this->actingAs($client)->postJson('/api/portal/activity', ['event' => $event, 'reportId' => $report->id])->assertCreated();
        }
    }

    public function test_rank_honours_metric_limit_min_events_and_window(): void
    {
        $a = $this->report();
        $b = $this->report();
        $c = $this->report();
        $client = $this->client();

        // Four months back: a burst on C that only "all time" should count.
        $this->travel(-4)->months();
        $this->beacons($client, $c, 'view', 5);
        $this->travelBack();

        $this->beacons($client, $a, 'view', 4);
        $this->beacons($client, $b, 'view', 1);
        $this->beacons($client, $b, 'download', 2);
        $this->beacons($client, $c, 'download', 1);
        // Clicks never count toward any metric.
        $this->beacons($client, $a, 'click', 4);

        $rules = ['metric' => 'views', 'windowMonths' => 3, 'limit' => 3, 'minEvents' => 1];
        $this->assertSame([
            ['reportId' => (string) $a->id, 'count' => 4],
            ['reportId' => (string) $b->id, 'count' => 1],
        ], Trending::rank($rules));

        $this->assertSame(
            [['reportId' => (string) $a->id, 'count' => 4]],
            Trending::rank(['metric' => 'views', 'windowMonths' => 3, 'limit' => 1, 'minEvents' => 1]),
        );
        $this->assertSame(
            [['reportId' => (string) $a->id, 'count' => 4]],
            Trending::rank(['metric' => 'views', 'windowMonths' => 3, 'limit' => 3, 'minEvents' => 2]),
        );

        // Downloads only.
        $downloads = Trending::rank(['metric' => 'downloads', 'windowMonths' => 3, 'limit' => 3, 'minEvents' => 1]);
        $this->assertSame([
            ['reportId' => (string) $b->id, 'count' => 2],
            ['reportId' => (string) $c->id, 'count' => 1],
        ], $downloads);

        // Engagement = views + downloads.
        $engagement = Trending::rank(['metric' => 'engagement', 'windowMonths' => 3, 'limit' => 3, 'minEvents' => 1]);
        $this->assertSame([
            ['reportId' => (string) $a->id, 'count' => 4],
            ['reportId' => (string) $b->id, 'count' => 3],
            ['reportId' => (string) $c->id, 'count' => 1],
        ], $engagement);

        // All time (window 0) lets the old burst on C back in, on top.
        $allTime = Trending::rank(['metric' => 'views', 'windowMonths' => 0, 'limit' => 3, 'minEvents' => 1]);
        $this->assertSame([(string) $c->id, (string) $a->id, (string) $b->id], array_column($allTime, 'reportId'));
        $this->assertSame(5, $allTime[0]['count']);
    }

    public function test_portal_serves_the_ranking_under_the_rules_the_cms_saved(): void
    {
        $a = $this->report(['category' => 'Banks']);
        $b = $this->report(['category' => 'Power']);
        $client = $this->client();
        $this->beacons($client, $a, 'view', 2);
        $this->beacons($client, $b, 'download', 3);

        // Defaults: views, trailing 3 months, top 3, 1+ events.
        $this->assertSame(['enabled' => true, 'metric' => 'views', 'windowMonths' => 3, 'limit' => 3, 'minEvents' => 1], PortalSetting::current()->trendingToWire());
        $this->actingAs($client)->getJson('/api/portal/reports')->assertOk()
            ->assertJsonPath('trending.metric', 'views')
            ->assertJsonPath('trending.entries.0.reportId', (string) $a->id)
            ->assertJsonCount(1, 'trending.entries');

        $admin = $this->staff('Administrator');
        $this->actingAs($admin)->putJson('/api/cms/trending', ['enabled' => true, 'metric' => 'downloads', 'windowMonths' => 1, 'limit' => 2, 'minEvents' => 2])
            ->assertOk()->assertJsonPath('item.metric', 'downloads')->assertJsonPath('audit.action', 'Updated trending rules');
        $this->assertDatabaseCount('portal_settings', 1);

        $this->actingAs($client)->getJson('/api/portal/reports')->assertOk()
            ->assertJsonPath('trending.metric', 'downloads')
            ->assertJsonPath('trending.windowMonths', 1)
            ->assertJsonPath('trending.entries', [['reportId' => (string) $b->id, 'count' => 3]]);

        // The CMS preview is the same ranking, dry-run.
        $this->actingAs($admin)->getJson('/api/cms/trending/preview?metric=views&windowMonths=3&limit=3&minEvents=1')
            ->assertOk()->assertJsonPath('entries.0.reportId', (string) $a->id);

        // A restricted client never sees a hidden report rank, and a switched-off ladder is empty.
        $restricted = $this->client(['sector_prefs' => ['Banks']]);
        $this->actingAs($restricted)->getJson('/api/portal/reports')->assertOk()->assertJsonPath('trending.entries', []);

        $this->actingAs($admin)->putJson('/api/cms/trending', ['enabled' => false, 'metric' => 'downloads', 'windowMonths' => 1, 'limit' => 2, 'minEvents' => 1])->assertOk();
        $this->actingAs($client)->getJson('/api/portal/reports')->assertOk()->assertJsonPath('trending.entries', []);
    }
}
