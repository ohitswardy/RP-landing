<?php

namespace App\Services\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\ClientAddress;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Corporate;
use App\Models\Crms\Interaction;
use App\Models\Crms\ReportTemplate;
use App\Support\SimpleXlsx;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * One code path for every consumption report. The date range is applied as
 * a real WHERE on interaction_date and every row in range is selected
 * regardless of who logged it — the two legacy bugs (CRMSmasterplan.md
 * §7.3) are fixed here, once, for all report types and client templates.
 *
 * Layouts mirror the workbooks the client's compliance desk already
 * receives (Call_Report_*.xlsx and generic_*.xlsx, 2026-09-18):
 *
 *  - Generic: the flat Salesforce / T1C extract — one sheet, the exact
 *    column set on row 1, so it can be uploaded as-is.
 *  - Internal ("Call Report"): Bespoke detail, Official events (the
 *    corporate-access subset), Summary rankings, a firm × month pivot and
 *    per-person Sales / Analysts sheets keyed by who logged the row.
 *  - By client: the layout bound to that client, else the generic extract.
 */
class ReportGenerator
{
    public const TYPES = ['generic', 'internal', 'client'];

    /** The legacy workbook labels every time of day with this zone (PH shares UTC+8). */
    public const TIME_ZONE = 'HKT';

    /** Interaction types that count as corporate access; matched on a normalised name. */
    public const CORPORATE_ACCESS = [
        'Roadshow:Deal', 'Deal Related', 'Roadshow:Non-Deal', 'Non Deal Roadshow',
        'Bespoke Access', 'Expert Meeting', 'Industry Expert', 'Conference', 'Field Trip',
    ];

    private const EXTRACT_HEADERS = [
        'Type__c', 'T1C_BASE__LOCATION__C', 'T1C_BASE__CITY__C', 'T1C_BASE__MEETING_DATE__C', 'T1C_BASE__NOTES__C',
        'T1C_BASE__SUBJECT_MEETING_OBJECTIVES__C', 'T1C_BASE__TIME_SPENT_MIN__C', 'LINE_OF_BUSINESS__C', 'SOLICITED__C',
        'T_E_EXPENSE__C', 'T_E_DESCRIPTION__C', 'OWNER__C', 'SOURCE__C', 'Topics (Tickers)',
        'Contact [Person(s) who attended from the client]', 'OJ Contact Id', 'Internal Attendee (Jefferies)', 'Client/Firm',
    ];

    /** Column widths by header text; anything else is sized from its header. */
    private const WIDTHS = [
        'Date' => 12, 'Firm' => 34, 'Investor' => 36, 'Broker' => 32, 'Description of interaction' => 64, 'Stocks' => 18,
        'Initiated by' => 13, 'Interaction type' => 24, 'Meeting Type' => 16, 'Duration' => 10, 'Time' => 11,
        'Type__c' => 30, 'T1C_BASE__LOCATION__C' => 44, 'T1C_BASE__CITY__C' => 14, 'T1C_BASE__MEETING_DATE__C' => 15,
        'T1C_BASE__NOTES__C' => 52, 'T1C_BASE__SUBJECT_MEETING_OBJECTIVES__C' => 64, 'T1C_BASE__TIME_SPENT_MIN__C' => 12,
        'LINE_OF_BUSINESS__C' => 14, 'SOLICITED__C' => 12, 'T_E_EXPENSE__C' => 14, 'T_E_DESCRIPTION__C' => 18,
        'OWNER__C' => 22, 'SOURCE__C' => 10, 'Topics (Tickers)' => 22, 'Contact [Person(s) who attended from the client]' => 44,
        'OJ Contact Id' => 14, 'Internal Attendee (Jefferies)' => 40, 'Client/Firm' => 34,
        'Contact(s)' => 36, 'Analyst / Sales' => 32, 'Notes' => 56, 'Description' => 56, 'Summary' => 56,
        'GMO Contact' => 36, 'Broker Contact' => 32, 'JPM Attendee(s)' => 36, 'Broker Attendee(s)' => 32,
        'Schroders Contact' => 36, 'Regis Contact' => 32, 'T. Rowe Attendee(s)' => 36,
    ];

    private string $from = '';

    private string $to = '';

