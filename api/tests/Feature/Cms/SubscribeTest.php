<?php

namespace Tests\Feature\Cms;

use App\Http\Controllers\Api\NewsletterSubscribeController;
use App\Models\Subscriber;
use App\Services\MicrosoftGraphMailer;
use Mockery;

/**
 * The public double opt-in: subscribe files an unverified row and mails a
 * confirmation; the link flips verified; unsubscribe clears it again.
 */
class SubscribeTest extends CmsTestCase
{
    /** A Graph mailer that records the one confirmation it is asked to send. */
    private function mailerOn(?array &$captured): void
    {
        // Partial: the real config-reading helpers (senderFor, batchSize, …) keep
        // working for any other endpoint the test touches; only the wire is faked.
        $mailer = Mockery::mock(MicrosoftGraphMailer::class, [[
            'tenant' => 't', 'client_id' => 'c', 'client_secret' => 's',
            'sender' => 'noreply@regis.ph', 'sender_domain' => 'regis.ph', 'batch_size' => 500, 'attachment_max_bytes' => 3145728,
        ]])->makePartial();
        $mailer->shouldReceive('send')->once()
            ->withArgs(function (string $sender, array $message) use (&$captured) {
                $captured = ['sender' => $sender, 'message' => $message];

                return $sender === 'noreply@regis.ph';
            })
            ->andReturn('req-1');
        $this->app->instance(MicrosoftGraphMailer::class, $mailer);
    }

    public function test_subscribe_files_an_unverified_row_and_mails_the_confirmation(): void
    {
        $this->mailerOn($captured);

        $this->postJson('/api/newsletter/subscribe', ['email' => 'New.Reader@Example.com', 'name' => 'Lakefield AM'])
            ->assertOk()->assertJsonPath('ok', true)->assertJsonPath('message', NewsletterSubscribeController::NEUTRAL);

        $sub = Subscriber::where('email', 'new.reader@example.com')->firstOrFail();
        $this->assertFalse($sub->verified);
        $this->assertSame('public', $sub->source);
        $this->assertSame('Lakefield AM', $sub->firm);
        $this->assertNotEmpty($sub->verify_token);
        $this->assertNull($sub->verified_at);

        $this->assertSame('new.reader@example.com', $captured['message']['toRecipients'][0]['emailAddress']['address']);
        $this->assertStringContainsString("https://regis.ph/newsletter/verify/{$sub->verify_token}", $captured['message']['body']['content']);
        $this->assertDatabaseHas('audit_entries', ['action' => 'Subscriber signed up', 'target' => 'new.reader@example.com']);

        // Verify: flips the flag, records when, and the wire carries both.
        $this->getJson("/api/newsletter/verify/{$sub->verify_token}")->assertOk()
            ->assertJsonPath('ok', true)->assertJsonPath('email', 'new.reader@example.com');
        $sub->refresh();
        $this->assertTrue($sub->verified);
        $this->assertNotNull($sub->verified_at);
        $this->assertNotNull($sub->toWire()['verifiedAt']);
        $this->assertDatabaseHas('audit_entries', ['action' => 'Subscriber confirmed']);

        // Idempotent, and a bad token is a 404.
        $this->getJson("/api/newsletter/verify/{$sub->verify_token}")->assertOk();
        $this->getJson('/api/newsletter/verify/not-a-token')->assertNotFound();

        // Now in the desk's pool.
        $this->actingAsStaff('Analyst');
        $this->getJson('/api/cms/email-blasts/audience')->assertOk()->assertJsonCount(1, 'subscribers');
    }

    public function test_unsubscribe_clears_verified_and_resubscribe_reactivates_through_a_fresh_token(): void
    {
        $sub = Subscriber::create(['email' => 'reader@example.com', 'joined' => '2026-01-01', 'verified' => true, 'source' => 'cms']);
        $path = parse_url($sub->unsubscribeUrl(), PHP_URL_PATH);

        $this->get($path)->assertOk();
        $sub->refresh();
        $this->assertFalse($sub->verified);
        $this->assertNotNull($sub->unsubscribed_at);

        $this->mailerOn($captured);
        $this->postJson('/api/newsletter/subscribe', ['email' => 'reader@example.com'])->assertOk();
        $sub->refresh();
        $this->assertFalse($sub->verified);
        $this->assertNotEmpty($sub->verify_token);
        $this->assertSame(1, Subscriber::count());

        $this->getJson("/api/newsletter/verify/{$sub->verify_token}")->assertOk();
        $sub->refresh();
        $this->assertTrue($sub->verified);
        $this->assertNull($sub->unsubscribed_at);
    }

    public function test_subscribe_is_neutral_for_known_addresses_and_survives_graph_being_off(): void
    {
        Subscriber::create(['email' => 'known@example.com', 'joined' => '2026-01-01', 'verified' => true]);

        // Graph is blanked by phpunit.xml: no mail, still 200, row still filed.
        $this->postJson('/api/newsletter/subscribe', ['email' => 'known@example.com'])
            ->assertOk()->assertJsonPath('message', NewsletterSubscribeController::NEUTRAL);
        $this->postJson('/api/newsletter/subscribe', ['email' => 'fresh@example.com'])
            ->assertOk()->assertJsonPath('message', NewsletterSubscribeController::NEUTRAL);
        $this->assertFalse(Subscriber::where('email', 'fresh@example.com')->value('verified'));
        $this->assertTrue(Subscriber::where('email', 'known@example.com')->value('verified'));

        $this->postJson('/api/newsletter/subscribe', ['email' => 'not-an-email'])->assertStatus(422);
    }
}
