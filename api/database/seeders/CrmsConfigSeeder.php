<?php

namespace Database\Seeders;

use App\Models\Crms\Client;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\CorporateContact;
use App\Models\Crms\ReportTemplate;
use App\Services\Crms\PortalAccountResolver;
use App\Support\ResearchDistribution;
use Illuminate\Database\Seeder;

/**
 * Configuration on top of the production CRMS data — idempotent, additive,
 * and safe to re-run: the report template bindings that replace the legacy
 * hard-coded client ids (Database.md §6), the research distribution
 * hierarchy (CRMSmasterplan.md §7.8) resolved against the real corporates,
 * the corporate_contact.corporate_id backfill from the embedded JSON, and
 * the email-match portal link.
 */
class CrmsConfigSeeder extends Seeder
{
    public function run(): void
    {
        $this->reportTemplates();
        $this->sectorGroups();
        $this->backfillCorporateContacts();
        $this->linkPortalAccounts();
    }

    /**
     * Database.md §6 — the clients with their own Excel layout: Schroders and
     * JPM take the Commcise upload template, the "Jefferies" client row holds
     * the bulk-upload workbook (Reports → Jefferies monthly), and the legacy
     * layouts stay bound to 10, 23, 59, 139. A workbook the desk imported
     * over any of these (`custom`) is never overwritten by a re-seed.
     */
    private function reportTemplates(): void
    {
        $bindings = [10 => 'corpaxe', 23 => 'corpaxe', 59 => 'gmo', 72 => 'commcise', 126 => 'commcise', 139 => 'trowe'];
        if ($jefferies = Client::jefferiesId()) {
            $bindings[$jefferies] = 'jefferies';
        }
        foreach ($bindings as $clientId => $code) {
            if (! Client::whereKey($clientId)->exists() || ReportTemplate::where('client_id', $clientId)->first()?->hasLayout()) {
                continue;
            }
            ReportTemplate::updateOrCreate(['client_id' => $clientId], ['code' => $code, 'is_active' => true]);
        }
    }

    /**
     * The Research-Domestics / Research-Foreign sector → ticker hierarchy,
     * held in App\Support\ResearchDistribution and resolved against the real
     * corporates. Only empty sectors are tagged here; `php artisan
     * crms:distribution-list --force` is the way to overwrite drifted ones.
     */
    private function sectorGroups(): void
    {
        ResearchDistribution::apply();
    }

    /**
     * corporate.corporate_contacts embeds each issuer's people with their
     * corporate_contact.id; the additive corporate_id column makes that a
     * real relation. Only rows still unassigned are touched.
     */
    private function backfillCorporateContacts(): void
    {
        foreach (Corporate::all() as $corporate) {
            $ids = collect($corporate->corporate_contacts)->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();
            if ($ids !== []) {
                CorporateContact::whereIn('id', $ids)->whereNull('corporate_id')->update(['corporate_id' => $corporate->id]);
            }
        }
    }

    /** Rule 1 of §7.6 — the only automatic link: one portal account with exactly this email. */
    private function linkPortalAccounts(): void
    {
        $resolver = app(PortalAccountResolver::class);
        ClientContact::whereNull('portal_user_id')->whereNotNull('email')->where('email', '<>', '')
            ->each(fn (ClientContact $c) => $resolver->autoLinkByEmail($c));
    }
}