    /** @return array{filename: string, sheets: array<string, array>} */
    public function build(string $type, string $from, string $to, ?Client $client = null): array
    {
        $this->from = $from;
        $this->to = $to;

        $rows = Interaction::with(['client', 'type'])
            ->when($client, fn ($q) => $q->where('client_id', $client->id))
            ->between($from, $to)
            ->orderBy('interaction_date')->orderBy('id')
            ->get();

        $stamp = "($from to $to)";

        return match ($type) {
            'internal' => [
                'filename' => "Call Report $stamp.xlsx",
                'sheets' => $this->internal($rows),
            ],
            'client' => [
                'filename' => ($client?->name ?? 'Client')." Consumption Report $stamp.xlsx",
                'sheets' => ['Consumption' => $this->table($this->template($client), $rows)],
            ],
            default => [
                'filename' => "Generic Report $stamp.xlsx",
                'sheets' => ['Extract' => $this->table($this->extract(), $rows)],
            ],
        };
    }

    /* ── Internal call report ─────────────────────────────────────── */

    /** @return array<string, array> */
    private function internal(Collection $rows): array
    {
        $corporate = $rows->filter(fn (Interaction $i) => $this->isCorporateAccess($i))->values();

        return [
            'Bespoke' => $this->table($this->bespoke(true), $rows),
            'Official events' => $this->table($this->bespoke(false), $corporate),
            'Summary' => $this->summary($rows, $corporate),
            'Monthly by firm' => $this->monthly($rows),
            ...$this->people($rows),
        ];
    }

    /** The Bespoke / Official events column set from the legacy Call Report. */
    private function bespoke(bool $withMeetingType): array
    {
        $columns = [
            'Date' => fn (Interaction $i) => $this->dmy($i),
            'Firm' => fn (Interaction $i) => $i->client?->name,
            'Investor' => fn (Interaction $i) => $this->names($i->client_contact),
            'Broker' => fn (Interaction $i) => $this->names($i->sellside_contact),
            'Description of interaction' => fn (Interaction $i) => $i->description,
            'Stocks' => fn (Interaction $i) => implode('/', $this->tickerList($i)),
            'Initiated by' => fn (Interaction $i) => $this->initiatedBy($i),
            'Interaction type' => fn (Interaction $i) => $i->type?->type,
            'Meeting Type' => fn (Interaction $i) => $i->meeting_type,
            'Duration' => fn (Interaction $i) => $i->minutes(),
            'Time' => fn (Interaction $i) => $i->time_start ? $i->time_start.' '.self::TIME_ZONE : null,
        ];
        if (! $withMeetingType) {
            unset($columns['Meeting Type']);
        }

        return $columns;
    }

    /** Rankings side by side: by firm, by type, by Regis attendee, and the corporate-access cuts. */
    private function summary(Collection $rows, Collection $corporate): array
    {
        $blocks = [
            $this->rankBlock('Minutes by client firm', 'Client firm', $this->sumBy($rows, fn (Interaction $i) => [$i->client?->name ?: '—'])),
            $this->rankBlock('Minutes by interaction type', 'Interaction type', $this->sumBy($rows, fn (Interaction $i) => [$i->type?->type ?: '—'])),
            $this->rankBlock('Minutes by Regis attendee', 'Broker', $this->sumBy($rows, fn (Interaction $i) => $this->nameList($i->sellside_contact) ?: ['—'])),
            $this->rankBlock('Corporate access by client firm', 'Client firm', $this->sumBy($corporate, fn (Interaction $i) => [$i->client?->name ?: '—'])),
            $this->rankBlock('Corporate access by type', 'Corporate access type', $this->sumBy($corporate, fn (Interaction $i) => [$i->type?->type ?: '—'])),
        ];

        $firms = $rows->map(fn (Interaction $i) => $i->client_id)->unique()->count();
        $grid = $this->heading('Summary', sprintf(
            '%s · %s interactions · %s minutes · %s client firms · corporate access %s minutes · attendee minutes credit every Regis attendee in full',
            $this->rangeLabel(), number_format($rows->count()), number_format($this->minutes($rows)), number_format($firms), number_format($this->minutes($corporate)),
        ));
        [$body, $merges, $widths] = $this->sideBySide($blocks, count($grid) + 1, [5, 40, 11, 9]);

        return [
            'grid' => [...$grid, ...$body],
            'widths' => $widths,
            'merges' => $merges,
            'freeze' => 'A'.(count($grid) + 3),
            'gridlines' => false,
        ];
    }

