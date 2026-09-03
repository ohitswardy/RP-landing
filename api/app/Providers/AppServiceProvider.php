<?php

namespace App\Providers;

use App\Models\User;
use App\Services\MicrosoftGraphMailer;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // The Email desk's outbound channel; inert until the MS_GRAPH_* keys are set.
        $this->app->singleton(MicrosoftGraphMailer::class, fn () => new MicrosoftGraphMailer((array) config('services.graph')));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Report PDFs are readable by any active account, staff or client.
        Gate::define('view-report-files', fn (User $user) => ! $user->suspended);
    }
}
