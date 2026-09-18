<?php

namespace App\Services\Crms;

use App\Models\Crms\Accommodation;
use App\Models\Crms\ClientContact;
use App\Models\Crms\Event;
use App\Models\Crms\Flight;
use App\Models\Crms\Meeting;
use App\Models\Crms\Transportation;
use Carbon\CarbonImmutable;

/**
 * Merges an event's meetings, flights, ground transport and hotels into one
 * chronological itinerary grouped by day — the data behind the printed
 * schedule. A hotel booking appears on every day it covers, not only at
 * check-in, so any single day of the itinerary reads complete on its own.
 */
class ScheduleAggregator
{
    public function build(Event $event, ?int $contactId = null): array
    {
        $event->loadMissing(['corporate', 'client', 'meetings.client', 'meetings.corporate', 'investors.client', 'flights', 'transportation', 'accommodation', 'attendees.sellsideContact']);

        $meetings = $event->meetings->filter(fn (Meeting $m) => $contactId === null || $this->attends($m, $contactId));

        $days = [];
        $push = function (?string $date, array $item) use (&$days) {
            if (! $date) {
                return;
            }
            $days[$date][] = $item;
        };

        $tz = fn (?string $time, ?string $zone) => $time ? trim($time.($zone ? " ($zone)" : '')) : null;

        foreach ($meetings as $m) {
            $people = array_values(array_filter([...array_map(fn ($c) => $c['name'] ?? null, [...$m->client_contact, ...$m->corporate_contact]), trim((string) $m->contact) ?: null]));
            $push($this->day($m->date), [
                'kind' => 'meeting',
                'time' => $m->time_start,
                'timeEnd' => $m->time_end,
                'timezone' => $m->timezone,
                'title' => $this->counterparty($m),
                'subtitle' => $m->meeting_type,
                'detail' => implode(' · ', array_filter([$m->location, $m->corporate_address, $m->booked_by ? 'Booked by '.$m->booked_by : null])),
                // Linked contacts first, then the free-text attendees line the desk typed.
                'people' => $people,
                'note' => $m->note,
                // The printed block, as the legacy schedule laid it out: the counterparty over its
                // address (legacy typed the venue into `description`); the attendees line as the desk
                // typed it — or the linked contacts when nothing was typed — then who booked the slot.
                'columns' => [[
                    'where' => $m->location,
                    'when' => array_values(array_filter([$tz($m->time_start, $m->timezone), $tz($m->time_end, $m->timezone), $m->meeting_type])),
                    'label' => null,
                    'what' => array_values(array_filter([$this->counterparty($m), ...$this->rows($m->corporate_address), ...($m->corporate_type === 'expert_meeting' ? [] : $this->rows($m->description))])),
                    'who' => [
                        ...($this->rows($m->contact) ?: array_values(array_filter(array_map(fn ($c) => $c['name'] ?? null, [...$m->client_contact, ...$m->corporate_contact])))),
                        ...($m->booked_by ? ['', 'BOOKED BY:', $m->booked_by] : []),
                    ],
                ]],
            ]);
        }

        foreach ($event->flights as $f) {
            /** @var Flight $f */
            // Departure and arrival print as two lines, as the legacy schedule did, so a
            // day that only contains a landing still reads complete.
            $depart = ['where' => $f->location, 'when' => array_values(array_filter([$tz($f->time, $f->timezone)])), 'label' => null, 'what' => $this->rows($f->description), 'who' => $this->rows($f->passenger)];
            $arrive = ['where' => $f->location_arrival, 'when' => array_values(array_filter([$tz($f->time_arrival, $f->timezone_arrival)])), 'label' => null, 'what' => $this->rows($f->description_arrival), 'who' => []];
            $sameDay = ! $f->date_arrival || $this->day($f->date_arrival) === $this->day($f->date);
            $push($this->day($f->date), [
                'kind' => 'flight',
                'time' => $f->time,
                'timeEnd' => null,
                'timezone' => $f->timezone,
                'title' => 'Departs '.trim($f->location.($f->location_arrival ? ' → '.$f->location_arrival : '')),
                'subtitle' => $f->description,
                'detail' => $f->date_arrival ? 'Arrives '.$this->day($f->date_arrival).' '.trim($f->time_arrival.' '.$f->timezone_arrival) : '',
                'people' => $this->lines($f->passenger),
                'note' => $f->note,
                // Both legs print under the departure when they land the same day; otherwise the arrival gets its own entry.
                'columns' => $sameDay && ($f->location_arrival || $f->time_arrival) ? [$depart, $arrive] : [$depart],
            ]);
            if ($f->date_arrival && ! $sameDay) {
                $push($this->day($f->date_arrival), [
                    'kind' => 'flight',
                    'time' => $f->time_arrival,
                    'timeEnd' => null,
                    'timezone' => $f->timezone_arrival,
                    'title' => 'Arrives '.($f->location_arrival ?: $f->location),
                    'subtitle' => $f->description,
                    'detail' => $f->description_arrival ?? '',
                    'people' => $this->lines($f->passenger),
                    'note' => null,
                    'columns' => [$arrive],
                ]);
            }
        }

        foreach ($event->transportation as $t) {
            /** @var Transportation $t */
            $push($this->day($t->date), [
                'kind' => 'transport',
                'time' => $t->start_time,
                'timeEnd' => $t->end_time,
                'timezone' => $t->timezone,
                'title' => trim($t->vehicle_type.' · '.$t->location, ' ·'),
                'subtitle' => $t->description,
                'detail' => implode(' · ', array_filter([$t->driver_name ? "Driver {$t->driver_name}" : null, $t->driver_mobile, $t->confirm_no ? "Conf. {$t->confirm_no}" : null, $t->remarks])),
                'people' => $this->lines($t->passenger),
                'note' => $t->note,
                'columns' => [[
                    'where' => $t->location,
                    'when' => array_values(array_filter([$tz($t->start_time, $t->timezone), $tz($t->end_time, $t->timezone)])),
                    'label' => null,
                    'what' => $this->paragraphs(
                        $this->rows($t->description),
                        array_values(array_filter([$t->driver_name ? 'Driver Name: '.$t->driver_name : null, $t->driver_mobile ? 'Driver Mobile: '.$t->driver_mobile : null, $t->vehicle_type ? 'Vehicle type: '.$t->vehicle_type : null])),
                        $this->rows($t->remarks),
                    ),
                    'who' => $this->rows($t->passenger),
                ]],
            ]);
        }

        foreach ($event->accommodation as $a) {
            /** @var Accommodation $a */
            $in = $a->date ? CarbonImmutable::parse($a->date)->startOfDay() : null;
            $out = $a->date_out ? CarbonImmutable::parse($a->date_out)->startOfDay() : $in;
            if (! $in) {
                continue;
            }
            // Expand across the whole stay; the check-out day reads as departure.
            for ($d = $in; $d->lte($out); $d = $d->addDay()) {
                $first = $d->equalTo($in);
                $last = $d->equalTo($out) && ! $first;
                $push($d->format('Y-m-d'), [
                    'kind' => 'hotel',
                    'time' => $first ? $a->time_in : ($last ? $a->time_out : null),
                    'timeEnd' => null,
                    'timezone' => null,
                    'title' => $a->description ?: ($a->location ?? 'Accommodation'),
                    'subtitle' => $first ? 'Check-in' : ($last ? 'Check-out' : 'Overnight'),
                    'detail' => $a->location ?? '',
                    'people' => $this->lines($a->accommodator),
                    'note' => $first ? $a->note : null,
                    'columns' => [[
                        'where' => $a->location,
                        'when' => array_values(array_filter([$first ? $a->time_in : ($last ? $a->time_out : null)])),
                        'label' => $first ? 'Check-in' : ($last ? 'Check-out' : 'Overnight'),
                        'what' => $this->rows($a->description),
                        'who' => $this->rows($a->accommodator),
                    ]],
                ]);
            }
        }

        ksort($days);
        $ordered = [];
        foreach ($days as $date => $items) {
            usort($items, fn ($a, $b) => strcmp($this->sortKey($a), $this->sortKey($b)));
            $ordered[] = ['date' => $date, 'items' => $items];
        }

        $directory = ClientContact::whereIn('id', $event->investors->flatMap(fn ($i) => array_column($i->client_contact, 'id'))->filter()->unique()->values())->get()->keyBy('id');

        return [
            'event' => $event->toWire(),
            'participants' => [
                'investors' => $event->investors->map(fn ($i) => [
                    'client' => $i->client?->name,
                    'contacts' => array_values(array_map(function ($c) use ($directory) {
                        // Legacy investor snapshots hold little more than id and name; the printed
                        // page looked the title and office number up in the directory, as we do.
                        $live = $directory->get((int) ($c['id'] ?? 0));

                        return [
                            'name' => $c['name'] ?? '',
                            'position' => ($c['position'] ?? null) ?: $live?->position,
                            'email' => ($c['email'] ?? null) ?: $live?->email,
                            'phone' => ($c['contact_no'] ?? $c['mobile_no'] ?? null) ?: ($live?->contact_no ?: $live?->mobile_no),
                        ];
                    }, $i->client_contact)),
                ])->values()->all(),
                'regis' => $event->attendees->map(fn ($b) => [
                    'name' => $b->sellsideContact?->name,
                    'position' => $b->position,
                    'email' => $b->email,
                    'phone' => $b->mobile_no ?: $b->office_no,
                    'office' => $b->office_no,
                    'mobile' => $b->mobile_no,
                ])->values()->all(),
            ],
            'summary' => $meetings->groupBy(fn (Meeting $m) => $this->day($m->date))->sortKeys()
                ->map(fn ($group, $date) => [
                    'date' => $date,
                    'meetings' => $group->sortBy(fn (Meeting $m) => (string) $m->time_start)->map(fn (Meeting $m) => [
                        'time' => $m->time_start, 'timeEnd' => $m->time_end, 'timezone' => $m->timezone,
                        'title' => $this->counterparty($m), 'type' => $m->meeting_type, 'location' => $m->location,
                    ])->values()->all(),
                ])->values()->all(),
            'days' => $ordered,
            'filteredTo' => $contactId ? (string) $contactId : null,
            'generatedAt' => now()->toIso8601String(),
        ];
    }

