<?php

namespace Database\Seeders;

use App\Models\Crms\Client;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\CorporateContact;
use App\Models\Crms\ReportTemplate;
use App\Models\Crms\SectorGroup;
use App\Services\Crms\PortalAccountResolver;
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

    /** Database.md §6 — the six clients with their own Excel layout. */
    private function reportTemplates(): void
    {
        foreach ([10 => 'corpaxe', 23 => 'corpaxe', 59 => 'gmo', 72 => 'jpmorgan', 126 => 'schroders', 139 => 'trowe'] as $clientId => $code) {
            if (Client::whereKey($clientId)->exists()) {
                ReportTemplate::updateOrCreate(['client_id' => $clientId], ['code' => $code, 'is_active' => true]);
            }
        }
    }

    /** The Domestic / Foreign sector → ticker hierarchy from the client's requirements. */
    private function sectorGroups(): void
    {
        $sectors = [
            'Banks' => ['BPI', 'BDO', 'MBT', 'SECB'],
            'Property' => ['ALI', 'SMPH', 'FLI', 'MEG', 'RLC', 'VLL'],
            'Power & Utilities' => ['ACEN', 'AP', 'FGEN', 'MWC', 'MER', 'SCC'],
            'Telecommunications' => ['CNVRG', 'GLO', 'TEL'],
            'Consumer' => ['CNPF', 'EMI', 'JFC', 'MONDE', 'PGOLD', 'RRHI', 'FB', 'SEVN', 'PIZZA', 'URC', 'WLCON'],
            'Gaming & Leisure' => ['BLOOM'],
            'Mining' => ['NIKL'],
            'Conglomerates' => ['AGI', 'AC', 'DMC', 'GTCAP', 'LTG', 'SM'],
            'Transportation' => ['CEB', 'ICT'],
        ];
        $byTicker = Corporate::whereNotNull('ticker')->get()->keyBy(fn (Corporate $c) => strtoupper(trim((string) $c->ticker)));

        foreach (['domestic', 'foreign'] as $scope) {
            $position = 0;
            foreach ($sectors as $name => $tickers) {
                $group = SectorGroup::firstOrCreate(['name' => $name, 'scope' => $scope], ['position' => $position]);
                $ids = collect($tickers)->map(fn ($t) => $byTicker->get($t)?->id)->filter()->values()->all();
                // Only fill an empty group: an Administrator's later edits are theirs to keep.
                if ($group->corporates()->count() === 0 && $ids !== []) {
                    $group->corporates()->sync($ids);
                }
                $position++;
            }
        }
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
