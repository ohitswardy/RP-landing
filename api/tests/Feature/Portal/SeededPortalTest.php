<?php

namespace Tests\Feature\Portal;

use App\Models\Report;
use App\Models\User;
use Database\Seeders\ContentSeeder;
use Illuminate\Support\Facades\Storage;

/**
 * `migrate --seed` leaves a portal that works: one approved demo client who
 * can sign in, and a seeded catalog whose PDFs stream from the API.
 */
class SeededPortalTest extends PortalTestCase
{
    public function test_seeded_demo_client_signs_in_and_streams_a_seeded_report(): void
    {
        Storage::fake();
        $this->seed(ContentSeeder::class);

        $demo = User::where('email', ContentSeeder::DEMO_CLIENT_EMAIL)->where('kind', User::KIND_CLIENT)->firstOrFail();
        $this->assertSame(User::STATUS_APPROVED, $demo->status);
        $this->assertSame(ContentSeeder::DEMO_CLIENT_USERNAME, $demo->username);
        $this->assertFalse($demo->hasCoverageFilter(), 'empty prefs mean the whole catalog');

        $token = $this->postJson('/api/portal/login', ['identity' => 'rp-demo-0001', 'password' => ContentSeeder::DEMO_CLIENT_PASSWORD])
            ->assertOk()->assertJsonPath('client.username', 'RP-DEMO-0001')->json('token');

        $catalog = $this->withToken($token)->getJson('/api/portal/reports')->assertOk()->json('reports');
        $this->assertSame(Report::count(), count($catalog));

        // Every seeded report carries a private-disk copy of the sample PDF and no public URL.
        $this->assertSame(0, Report::whereNull('file_path')->count());
        $this->assertSame(0, Report::whereNotNull('file_url')->count());
        foreach (Report::all() as $report) {
            $this->assertTrue(Storage::exists($report->file_path), $report->file_path);
        }

        $first = Report::orderBy('id')->first();
        $this->withToken($token)->get("/api/reports/{$first->id}/file")
            ->assertOk()->assertHeader('content-type', 'application/pdf');
    }
}