    /** Client firm × month pivot of minutes with a Total column and row, all in formulas. */
    private function monthly(Collection $rows): array
    {
        $months = $this->months();
        $byFirm = [];
        foreach ($rows as $i) {
            $firm = $i->client?->name ?: '—';
            $byFirm[$firm][$i->interaction_date->format('Y-m')] = ($byFirm[$firm][$i->interaction_date->format('Y-m')] ?? 0) + $i->minutes();
        }
        uksort($byFirm, fn ($a, $b) => array_sum($byFirm[$b]) <=> array_sum($byFirm[$a]) ?: strcasecmp((string) $a, (string) $b));

        $grid = $this->heading('Minutes logged by client firm and month', $this->rangeLabel().' · every interaction type · '.number_format($this->minutes($rows)).' minutes');
        $head = [['v' => 'Client firm', 's' => 'header']];
        foreach ($months as $m) {
            $head[] = ['v' => $m->format('M-y'), 's' => 'header'];
        }
        $head[] = ['v' => 'Total', 's' => 'header'];
        $grid[] = $head;

        $headerRow = count($grid);
        $first = $headerRow + 1;
        $lastMonthCol = SimpleXlsx::col(count($months) + 1);
        $totalCol = SimpleXlsx::col(count($months) + 2);
        foreach ($byFirm as $firm => $perMonth) {
            $r = count($grid) + 1;
            $line = [['v' => $firm, 's' => 'text']];
            foreach ($months as $m) {
                $v = $perMonth[$m->format('Y-m')] ?? 0;
                $line[] = ['v' => $v > 0 ? $v : null, 's' => 'num'];
            }
            $line[] = ['f' => "SUM(B{$r}:{$lastMonthCol}{$r})", 's' => 'numBold'];
            $grid[] = $line;
        }
        $last = count($grid);
        $totals = [['v' => 'Total', 's' => 'totalLabel']];
        for ($c = 2; $c <= count($months) + 2; $c++) {
            $col = SimpleXlsx::col($c);
            $totals[] = $last >= $first ? ['f' => "SUM({$col}{$first}:{$col}{$last})", 's' => 'total'] : ['v' => 0, 's' => 'total'];
        }
        $grid[] = $totals;

        return [
            'grid' => $grid,
            'widths' => [44, ...array_fill(0, count($months), 10), 11],
            'freeze' => 'B'.($headerRow + 1),
            'filter' => "A{$headerRow}:{$totalCol}{$headerRow}",
        ];
    }

    /**
     * Sales and Analysts sheets: one band per person who logged interactions
     * (interactions.user_id → legacy user), grouped by that user's desk.
     * Research users sit with Analysts; anyone else lands on "Other staff"
     * so no minutes disappear (the legacy report dropped them).
     *
     * @return array<string, array>
     */
    private function people(Collection $rows): array
    {
        $users = $this->users();
        $groups = ['Sales' => [], 'Analysts' => [], 'Other staff' => []];
        foreach ($rows->groupBy(fn (Interaction $i) => (int) ($i->user_id ?? 0)) as $uid => $set) {
            $user = $users[(int) $uid] ?? null;
            $desk = strtolower(trim((string) ($user['type'] ?? '')));
            $sheet = $desk === 'sales' ? 'Sales' : (in_array($desk, ['analyst', 'research'], true) ? 'Analysts' : 'Other staff');
            $groups[$sheet][] = ['name' => $user['name'] ?? 'Unattributed', 'desk' => $user['type'] ?? null, 'rows' => $set, 'minutes' => $this->minutes($set)];
        }

        $sheets = [];
        foreach ($groups as $sheet => $persons) {
            if ($sheet === 'Other staff' && $persons === []) {
                continue;
            }
            usort($persons, fn ($a, $b) => $b['minutes'] <=> $a['minutes'] ?: strcasecmp($a['name'], $b['name']));
            $sheets[$sheet] = $this->peopleSheet($sheet, $persons);
        }

        return $sheets;
    }

