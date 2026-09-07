<?php

namespace App\Services\Crms;

use App\Models\Crms\Client;
use App\Models\Crms\Corporate;
use App\Models\Crms\Interaction;
use App\Models\Crms\ReportTemplate;
use App\Models\Crms\SellsideContact;
use Illuminate\Support\Collection;

/**
 * One code path for every consumption report. The date range is applied as
 * a real WHERE on interaction_date and every row in range is selected
 * regardless of who logged it — the two legacy bugs (CRMSmasterplan.md
 * §7.3) are fixed here, once, for all report types and client templates.
 */
class ReportGenerator
{
    public const TYPES = ['generic', 'internal', 'client'];

    /** @return array{filename: string, sheets: array<string, array{headers: list<string>, rows: list<array>}>} */
    public function build(string $type, string $from, string $to, ?Client $client = null): array
    {
        $rows = Interaction::with(['client', 'type'])
            ->when($client, fn ($q) => $q->where('client_id', $client->id))
            ->between($from, $to)
            ->orderBy('interaction_date')->orderBy('id')
            ->get();

        $stamp = "($from to $to)";

        return match ($type) {
            'internal' => [
                'filename' => "Internal Report $stamp.xlsx",
                'sheets' => [
                    // Both sheets populate from the same in-range set, split by the
                    // Regis attendees' desk. An interaction with both appears on both.
                    'Analysts' => $this->sheet($this->generic(), $rows->filter(fn ($i) => $this->hasDesk($i, 'Analyst'))),
                    'Sales' => $this->sheet($this->generic(), $rows->filter(fn ($i) => $this->hasDesk($i, 'Sales'))),
                    'All interactions' => $this->sheet($this->generic(), $rows),
                ],
            ],
            'client' => [
                'filename' => ($client?->name ?? 'Client')." Consumption Report $stamp.xlsx",
                'sheets' => ['Consumption' => $this->sheet($this->template($client), $rows)],
            ],
            default => [
                'filename' => "Generic Report $stamp.xlsx",
                'sheets' => ['Interactions' => $this->sheet($this->generic(), $rows)],
            ],
        };
    }

    /** Which client template applies: a bound one, else the generic layout. */
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
            default => $this->generic(),
        };
    }

    private function generic(): array
    {
        return [
            'Reference' => fn (Interaction $i) => $i->reference(),
            'Date' => fn (Interaction $i) => $this->date($i),
            'Client' => fn (Interaction $i) => $i->client?->name,
            'Client Contact(s)' => fn (Interaction $i) => $this->names($i->client_contact),
            'Regis Contact(s)' => fn (Interaction $i) => $this->names($i->sellside_contact),
            'Interaction Type' => fn (Interaction $i) => $i->type?->type,
            'Sub-type' => fn (Interaction $i) => $i->meeting_type,
            'Start' => fn (Interaction $i) => $i->time_start,
            'End' => fn (Interaction $i) => $i->time_end,
            'Minutes' => fn (Interaction $i) => $i->minutes(),
            'Stocks Discussed' => fn (Interaction $i) => $this->tickers($i, 'ticker'),
            'Description' => fn (Interaction $i) => $i->description,
            'Action Point' => fn (Interaction $i) => $i->action_point,
            'Disposition' => fn (Interaction $i) => $i->disposition ?: 'closed',
        ];
    }

    /** @return array{headers: list<string>, rows: list<array>} */
    private function sheet(array $columns, Collection $rows): array
    {
        return [
            'headers' => array_keys($columns),
            'rows' => $rows->map(fn (Interaction $i) => array_map(fn ($fn) => $fn($i) ?? '', array_values($columns)))->values()->all(),
        ];
    }

    /** @var array<int, string>|null sellside_contact.id → desk type */
    private ?array $desks = null;

    /** Snapshots only carry id/name/email, so the desk comes from the directory row. */
    private function hasDesk(Interaction $i, string $type): bool
    {
        $this->desks ??= SellsideContact::pluck('type', 'id')->map(fn ($t) => (string) $t)->all();
        foreach ($i->sellside_contact as $s) {
            $desk = $this->desks[(int) ($s['id'] ?? 0)] ?? ($s['type'] ?? '');
            if (strcasecmp($desk, $type) === 0) {
                return true;
            }
        }

        return false;
    }

    private function date(Interaction $i): string
    {
        return substr((string) $i->interaction_date, 0, 10);
    }

    private function names(array $people): string
    {
        return implode('; ', array_filter(array_map(fn ($p) => $p['name'] ?? trim(($p['firstname'] ?? '').' '.($p['lastname'] ?? '')), $people)));
    }

    /** Every corporate on the form, rendered through the identifier a client's template asks for. */
    private function tickers(Interaction $i, string $identifier): string
    {
        $out = [];
        foreach ($i->corporatesDiscussed() as $c) {
            $corp = $this->corporate($c);
            $out[] = $corp?->{$identifier} ?: ($c['ticker'] ?: $c['name']);
        }

        return implode(', ', array_unique(array_filter($out)));
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
