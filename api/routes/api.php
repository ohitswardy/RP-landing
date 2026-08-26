<?php

use App\Http\Controllers\Api\AboutController;
use App\Http\Controllers\Api\AccessController;
use App\Http\Controllers\Api\ArticleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\CareerController;
use App\Http\Controllers\Api\ClientLogController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\InsightsController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\PageController;
use App\Http\Controllers\Api\PersonController;
use App\Http\Controllers\Api\PortalClientController;
use App\Http\Controllers\Api\PortalController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\SiteContentController;
use App\Http\Controllers\Api\SubscriberController;
use App\Http\Controllers\Api\WatchlistController;
use Illuminate\Support\Facades\Route;

/* ── Auth ─────────────────────────────────────────────────────── */

Route::post('/cms/login', [AuthController::class, 'cmsLogin'])->middleware('throttle:10,1');
Route::post('/portal/login', [AuthController::class, 'portalLogin'])->middleware('throttle:10,1');

/* ── Public site content ──────────────────────────────────────── */

Route::get('/content/services', [SiteContentController::class, 'services']);
Route::get('/content/insights', [SiteContentController::class, 'insights']);
Route::get('/content/people', [SiteContentController::class, 'people']);
Route::get('/content/about', [SiteContentController::class, 'about']);
Route::get('/content/legal', [SiteContentController::class, 'legal']);
Route::get('/media/{path}', [MediaController::class, 'show'])->where('path', '.+');

/* ── Public onboarding links (emailed to clients) ─────────────── */

