<?php

namespace Tests\Feature;

use App\Models\EmailBlast;
use App\Models\Report;
use App\Models\Subscriber;
use App\Models\User;
use App\Services\MicrosoftGraphMailer;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmailBlastSendTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RbacSeeder::class);
        $this->admin = User::where('email', 'e.dagal@regis.ph')->firstOrFail();
        Sanctum::actingAs($this->admin, ['cms']);
        config()->set('app.frontend_url', 'https://regis.ph');
        config()->set('app.url', 'https://api.regis.ph');
    }

    /** Graph credentials present, every call answered: sign-in, then 202s. */
    private function graphOn(array $graphResponses = []): void
    {
        config()->set('services.graph', [
            'tenant' => 'tenant-id', 'client_id' => 'client-id', 'client_secret' => 'secret',
            'sender_domain' => 'regis.ph', 'batch_size' => 500, 'attachment_max_bytes' => 3 * 1024 * 1024,
        ]);
        $this->app->forgetInstance(MicrosoftGraphMailer::class);

        Http::fake([
            'login.microsoftonline.com/*' => Http::response(['access_token' => 'tok', 'expires_in' => 3600]),
            'graph.microsoft.com/*' => $graphResponses === []
                ? Http::response('', 202, ['request-id' => 'req-1'])
                : Http::sequence($graphResponses),
        ]);
    }

    private function report(array $over = []): Report
    {
        return Report::create($over + [
            'title' => 'PSEi Strategy <script>alert(1)</script>',
            'category' => 'Banks',
            'analyst' => 'Paolo Gabriel D. Garcia',
            'date' => '2026-09-01',
            'pages' => 12,
            'summary' => 'Quarterly view.',
            'file_name' => 'psei.pdf',
            'file_size' => 1000,
        ]);
    }

    private function blast(array $over = []): EmailBlast
    {
        return EmailBlast::create($over + [
            'kind' => 'report',
            'subject' => 'REGIS Research: PSEi',
            'html_body' => '<p>Dear client, our latest view is below.</p>',
            'report_id' => $this->report()->id,
            'external_link' => 'https://javatar.jefferies.com/report/123',
            'recipients' => [
                ['email' => 'k.villaruel@arqcapital.ph', 'name' => 'Katrina', 'userId' => '1', 'source' => 'client'],
                ['email' => 'mdizon@lakefieldam.com', 'name' => 'Miguel', 'userId' => '2', 'source' => 'client'],
                ['email' => 'sub@example.com', 'name' => null, 'userId' => null, 'source' => 'subscriber'],
            ],
            'recipients_foreign' => [
                ['email' => 'nyc@foreignfund.com', 'name' => 'NYC desk', 'userId' => null, 'source' => 'client'],
                // Already on the Local leg: dropped so nobody gets the mail twice.
                ['email' => 'K.Villaruel@arqcapital.ph', 'name' => 'Dup', 'userId' => '1', 'source' => 'client'],
            ],
            'status' => 'ready',
        ]);
    }

    /** @return array<int, array> the JSON bodies of every sendMail call, in order */
    private function sentMessages(): array
    {
        return collect(Http::recorded(fn (ClientRequest $r) => str_contains($r->url(), '/sendMail')))
            ->map(fn (array $pair) => $pair[0]->data()['message'])
            ->values()
            ->all();
    }

    public function test_send_is_refused_until_graph_is_configured(): void
    {
        config()->set('services.graph.client_secret', null);
        $blast = $this->blast();

        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Server-side sending is not configured yet. Use the Outlook hand-off.');

        $this->assertSame('ready', $blast->fresh()->status);
    }

    public function test_send_batches_by_variant_and_logs_every_delivery(): void
    {
        $this->graphOn();
        Subscriber::create(['email' => 'sub@example.com', 'joined' => '2026-01-01', 'verified' => true]);
        $blast = $this->blast();

        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertOk();

        // The queue runs synchronously under test, so the job has already finished.
        $blast->refresh();
        $this->assertSame('sent', $blast->status);
        $this->assertSame('graph', $blast->channel);
        $this->assertSame('e.dagal@regis.ph', $blast->sender_outlook);
        $this->assertSame(4, $blast->sent_count);
        $this->assertSame(0, $blast->failed_count);

        $deliveries = $blast->deliveries()->orderBy('id')->get();
        $this->assertSame(
            [['local', 'bcc', 2], ['local', 'direct', 1], ['foreign', 'bcc', 1]],
            $deliveries->map(fn ($d) => [$d->variant, $d->envelope, $d->recipient_count])->all(),
        );
        $this->assertTrue($deliveries->every(fn ($d) => $d->status === 'sent' && $d->graph_request_id === 'req-1'));

        Http::assertSent(fn (ClientRequest $r) => str_contains($r->url(), '/users/e.dagal%40regis.ph/sendMail'));
        [$localBcc, $direct, $foreign] = $this->sentMessages();

        // Local BCC leg: sender to self, clients hidden from each other, portal deep link, escaped title.
        $this->assertSame('e.dagal@regis.ph', $localBcc['toRecipients'][0]['emailAddress']['address']);
        $this->assertCount(2, $localBcc['bccRecipients']);
        $this->assertStringContainsString('https://regis.ph/portal?report=', $localBcc['body']['content']);
        $this->assertStringContainsString('&lt;script&gt;', $localBcc['body']['content']);
        $this->assertStringNotContainsString('<script>', $localBcc['body']['content']);
        $this->assertSame('REGIS Research: PSEi', $localBcc['subject']);

        // Subscriber leg: a direct message carrying that subscriber's own unsubscribe link.
        $this->assertSame('sub@example.com', $direct['toRecipients'][0]['emailAddress']['address']);
        $this->assertArrayNotHasKey('bccRecipients', $direct);
        $token = Subscriber::where('email', 'sub@example.com')->value('unsubscribe_token');
        $this->assertNotEmpty($token);
        $this->assertStringContainsString("https://api.regis.ph/api/newsletter/unsubscribe/{$token}", $direct['body']['content']);

        // Foreign leg: Jefferies link instead of the portal.
        $this->assertSame('nyc@foreignfund.com', $foreign['bccRecipients'][0]['emailAddress']['address']);
        $this->assertStringContainsString('https://javatar.jefferies.com/report/123', $foreign['body']['content']);
        $this->assertStringNotContainsString('/portal?report=', $foreign['body']['content']);
    }

    public function test_a_blast_cannot_be_queued_twice(): void
    {
        $this->graphOn();
        $blast = $this->blast();

        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertOk();
        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertStatus(422);

        $blast->forceFill(['status' => 'queued'])->save();
        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertStatus(409);
        $this->putJson("/api/cms/email-blasts/{$blast->id}", ['subject' => 'Changed'])->assertStatus(422);
        $this->deleteJson("/api/cms/email-blasts/{$blast->id}")->assertStatus(409);
    }

    public function test_failed_batches_are_recorded_and_can_be_retried_alone(): void
    {
        $this->graphOn([
            Http::response('', 202, ['request-id' => 'ok-1']),
            Http::response(['error' => ['code' => 'ErrorInvalidRecipients', 'message' => 'Bad recipient']], 400),
            Http::response('', 202, ['request-id' => 'ok-2']),
        ]);
        Subscriber::create(['email' => 'sub@example.com', 'joined' => '2026-01-01', 'verified' => true]);
        $blast = $this->blast(['recipients_foreign' => null]);

        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertOk();

        $blast->refresh();
        $this->assertSame('failed', $blast->status);
        $this->assertSame(2, $blast->sent_count);
        $this->assertSame(1, $blast->failed_count);
        $this->assertStringContainsString('Bad recipient', (string) $blast->send_error);
        $this->assertSame(['sent', 'failed'], $blast->deliveries()->orderBy('id')->pluck('status')->all());

        // Content is frozen, but the failed batch can go again — and only it.
        $this->putJson("/api/cms/email-blasts/{$blast->id}", ['subject' => 'Changed'])->assertStatus(422);
        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")->assertOk();

        $blast->refresh();
        $this->assertSame('sent', $blast->status);
        $this->assertSame(3, $blast->sent_count);
        $this->assertSame(0, $blast->failed_count);
        $this->assertNull($blast->send_error);
        $this->assertCount(3, $this->sentMessages());
    }

    public function test_foreign_recipients_need_the_external_link(): void
    {
        $this->graphOn();
        $blast = $this->blast(['external_link' => null]);

        $this->postJson("/api/cms/email-blasts/{$blast->id}/send")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Foreign recipients need the external (Jefferies) link before this can go out.');
    }

    public function test_report_pdf_is_attached_within_the_graph_limit_and_refused_beyond_it(): void
    {
        $this->graphOn();
        Storage::fake('local');
        Storage::put('reports/small.pdf', '%PDF-1.4 small');
        Storage::put('reports/large.pdf', str_repeat('x', 4 * 1024 * 1024));

        $large = $this->blast(['attach_report' => true, 'recipients_foreign' => null]);
        $large->report->forceFill(['file_path' => 'reports/large.pdf'])->save();
        $this->postJson("/api/cms/email-blasts/{$large->id}/send")->assertStatus(422);
        $this->assertStringContainsString('capped at 3 MB', $this->postJson("/api/cms/email-blasts/{$large->id}/send")->json('message'));

        $small = $this->blast(['attach_report' => true, 'recipients_foreign' => null]);
        $small->report->forceFill(['file_path' => 'reports/small.pdf'])->save();
        $this->postJson("/api/cms/email-blasts/{$small->id}/send")->assertOk();

        [$message] = $this->sentMessages();
        $this->assertSame('#microsoft.graph.fileAttachment', $message['attachments'][0]['@odata.type']);
        $this->assertSame('psei.pdf', $message['attachments'][0]['name']);
        $this->assertSame(base64_encode('%PDF-1.4 small'), $message['attachments'][0]['contentBytes']);
    }

    public function test_render_returns_the_escaped_mailer_for_either_variant(): void
    {
        $report = $this->report();
        $payload = [
            'kind' => 'report',
            'subject' => 'Preview',
            'htmlBody' => '<p>Body copy <b>kept</b></p><script>alert(2)</script>',
            'reportId' => $report->id,
            'externalLink' => 'https://javatar.jefferies.com/report/9',
        ];

        $local = $this->postJson('/api/cms/email-blasts/render', $payload + ['variant' => 'local'])->assertOk()->json('html');
        $this->assertStringContainsString('&lt;script&gt;alert(1)', $local);
        $this->assertStringNotContainsString('alert(2)', $local);
        $this->assertStringContainsString('<b>kept</b>', $local);
        $this->assertStringContainsString("https://regis.ph/portal?report={$report->id}", $local);
        $this->assertStringContainsString('Banks', $local);

        $foreign = $this->postJson('/api/cms/email-blasts/render', $payload + ['variant' => 'foreign'])->assertOk()->json('html');
        $this->assertStringContainsString('https://javatar.jefferies.com/report/9', $foreign);
        $this->assertStringNotContainsString('/portal?report=', $foreign);
    }

    public function test_stored_fragments_are_sanitized_but_newsletter_documents_pass_through(): void
    {
        $fragment = $this->postJson('/api/cms/email-blasts', [
            'kind' => 'adhoc', 'subject' => 'Note',
            'htmlBody' => '<p onclick="x()">Hello</p><script>bad()</script>',
            'recipients' => [['email' => 'a@b.co', 'source' => 'manual']],
        ])->assertCreated()->json('item.htmlBody');
        $this->assertStringNotContainsString('script', $fragment);
        $this->assertStringNotContainsString('onclick', $fragment);
        $this->assertStringContainsString('Hello', $fragment);

        $doc = '<!doctype html><html><body><table style="width:800px"><tr><td>Issue</td></tr></table></body></html>';
        $stored = $this->postJson('/api/cms/email-blasts', [
            'kind' => 'newsletter', 'subject' => 'Issue', 'htmlBody' => $doc,
            'recipients' => [['email' => 'a@b.co', 'source' => 'subscriber']],
        ])->assertCreated()->json('item.htmlBody');
        $this->assertSame($doc, $stored);
    }

    public function test_marking_sent_by_hand_records_the_outlook_channel(): void
    {
        $blast = $this->blast();

        $this->postJson("/api/cms/email-blasts/{$blast->id}/sent")
            ->assertOk()
            ->assertJsonPath('item.status', 'sent')
            ->assertJsonPath('item.channel', 'outlook')
            ->assertJsonPath('item.sentCount', 5)
            ->assertJsonPath('item.sentByName', $this->admin->name);
    }

    public function test_unsubscribe_link_drops_the_subscriber_from_the_pool(): void
    {
        $subscriber = Subscriber::create(['email' => 'sub@example.com', 'joined' => '2026-01-01', 'verified' => true]);
        $url = $subscriber->unsubscribeUrl();
        $path = parse_url($url, PHP_URL_PATH);

        $this->get($path)->assertOk()->assertSee('You have been unsubscribed.')->assertSee('sub@example.com');
        $this->assertFalse($subscriber->fresh()->verified);
        $this->assertNotNull($subscriber->fresh()->unsubscribed_at);

        $this->get($path)->assertOk()->assertSee('You are already unsubscribed.');
        $this->get('/api/newsletter/unsubscribe/not-a-real-token')->assertNotFound();

        $this->getJson('/api/cms/email-blasts/audience')->assertOk()->assertJsonCount(0, 'subscribers');
    }
}
