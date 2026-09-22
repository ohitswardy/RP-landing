<?php

namespace App\Console\Commands;

use App\Jobs\SendEmailBlast;
use App\Models\EmailBlast;
use App\Support\Audit;
use Illuminate\Console\Command;

/**
 * A blast queued while no worker was running (or whose job was lost when
 * one died) sits at `queued` for good: the job only ever runs once. This
 * re-dispatches every blast still `queued` after the threshold, so a
 * worker brought back up picks them up. The job itself only sends the
 * pending batches, so nothing goes out twice.
 */
class RequeueStaleBlasts extends Command
{
    protected $signature = 'blasts:requeue-stale
        {--minutes=15 : Re-dispatch blasts still queued after this many minutes}
        {--dry-run : List the stuck blasts without dispatching}';

    protected $description = 'Re-dispatch email blasts stuck at queued for longer than the threshold';

    public function handle(): int
    {
        $minutes = max(1, (int) $this->option('minutes'));
        $stale = EmailBlast::where('status', 'queued')
            ->where('queued_at', '<', now()->subMinutes($minutes))
            ->orderBy('id')
            ->get();

        if ($stale->isEmpty()) {
            $this->info("No blasts have been queued for more than {$minutes} minutes.");

            return self::SUCCESS;
        }

        foreach ($stale as $blast) {
            $pending = $blast->deliveries()->where('status', 'pending')->count();
            $this->line(sprintf('#%d  %-60s  queued %s  %d pending batch(es)', $blast->id, mb_substr($blast->subject, 0, 60), $blast->queued_at?->diffForHumans() ?? '?', $pending));

            if ($this->option('dry-run')) {
                continue;
            }

            // Fresh queued_at so the same blast is not re-dispatched by the next run
            // before a worker has had the chance to take it.
            $blast->forceFill(['queued_at' => now()])->save();
            SendEmailBlast::dispatch($blast->id);
            Audit::log('Re-queued stale email blast', $blast->subject, actor: 'Scheduler');
        }

        $this->info(($this->option('dry-run') ? 'Would re-dispatch ' : 'Re-dispatched ').$stale->count().' blast(s).');

        return self::SUCCESS;
    }
}
