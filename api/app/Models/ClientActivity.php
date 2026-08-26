<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One consumption event on the client portal (view / download / click),
 * sealed into a tamper-evident hash chain. Rows are append-only: no route
 * updates or deletes them, and any edit made behind the API's back breaks
 * the chain from that row onward.
 */
class ClientActivity extends Model
{
    public $timestamps = false;

    public const EVENTS = ['view', 'download', 'click'];

    protected $fillable = [
        'user_id', 'actor_name', 'actor_email', 'actor_firm',
        'event', 'report_id', 'target', 'context',
        'ip', 'user_agent', 'occurred_at', 'prev_hash', 'hash',
    ];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'userId' => $this->user_id !== null ? (string) $this->user_id : null,
            'actor' => $this->actor_name,
            'email' => $this->actor_email,
            'firm' => $this->actor_firm,
            'event' => $this->event,
            'reportId' => $this->report_id !== null ? (string) $this->report_id : null,
            'target' => $this->target,
            'context' => $this->context,
            'ip' => $this->ip,
            'at' => $this->occurred_at->toIso8601String(),
            'hash' => $this->hash,
        ];
    }
}