    private function peopleSheet(string $sheet, array $persons): array
    {
        $desk = match ($sheet) {
            'Sales' => 'the Sales desk',
            'Analysts' => 'the Analyst and Research desks',
            default => 'Admin and other staff',
        };
        $grid = $this->heading("$sheet — minutes logged by person", sprintf(
            '%s · %d %s on %s · minutes are credited to whoever logged the interaction',
            $this->rangeLabel(), count($persons), count($persons) === 1 ? 'person' : 'people', $desk,
        ));
        $merges = [];

        if ($persons === []) {
            $grid[] = [['v' => 'No interactions were logged by '.$desk.' in this range.', 's' => 'muted']];
        }

        foreach ($persons as $p) {
            $r = count($grid) + 1;
            $band = array_fill(0, 8, ['s' => 'name']);
            $band[0] = ['v' => $p['name'], 's' => 'name'];
            $grid[] = $band;
            $merges[] = "A{$r}:H{$r}";

            $grid[] = [
                ['v' => 'Client firm', 's' => 'subhead'], ['v' => 'Minutes', 's' => 'subheadNum'], null,
                ['v' => 'Interaction type', 's' => 'subhead'], ['v' => 'Minutes', 's' => 'subheadNum'], null,
                ['v' => 'Month', 's' => 'subhead'], ['v' => 'Minutes', 's' => 'subheadNum'],
            ];

            $firms = $this->sumBy($p['rows'], fn (Interaction $i) => [$i->client?->name ?: '—']);
            $types = $this->sumBy($p['rows'], fn (Interaction $i) => [$i->type?->type ?: '—']);
            $months = [];
            foreach ($this->months() as $m) {
                $months[$m->format('M-y')] = 0;
            }
            foreach ($p['rows'] as $i) {
                $months[$i->interaction_date->format('M-y')] = ($months[$i->interaction_date->format('M-y')] ?? 0) + $i->minutes();
            }

            $firstRow = count($grid) + 1;
            $n = max(count($firms), count($types), count($months));
            $f = array_keys($firms);
            $t = array_keys($types);
            $mo = array_keys($months);
            for ($k = 0; $k < $n; $k++) {
                $grid[] = [
                    isset($f[$k]) ? ['v' => $f[$k], 's' => 'text'] : null, isset($f[$k]) ? ['v' => $firms[$f[$k]], 's' => 'num'] : null, null,
                    isset($t[$k]) ? ['v' => $t[$k], 's' => 'text'] : null, isset($t[$k]) ? ['v' => $types[$t[$k]], 's' => 'num'] : null, null,
                    isset($mo[$k]) ? ['v' => $mo[$k], 's' => 'text'] : null, isset($mo[$k]) ? ['v' => $months[$mo[$k]], 's' => 'num'] : null,
                ];
            }
            $lastRow = count($grid);
            $sum = fn (string $col) => $lastRow >= $firstRow ? ['f' => "SUM({$col}{$firstRow}:{$col}{$lastRow})", 's' => 'total'] : ['v' => 0, 's' => 'total'];
            $grid[] = [
                ['v' => 'Total minutes logged', 's' => 'totalLabel'], $sum('B'), null,
                ['v' => 'Total', 's' => 'totalLabel'], $sum('E'), null,
                ['v' => 'Total', 's' => 'totalLabel'], $sum('H'),
            ];
            $grid[] = [];
        }

        return [
            'grid' => $grid,
            'widths' => [40, 11, 3, 30, 11, 3, 12, 11],
            'merges' => $merges,
            'gridlines' => false,
        ];
    }

    /* ── Generic (T1C) extract and client templates ───────────────── */

    /** The Salesforce / T1C column set the client uploads as-is. */
    private function extract(): array
    {
        return [
            'Type__c' => fn (Interaction $i) => $this->typeLabel($i),
            'T1C_BASE__LOCATION__C' => fn (Interaction $i) => $this->clientLocation($i),
            'T1C_BASE__CITY__C' => fn (Interaction $i) => '',
            'T1C_BASE__MEETING_DATE__C' => fn (Interaction $i) => $this->dmy($i),
            'T1C_BASE__NOTES__C' => fn (Interaction $i) => $i->description,
            'T1C_BASE__SUBJECT_MEETING_OBJECTIVES__C' => fn (Interaction $i) => sprintf(
                '%s with %s about %s (%d mins)',
                $this->typeLabel($i), implode(',', $this->nameList($i->client_contact)), implode(',', $this->tickerList($i)), $i->minutes(),
            ),
            'T1C_BASE__TIME_SPENT_MIN__C' => fn (Interaction $i) => $i->minutes(),
            'LINE_OF_BUSINESS__C' => fn (Interaction $i) => 'Equity',
            'SOLICITED__C' => fn (Interaction $i) => 'Yes',
            'T_E_EXPENSE__C' => fn (Interaction $i) => 'False',
            'T_E_DESCRIPTION__C' => fn (Interaction $i) => '',
            'OWNER__C' => fn (Interaction $i) => $this->owner($i),
            'SOURCE__C' => fn (Interaction $i) => 'Regis',
            'Topics (Tickers)' => fn (Interaction $i) => implode(' | ', $this->tickerList($i)),
            'Contact [Person(s) who attended from the client]' => fn (Interaction $i) => implode(' | ', $this->nameList($i->client_contact)),
            'OJ Contact Id' => fn (Interaction $i) => '',
            'Internal Attendee (Jefferies)' => fn (Interaction $i) => implode(' | ', $this->nameList($i->sellside_contact)),
            'Client/Firm' => fn (Interaction $i) => $i->client?->name,
        ];
    }

