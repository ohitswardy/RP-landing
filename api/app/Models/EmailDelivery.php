<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One Graph message of a blast. Clients and typed addresses ride BCC in
 * batches under Exchange's 500-recipient cap; each newsletter subscriber
 * gets a direct message of their own so it can carry a personal
 * unsubscribe link. Rows are planned before the job starts, so a retry
 * only resends what failed.
 */
class EmailDelivery extends Model
{
    public const STATUSES = ['pending', 'sent', 'failed'];

    protected $fillable = [
        'email_blast_id', 'variant', 'batch', 'envelope', 'recipients',
        'recipient_count', 'status', 'error', 'graph_request_id', 'sent_at',
    ];

    protected $casts = [
        'recipients' => 'array',
        'batch' => 'integer',
        'recipient_count' => 'integer',
        'sent_at' => 'datetime',
    ];

    public function blast(): BelongsTo
    {
        return $this->belongsTo(EmailBlast::class, 'email_blast_id');
    }

    /**
     * Plan the messages for a blast. Addresses are deduplicated across both
     * variants (the Local leg wins), subscribers are split off into direct
     * messages, and everyone else is chunked into BCC batches of $batchSize.
     *
     * @return array<int, array<string, mixed>> attribute sets, ready to insert
     */
    public static function plan(EmailBlast $blast, int $batchSize): array
    {
        $seen = [];
        $rows = [];

        foreach (['local', 'foreign'] as $variant) {
            if ($variant === 'foreign' && ! $blast->hasForeignVariant()) {
                continue;
            }

            $bcc = [];
            $direct = [];
            foreach ($blast->recipientsFor($variant) as $r) {
                $email = mb_strtolower(trim((string) ($r['email'] ?? '')));
                if ($email === '' || isset($seen[$email])) {
                    continue;
                }
                $seen[$email] = true;
                $contact = [
                    'email' => $email,
                    'name' => $r['name'] ?? null,
                    'source' => $r['source'] ?? 'manual',
                ];
                if ($contact['source'] === 'subscriber') {
                    $direct[] = $contact;
                } else {
                    $bcc[] = $contact;
                }
            }

            $batch = 0;
            foreach (array_chunk($bcc, max(1, $batchSize)) as $chunk) {
                $rows[] = [
                    'variant' => $variant,
                    'batch' => ++$batch,
                    'envelope' => 'bcc',
                    'recipients' => $chunk,
                    'recipient_count' => count($chunk),
                    'status' => 'pending',
                ];
            }
            foreach ($direct as $contact) {
                $rows[] = [
                    'variant' => $variant,
                    'batch' => ++$batch,
                    'envelope' => 'direct',
                    'recipients' => [$contact],
                    'recipient_count' => 1,
                    'status' => 'pending',
                ];
            }
        }

        return $rows;
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'variant' => $this->variant,
            'batch' => $this->batch,
            'envelope' => $this->envelope,
            'recipients' => array_values(array_map(fn (array $c) => $c['email'], $this->recipients ?? [])),
            'recipientCount' => $this->recipient_count,
            'status' => $this->status,
            'error' => $this->error,
            'sentAt' => $this->sent_at?->toIso8601String(),
        ];
    }
}
