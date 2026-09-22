<?php

use App\Http\Controllers\Api\AboutController;
use App\Http\Controllers\Api\AccessController;
use App\Http\Controllers\Api\ArticleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\CareerController;
use App\Http\Controllers\Api\ClientLogController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DistributionListController;
use App\Http\Controllers\Api\EmailBlastController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\InsightsController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\NewsletterSubscribeController;
use App\Http\Controllers\Api\PageController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PersonController;
use App\Http\Controllers\Api\PortalClientController;
use App\Http\Controllers\Api\PortalController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReportTypeController;
use App\Http\Controllers\Api\SelfServiceController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\SiteContentController;
use App\Http\Controllers\Api\SubscriberController;
use App\Http\Controllers\Api\UnsubscribeController;
use App\Http\Controllers\Api\WatchlistController;
use Illuminate\Support\Facades\Route;

/* ── Auth ─────────────────────────────────────────────────────── */

Route::post('/cms/login', [AuthController::class, 'cmsLogin'])->middleware('throttle:10,1');
Route::post('/portal/login', [AuthController::class, 'portalLogin'])->middleware('throttle:10,1');

// Self-service "forgot password" for either door. Always 200; a matching
// account gets a single-use link by email (finished at /portal/reset/{token}).
Route::post('/portal/forgot-password', [PasswordResetController::class, 'forgotClient'])->middleware('throttle:10,1');
Route::post('/cms/forgot-password', [PasswordResetController::class, 'forgotStaff'])->middleware('throttle:10,1');

/* ── Public site content ──────────────────────────────────────── */

Route::get('/content/home', [SiteContentController::class, 'home']);
Route::get('/content/services', [SiteContentController::class, 'services']);
Route::get('/content/insights', [SiteContentController::class, 'insights']);
// One published note in full, with three related notes; drafts are 404.
Route::get('/content/insights/{slug}', [SiteContentController::class, 'insight'])->where('slug', '[a-z0-9-]+');
Route::get('/content/people', [SiteContentController::class, 'people']);
// The market ribbon's symbol list, the open career postings, and the site-search index (cached 60 s).
Route::get('/content/watchlist', [SiteContentController::class, 'watchlist']);
Route::get('/content/careers', [SiteContentController::class, 'careers']);
Route::get('/content/search', [SiteContentController::class, 'search']);
Route::get('/content/about', [SiteContentController::class, 'about']);
Route::get('/content/legal', [SiteContentController::class, 'legal']);
Route::get('/content/contact', [SiteContentController::class, 'contact']);
// The mega-menu photography: every hero image the navbar shows, in one call.
Route::get('/content/nav', [SiteContentController::class, 'nav']);
Route::get('/media/{path}', [MediaController::class, 'show'])->where('path', '.+');

/* ── Public onboarding links (emailed to clients) ─────────────── */

Route::prefix('portal')->middleware('throttle:20,1')->group(function () {
    Route::get('/register/{token}', [RegistrationController::class, 'show']);
    Route::post('/register/{token}', [RegistrationController::class, 'submit']);
    Route::get('/reset/{token}', [RegistrationController::class, 'showReset']);
    Route::post('/reset/{token}', [RegistrationController::class, 'submitReset']);
});