    /** Which client template applies: a bound one, else the generic extract. */
    private function template(?Client $client): array
    {
        $code = $client
            ? ReportTemplate::where('client_id', $client->id)->where('is_active', true)->value('code')
            : null;

        return match ($code) {
            'corpaxe' => [
                'Date' => fn (Interaction $i) => $this->date($i),
                'Firm' => fn (Interaction $i) => $i->client?->name,
                'Contact(s)' => fn (Interaction $i) => $this->names($i->client_contact),
                'Interaction Type' => fn (Interaction $i) => $i->type?->type,
                'Sub-type' => fn (Interaction $i) => $i->meeting_type,
                'Duration (min)' => fn (Interaction $i) => $i->minutes(),
                'Analyst / Sales' => fn (Interaction $i) => $this->names($i->sellside_contact),
                'Ticker(s)' => fn (Interaction $i) => $this->tickers($i, 'ticker'),
                'Sector' => fn (Interaction $i) => $i->formValue('sector') ?? $this->sector($i, 'sector_generic'),
                'Contract ID' => fn (Interaction $i) => $i->formValue('contract_id'),
                'Notes' => fn (Interaction $i) => $i->description,
            ],
            'gmo' => [
                'Interaction Date' => fn (Interaction $i) => $this->date($i),
                'GMO Contact' => fn (Interaction $i) => $this->names($i->client_contact),
                'Broker Contact' => fn (Interaction $i) => $this->names($i->sellside_contact),
                'Interaction Type' => fn (Interaction $i) => $i->type?->type,
                'Meeting Type' => fn (Interaction $i) => $i->meeting_type,
                'Duration (min)' => fn (Interaction $i) => $i->minutes(),
                'RIC' => fn (Interaction $i) => $this->tickers($i, 'identifiers2'),
                'GMO Sector' => fn (Interaction $i) => $this->sector($i, 'sector_gmo'),
                'Asset Class' => fn (Interaction $i) => $i->formValue('asset_class') ?? 'Equity',
                'Client Initiated' => fn (Interaction $i) => $i->formValue('client_initiated'),
                'Description' => fn (Interaction $i) => $i->description,
            ],
            'jpmorgan' => [
                'Date' => fn (Interaction $i) => $this->date($i),
                'JPM Attendee(s)' => fn (Interaction $i) => $this->names($i->client_contact),
                'Broker Attendee(s)' => fn (Interaction $i) => $this->names($i->sellside_contact),
                'Type' => fn (Interaction $i) => $i->type?->type,
                'Sub-type' => fn (Interaction $i) => $i->meeting_type,
                'Length (min)' => fn (Interaction $i) => $i->minutes(),
                'Bloomberg Ticker(s)' => fn (Interaction $i) => $this->tickers($i, 'identifiers1'),
                'JPM Sector' => fn (Interaction $i) => $this->sector($i, 'sector_jpmorgan'),
                'Meeting Name' => fn (Interaction $i) => $i->formValue('meeting_name'),
                'Summary' => fn (Interaction $i) => $i->description,
            ],
            'schroders' => [
                'Date' => fn (Interaction $i) => $this->date($i),
                'Schroders Contact' => fn (Interaction $i) => $this->names($i->client_contact),
                'Regis Contact' => fn (Interaction $i) => $this->names($i->sellside_contact),
                'Interaction Type' => fn (Interaction $i) => $i->type?->type,
                'Format' => fn (Interaction $i) => $i->meeting_type,
                'Minutes' => fn (Interaction $i) => $i->minutes(),
                'Company / Ticker' => fn (Interaction $i) => $this->tickers($i, 'ticker'),
                'Schroders Sector' => fn (Interaction $i) => $this->sector($i, 'sector_schroders'),
                'Region' => fn (Interaction $i) => $i->client?->region,
                'Parent Interaction' => fn (Interaction $i) => $i->formValue('parent_interaction_id'),
                'Notes' => fn (Interaction $i) => $i->description,
            ],
            'trowe' => [
                'Date' => fn (Interaction $i) => $this->date($i),
                'T. Rowe Attendee(s)' => fn (Interaction $i) => $this->names($i->client_contact),
                'Broker Attendee(s)' => fn (Interaction $i) => $this->names($i->sellside_contact),
                'Interaction Type' => fn (Interaction $i) => $i->type?->type,
                'Sub-type' => fn (Interaction $i) => $i->meeting_type,
                'Duration (min)' => fn (Interaction $i) => $i->minutes(),
                'Ticker(s)' => fn (Interaction $i) => $this->tickers($i, 'ticker'),
                'T. Rowe Sector' => fn (Interaction $i) => $this->sector($i, 'sector_trowe'),
                'Location' => fn (Interaction $i) => $i->formValue('location'),
                'Expert Contact' => fn (Interaction $i) => $i->formValue('expert_contact'),
                'Notes' => fn (Interaction $i) => $i->description,
            ],
            default => $this->extract(),
        };
    }

