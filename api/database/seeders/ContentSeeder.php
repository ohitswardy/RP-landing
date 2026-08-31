<?php

namespace Database\Seeders;

use App\Models\AboutPage;
use App\Models\Article;
use App\Models\AuditEntry;
use App\Models\CareerPost;
use App\Models\Company;
use App\Models\ContactPage;
use App\Models\MediaAsset;
use App\Models\PageBlock;
use App\Models\Report;
use App\Models\ServiceLine;
use App\Models\ServicePage;
use App\Models\StaffMember;
use App\Models\Subscriber;
use App\Models\WatchSymbol;
use App\Support\AboutDefaults;
use App\Support\ContactDefaults;
use App\Support\LegalDefaults;
use App\Support\PeopleDefaults;
use App\Support\ServiceDefaults;
use Illuminate\Database\Seeder;

class ContentSeeder extends Seeder
{
    private const SAMPLE_PDF = '/reports/regis-sample-report.pdf';

    public function run(): void
    {
        $this->articles();
        $this->reports();
        $this->people();
        $this->about();
        $this->contact();
        $this->services();
        $this->careers();
        $this->watchlist();
        $this->subscribers();
        $this->pages();
        $this->media();
        $this->audit();
    }

    private function articles(): void
    {
        $rows = [
            ['Strategy', 'PSEi 7,400: the earnings math behind our year-end target.', 'C. Sy', '2026-08-21', 'review', 0, 'Consensus is still marking to the 2024 multiple. We walk through why the re-rating case rests on banks and holding-company discounts, not on the index heavyweights.'],
            ['Banks', 'The deposit war nobody declared: funding costs into Q4.', 'C. Resullar', '2026-08-18', 'draft', 0, 'Time-deposit repricing is running ahead of loan yields for the first time since 2022. Three banks absorb it; two pass it on.'],
            ['Macro', 'Remittance seasonality and the peso: the September setup.', 'P. Garcia', '2026-08-12', 'published', 1874, 'The seasonal remittance surge meets a thinner BSP forward book this year. What that means for importers, and for index FX sensitivity.'],
            ['Power', 'Reserve margins after the July outages: who actually earns.', 'A. Lim', '2026-08-04', 'published', 2941, 'WESM spiked, but merchant exposure is not where the market thinks it is. A plant-by-plant walk through the dispatch stack.'],
            ['Property', 'POGO exit, two years on: the office market has re-based.', 'A. Lim', '2026-07-28', 'published', 3260, 'Vacancy in the Bay Area has stopped making headlines because it stopped getting worse. The recovery is narrow, and rents tell you where.'],
            ['Consumer', 'Sari-sari digitization: the distribution moat, quantified.', 'P. Cruz', '2026-07-15', 'published', 4102, 'Route-to-market data from 1.3M outlets says the discounters are not winning where the market assumes they are.'],
            ['Single name', 'ICT: an underappreciated optionality on Manila Port volumes.', 'J. Reyes', '2026-05-19', 'published', 6519, 'Berth productivity, yard density, and the tariff reset — the three levers the street models flat.'],
            ['Policy', "BSP's quiet pivot, in five charts.", 'M. Bautista', '2026-05-16', 'published', 7208, 'The reaction function changed in April. Nobody put it in a statement, but the numbers did.'],
        ];

        foreach ($rows as [$tag, $title, $author, $date, $status, $reads, $excerpt]) {
            Article::create(compact('tag', 'title', 'author', 'date', 'status', 'reads', 'excerpt'));
        }
    }

