<?php

namespace Tests\Feature\Cms;

use App\Jobs\SendEmailBlast;
use App\Models\EmailBlast;
use App\Models\Report;
use App\Services\MicrosoftGraphMailer;
use App\Support\QueueHealth;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

/**
 * "Send now" refuses to queue a blast into a queue nobody is working,
 * unless the desk confirms; the readiness strip says which it is.
 */
class QueueGuardTest extends CmsTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->actingAsStaff('Administrator', ['outlook_email' => 'desk@regis.ph']);
        // Graph "configured": the mailer object is real but never reached, the queue is faked.
        config()->set('services.graph', [
            'tenant' => 't', 'client_id' => 'c', 'client_secret' => 's',
            'sender_domain' => 'regis.ph', 'batch_size' => 500, 'attachment_max_bytes' => 3 * 1024 * 1024,
        ]);
        $this->app->forgetInstance(MicrosoftGraphMailer::class);
        Queue::fake();
    }

    private function blast(): EmailBlast
    {
        $report = Report::create(['title' => 'PSEi', 'category' => 'Banks', 'analyst' => 'A', 'date' => '2026-09-01', 'pages' => 1, 'summary' => 's', 'file_name' => 'a.pdf', 'file_size' => 1]);

        return EmailBlast::create([
            'kind' => 'adhoc', 'subject' => 'Note', 'html_body' => '<p>Hi</p>', 'report_id' => $report->id,
            'recipients' => [['email' => 'a@b.co', 'name' => null, 'userId' => null, 'source' => 'manual']],
            'status' => 'ready',
        ]);
    }

    public function test_sync_driver_is_always_alive(): void
    {
        config()->set('queue.default', 'sync');
        $this->getJson('/api/cms/email-blasts/readiness')->assertOk()
            ->assertJsonPath('dispatch.queue.driver', 'sync')
            ->assertJsonPath('dispatch.queue.alive', true)
            ->assertJsonPath('dispatch.queue.pending', null)
            ->assertJsonPath('dispatch.queue.stale', 0)
            ->assertJsonPath('dispatch.graphReady', true);

        $this->postJson('/api/cms/email-blasts/'.$this->blast()->id.'/send')->assertOk();
        Queue::assertPushed(SendEmailBlast::class, 1);
    }

    public function test_send_is_refused_with_a_stale_heartbeat_unless_confirmed(): void
    {
        config()->set('queue.default', 'database');
        $blast = $this->blast();

        // No heartbeat at all.
        $this->getJson('/api/cms/email-blasts/audience')->assertOk()
            ->assertJsonPath('dispatch.queue.driver', 'database')
            ->assertJsonPath('dispatch.queue.alive', false)
            ->assertJsonPath('dispatch.queue.lastSeenAt', null)
            ->assertJsonPath('dispatch.queue.pending', 0);
        $res = $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertStatus(409);
        $this->assertStringStartsWith('The queue worker is not running', $res->json('message'));
        $this->assertFalse($res->json('queue.alive'));
        $this->assertSame('ready', $blast->fresh()->status);
        Queue::assertNothingPushed();

        // An old heartbeat is just as dead.
        Cache::put(QueueHealth::HEARTBEAT_KEY, now()->subMinutes(3)->toIso8601String(), 600);
        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertStatus(409);

        // Confirmed: queued anyway.
        $this->postJson("/api/cms/email-blasts/{$blast->id}/send", ['confirmNoWorker' => true])->assertOk()
            ->assertJsonPath('item.status', 'queued');
        Queue::assertPushed(SendEmailBlast::class, 1);
    }

    public function test_a_fresh_heartbeat_lets_a_blast_through_and_stale_blasts_are_counted_and_requeued(): void
    {
        config()->set('queue.default', 'database');
        QueueHealth::beat();

        $this->getJson('/api/cms/email-blasts/readiness')->assertOk()
            ->assertJsonPath('dispatch.queue.alive', true);
        $this->assertNotNull($this->getJson('/api/cms/email-blasts/readiness')->json('dispatch.queue.lastSeenAt'));

        $blast = $this->blast();
        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertOk()->assertJsonPath('item.status', 'queued');
        Queue::assertPushed(SendEmailBlast::class, 1);

        // Nothing is stale yet; age it and it is.
        $this->assertSame(0, $this->getJson('/api/cms/email-blasts/readiness')->json('dispatch.queue.stale'));
        $blast->forceFill(['queued_at' => now()->subMinutes(20)])->save();
        $this->assertSame(1, $this->getJson('/api/cms/email-blasts/readiness')->json('dispatch.queue.stale'));

        Artisan::call('blasts:requeue-stale', ['--dry-run' => true]);
        Queue::assertPushed(SendEmailBlast::class, 1);
        Artisan::call('blasts:requeue-stale');
        Queue::assertPushed(SendEmailBlast::class, 2);
        $this->assertTrue($blast->fresh()->queued_at->greaterThan(now()->subMinute()));
        $this->assertDatabaseHas('audit_entries', ['action' => 'Re-queued stale email blast', 'target' => 'Note']);
    }
}