    /* ── Sheet builders ───────────────────────────────────────────── */

    /**
     * A flat table: header text on row 1 (frozen, filtered), one row per
     * interaction. Integers become numeric cells so minutes add up in Excel.
     *
     * @return array{headers: list<string>, rows: list<array>, widths: list<int>, freeze: string}
     */
    private function table(array $columns, Collection $rows): array
    {
        $headers = array_keys($columns);

        return [
            'headers' => $headers,
            'rows' => $rows->map(fn (Interaction $i) => array_map(fn ($fn) => $fn($i) ?? '', array_values($columns)))->values()->all(),
            'widths' => array_map(fn ($h) => self::WIDTHS[$h] ?? max(12, min(40, mb_strlen($h) + 4)), $headers),
            'freeze' => 'A2',
        ];
    }

    /** Title + subtitle + spacer rows that open every analysis sheet. */
    private function heading(string $title, string $subtitle): array
    {
        return [
            [['v' => $title, 's' => 'title']],
            [['v' => 'Regis Partners · '.$subtitle.' · generated '.CarbonImmutable::now()->format('j M Y H:i'), 's' => 'subtitle']],
            [],
        ];
    }

    /**
     * A ranked block: section band, sub-headings, rank / label / minutes /
     * share rows and a total line. Returned as rows relative to the block's
     * own origin; sideBySide() places it and rewrites the formulas.
     *
     * @param  array<string, int>  $totals  label → minutes, sorted desc
     */
    private function rankBlock(string $title, string $keyHeader, array $totals): array
    {
        $rows = [
            'band' => $title,
            'head' => ['#', $keyHeader, 'Minutes', 'Share'],
            'items' => [],
        ];
        $rank = 0;
        foreach ($totals as $label => $minutes) {
            $rows['items'][] = [++$rank, (string) $label, $minutes];
        }

        return $rows;
    }

