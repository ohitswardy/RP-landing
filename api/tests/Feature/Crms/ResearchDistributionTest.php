<?php

namespace Tests\Feature\Crms;

use App\Models\Crms\Corporate;
use App\Models\Crms\SectorGroup;
use App\Support\ResearchDistribution;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The Research-Domestics / Research-Foreign hierarchy the client dictated:
 * the two audiences carry different lists, every ticker must resolve to a
 * real `corporate` row despite the legacy suffixes and the EMI/EMP rename,
 * and applying the spec twice may not disturb an Administrator's edits.
 */
class ResearchDistributionTest extends TestCase
{
    use RefreshDatabase;

    /** The tickers as the legacy dump spells them, including the noisy ones. */
    private const DUMP = [
        'BPI', 'BDO', 'MBT', 'SECB', 'ALI', 'SMPH', 'AREIT', 'MEG', 'RLC', 'RCR', 'FLI', 'VLL',
        'ACEN', 'AP', 'FGEN', 'MWC', 'MER', 'SCC', 'CNVRG', 'GLO', 'TEL',
        'CNPF', 'EMP', 'JFC', 'MONDE', 'PGOLD', 'RRHI', 'FB', 'SEVN', 'PIZZA', 'URC', 'WLCON',
        'BLOOM', 'NIKL', 'APX PM', 'AGI', 'AC', 'DMC', 'GTCAP', 'LTG', 'SM', 'CEB', 'ICT',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate', ['--database' => 'crms', '--path' => [
            'database/migrations/2026_09_07_100000_create_crms_schema.php',
            'database/migrations/2026_09_18_100000_add_important_to_crms_interactions.php',
            'database/migrations/2026_09_22_100000_add_layout_to_crms_report_templates.php',
        ]]);

        foreach (self::DUMP as $ticker) {
            Corporate::create(['name' => $ticker.' Corporation', 'ticker' => $ticker, 'corporate_contacts' => []]);
        }
    }

    public function test_every_ticker_in_the_spec_resolves_to_a_corporate(): void
    {
        foreach (array_keys(ResearchDistribution::SPEC) as $scope) {
            foreach (ResearchDistribution::resolve($scope) as $sector) {
                $this->assertSame([], $sector['missing'], "{$scope} · {$sector['name']} has unresolved tickers");
                $this->assertCount(count($sector['tickers']), $sector['corporateIds']);
            }
        }
    }

    public function test_legacy_suffixes_and_the_emperador_rename_are_resolved(): void
    {
        $this->assertSame('APX', ResearchDistribution::normalise('APX PM'));
        $this->assertSame('CREIT', ResearchDistribution::normalise(' creit.ps '));
        $this->assertSame('GSMI', ResearchDistribution::normalise('GSMI '));

        ResearchDistribution::apply();

        $mining = SectorGroup::where('scope', 'domestic')->where('name', 'Mining')->firstOrFail();
        $this->assertEqualsCanonicalizing(['NIKL', 'APX PM'], $mining->corporates()->pluck('ticker')->all());

        $consumer = SectorGroup::where('scope', 'foreign')->where('name', 'Consumer')->firstOrFail();
        $this->assertContains('EMP', $consumer->corporates()->pluck('ticker')->all());
    }

    public function test_the_two_audiences_differ_where_the_client_says_they_differ(): void
    {
        ResearchDistribution::apply();

        $tickers = fn (string $scope, string $name) => SectorGroup::where('scope', $scope)->where('name', $name)
            ->firstOrFail()->corporates()->pluck('ticker')->all();

        $this->assertEqualsCanonicalizing(['ALI', 'SMPH', 'AREIT', 'MEG', 'RLC', 'RCR'], $tickers('domestic', 'Property'));
        $this->assertEqualsCanonicalizing(['ALI', 'SMPH', 'FLI', 'MEG', 'RLC', 'VLL'], $tickers('foreign', 'Property'));
        $this->assertNotContains('EMP', $tickers('domestic', 'Consumer'));
        $this->assertSame(['NIKL'], $tickers('foreign', 'Mining'));

        // Strategy leads both audiences and covers no single ticker.
        foreach (['domestic', 'foreign'] as $scope) {
            $strategy = SectorGroup::where('scope', $scope)->where('name', 'Strategy')->firstOrFail();
            $this->assertSame(0, (int) $strategy->position);
            $this->assertSame(0, $strategy->corporates()->count());
        }
        $this->assertSame(20, SectorGroup::count());
    }

    public function test_a_second_run_keeps_administrator_edits_unless_forced(): void
    {
        ResearchDistribution::apply();

        $banks = SectorGroup::where('scope', 'domestic')->where('name', 'Banks')->firstOrFail();
        $banks->corporates()->sync([Corporate::where('ticker', 'BPI')->value('id')]);

        ResearchDistribution::apply();
        $this->assertSame(['BPI'], $banks->corporates()->pluck('ticker')->all());

        ResearchDistribution::apply(force: true);
        $this->assertEqualsCanonicalizing(['BPI', 'BDO', 'MBT', 'SECB'], $banks->corporates()->pluck('ticker')->all());
        $this->assertSame(20, SectorGroup::count());
    }

    public function test_dry_run_writes_nothing(): void
    {
        $log = ResearchDistribution::apply(force: false, dryRun: true);

        $this->assertSame(0, SectorGroup::count());
        $this->assertSame('would be created', $log[0]['action']);
    }
}