    /** The counterparty with its ticker when it is an issuer — "Ayala Land, Inc. (ALI)". */
    private function counterparty(Meeting $m): string
    {
        $name = $m->counterparty();
        $ticker = $m->corporate_type === 'corporate' ? ($m->corporate?->ticker ?: $m->corporate?->identifiers2) : null;

        return $ticker ? "$name ($ticker)" : $name;
    }

    private function attends(Meeting $m, int $contactId): bool
    {
        foreach ($m->client_contact as $c) {
            if ((int) ($c['id'] ?? 0) === $contactId) {
                return true;
            }
        }

        return false;
    }

    /** Overnight hotel lines print first; everything else sorts by time. */
    private function sortKey(array $item): string
    {
        $time = $item['time'] ?? null;
        if ($item['kind'] === 'hotel' && $item['subtitle'] === 'Overnight') {
            return '0';
        }

        return $time ? '1'.$time : '2';
    }

    private function day(mixed $v): ?string
    {
        return $v ? CarbonImmutable::parse($v)->format('Y-m-d') : null;
    }

    private function lines(?string $text): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n|,/', (string) $text))));
    }

    /** Text as the desk typed it, one entry per line — the printed block keeps those breaks. */
    private function rows(?string $text): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string) $text)), fn ($l) => $l !== ''));
    }

    /** Joins groups of lines with one blank line between the non-empty groups. */
    private function paragraphs(array ...$groups): array
    {
        $out = [];
        foreach (array_filter($groups) as $g) {
            $out = $out === [] ? $g : [...$out, '', ...$g];
        }

        return $out;
    }
}
