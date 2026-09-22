<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Email blasts left at `queued` because no worker was running are re-dispatched
// once a worker is back (see App\Console\Commands\RequeueStaleBlasts). Needs
// `php artisan schedule:work` (or a cron hitting schedule:run) alongside queue:work.
Schedule::command('blasts:requeue-stale --minutes=15')->everyTenMinutes()->withoutOverlapping();