// One-click opt-out carried by every subscriber blast; renders a plain confirmation page.
Route::get('/newsletter/unsubscribe/{token}', UnsubscribeController::class)->middleware('throttle:20,1');
// Public double opt-in: the site's subscribe form, then the confirmation link it emails.
Route::post('/newsletter/subscribe', [NewsletterSubscribeController::class, 'subscribe'])->middleware('throttle:6,1');
Route::get('/newsletter/verify/{token}', [NewsletterSubscribeController::class, 'verify'])->middleware('throttle:20,1');

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
    // Any signed-in staff member may change their own password (no module permission needed).
    Route::put('/password', [SelfServiceController::class, 'changePassword']);
    // Issue bodies load on demand — the bootstrap list carries summaries only.
    Route::get('/newsletters/{issue}', [NewsletterController::class, 'show']);

    // The landing page: one document covering every section's copy and photography.
    Route::middleware('permission:home.manage')->group(function () {
        Route::put('/home-page', [HomeController::class, 'update']);
        Route::post('/home/upload', [HomeController::class, 'upload']);
    });

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
        Route::put('/reports/{report}/spotlight', [ReportController::class, 'spotlight']);
        // Trending Content ranking rules for the portal dashboard.
        Route::put('/trending', [ReportController::class, 'updateTrending']);
        Route::get('/trending/preview', [ReportController::class, 'previewTrending']);
        Route::match(['put', 'post'], '/reports/{report}', [ReportController::class, 'update']);
        Route::delete('/reports/{report}', [ReportController::class, 'destroy']);

        // Company registry — reports link to a company; type drives the portal filter.
        Route::post('/companies', [CompanyController::class, 'store']);
        Route::put('/companies/{company}', [CompanyController::class, 'update']);
        Route::delete('/companies/{company}', [CompanyController::class, 'destroy']);

        // Report-type registry — the desk's editable editorial classifications.
        Route::post('/report-types', [ReportTypeController::class, 'store']);
        Route::put('/report-types/{reportType}', [ReportTypeController::class, 'update']);
        Route::delete('/report-types/{reportType}', [ReportTypeController::class, 'destroy']);
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
        Route::post('/services', [ServiceController::class, 'store']);
        Route::put('/services/{service}', [ServiceController::class, 'update']);
        Route::delete('/services/{service}', [ServiceController::class, 'destroy']);
    });

    // The media library on its own: list, upload, delete (refused while in use).
    Route::middleware('permission:media.manage')->group(function () {
        Route::get('/media', [MediaController::class, 'index']);
        Route::post('/media', [MediaController::class, 'store']);
        Route::delete('/media/{asset}', [MediaController::class, 'destroy']);
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

    // The Email desk: blasts are composed and previewed here, then sent through
    // Graph from the staff mailbox (send) or by hand through Outlook (sent).
    Route::middleware('permission:email.manage')->group(function () {
        Route::get('/email-blasts', [EmailBlastController::class, 'index']);
        Route::get('/email-blasts/audience', [EmailBlastController::class, 'audience']);
        Route::get('/email-blasts/readiness', [EmailBlastController::class, 'readiness']);
        Route::get('/email-blasts/match', [EmailBlastController::class, 'match']);
        Route::post('/email-blasts/render', [EmailBlastController::class, 'render'])->middleware('throttle:120,1');
        Route::post('/email-blasts', [EmailBlastController::class, 'store']);
        Route::put('/email-blasts/{blast}', [EmailBlastController::class, 'update']);
        Route::get('/email-blasts/{blast}/deliveries', [EmailBlastController::class, 'deliveries']);
        Route::post('/email-blasts/{blast}/send', [EmailBlastController::class, 'send'])->middleware('throttle:6,1');
        Route::post('/email-blasts/{blast}/sent', [EmailBlastController::class, 'markSent']);
        Route::delete('/email-blasts/{blast}', [EmailBlastController::class, 'destroy']);

        // Saved audiences the composer and the newsletter blast panel pick from.
        Route::get('/distribution-lists', [DistributionListController::class, 'index']);
        Route::post('/distribution-lists', [DistributionListController::class, 'store']);
        Route::put('/distribution-lists/{list}', [DistributionListController::class, 'update']);
        Route::delete('/distribution-lists/{list}', [DistributionListController::class, 'destroy']);
    });

    Route::middleware('permission:pages.manage')->group(function () {
        Route::put('/pages/{page}', [PageController::class, 'update']);
        // The Contact page copy lives with the legal documents (same permission).
        Route::put('/contact-page', [ContactController::class, 'update']);
        Route::post('/contact/upload', [ContactController::class, 'upload']);
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
        Route::get('/users/{user}/password', [AccessController::class, 'revealPassword']); // super admin only
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

    // The client's own account: profile readout and password change.
    Route::get('/profile', [SelfServiceController::class, 'profile']);
    Route::put('/password', [SelfServiceController::class, 'changePassword']);

    Route::get('/reports', [PortalController::class, 'reports']);
    Route::get('/bookmarks', [PortalController::class, 'bookmarks']);
    Route::put('/bookmarks/{report}', [PortalController::class, 'toggleBookmark']);
    Route::delete('/bookmarks/{report}', [PortalController::class, 'removeBookmark']);
    Route::delete('/bookmarks', [PortalController::class, 'clearBookmarks']);
});

/* ── CRMS (staff, Administrator + Analyst) ────────────────────── */

require __DIR__.'/crms.php';
