<?php

namespace App\Support;

use App\Models\EmailBlast;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;

/**
 * Whether a queue worker is actually running. The worker stamps a cache
 * heartbeat on every loop (AppServiceProvider); the Email desk reads it
 * before offering "Send now", because a blast queued with no worker sits
 * at `queued` forever and nothing else would say so.
 */
class QueueHealth
{
    public const HEARTBEAT_KEY = 'queue.heartbeat';

    /** Seconds the heartbeat stays in the cache after the last worker loop. */
    public const HEARTBEAT_TTL = 600;

    /** A heartbeat older than this means the worker is gone. */
    public const ALIVE_WITHIN_SECONDS = 90;

    /** A blast still `queued` after this long is stuck. */
    public const STALE_AFTER_MINUTES = 5;

    public static function beat(): void
    {
        Cache::put(self::HEARTBEAT_KEY, now()->toIso8601String(), self::HEARTBEAT_TTL);
    }

    public static function driver(): string
    {
        $connection = (string) config('queue.default');

        return (string) (config("queue.connections.{$connection}.driver") ?? $connection);
    }

    public static function lastSeenAt(): ?Carbon
    {
        $raw = Cache::get(self::HEARTBEAT_KEY);
        if (! is_string($raw) || $raw === '') {
            return null;
        }
        try {
            return Carbon::parse($raw);
        } catch (\Throwable) {
            return null;
        }
    }

    /** True on the sync driver (jobs run inline) or when the heartbeat is fresh. */
    public static function alive(): bool
    {
        if (self::driver() === 'sync') {
            return true;
        }
        $seen = self::lastSeenAt();

        return $seen !== null && $seen->greaterThanOrEqualTo(now()->subSeconds(self::ALIVE_WITHIN_SECONDS));
    }

    /** The `queue` block the Email desk's readiness strip reads. */
    public static function status(): array
    {
        $driver = self::driver();

        return [
            'driver' => $driver,
            'alive' => self::alive(),
            'lastSeenAt' => self::lastSeenAt()?->toIso8601String(),
            'pending' => self::pending($driver),
            'stale' => EmailBlast::where('status', 'queued')
                ->where('queued_at', '<', now()->subMinutes(self::STALE_AFTER_MINUTES))
                ->count(),
        ];
    }

    /** Jobs waiting in the database queue; null on any other driver. */
    private static function pending(string $driver): ?int
    {
        if ($driver !== 'database') {
            return null;
        }
        $connection = (string) config('queue.default');
        $table = (string) (config("queue.connections.{$connection}.table") ?: 'jobs');
        $db = config("queue.connections.{$connection}.connection");
        if (! Schema::connection($db)->hasTable($table)) {
            return null;
        }

        return (int) DB::connection($db)->table($table)->count();
    }
}
