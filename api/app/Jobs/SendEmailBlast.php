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
use Illuminate\Support\Facades\Http;
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

    /** Images fetched for inline embedding this run, keyed by URL, so a logo used twice is attached once. */
    private array $inlineImages = [];

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

        [$html, $inline] = $this->embedImages(BlastRenderer::render($fields, $delivery->variant, $unsubscribe));

        $message = [
            'subject' => $blast->subject,
            'body' => [
                'contentType' => 'HTML',
                'content' => $html,
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

        $attachments = $inline;
        if ($attachment !== null) {
            $attachments[] = $attachment;
        }
        if ($attachments !== []) {
            $message['attachments'] = $attachments;
        }

        return $message;
    }

    /**
     * Images the mail references from our own hosts (the site, the API, or a
     * root-relative path) are not reachable from a recipient's mail client
     * while this runs behind a firewall, and the logo is the first thing a
     * reader sees. Each is fetched once, attached inline with a content id,
     * and the tag rewritten to cid: — every client renders those. Anything
     * on a third-party host is left as a link. Returns [html, attachments].
     */
    private function embedImages(string $html): array
    {
        $ours = array_values(array_filter(array_unique([
            rtrim((string) config('app.frontend_url'), '/'),
            rtrim((string) config('app.url'), '/'),
        ])));
        $frontend = $ours[0] ?? '';
        $max = app(MicrosoftGraphMailer::class)->attachmentMaxBytes();
        $attachments = [];

        $rewritten = preg_replace_callback('~<img\b[^>]*\bsrc=(["\'])([^"\']+)\1~i', function (array $m) use ($ours, $frontend, $max, &$attachments): string {
            $src = html_entity_decode($m[2]);
            if (str_starts_with($src, 'cid:') || str_starts_with($src, 'data:')) {
                return $m[0];
            }
            $url = null;
            if (str_starts_with($src, '/') && ! str_starts_with($src, '//')) {
                $url = $frontend.$src;
            } else {
                foreach ($ours as $origin) {
                    if ($origin !== '' && str_starts_with($src, $origin.'/')) {
                        $url = $src;
                        break;
                    }
                }
            }
            if ($url === null) {
                return $m[0];
            }

            $image = $this->inlineImages[$url] ??= $this->fetchImage($url, $max);
            if ($image === null) {
                return $m[0];
            }
            $attachments[$image['contentId']] = $image;

            return str_replace($m[1].$m[2].$m[1], $m[1].'cid:'.$image['contentId'].$m[1], $m[0]);
        }, $html);

        return [$rewritten ?? $html, array_values($attachments)];
    }

    /** One image as a Graph inline fileAttachment, or null when it cannot be fetched or is too large. */
    private function fetchImage(string $url, int $max): ?array
    {
        try {
            $response = Http::timeout(15)->get($url);
        } catch (Throwable) {
            return null;
        }
        $type = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
        $bytes = $response->body();
        if (! $response->successful() || ! str_starts_with($type, 'image/') || $bytes === '' || strlen($bytes) > $max) {
            return null;
        }
        $name = basename((string) parse_url($url, PHP_URL_PATH)) ?: 'image';

        return [
            '@odata.type' => '#microsoft.graph.fileAttachment',
            'name' => $name,
            'contentType' => $type,
            'contentId' => substr(sha1($url), 0, 20).'@regis',
            'isInline' => true,
            'contentBytes' => base64_encode($bytes),
        ];
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