    private function reports(): void
    {
        // Covered names, each classified local or foreign. Reports link by name below.
        $companies = [
            'Ayala Land' => 'Local',
            'Meralco' => 'Local',
            'International Container Terminal Services' => 'Local',
            'Universal Robina' => 'Local',
            'Ayala Corp' => 'Local',
            'Nickel Asia' => 'Local',
            'Bloomberry Resorts' => 'Local',
            'Manila Water' => 'Local',
            'SM Prime' => 'Local',
        ];
        $companyIds = [];
        foreach ($companies as $name => $type) {
            $companyIds[$name] = Company::firstOrCreate(['name' => $name], ['type' => $type])->id;
        }

        $rows = [
            ['Philippine Banks: the deposit war nobody declared', 'Banks', null, 'C. Resullar, CFA', '2026-08-22', 14, 'Time-deposit repricing is running ahead of loan yields for the first time since 2022. Three franchises absorb it; two pass it on.', 'ph-banks-deposit-war.pdf', 1842000],
            ['PSEi 7,400: the earnings math behind our year-end target', 'Macro / Strategy', null, 'C. Sy, CFA', '2026-08-20', 22, 'The re-rating case rests on banks and holding-company discounts, not on the index heavyweights the street keeps modelling.', 'psei-7400-year-end.pdf', 2640000],
            ['Ayala Land: the office market has re-based, not recovered', 'Property', 'Ayala Land', 'P. Garcia', '2026-08-15', 18, 'Bay Area vacancy stopped making headlines because it stopped getting worse. The recovery is narrow, and rents tell you where.', 'ali-office-rebase.pdf', 2110000],
            ['Meralco: reserve margins after the July outages', 'Power', 'Meralco', 'P. Garcia', '2026-08-11', 16, 'WESM spiked, but merchant exposure is not where the market thinks it is. A plant-by-plant walk through the dispatch stack.', 'mer-reserve-margins.pdf', 1970000],
            ['ICT: underappreciated optionality on Manila port volumes', 'Transportation', 'International Container Terminal Services', 'C. Sy, CFA', '2026-08-06', 12, 'Berth productivity, yard density, and the tariff reset — the three levers the street models flat.', 'ict-manila-volumes.pdf', 1480000],
            ['Universal Robina: the discounter thesis, stress-tested', 'Consumer', 'Universal Robina', 'C. Resullar, CFA', '2026-08-01', 20, 'Route-to-market data from 1.3M outlets says the discounters are not winning where the market assumes they are.', 'urc-discounter-thesis.pdf', 2320000],
            ['Ayala Corp: unpacking the holding-company discount', 'Conglomerates', 'Ayala Corp', 'C. Sy, CFA', '2026-07-27', 24, 'A sum-of-the-parts that the market has stopped updating. Where the 38% discount is earned, and where it is lazy.', 'ac-holdco-discount.pdf', 2910000],
            ['Globe vs. PLDT: the capex truce and the FCF inflection', 'Telecommunications', null, 'P. Garcia', '2026-07-21', 15, 'Tower monetisation is done; the story is now free cash flow. We model the dividend runway both ways.', 'glo-tel-fcf.pdf', 1760000],
            ['Nickel Asia: the Indonesia supply overhang, quantified', 'Mining', 'Nickel Asia', 'C. Resullar, CFA', '2026-07-14', 13, 'LME nickel is pricing an Indonesian discipline that the export data does not support. Cost-curve implications for local ore.', 'nikl-supply-overhang.pdf', 1540000],
            ['Bloomberry Resorts: mass-market GGR past the peak?', 'Hotels / Leisure / Gaming', 'Bloomberry Resorts', 'P. Garcia', '2026-07-08', 17, 'Junket is gone and never coming back. Whether mass-market gross gaming revenue has plateaued is the only debate that matters.', 'blo-mass-market-ggr.pdf', 2040000],
            ['Manila Water: the tariff reset and the return path', 'Utilities', 'Manila Water', 'C. Sy, CFA', '2026-06-30', 11, 'The rebasing is finally through. We walk the allowed return, the capex commitment, and the concession renewal risk.', 'mwc-tariff-reset.pdf', 1310000],
            ['SM Prime: the NLEX-to-mall land bank optionality', 'Infrastructure', 'SM Prime', 'P. Garcia', '2026-06-23', 19, 'Reclamation politics aside, the entitled land bank is a multi-cycle option the market marks at zero.', 'smph-land-bank.pdf', 2260000],
        ];

        foreach ($rows as [$title, $category, $companyName, $analyst, $date, $pages, $summary, $fileName, $fileSize]) {
            Report::create([
                'title' => $title,
                'category' => $category,
                'company_id' => $companyName !== null ? $companyIds[$companyName] : null,
                'analyst' => $analyst,
                'date' => $date,
                'pages' => $pages,
                'summary' => $summary,
                'file_name' => $fileName,
                'file_size' => $fileSize,
                'file_url' => self::SAMPLE_PDF,
                'file_path' => null,
            ]);
        }
    }