    /**
     * Lay ranked blocks next to each other with a spacer column, resolving
     * SUM / share formulas against their final cell addresses.
     *
     * @return array{0: list<array>, 1: list<string>, 2: list<int>}
     */
    private function sideBySide(array $blocks, int $firstRow, array $colWidths): array
    {
        $stride = count($colWidths) + 1;
        $height = 0;
        foreach ($blocks as $b) {
            $height = max($height, 3 + max(count($b['items']), 1));
        }
        $grid = array_fill(0, $height, []);
        $merges = [];
        $widths = [];

        foreach ($blocks as $n => $b) {
            $c0 = $n * $stride;                                  // 0-based column of the block
            $rank = SimpleXlsx::col($c0 + 1);
            $label = SimpleXlsx::col($c0 + 2);
            $min = SimpleXlsx::col($c0 + 3);
            $share = SimpleXlsx::col($c0 + 4);
            $widths = [...$widths, ...$colWidths, 3];

            $put = function (int $r, int $c, ?array $cell) use (&$grid) {
                while (count($grid[$r]) < $c) {
                    $grid[$r][] = null;
                }
                $grid[$r][$c] = $cell;
            };

            $put(0, $c0, ['v' => $b['band'], 's' => 'label']);
            for ($k = 1; $k < 4; $k++) {
                $put(0, $c0 + $k, ['s' => 'label']);
            }
            $merges[] = "{$rank}{$firstRow}:{$share}{$firstRow}";
            foreach ($b['head'] as $k => $h) {
                $put(1, $c0 + $k, ['v' => $h, 's' => $k >= 2 ? 'subheadNum' : 'subhead']);
            }

            $items = $b['items'];
            $first = $firstRow + 2;
            $last = $first + count($items) - 1;
            $totalRow = $first + max(count($items), 1);
            if ($items === []) {
                $put(2, $c0 + 1, ['v' => 'No interactions in range', 's' => 'muted']);
            }
            foreach ($items as $k => [$pos, $text, $minutes]) {
                $r = $first + $k;
                $put(2 + $k, $c0, ['v' => $pos, 's' => 'muted']);
                $put(2 + $k, $c0 + 1, ['v' => $text, 's' => 'text']);
                $put(2 + $k, $c0 + 2, ['v' => $minutes, 's' => 'num']);
                $put(2 + $k, $c0 + 3, ['f' => "IF(\${$min}\${$totalRow}=0,0,{$min}{$r}/\${$min}\${$totalRow})", 's' => 'pct']);
            }
            $tr = $totalRow - $firstRow;
            $put($tr, $c0, ['s' => 'totalLabel']);
            $put($tr, $c0 + 1, ['v' => 'Total', 's' => 'totalLabel']);
            $put($tr, $c0 + 2, $items === [] ? ['v' => 0, 's' => 'total'] : ['f' => "SUM({$min}{$first}:{$min}{$last})", 's' => 'total']);
            $put($tr, $c0 + 3, $items === [] ? ['v' => 0, 's' => 'totalPct'] : ['f' => "SUM({$share}{$first}:{$share}{$last})", 's' => 'totalPct']);
        }

        return [$grid, $merges, $widths];
    }

    /* ── Aggregation helpers ──────────────────────────────────────── */

    /**
     * Minutes summed per key, sorted desc then A–Z. The key callback may
     * return several keys (an interaction with two Regis attendees credits
     * both in full).
     *
     * @return array<string, int>
     */
    private function sumBy(Collection $rows, callable $keys): array
    {
        $out = [];
        foreach ($rows as $i) {
            foreach ($keys($i) as $key) {
                $out[$key] = ($out[$key] ?? 0) + $i->minutes();
            }
        }
        uksort($out, fn ($a, $b) => $out[$b] <=> $out[$a] ?: strcasecmp((string) $a, (string) $b));

        return $out;
    }

    private function minutes(Collection $rows): int
    {
        return (int) $rows->sum(fn (Interaction $i) => $i->minutes());
    }

    /** @return list<CarbonImmutable> first day of every month in range */
    private function months(): array
    {
        $out = [];
        $m = CarbonImmutable::parse($this->from)->startOfMonth();
        $end = CarbonImmutable::parse($this->to)->startOfMonth();
        while ($m <= $end) {
            $out[] = $m;
            $m = $m->addMonth();
        }

        return $out;
    }

    private function rangeLabel(): string
    {
        return CarbonImmutable::parse($this->from)->format('j M Y').' to '.CarbonImmutable::parse($this->to)->format('j M Y');
    }

    private function isCorporateAccess(Interaction $i): bool
    {
        static $set = null;
        $set ??= array_flip(array_map([self::class, 'normalise'], self::CORPORATE_ACCESS));

        return isset($set[self::normalise((string) $i->type?->type)]);
    }

    private static function normalise(string $name): string
    {
        return strtolower(preg_replace('/[^a-z0-9]+/i', '', $name) ?? '');
    }

    /* ── Cell value helpers ───────────────────────────────────────── */

    private function date(Interaction $i): string
    {
        return substr((string) $i->interaction_date, 0, 10);
    }

    /** dd/mm/yyyy, as both legacy workbooks print it. */
    private function dmy(Interaction $i): string
    {
        return $i->interaction_date?->format('d/m/Y') ?? '';
    }

    /** "Analyst Interaction - Call1x1": type plus sub-type when one was chosen. */
    private function typeLabel(Interaction $i): string
    {
        $type = trim((string) $i->type?->type);
        $sub = trim((string) $i->meeting_type);

        return $sub !== '' ? "$type - $sub" : $type;
    }

