<?php

use App\Http\Controllers\Crms\BootstrapController;
use App\Http\Controllers\Crms\ClientContactController;
use App\Http\Controllers\Crms\ClientController;
use App\Http\Controllers\Crms\ConfigController;
use App\Http\Controllers\Crms\CorporateController;
use App\Http\Controllers\Crms\EventChildController;
use App\Http\Controllers\Crms\EventController;
use App\Http\Controllers\Crms\InsightController;
use App\Http\Controllers\Crms\InteractionController;
use App\Http\Controllers\Crms\LoginController;
use App\Http\Controllers\Crms\OneOffMeetingController;
use App\Http\Controllers\Crms\ReportController;
use App\Http\Controllers\Crms\SellsideContactController;
use Illuminate\Support\Facades\Route;

/*
 * The CRMS API. Same staff accounts and Sanctum tokens as the CMS; every
 * route below sits behind auth:sanctum + staff + crms.access, and each
 * write group behind its own crms.* key (CRMSmasterplan.md §5).
 */

Route::post('/crms/login', LoginController::class)->middleware('throttle:10,1');

Route::prefix('crms')->middleware(['auth:sanctum', 'staff', 'permission:crms.access'])->group(function () {
    Route::get('/bootstrap', BootstrapController::class);

    // Reads any CRMS desk can make.
    Route::get('/interactions', [InteractionController::class, 'index']);
    Route::get('/interactions/{interaction}', [InteractionController::class, 'show']);
    Route::get('/events', [EventController::class, 'index']);
    Route::get('/events/{event}', [EventController::class, 'show']);
    Route::get('/events/{event}/itinerary', [EventController::class, 'itinerary']);
    Route::get('/one-off-meetings', [OneOffMeetingController::class, 'index']);
    Route::get('/one-off-meetings/{meeting}', [OneOffMeetingController::class, 'show']);
    Route::get('/calendar', [InsightController::class, 'calendar']);
    Route::get('/dashboard/summary', [InsightController::class, 'summary']);
    Route::get('/corporates/{corporate}/holders', [InsightController::class, 'holders']);
    Route::get('/client-contacts/{contact}/portal', [ClientContactController::class, 'portal']);

    Route::middleware('permission:crms.contacts.manage')->group(function () {
        Route::post('/clients', [ClientController::class, 'store']);
        Route::put('/clients/{client}', [ClientController::class, 'update']);
        Route::delete('/clients/{client}', [ClientController::class, 'destroy']);
        Route::post('/clients/{client}/addresses', [ClientController::class, 'storeAddress']);
        Route::put('/clients/{client}/addresses/{address}', [ClientController::class, 'updateAddress']);
        Route::delete('/clients/{client}/addresses/{address}', [ClientController::class, 'destroyAddress']);

        Route::post('/client-contacts', [ClientContactController::class, 'store']);
        Route::put('/client-contacts/{contact}', [ClientContactController::class, 'update']);
        Route::delete('/client-contacts/{contact}', [ClientContactController::class, 'destroy']);
        Route::post('/client-contacts/{contact}/portal', [ClientContactController::class, 'link']);

        Route::post('/corporates', [CorporateController::class, 'store']);
        Route::put('/corporates/{corporate}', [CorporateController::class, 'update']);
        Route::delete('/corporates/{corporate}', [CorporateController::class, 'destroy']);
        Route::post('/corporate-contacts', [CorporateController::class, 'storeContact']);
        Route::put('/corporate-contacts/{contact}', [CorporateController::class, 'updateContact']);
        Route::delete('/corporate-contacts/{contact}', [CorporateController::class, 'destroyContact']);

        Route::post('/sellside-contacts', [SellsideContactController::class, 'store']);
        Route::put('/sellside-contacts/{contact}', [SellsideContactController::class, 'update']);
        Route::delete('/sellside-contacts/{contact}', [SellsideContactController::class, 'destroy']);

        // The research distribution taxonomy (§7.8) lives with the contacts desk.
        Route::post('/sector-groups', [ConfigController::class, 'storeGroup']);
        Route::put('/sector-groups/{group}', [ConfigController::class, 'updateGroup']);
        Route::delete('/sector-groups/{group}', [ConfigController::class, 'destroyGroup']);
    });

    Route::middleware('permission:crms.interactions.manage')->group(function () {
        Route::post('/interactions', [InteractionController::class, 'store']);
        Route::put('/interactions/{interaction}', [InteractionController::class, 'update']);
        Route::delete('/interactions/{interaction}', [InteractionController::class, 'destroy']);
        Route::post('/interactions/{interaction}/actioned', [InteractionController::class, 'actioned']);
    });

    Route::middleware('permission:crms.events.manage')->group(function () {
        Route::post('/events', [EventController::class, 'store']);
        Route::put('/events/{event}', [EventController::class, 'update']);
        Route::delete('/events/{event}', [EventController::class, 'destroy']);
        Route::post('/events/{event}/{type}', [EventChildController::class, 'store'])->whereIn('type', array_keys(\App\Models\Crms\Event::CHILDREN));
        Route::put('/events/{event}/{type}/{id}', [EventChildController::class, 'update'])->whereIn('type', array_keys(\App\Models\Crms\Event::CHILDREN))->whereNumber('id');
        Route::delete('/events/{event}/{type}/{id}', [EventChildController::class, 'destroy'])->whereIn('type', array_keys(\App\Models\Crms\Event::CHILDREN))->whereNumber('id');
        Route::post('/meetings/{meeting}/convert-to-interaction', [EventController::class, 'convert']);
        Route::post('/one-off-meetings', [OneOffMeetingController::class, 'store']);
        Route::put('/one-off-meetings/{meeting}', [OneOffMeetingController::class, 'update']);
        Route::delete('/one-off-meetings/{meeting}', [OneOffMeetingController::class, 'destroy']);
        Route::post('/one-off-meetings/{meeting}/convert-to-interaction', [OneOffMeetingController::class, 'convert']);
    });

    Route::middleware('permission:crms.reports.generate')->group(function () {
        Route::post('/reports/generate', [ReportController::class, 'generate'])->middleware('throttle:30,1');
    });

    Route::middleware('permission:crms.admin')->group(function () {
        Route::post('/interaction-types', [ConfigController::class, 'storeType']);
        Route::put('/interaction-types/{type}', [ConfigController::class, 'updateType']);
        Route::delete('/interaction-types/{type}', [ConfigController::class, 'destroyType']);
        Route::post('/forms', [ConfigController::class, 'storeForm']);
        Route::put('/forms/{form}', [ConfigController::class, 'updateForm']);
        Route::delete('/forms/{form}', [ConfigController::class, 'destroyForm']);
        Route::post('/report-templates', [ConfigController::class, 'storeTemplate']);
        Route::put('/report-templates/{template}', [ConfigController::class, 'updateTemplate']);
        Route::delete('/report-templates/{template}', [ConfigController::class, 'destroyTemplate']);
        Route::get('/logs', [InsightController::class, 'logs']);
    });
});
