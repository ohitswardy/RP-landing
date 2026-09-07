<?php

namespace App\Http\Controllers\Crms;

use App\Enums\Crms\EventCategory;
use App\Models\AuditEntry;
use App\Models\Crms\Client;
use App\Models\Crms\ClientAddress;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\CorporateContact;
use App\Models\Crms\Form;
use App\Models\Crms\Interaction;
use App\Models\Crms\InteractionType;
use App\Models\Crms\ReportTemplate;
use App\Models\Crms\SectorGroup;
use App\Models\Crms\SellsideContact;
use App\Models\User;
use App\Services\Crms\PortalAccountResolver;
use Illuminate\Http\JsonResponse;

/** The master data the CRMS workspace needs in one round-trip. */
class BootstrapController extends CrmsController
{
    public function __invoke(PortalAccountResolver $portal): JsonResponse
    {
        $firstYear = (int) (Interaction::min('interaction_date') ? substr(Interaction::min('interaction_date'), 0, 4) : now()->year);

        return response()->json([
            'clients' => Client::withCount(['contacts', 'addresses', 'interactions'])->orderBy('name')->get()->map->toWire()->values(),
            'addresses' => ClientAddress::orderBy('client_id')->orderBy('id')->get()->map->toWire()->values(),
            'clientContacts' => ClientContact::with(['client', 'sectorGroups'])->orderBy('lastname')->orderBy('firstname')->get()->map->toWire()->values(),
            'corporates' => Corporate::withCount('contacts')->orderBy('name')->get()->map->toWire()->values(),
            'corporateContacts' => CorporateContact::with('corporate')->orderBy('name')->get()->map->toWire()->values(),
            'sellsideContacts' => SellsideContact::orderBy('name')->get()->map->toWire()->values(),
            'interactionTypes' => InteractionType::orderBy('type')->get()->map->toWire()->values(),
            'forms' => Form::orderBy('client_id')->get()->map->toWire()->values(),
            'sectorGroups' => SectorGroup::with('corporates')->withCount('contacts')->orderBy('scope')->orderBy('position')->orderBy('id')->get()->map->toWire()->values(),
            'reportTemplates' => ReportTemplate::with('client')->orderBy('id')->get()->map->toWire()->values(),
            // Portal accounts, read-only, for the reconciliation lists and the link picker.
            'portalAccounts' => User::where('kind', User::KIND_CLIENT)->orderBy('name')->get()->map(fn (User $u) => $portal->accountWire($u))->values(),
            'audit' => AuditEntry::where('action', 'like', 'CRMS · %')->orderByDesc('at')->orderByDesc('id')->limit(60)->get()->map->toWire()->values(),
            'meta' => [
                'years' => range(now()->year, min($firstYear, now()->year)),
                // The client row that stands in for "default" form and shared types (legacy convention).
                'genericClientId' => ($g = Client::genericId()) ? (string) $g : null,
                'eventCategories' => [
                    ...array_map(fn (EventCategory $c) => ['slug' => $c->slug(), 'label' => $c->label()], EventCategory::cases()),
                    ['slug' => 'meetings', 'label' => 'One-Off Meeting'],
                ],
            ],
        ]);
    }
}
