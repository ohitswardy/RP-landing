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
use App\Services\Crms\BundledTemplates;
use App\Services\Crms\PortalAccountResolver;
use App\Services\Crms\ReportSources;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/** The master data the CRMS workspace needs in one round-trip. */
class BootstrapController extends CrmsController
{
    public function __invoke(PortalAccountResolver $portal): JsonResponse
    {
        $firstYear = (int) (Interaction::min('interaction_date') ? substr(Interaction::min('interaction_date'), 0, 4) : now()->year);
        $legacyUserId = $this->legacyUserId();

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
                    ...$this->eventCategories(),
                    ['slug' => 'meetings', 'label' => 'One-Off Meeting', 'id' => null, 'legacyName' => null],
                ],
                // Whether the signed-in staff member has a row in the legacy `user` table.
                // When false, interactions.user_id stays null and the author lives in the audit ledger only.
                'legacyUserMatched' => $legacyUserId !== null,
                'legacyUserId' => $legacyUserId !== null ? (string) $legacyUserId : null,
                // Everything a column of an imported report template can be filled with (Form builder → Report template).
                'reportSources' => ReportSources::catalog(),
                // The Jefferies upload: the client row that holds its binding (null on an install without one), the
                // binding it renders through today, and the bundled workbook as Jefferies sent it.
                'jefferies' => [
                    'clientId' => ($j = Client::jefferiesId()) ? (string) $j : null,
                    'templateId' => ($jt = ReportTemplate::jefferies()) ? (string) $jt->getKey() : null,
                    'bundled' => BundledTemplates::describe(BundledTemplates::JEFFERIES),
                ],
            ],
        ]);
    }

    /**
     * The three roadshow categories. Slugs and labels come from the enum
     * (the routes depend on them); when the legacy `event_category` table
     * has rows, each case also carries the id and name the table holds, so
     * a renamed or extra legacy row is visible rather than silently ignored.
     */
    private function eventCategories(): array
    {
        $legacy = [];
        try {
            $legacy = DB::connection('crms')->table('event_category')->orderBy('id')->pluck('name', 'id')->all();
        } catch (\Throwable) {
            $legacy = [];
        }

        return array_map(fn (EventCategory $c) => [
            'slug' => $c->slug(),
            'label' => $c->label(),
            'id' => (string) $c->value,
            'legacyName' => $legacy[$c->value] ?? null,
        ], EventCategory::cases());
    }
}
