<?php

namespace App\Models;

use App\Support\BlastRenderer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailBlast extends Model
{
    public const KINDS = ['newsletter', 'report', 'adhoc'];

    /**
     * draft and ready are editorial; queued and sending mean the Graph job
     * is in flight; sent and failed are terminal. A failed blast can retry
     * its failed batches, but its content is frozen to match what went out.
     */
    public const STATUSES = ['draft', 'ready', 'queued', 'sending', 'sent', 'failed'];

    public const IN_FLIGHT = ['queued', 'sending'];

    public const LOCKED = ['queued', 'sending', 'sent', 'failed'];

    protected $fillable = [
        'kind', 'subject', 'html_body', 'report_id', 'newsletter_issue_id',
        'external_link', 'attach_report', 'recipients', 'recipients_foreign',
        'status', 'notes', 'sender_outlook', 'channel', 'sent_count', 'failed_count',
        'send_error', 'sent_by', 'sent_at', 'queued_at',
    ];

    protected $casts = [
        'recipients' => 'array',
        'recipients_foreign' => 'array',
        'attach_report' => 'boolean',
        'sent_count' => 'integer',
        'failed_count' => 'integer',
        'sent_at' => 'datetime',
        'queued_at' => 'datetime',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function newsletterIssue(): BelongsTo
    {
        return $this->belongsTo(NewsletterIssue::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(EmailDelivery::class);
    }

    /** Batch tallies for the ledger, without loading every delivery row. */
    public function scopeWithBatchCounts(Builder $query): Builder
    {
        return $query->withCount(self::batchCounts());
    }

    public function loadBatchCounts(): static
    {
        return $this->loadCount(self::batchCounts());
    }

    private static function batchCounts(): array
    {
        return [
            'deliveries as batches_total',
            'deliveries as batches_sent' => fn (Builder $q) => $q->where('status', 'sent'),
            'deliveries as batches_failed' => fn (Builder $q) => $q->where('status', 'failed'),
        ];
    }

    public function isInFlight(): bool
    {
        return in_array($this->status, self::IN_FLIGHT, true);
    }

    public function isLocked(): bool
    {
        return in_array($this->status, self::LOCKED, true);
    }

    /** The Foreign leg exists once the composer switches it on (an empty list still counts). */
    public function hasForeignVariant(): bool
    {
        return $this->recipients_foreign !== null;
    }

    /** @return array<int, array{email: string, name?: ?string, userId?: ?string, source: string}> */
    public function recipientsFor(string $variant): array
    {
        $list = $variant === 'foreign' ? $this->recipients_foreign : $this->recipients;

        return array_values($list ?? []);
    }

    public function recipientTotal(): int
    {
        return count($this->recipientsFor('local')) + count($this->recipientsFor('foreign'));
    }

    /** What the renderer needs to produce this blast's HTML for either variant. */
    public function renderFields(): array
    {
        return BlastRenderer::fields(
            kind: $this->kind,
            subject: $this->subject,
            htmlBody: $this->html_body,
            report: $this->kind === 'report' ? $this->report : null,
            externalLink: $this->external_link,
        );
    }

    public function toWire(): array
    {
        $total = $this->getAttribute('batches_total');

        return [
            'id' => (string) $this->id,
            'kind' => $this->kind,
            'subject' => $this->subject,
            'htmlBody' => $this->html_body,
            'reportId' => $this->report_id !== null ? (string) $this->report_id : null,
            'newsletterIssueId' => $this->newsletter_issue_id !== null ? (string) $this->newsletter_issue_id : null,
            'externalLink' => $this->external_link,
            'attachReport' => (bool) $this->attach_report,
            'recipients' => $this->recipientsFor('local'),
            'recipientsForeign' => $this->hasForeignVariant() ? $this->recipientsFor('foreign') : null,
            'status' => $this->status,
            'notes' => $this->notes,
            'channel' => $this->channel,
            'senderOutlook' => $this->sender_outlook,
            'sentBy' => $this->sent_by !== null ? (string) $this->sent_by : null,
            'sentByName' => $this->sender?->name,
            'sentCount' => (int) $this->sent_count,
            'failedCount' => (int) $this->failed_count,
            'sendError' => $this->send_error,
            'batches' => $total === null ? null : [
                'total' => (int) $total,
                'sent' => (int) $this->getAttribute('batches_sent'),
                'failed' => (int) $this->getAttribute('batches_failed'),
            ],
            'queuedAt' => $this->queued_at?->toIso8601String(),
            'sentAt' => $this->sent_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String() ?? now()->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }
}
