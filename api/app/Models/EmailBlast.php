<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailBlast extends Model
{
    public const KINDS = ['newsletter', 'report', 'adhoc'];
    public const STATUSES = ['draft', 'ready', 'sent'];

    protected $fillable = [
        'kind', 'subject', 'html_body', 'report_id', 'newsletter_issue_id',
        'external_link', 'recipients', 'status', 'notes', 'sender_outlook',
        'sent_by', 'sent_at',
    ];

    protected $casts = [
        'recipients' => 'array',
        'sent_at' => 'datetime',
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

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'kind' => $this->kind,
            'subject' => $this->subject,
            'htmlBody' => $this->html_body,
            'reportId' => $this->report_id !== null ? (string) $this->report_id : null,
            'newsletterIssueId' => $this->newsletter_issue_id !== null ? (string) $this->newsletter_issue_id : null,
            'externalLink' => $this->external_link,
            'recipients' => $this->recipients ?? [],
            'status' => $this->status,
            'notes' => $this->notes,
            'senderOutlook' => $this->sender_outlook,
            'sentBy' => $this->sent_by !== null ? (string) $this->sent_by : null,
            'sentByName' => $this->sender?->name,
            'sentAt' => $this->sent_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String() ?? now()->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }
}