Route::prefix('portal')->middleware('throttle:20,1')->group(function () {
    Route::get('/register/{token}', [RegistrationController::class, 'show']);
    Route::post('/register/{token}', [RegistrationController::class, 'submit']);
    Route::get('/reset/{token}', [RegistrationController::class, 'showReset']);
    Route::post('/reset/{token}', [RegistrationController::class, 'submitReset']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Report PDFs stream to any authenticated, non-suspended account.
    Route::get('/reports/{report}/file', [ReportController::class, 'file'])
        ->middleware('can:view-report-files');
});

/* ── CMS (staff) ──────────────────────────────────────────────── */

Route::prefix('cms')->middleware(['auth:sanctum', 'staff'])->group(function () {
    Route::get('/bootstrap', BootstrapController::class);

    Route::middleware('permission:insights.manage')->group(function () {
        Route::post('/articles', [ArticleController::class, 'store']);
        Route::put('/articles/{article}', [ArticleController::class, 'update']);
        Route::delete('/articles/{article}', [ArticleController::class, 'destroy']);
        // The /insights page composition lives with the journal (same permission).
        Route::put('/insights/page', [InsightsController::class, 'update']);
        Route::post('/insights/upload', [InsightsController::class, 'upload']);
    });

    Route::middleware('permission:reports.manage')->group(function () {
        Route::post('/reports', [ReportController::class, 'store']);
        Route::match(['put', 'post'], '/reports/{report}', [ReportController::class, 'update']);
        Route::delete('/reports/{report}', [ReportController::class, 'destroy']);

        // Company registry — reports link to a company; type drives the portal filter.
        Route::post('/companies', [CompanyController::class, 'store']);
        Route::put('/companies/{company}', [CompanyController::class, 'update']);
        Route::delete('/companies/{company}', [CompanyController::class, 'destroy']);
    });

    Route::middleware('permission:people.manage')->group(function () {
        Route::post('/people', [PersonController::class, 'store']);
        Route::post('/people/upload', [PersonController::class, 'upload']);
        Route::put('/people/reorder', [PersonController::class, 'reorder']);
        Route::put('/people/{person}', [PersonController::class, 'update']);
        Route::delete('/people/{person}', [PersonController::class, 'destroy']);
        // About page copy lives with the People module (same permission).
        Route::put('/about-page', [AboutController::class, 'update']);
    });

    Route::middleware('permission:services.manage')->group(function () {
        Route::put('/services/page', [ServiceController::class, 'updatePage']);
        Route::put('/services/reorder', [ServiceController::class, 'reorder']);
        Route::post('/services/upload', [ServiceController::class, 'upload']);
        Route::put('/services/{service}', [ServiceController::class, 'update']);
    });

    Route::middleware('permission:careers.manage')->group(function () {
        Route::post('/careers', [CareerController::class, 'store']);
        Route::put('/careers/{career}', [CareerController::class, 'update']);
        Route::delete('/careers/{career}', [CareerController::class, 'destroy']);
    });

    Route::middleware('permission:market.manage')->group(function () {
        Route::post('/watchlist', [WatchlistController::class, 'store']);
        Route::put('/watchlist/reorder', [WatchlistController::class, 'reorder']);
        Route::put('/watchlist/{symbol}', [WatchlistController::class, 'update']);
        Route::delete('/watchlist/{symbol}', [WatchlistController::class, 'destroy']);
    });

    Route::middleware('permission:newsletter.manage')->group(function () {
        Route::post('/newsletters', [NewsletterController::class, 'store']);
        Route::post('/newsletters/upload', [NewsletterController::class, 'upload']);
        Route::put('/newsletters/{issue}', [NewsletterController::class, 'update']);
        Route::delete('/newsletters/{issue}', [NewsletterController::class, 'destroy']);
        Route::delete('/subscribers/{subscriber}', [SubscriberController::class, 'destroy']);
    });

    Route::middleware('permission:pages.manage')->group(function () {
        Route::put('/pages/{page}', [PageController::class, 'update']);
    });

    // Tamper-evident ledger of client portal consumption (views, downloads, clicks).
    Route::middleware('permission:logs.view')->group(function () {
        Route::get('/client-logs', [ClientLogController::class, 'index']);
        Route::get('/client-logs/export', [ClientLogController::class, 'export']);
        Route::get('/client-logs/verify', [ClientLogController::class, 'verify']);
    });

    Route::middleware('permission:access.manage')->group(function () {
        Route::get('/access', [AccessController::class, 'index']);
        Route::post('/users', [AccessController::class, 'storeUser']);
        Route::put('/users/{user}', [AccessController::class, 'updateUser']);
        Route::delete('/users/{user}', [AccessController::class, 'destroyUser']);
        Route::post('/roles', [AccessController::class, 'storeRole']);
        Route::put('/roles/{role}', [AccessController::class, 'updateRole']);
        Route::delete('/roles/{role}', [AccessController::class, 'destroyRole']);

        // Portal-client onboarding: provision, approve, reset.
        Route::post('/portal-clients', [PortalClientController::class, 'store']);
        Route::post('/portal-clients/{client}/invite-link', [PortalClientController::class, 'inviteLink']);
        Route::post('/portal-clients/{client}/approve', [PortalClientController::class, 'approve']);
        Route::post('/portal-clients/{client}/decline', [PortalClientController::class, 'decline']);
        Route::post('/portal-clients/{client}/reset-link', [PortalClientController::class, 'resetLink']);
        Route::put('/portal-clients/{client}/password', [PortalClientController::class, 'setPassword']);
        Route::put('/portal-clients/{client}/username', [PortalClientController::class, 'updateUsername']);
    });
});

/* ── Portal (clients) ─────────────────────────────────────────── */

Route::prefix('portal')->middleware(['auth:sanctum', 'client'])->group(function () {
    // Consumption events land in the anti-tamper ledger; generous throttle
    // since every view/download/click posts one beacon.
    Route::post('/activity', [ClientLogController::class, 'store'])->middleware('throttle:120,1');

    Route::get('/reports', [PortalController::class, 'reports']);
    Route::get('/bookmarks', [PortalController::class, 'bookmarks']);
    Route::put('/bookmarks/{report}', [PortalController::class, 'toggleBookmark']);
    Route::delete('/bookmarks/{report}', [PortalController::class, 'removeBookmark']);
    Route::delete('/bookmarks', [PortalController::class, 'clearBookmarks']);
});
