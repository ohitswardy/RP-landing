<?php

namespace App\Support;

use App\Models\AuditEntry;
use Illuminate\Support\Facades\Auth;

class Audit
{
    /**
     * Record an audit-trail entry attributed to the signed-in user, or to
     * $actor for unauthenticated flows such as a client self-registering.
     */
    public static function log(string $action, string $target, ?string $actor = null): AuditEntry
    {
        $user = Auth::user();

        return AuditEntry::create([
            'user_id' => $user?->id,
            'actor' => $actor ?? $user?->name ?? 'System',
            'action' => $action,
            'target' => mb_substr($target, 0, 500),
            'at' => now(),
        ]);
    }
}
