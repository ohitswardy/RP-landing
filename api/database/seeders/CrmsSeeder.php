<?php

namespace Database\Seeders;

use App\Enums\Crms\EventCategory;
use App\Models\Crms\Client;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\CorporateContact;
use App\Models\Crms\Event;
use App\Models\Crms\Form;
use App\Models\Crms\Interaction;
use App\Models\Crms\InteractionType;
use App\Models\Crms\OneOffMeeting;
use App\Models\Crms\ReportTemplate;
use App\Models\Crms\SectorGroup;
use App\Models\Crms\SellsideContact;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Demo master data for a fresh CRMS database. Idempotent, and a no-op when
 * the schema already holds clients — production data is never touched.
 */
class CrmsSeeder extends Seeder
{
    public function run(): void
    {
        if (Client::exists()) {
            return;
        }

        $cat = DB::connection('crms')->table('event_category');
        if ($cat->count() === 0) {
            $cat->insert([
                ['id' => 1, 'name' => 'Roadshow'], ['id' => 2, 'name' => 'Reverse Roadshow'],
                ['id' => 3, 'name' => 'Meeting'],
            ]);
        }

        /* ── Corporates and the sector hierarchy (§7.8) ──────────── */

        $sectors = [
            'Banks' => ['BPI' => 'Bank of the Philippine Islands', 'BDO' => 'BDO Unibank', 'MBT' => 'Metropolitan Bank & Trust', 'SECB' => 'Security Bank'],
            'Property' => ['ALI' => 'Ayala Land', 'SMPH' => 'SM Prime Holdings', 'FLI' => 'Filinvest Land', 'MEG' => 'Megaworld', 'RLC' => 'Robinsons Land', 'VLL' => 'Vista Land & Lifescapes'],
            'Power & Utilities' => ['ACEN' => 'ACEN Corporation', 'AP' => 'Aboitiz Power', 'FGEN' => 'First Gen', 'MWC' => 'Manila Water', 'MER' => 'Manila Electric Company', 'SCC' => 'Semirara Mining & Power'],
            'Telecommunications' => ['CNVRG' => 'Converge ICT Solutions', 'GLO' => 'Globe Telecom', 'TEL' => 'PLDT'],
            'Consumer' => ['CNPF' => 'Century Pacific Food', 'EMI' => 'Emperador', 'JFC' => 'Jollibee Foods', 'MONDE' => 'Monde Nissin', 'PGOLD' => 'Puregold Price Club', 'RRHI' => 'Robinsons Retail', 'FB' => 'San Miguel Food & Beverage', 'SEVN' => 'Philippine Seven', 'PIZZA' => 'Shakey\'s Pizza Asia Ventures', 'URC' => 'Universal Robina', 'WLCON' => 'Wilcon Depot'],
            'Gaming & Leisure' => ['BLOOM' => 'Bloomberry Resorts'],
            'Mining' => ['NIKL' => 'Nickel Asia'],
            'Conglomerates' => ['AGI' => 'Alliance Global Group', 'AC' => 'Ayala Corporation', 'DMC' => 'DMCI Holdings', 'GTCAP' => 'GT Capital Holdings', 'LTG' => 'LT Group', 'SM' => 'SM Investments'],
            'Transportation' => ['CEB' => 'Cebu Air', 'ICT' => 'International Container Terminal Services'],
        ];

        $corporates = [];
        foreach ($sectors as $sector => $tickers) {
            foreach ($tickers as $ticker => $name) {
                $corporates[$ticker] = Corporate::create([
                    'name' => $name,
                    'ticker' => $ticker,
                    'identifiers1' => "$ticker PM",
                    'identifiers2' => "$ticker.PS",
                    'address' => 'Makati City, Metro Manila',
                    'sector_generic' => $sector,
                    'sector_gmo' => $sector,
                    'sector_jpmorgan' => $sector,
                    'sector_schroders' => $sector,
                    'sector_trowe' => $sector,
                    'corporate_contacts' => [],
                ]);
            }
        }

        foreach (['domestic', 'foreign'] as $scope) {
            $pos = 0;
            foreach ($sectors as $sector => $tickers) {
                $group = SectorGroup::create(['name' => $sector, 'scope' => $scope, 'position' => $pos++]);
                $group->corporates()->sync(array_map(fn ($t) => $corporates[$t]->id, array_keys($tickers)));
            }
        }

        $ir = [
            ['ALI', 'Carla Villanueva', 'Head of Investor Relations', 'ir@ayalaland.com.ph'],
            ['BDO', 'Miguel Santos', 'Investor Relations Officer', 'ir@bdo.com.ph'],
            ['JFC', 'Andrea Lim', 'VP, Corporate Finance & IR', 'ir@jollibee.com.ph'],
            ['ICT', 'Rafael Cruz', 'Investor Relations', 'ir@ictsi.com'],
        ];
        foreach ($ir as [$ticker, $name, $position, $email]) {
            $c = CorporateContact::create(['corporate_id' => $corporates[$ticker]->id, 'name' => $name, 'position' => $position, 'email' => $email, 'analyst' => []]);
            $corp = $corporates[$ticker];
            $corp->corporate_contacts = [$c->toSnapshot()];
            $corp->save();
        }

        /* ── REGIS staff directory ───────────────────────────────── */

        $desk = [
            ['Research Desk', 'research@regis.ph', 'Research', 'Research', null],
            ['Sales Desk', 'sales@regis.ph', 'Sales', 'Institutional Sales', null],
            ['Paolo Gabriel D. Garcia', 'p.garcia@regis.ph', 'Research', 'Senior Analyst, Banks & Property', '+63 917 100 2001'],
            ['Cerre Klyne M. Resullar', 'c.resullar@regis.ph', 'Research', 'Analyst, Consumer & Conglomerates', '+63 917 100 2002'],
            ['Renalyn C. Chu', 'r.chu@regis.ph', 'Sales', 'Director, Institutional Sales', '+63 917 100 2003'],
            ['Carl Stanley T. Sy', 'c.sy@regis.ph', 'Sales', 'Institutional Sales', '+63 917 100 2004'],
            ['Edward S. Dagal', 'e.dagal@regis.ph', 'Management', 'Head of Corporate Access', '+63 917 100 2000'],
        ];
        $staff = [];
        foreach ($desk as [$name, $email, $type, $position, $mobile]) {
            $staff[$email] = SellsideContact::create(['name' => $name, 'email' => $email, 'type' => $type === 'Research' ? 'Analyst' : ($type === 'Sales' ? 'Sales' : 'N/A'), 'position' => $position, 'office_no' => '+63 2 8888 1000', 'mobile_no' => $mobile]);
        }

        /* ── Clients, addresses and contacts ─────────────────────── */

        $firms = [
            ['ARQ Capital', 'Philippines', 'ARQ', 'Local', 'Makati City', [['Katrina', 'Villaruel', 'k.villaruel@arqcapital.ph', 'Head of Research', ['ALI', 'BDO', 'JFC'], ['SM', 'ICT']]]],
            ['Lakefield Asset Management', 'Singapore', 'Lakefield Asset Mgmt', 'Foreign', 'Marina Bay, Singapore', [['Miguel', 'Dizon', 'mdizon@lakefieldam.com', 'Portfolio Manager', ['SMPH', 'BPI'], ['GLO', 'TEL']]]],
            ['Sunward Pensions', 'Philippines', 'Sunward', 'Local', 'Ortigas Center, Pasig', [['Thea', 'Abalos', 'thea.abalos@sunwardpensions.ph', 'Investment Officer', ['MER', 'AP'], ['ACEN']]]],
            ['Schroders', 'United Kingdom', 'Schroder Investment Management', 'Foreign', 'London', [['James', 'Whitfield', 'j.whitfield@schroders.com', 'Fund Manager, Asian Equities', ['ALI', 'SM', 'ICT'], ['JFC', 'URC']]]],
            ['JPMorgan Asset Management', 'Hong Kong', 'JPM · JPMAM', 'Foreign', 'Central, Hong Kong', [['Vivian', 'Cheng', 'vivian.cheng@jpmorgan.com', 'Analyst, ASEAN', ['BDO', 'MBT'], ['SECB']]]],
            ['GMO', 'United States', 'Grantham Mayo Van Otterloo', 'Foreign', 'Boston', [['Daniel', 'Osei', 'dosei@gmo.com', 'Emerging Markets PM', ['TEL', 'GLO'], ['CNVRG']]]],
            ['T. Rowe Price', 'United States', 'TRowe', 'Foreign', 'Baltimore', [['Hannah', 'Park', 'hannah.park@troweprice.com', 'Associate Analyst', ['JFC', 'MONDE'], ['PGOLD']]]],
            ['BlackRock Investment Management', 'Hong Kong', 'BlackRock', 'Foreign', 'Central, Hong Kong', [['Leo', 'Tan', 'leo.tan@blackrock.com', 'Portfolio Manager', ['SM', 'AC'], ['GTCAP']]]],
        ];

        $analysts = [$staff['p.garcia@regis.ph'], $staff['c.resullar@regis.ph']];
        $sales = [$staff['r.chu@regis.ph'], $staff['c.sy@regis.ph']];
        $clients = [];
        $contacts = [];
        foreach ($firms as [$name, $region, $monikers, $type, $addr, $people]) {
            $client = Client::create(['name' => $name, 'region' => $region, 'monikers' => $monikers, 'client_type' => $type]);
            $address = $client->addresses()->create(['name' => $addr]);
            $clients[$name] = $client;
            foreach ($people as [$first, $last, $email, $position, $own, $watch]) {
                $portal = User::where('kind', User::KIND_CLIENT)->whereRaw('LOWER(email) = ?', [mb_strtolower($email)])->value('id');
                $contact = ClientContact::create([
                    'client_id' => $client->id,
                    'client_address_id' => $address->id,
                    'firstname' => $first, 'lastname' => $last, 'email' => $email, 'position' => $position,
                    'country' => $region, 'contact_no' => '+63 2 8000 '.random_int(1000, 9999),
                    'own' => array_map(fn ($t) => $corporates[$t]->toSnapshot(), $own),
                    'watchlist' => array_map(fn ($t) => $corporates[$t]->toSnapshot(), $watch),
                    'coverage_team' => array_map(fn ($s) => $s->toSnapshot(), $analysts),
                    'sales' => [$sales[0]->toSnapshot()],
                    'portal_user_id' => $portal,
                ]);
                $scope = $type === 'Local' ? 'domestic' : 'foreign';
                $contact->sectorGroups()->sync(SectorGroup::where('scope', $scope)->whereIn('name', ['Banks', 'Property'])->pluck('id'));
                $contacts[$name] = $contact;
            }
        }

        foreach ([['Schroders', 'schroders'], ['JPMorgan Asset Management', 'jpmorgan'], ['GMO', 'gmo'], ['T. Rowe Price', 'trowe'], ['BlackRock Investment Management', 'corpaxe']] as [$name, $code]) {
            ReportTemplate::create(['client_id' => $clients[$name]->id, 'code' => $code, 'is_active' => true]);
        }

        /* ── Interaction types and the default form ──────────────── */

        $types = [];
        foreach ([
            ['Conference Call', "One-on-one\nGroup call\nEarnings call"],
            ['Meeting', "One-on-one\nGroup meeting\nSite visit\nLunch"],
            ['Corporate Access', "Roadshow\nReverse roadshow\nConference"],
            ['Email / Chat', "Bloomberg chat\nEmail\nMessage"],
        ] as [$type, $sub]) {
            $types[$type] = InteractionType::create(['type' => $type, 'meeting_type' => $sub, 'client_id' => null]);
        }

        $fields = [];
        $add = function (string $name, string $label, string $fieldType, array $options = [], bool $required = false) use (&$fields) {
            $fields[] = [
                'id' => count($fields) + 1, 'internalName' => $name, 'label' => $label, 'fieldType' => $fieldType,
                'required' => $required, 'multiSelect' => false,
                'options' => ['type' => $options['type'] ?? 'static', 'value' => $options['value'] ?? [], 'bindLabel' => 'name'],
                'defaultValue' => null,
            ];
        };
        $add('stock1', 'Stock discussed 1', 'lookup', ['type' => 'corporate']);
        $add('stock2', 'Stock discussed 2', 'lookup', ['type' => 'corporate']);
        $add('stock3', 'Stock discussed 3', 'lookup', ['type' => 'corporate']);
        $add('sector', 'Sector', 'select', ['value' => array_keys($sectors)]);
        $add('client_initiated', 'Client initiated', 'select', ['value' => ['Yes', 'No']]);
        $add('location', 'Location', 'text');
        Form::create(['client_id' => null, 'fields' => $fields]);

        /* ── Interactions across the last year ───────────────────── */

        $topics = [
            'Discussed 2Q results, NIM outlook and loan growth guidance.',
            'Walked through property pre-sales trends and the office leasing recovery.',
            'Reviewed consumer demand ahead of the holiday quarter; pricing power in focus.',
            'Power tariff reset and renewables pipeline; capex cadence questioned.',
            'Update on telco capex and the fibre rollout; competitive intensity.',
            'Conglomerate NAV discount and the infrastructure pipeline.',
        ];
        $tickers = array_keys($corporates);
        $names = array_keys($clients);
        $seed = 7;
        for ($m = 11; $m >= 0; $m--) {
            $month = now()->subMonths($m);
            $n = 3 + ($m % 3);
            for ($k = 0; $k < $n; $k++) {
                $seed = ($seed * 37 + 11) % 997;
                $client = $clients[$names[$seed % count($names)]];
                $contact = $contacts[$client->name];
                $type = array_values($types)[$seed % count($types)];
                $day = min(1 + ($seed % 27), $month->daysInMonth);
                $start = 9 + ($seed % 8);
                $stock = $tickers[$seed % count($tickers)];
                $regis = $type->type === 'Corporate Access' ? [$analysts[0], $sales[0]] : [$analysts[$seed % 2]];
                Interaction::create([
                    'client_id' => $client->id,
                    'interactions_type_id' => $type->id,
                    'interaction_date' => $month->copy()->day($day)->format('Y-m-d').' 00:00:00',
                    'time_start' => sprintf('%02d:00', $start),
                    'time_end' => sprintf('%02d:%02d', $start, 30 + ($seed % 2) * 15),
                    'duration' => null,
                    'meeting_type' => $type->meetingTypes()[$seed % count($type->meetingTypes())] ?? null,
                    'description' => $topics[$seed % count($topics)],
                    'action_point' => $seed % 4 === 0 ? 'Send the updated model and follow up next week.' : null,
                    'client_contact' => [$contact->toSnapshot()],
                    'sellside_contact' => array_map(fn ($s) => $s->toSnapshot(), $regis),
                    'form' => [
                        ['internalName' => 'stock1', 'label' => 'Stock discussed 1', 'fieldType' => 'lookup', 'value' => $stock],
                        ['internalName' => 'sector', 'label' => 'Sector', 'fieldType' => 'select', 'value' => $corporates[$stock]->sector_generic],
                        ['internalName' => 'client_initiated', 'label' => 'Client initiated', 'fieldType' => 'select', 'value' => $seed % 2 ? 'Yes' : 'No'],
                    ],
                    'disposition' => $seed % 5 === 0 ? Interaction::DISPOSITION_FLAGGED : Interaction::DISPOSITION_CLOSED,
                    'created' => now(),
                ]);
            }
        }

        /* ── Events: one of each type ────────────────────────────── */

        $coordinator = ['coordinator' => 'Edward S. Dagal', 'tel_no' => '+63 2 8888 1000', 'mobile_no' => '+63 917 100 2000', 'email' => 'e.dagal@regis.ph'];

        $roadshow = Event::create($coordinator + [
            'category' => EventCategory::Roadshow->value,
            'classification' => 'Non-Deal Roadshow',
            'start_date' => now()->addDays(10)->format('Y-m-d').' 00:00:00',
            'end_date' => now()->addDays(12)->format('Y-m-d').' 00:00:00',
            'corporate_id' => $corporates['ALI']->id,
            'client_contact' => [],
            'sellside_contact' => [$analysts[0]->toSnapshot()],
        ]);
        $this->logistics($roadshow, 'Singapore', now()->addDays(10), 3, [
            [$clients['Lakefield Asset Management'], $contacts['Lakefield Asset Management'], '09:00', '10:00'],
            [$clients['Schroders'], $contacts['Schroders'], '11:00', '12:00'],
            [$clients['GMO'], $contacts['GMO'], '14:00', '15:00'],
        ], $staff);

        $reverse = Event::create($coordinator + [
            'category' => EventCategory::ReverseRoadshow->value,
            'start_date' => now()->subDays(20)->format('Y-m-d').' 00:00:00',
            'end_date' => now()->subDays(19)->format('Y-m-d').' 00:00:00',
            'client_id' => $clients['Schroders']->id,
            'client_contact' => [$contacts['Schroders']->toSnapshot()],
            'sellside_contact' => [$sales[0]->toSnapshot()],
        ]);
        foreach ([['ALI', '09:00'], ['BDO', '11:00'], ['JFC', '14:00'], ['ICT', '16:00']] as $i => [$t, $time]) {
            $reverse->meetings()->create([
                'date' => now()->subDays(20 - intdiv($i, 2))->format('Y-m-d').' 00:00:00',
                'time_start' => $time, 'time_end' => substr($time, 0, 2) === '16' ? '17:00' : sprintf('%02d:00', (int) substr($time, 0, 2) + 1),
                'timezone' => 'MNL', 'location' => $corporates[$t]->name.' head office', 'meeting_type' => 'One-on-one',
                'corporate_type' => 'corporate', 'corporate_id' => $corporates[$t]->id, 'client_id' => $clients['Schroders']->id,
                'client_contact' => [$contacts['Schroders']->toSnapshot()],
                'corporate_contact' => $corporates[$t]->corporate_contacts,
            ]);
        }
        $reverse->attendees()->create(['sellside_contact_id' => $sales[0]->id, 'position' => $sales[0]->position, 'office_no' => $sales[0]->office_no, 'mobile_no' => $sales[0]->mobile_no, 'email' => $sales[0]->email]);

        Event::create($coordinator + [
            'category' => EventCategory::AnalystMarketing->value,
            'start_date' => now()->addDays(30)->format('Y-m-d').' 00:00:00',
            'end_date' => now()->addDays(32)->format('Y-m-d').' 00:00:00',
            'client_contact' => [],
            'sellside_contact' => [$analysts[1]->toSnapshot()],
        ])->meetings()->create([
            'date' => now()->addDays(30)->format('Y-m-d').' 00:00:00',
            'time_start' => '10:00', 'time_end' => '11:00', 'timezone' => 'HKT',
            'location' => 'Two IFC, Central', 'meeting_type' => 'One-on-one', 'corporate_type' => 'client',
            'client_id' => $clients['JPMorgan Asset Management']->id,
            'client_contact' => [$contacts['JPMorgan Asset Management']->toSnapshot()], 'corporate_contact' => [],
        ]);

        OneOffMeeting::create([
            'start_date' => now()->addDays(3)->format('Y-m-d').' 00:00:00',
            'end_date' => now()->addDays(3)->format('Y-m-d').' 00:00:00',
            'time_start' => '15:00', 'time_end' => '16:00', 'timezone' => 'MNL',
            'location' => 'Regis Partners, Makati', 'meeting_type' => '1-on-1', 'classification' => 'corporate',
            'client_id' => $clients['ARQ Capital']->id, 'corporate_id' => $corporates['JFC']->id,
            'client_contact' => [$contacts['ARQ Capital']->toSnapshot()], 'corporate_contact' => $corporates['JFC']->corporate_contacts,
            'created' => now(),
        ]);
    }

