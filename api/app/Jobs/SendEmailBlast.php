<?php

namespace App\Jobs;

use App\Models\EmailBlast;
use App\Models\EmailDelivery;
use App\Models\Subscriber;
use App\Services\GraphMailException;
use App\Services\MicrosoftGraphMailer;
use App\Support\Audit;
use App\Support\BlastRenderer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Dispatches one blast through Graph, batch by batch, from the sender's
 * mailbox. The batches were planned when the blast was queued, so the job
 * only ever looks at pending rows: a throttled run releases itself and
 * resumes where it stopped, and a retry after failure resends only what
 * failed. Finishing flips the blast to sent (or failed, when any batch
 * did) and records the tallies.
 */
class SendEmailBlast implements ShouldQueue
{
    use Queueable;

    public int $tries = 8;

    public int $timeout = 900;

    /** Seconds to wait when Graph asks us to back off without saying how long. */
    private const BACKOFF = 60;

    public function __construct(public readonly int $blastId) {}

    public function handle(MicrosoftGraphMailer $mailer): void
    {
        $blast = EmailBlast::with(['report.company', 'sender'])->find($this->blastId);
        if (! $blast || ! $blast->isInFlight()) {
            return; // deleted, or already finished by another run
        }
        if ($blast->status !== 'sending') {
            $blast->forceFill(['status' => 'sending'])->save();
        }

        try {
            $attachment = $this->attachment($blast, $mailer);
        } catch (RuntimeException $e) {
            // Nothing can go out without the PDF the desk asked for.
            $blast->deliveries()->where('status', 'pending')->update([
                'status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 2000),
            ]);
            $this->finish($blast);

            return;
        }

        $fields = $blast->renderFields();

        foreach ($blast->deliveries()->where('status', 'pending')->orderBy('id')->get() as $delivery) {
            try {
                $requestId = $mailer->send($blast->sender_outlook, $this->message($blast, $delivery, $fields, $attachment));
            } catch (GraphMailException $e) {
                if ($e->transient && $this->attempts() < $this->tries) {
                    $this->release($e->retryAfter ?? self::BACKOFF);

                    return;
                }
                $delivery->forceFill(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 2000)])->save();

                continue;
            }

            $delivery->forceFill([
                'status' => 'sent',
                'sent_at' => now(),
                'graph_request_id' => mb_substr($requestId, 0, 64) ?: null,
            ])->save();
        }

        $this->finish($blast);
    }

    /** The worker gave up (timeout, crash): nothing pending will go out. */
    public function failed(Throwable $e): void
    {
        $blast = EmailBlast::with('sender')->find($this->blastId);
        if (! $blast) {
            return;
        }

        $blast->deliveries()->where('status', 'pending')->update([
            'status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 2000),
        ]);
        $this->finish($blast);
    }

    /** The Graph message resource for one batch. */
    private function message(EmailBlast $blast, EmailDelivery $delivery, array $fields, ?array $attachment): array
    {
        $contacts = $delivery->recipients ?? [];
        $address = fn (array $c) => ['emailAddress' => array_filter([
            'address' => $c['email'],
            'name' => $c['name'] ?? null,
        ])];

        $unsubscribe = null;
        if ($delivery->envelope === 'direct') {
            $subscriber = Subscriber::where('email', $contacts[0]['email'] ?? '')->first();
            $unsubscribe = $subscriber?->unsubscribeUrl();
        }

        $message = [
            'subject' => $blast->subject,
            'body' => [
                'contentType' => 'HTML',
                'content' => BlastRenderer::render($fields, $delivery->variant, $unsubscribe),
            ],
            // Custom headers must start with x-; this ties a Sent Items copy back to the ledger.
            'internetMessageHeaders' => [
                ['name' => 'x-regis-blast', 'value' => $blast->id.'/'.$delivery->id],
            ],
        ];

        if ($delivery->envelope === 'direct') {
            $message['toRecipients'] = [$address($contacts[0])];
        } else {
            // Sender to self, everyone else BCC: recipients never see each other.
            $message['toRecipients'] = [['emailAddress' => ['address' => $blast->sender_outlook]]];
            $message['bccRecipients'] = array_map($address, $contacts);
        }

        if ($attachment !== null) {
            $message['attachments'] = [$attachment];
        }

        return $message;
    }

    /** The report PDF as a Graph fileAttachment, when the desk asked for it. */
    private function attachment(EmailBlast $blast, MicrosoftGraphMailer $mailer): ?array
    {
        if (! $blast->attach_report || $blast->kind !== 'report' || ! $blast->report) {
            return null;
        }

        $path = (string) $blast->report->file_path;
        if ($path === '' || ! Storage::exists($path)) {
            throw new RuntimeException('The report PDF is missing from storage; nothing was sent.');
        }
        if (Storage::size($path) > $mailer->attachmentMaxBytes()) {
            throw new RuntimeException('The report PDF is larger than Graph accepts inline; nothing was sent.');
        }

        return [
            '@odata.type' => '#microsoft.graph.fileAttachment',
            'name' => $blast->report->file_name ?: 'report.pdf',
            'contentType' => 'application/pdf',
            'contentBytes' => base64_encode((string) Storage::get($path)),
        ];
    }

    /** Roll the batch outcomes up onto the blast and close it out. */
    private function finish(EmailBlast $blast): void
    {
        $sent = (int) $blast->deliveries()->where('status', 'sent')->sum('recipient_count');
        $failed = (int) $blast->deliveries()->where('status', 'failed')->sum('recipient_count');
        $firstError = $blast->deliveries()->where('status', 'failed')->orderBy('id')->value('error');

        $blast->forceFill([
            'status' => $failed > 0 ? 'failed' : 'sent',
            'sent_at' => now(),
            'sent_count' => $sent,
            'failed_count' => $failed,
            'send_error' => $failed > 0 ? $firstError : null,
        ])->save();

        Audit::log(
            $failed > 0 ? 'Email blast partly failed' : 'Sent email blast',
            $blast->subject,
            actor: $blast->sender?->name ?? 'Email desk',
        );
    }
}