    private function people(): void
    {
        foreach (PeopleDefaults::all() as $i => $person) {
            StaffMember::create([...$person, 'visible' => true, 'position' => $i]);
        }
    }

    private function about(): void
    {
        AboutPage::create(['content' => AboutDefaults::content()]);
    }

    private function contact(): void
    {
        ContactPage::create(['content' => ContactDefaults::content()]);
    }

    private function services(): void
    {
        ServicePage::create(ServiceDefaults::page());

        foreach (ServiceDefaults::lines() as $i => $line) {
            ServiceLine::create([...$line, 'live' => true, 'position' => $i]);
        }
    }

    private function careers(): void
    {
        $rows = [
            ['Equity Research Analyst — Banks & Financials', 'Research', 'Full-time', 'Makati', '2026-08-11', 'open', 47],
            ['Institutional Sales Associate', 'Sales & Trading', 'Full-time', 'Makati', '2026-08-03', 'open', 63],
            ['Settlements Officer', 'Operations', 'Full-time', 'Makati', '2026-07-22', 'open', 118],
            ['Compliance Associate', 'Operations', 'Full-time', 'Makati', '2026-07-06', 'closed', 92],
            ['Research Intern — Macro & Strategy', 'Research', 'Internship', 'Makati / Hybrid', '2026-06-15', 'closed', 214],
        ];

        foreach ($rows as [$title, $dept, $type, $location, $posted, $status, $applicants]) {
            CareerPost::create(compact('title', 'dept', 'type', 'location', 'posted', 'status', 'applicants'));
        }
    }

    private function watchlist(): void
    {
        $rows = [
            ['PSEi', 'PSE Composite Index', true],
            ['ALI', 'Ayala Land', false],
            ['BPI', 'Bank of the Philippine Islands', false],
            ['SM', 'SM Investments', false],
            ['JFC', 'Jollibee Foods', false],
            ['TEL', 'PLDT', false],
            ['AC', 'Ayala Corporation', false],
            ['ICT', 'Intl. Container Terminal Services', false],
            ['BDO', 'BDO Unibank', false],
            ['MER', 'Meralco', false],
            ['URC', 'Universal Robina', false],
            ['GLO', 'Globe Telecom', false],
            ['AEV', 'Aboitiz Equity Ventures', false],
            ['MBT', 'Metrobank', false],
            ['AP', 'Aboitiz Power', false],
        ];

        foreach ($rows as $i => [$sym, $name, $pinned]) {
            WatchSymbol::create(['sym' => $sym, 'name' => $name, 'pinned' => $pinned, 'position' => $i]);
        }
    }

    private function subscribers(): void
    {
        $rows = [
            ['k.villaruel@arqcapital.ph', 'ARQ Capital', '2026-08-19', 'Insights page', true],
            ['mdizon@lakefieldam.com', 'Lakefield Asset Mgmt', '2026-08-17', 'Conference', true],
            ['thea.abalos@sunwardpensions.ph', 'Sunward Pensions', '2026-08-14', 'Footer', true],
            ['j.okabe@meridian-hk.com', 'Meridian Partners HK', '2026-08-09', 'Referral', true],
            ['bianca.t@cordovafunds.com', 'Cordova Funds', '2026-08-02', 'Insights page', false],
            ['rlagdameo@stratos.ph', 'Stratos Securities', '2026-07-28', 'Footer', true],
            ['w.cheng@harborviewsg.com', 'Harborview SG', '2026-07-21', 'Conference', true],
            ['a.buenaflor@pilarpension.gov.ph', 'Pilar Pension', '2026-07-11', 'Insights page', true],
            ['gtorralba@novaliches-cap.ph', 'Novaliches Capital', '2026-06-30', 'Referral', false],
            ['shofmann@tidewater-em.com', 'Tidewater EM', '2026-06-18', 'Conference', true],
        ];

        foreach ($rows as [$email, $firm, $joined, $source, $verified]) {
            Subscriber::create(compact('email', 'firm', 'joined', 'source', 'verified'));
        }
    }