    /** Meetings, investors, a flight, ground transport and a hotel for a travelling roadshow. */
    private function logistics(Event $event, string $city, $start, int $days, array $slots, array $staff): void
    {
        foreach ($slots as $i => [$client, $contact, $from, $to]) {
            $event->meetings()->create([
                'date' => $start->copy()->addDays($i % $days)->format('Y-m-d').' 00:00:00',
                'time_start' => $from, 'time_end' => $to, 'timezone' => 'SGT',
                'location' => $client->name.' office, '.$city, 'meeting_type' => 'One-on-one', 'corporate_type' => 'client',
                'client_id' => $client->id, 'client_contact' => [$contact->toSnapshot()], 'corporate_contact' => [],
            ]);
            $event->investors()->create(['client_id' => $client->id, 'client_contact' => [$contact->toSnapshot()]]);
        }
        $event->flights()->create([
            'date' => $start->copy()->subDay()->format('Y-m-d').' 00:00:00', 'time' => '18:30', 'timezone' => 'MNL',
            'location' => 'MNL · NAIA Terminal 3', 'description' => 'PR 507', 'date_arrival' => $start->copy()->subDay()->format('Y-m-d').' 00:00:00',
            'time_arrival' => '22:15', 'timezone_arrival' => 'SGT', 'location_arrival' => 'SIN · Changi T1',
            'passenger' => "Paolo Gabriel D. Garcia\nCarla Villanueva",
        ]);
        $event->transportation()->create([
            'date' => $start->format('Y-m-d').' 00:00:00', 'start_time' => '08:15', 'end_time' => '18:00', 'timezone' => 'SGT',
            'location' => 'Hotel lobby', 'description' => 'Full-day car', 'driver_name' => 'Mr. Lim', 'driver_mobile' => '+65 9123 4567',
            'vehicle_type' => 'Toyota Alphard', 'confirm_no' => 'SG-40921', 'passenger' => "Paolo Gabriel D. Garcia\nCarla Villanueva",
        ]);
        $event->accommodation()->create([
            'date' => $start->copy()->subDay()->format('Y-m-d').' 00:00:00', 'time_in' => '23:00',
            'date_out' => $start->copy()->addDays($days - 1)->format('Y-m-d').' 00:00:00', 'time_out' => '12:00',
            'location' => $city, 'description' => 'The Fullerton Hotel Singapore', 'accommodator' => "Paolo Gabriel D. Garcia\nCarla Villanueva",
            'note' => 'Corporate rate; breakfast included.',
        ]);
        $analyst = $staff['p.garcia@regis.ph'];
        $event->attendees()->create(['sellside_contact_id' => $analyst->id, 'position' => $analyst->position, 'office_no' => $analyst->office_no, 'mobile_no' => $analyst->mobile_no, 'email' => $analyst->email]);
    }
}