    /** The generic form's "Initiated by" (Broker / Investor); Corpaxe forms store Client Initiated TRUE/FALSE instead. */
    private function initiatedBy(Interaction $i): ?string
    {
        if ($v = $i->formValue('initiated_by')) {
            return $v;
        }

        return match (strtoupper((string) $i->formValue('client_initiated'))) {
            'TRUE' => 'Investor',
            'FALSE' => 'Broker',
            default => null,
        };
    }

    /** @return list<string> */
    private function nameList(array $people): array
    {
        return array_values(array_filter(array_map(fn ($p) => trim((string) ($p['name'] ?? trim(($p['firstname'] ?? '').' '.($p['lastname'] ?? '')))), $people)));
    }

    private function names(array $people): string
    {
        return implode(', ', $this->nameList($people));
    }

    /** @var array<int, array{name: string, type: ?string}>|null legacy user id → name / desk */
    private ?array $users = null;

    /** The legacy `user` table is the owner directory; absent (fresh install) it just yields no names. */
    private function users(): array
    {
        if ($this->users === null) {
            $this->users = [];
            try {
                foreach (DB::connection('crms')->table('user')->get(['id', 'first_name', 'last_name', 'type']) as $u) {
                    $name = trim(($u->first_name ?? '').' '.($u->last_name ?? ''));
                    $this->users[(int) $u->id] = ['name' => $name !== '' ? $name : "User #{$u->id}", 'type' => $u->type];
                }
            } catch (\Throwable) {
                // No legacy user table on this install.
            }
        }

        return $this->users;
    }

    private function owner(Interaction $i): string
    {
        return $this->users()[(int) ($i->user_id ?? 0)]['name'] ?? '';
    }

    /** @var array<int, string>|null client_contact id → the office address that contact sits at */
    private ?array $contactAddresses = null;

    /**
     * Where the client attendees sit: each contact's office address (the
     * legacy extract listed one per attendee), de-duplicated and joined " | ".
     */
    private function clientLocation(Interaction $i): string
    {
        if ($this->contactAddresses === null) {
            $this->contactAddresses = [];
            try {
                $addresses = ClientAddress::query()->pluck('name', 'id')->map(fn ($n) => trim((string) $n))->all();
                foreach (ClientContact::query()->whereNotNull('client_address_id')->get(['id', 'client_address_id']) as $c) {
                    $this->contactAddresses[(int) $c->id] = $addresses[(int) $c->client_address_id] ?? '';
                }
            } catch (\Throwable) {
                // No contact directory on this install.
            }
        }

        $out = [];
        foreach ($i->client_contact as $c) {
            $out[] = $this->contactAddresses[(int) ($c['id'] ?? 0)] ?? '';
        }

        return implode(' | ', array_values(array_unique(array_filter($out))));
    }

    /**
     * Every corporate on the form, through the identifier a template asks
     * for. A directory corporate with no such identifier (an unlisted name
     * like "Teneo") is left out, as the legacy workbooks did; free-text
     * stock fields print what was typed.
     *
     * @return list<string>
     */
    private function tickerList(Interaction $i, string $identifier = 'ticker'): array
    {
        $out = [];
        foreach ($i->corporatesDiscussed() as $c) {
            $corp = $this->corporate($c);
            $out[] = trim((string) ($corp ? $corp->{$identifier} : ($c['ticker'] ?: $c['name'])));
        }

        return array_values(array_unique(array_filter($out)));
    }

    private function tickers(Interaction $i, string $identifier): string
    {
        return implode(', ', $this->tickerList($i, $identifier));
    }

    private function sector(Interaction $i, string $column): ?string
    {
        foreach ($i->corporatesDiscussed() as $c) {
            if (($corp = $this->corporate($c)) && $corp->{$column}) {
                return $corp->{$column};
            }
        }

        return null;
    }

    /** @var array<string, Corporate|null> */
    private array $corporates = [];

    /** By id from a lookup snapshot, else by ticker or name. */
    private function corporate(array $c): ?Corporate
    {
        $key = $c['id'] ? 'id:'.$c['id'] : mb_strtolower((string) ($c['ticker'] ?: $c['name']));
        if (! array_key_exists($key, $this->corporates)) {
            $this->corporates[$key] = $c['id']
                ? Corporate::find($c['id'])
                : Corporate::whereRaw('LOWER(ticker) = ?', [$key])->orWhereRaw('LOWER(name) = ?', [$key])->first();
        }

        return $this->corporates[$key];
    }
}