    /** Legal copy: the two documents the footer and login portals render. */
    private function pages(): void
    {
        // The legal migration plants these too, so a fresh --seed must not double up.
        foreach (LegalDefaults::blocks() as $block) {
            PageBlock::updateOrCreate(
                ['page' => $block['page'], 'field' => $block['field']],
                $block + ['updated' => '2026-03-15', 'editor' => 'J. Mirasol'],
            );
        }
    }

    private function media(): void
    {
        $rows = [
            ['/Banner.png', 'Home hero banner', 'graphic', 'Home'],
            ['/hero-lobby.jpg', 'Lobby, 20/F Tower One', 'photo', 'Home'],
            ['/Skyline.jpg', 'Makati skyline dusk', 'photo', 'About'],
            ['/President.png', 'Leadership letter portrait', 'portrait', 'About'],
            ['/People of Regis.png', 'Team composite', 'photo', 'About'],
            ['/InsightsBG.png', 'Insights header', 'graphic', 'Insights'],
            ['/CareersBG.png', 'Careers banner', 'graphic', 'Careers'],
            ['/Services Hero.png', 'Services header', 'graphic', 'Services'],
            ['/Services1.jpg', 'Research advisory', 'photo', 'Services / Research'],
            ['/Services2.jpg', 'Sales advisory', 'photo', 'Services / Sales'],
            ['/Services3.jpg', 'Trading & execution', 'photo', 'Services / Trading'],
            ['/Services4.jpg', 'Corporate access', 'photo', 'Services / Corporate'],
            ['/insight-meeting.jpg', 'Morning meeting', 'photo', 'Home / Insights'],
            ['/insight-presenting.jpg', 'Conference presentation', 'photo', 'Home / Insights'],
            ['/StockWork.png', 'Desk at close', 'photo', 'Home'],
            ['/sunray.jpg', 'Tower sunray', 'photo', 'Culture'],
        ];

        foreach ($rows as [$path, $label, $kind, $usedBy]) {
            MediaAsset::create(['path' => $path, 'label' => $label, 'kind' => $kind, 'used_by' => $usedBy]);
        }
    }

    private function audit(): void
    {
        $rows = [
            ['C. Sy', 'Submitted for review', 'PSEi 7,400: the earnings math behind our year-end target.', '2026-08-21 16:42:00'],
            ['R. Chu', 'Updated posting', 'Careers / Equity Research Analyst — Banks & Financials', '2026-08-20 10:18:00'],
            ['C. Resullar', 'Saved draft', 'The deposit war nobody declared: funding costs into Q4.', '2026-08-18 18:03:00'],
            ['E. Dagal', 'Suspended account', 'm.salvador@regis.ph', '2026-08-15 09:27:00'],
            ['P. Garcia', 'Published', 'Remittance seasonality and the peso: the September setup.', '2026-08-12 08:55:00'],
            ['R. Chu', 'Replaced asset', '/CareersBG.png', '2026-08-08 14:31:00'],
            ['A. Lim', 'Published', 'Reserve margins after the July outages: who actually earns.', '2026-08-04 09:12:00'],
        ];

        foreach ($rows as [$actor, $action, $target, $at]) {
            AuditEntry::create(['actor' => $actor, 'action' => $action, 'target' => $target, 'at' => $at]);
        }
    }
}
