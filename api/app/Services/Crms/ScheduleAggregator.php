<?php

namespace App\Services\Crms;

use App\Models\Crms\Accommodation;
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

        foreach ($meetings as $m) {
            $push($this->day($m->date), [
                'kind' => 'meeting',
                'time' => $m->time_start,
                'timeEnd' => $m->time_end,
                'timezone' => $m->timezone,
                'title' => $m->counterparty(),
                'subtitle' => $m->meeting_type,
                'detail' => $m->location.($m->corporate_address ? ' · '.$m->corporate_address : ''),
                'people' => array_values(array_filter(array_map(fn ($c) => $c['name'] ?? null, [...$m->client_contact, ...$m->corporate_contact]))),
                'note' => $m->note,
            ]);
        }

        foreach ($event->flights as $f) {
            /** @var Flight $f */
            $push($this->day($f->date), [
                'kind' => 'flight',
                'time' => $f->time,
                'timeEnd' => $f->time_arrival,
                'timezone' => $f->timezone,
                'title' => trim($f->location.' → '.($f->location_arrival ?? '')),
                'subtitle' => $f->description,
                'detail' => $f->date_arrival && $this->day($f->date_arrival) !== $this->day($f->date)
                    ? 'Arrives '.$this->day($f->date_arrival).' '.$f->time_arrival.' '.$f->timezone_arrival
                    : ($f->description_arrival ?? ''),
                'people' => $this->lines($f->passenger),
                'note' => $f->note,
            ]);
        }

        foreach ($event->transportation as $t) {
            /** @var Transportation $t */
            $push($this->day($t->date), [
                'kind' => 'transport',
                'time' => $t->start_time,
                'timeEnd' => $t->end_time,
                'timezone' => $t->timezone,
                'title' => $t->vehicle_type.' · '.$t->location,
                'subtitle' => $t->description,
                'detail' => "Driver {$t->driver_name} · {$t->driver_mobile} · Conf. {$t->confirm_no}".($t->remarks ? " · {$t->remarks}" : ''),
                'people' => $this->lines($t->passenger),
                'note' => $t->note,
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
                ]);
            }
        }

        ksort($days);
        $ordered = [];
        foreach ($days as $date => $items) {
            usort($items, fn ($a, $b) => strcmp($this->sortKey($a), $this->sortKey($b)));
            $ordered[] = ['date' => $date, 'items' => $items];
        }

        return [
            'event' => $event->toWire(),
            'participants' => [
                'investors' => $event->investors->map(fn ($i) => [
                    'client' => $i->client?->name,
                    'contacts' => array_values(array_map(fn ($c) => [
                        'name' => $c['name'] ?? '',
                        'position' => $c['position'] ?? null,
                        'email' => $c['email'] ?? null,
                        'phone' => $c['contact_no'] ?? $c['mobile_no'] ?? null,
                    ], $i->client_contact)),
                ])->values()->all(),
                'regis' => $event->attendees->map(fn ($b) => [
                    'name' => $b->sellsideContact?->name,
                    'position' => $b->position,
                    'email' => $b->email,
                    'phone' => $b->mobile_no ?: $b->office_no,
                ])->values()->all(),
            ],
            'summary' => $meetings->groupBy(fn (Meeting $m) => $this->day($m->date))->sortKeys()
                ->map(fn ($group, $date) => [
                    'date' => $date,
                    'meetings' => $group->map(fn (Meeting $m) => [
                        'time' => $m->time_start, 'timeEnd' => $m->time_end, 'timezone' => $m->timezone,
                        'title' => $m->counterparty(), 'type' => $m->meeting_type, 'location' => $m->location,
                    ])->values()->all(),
                ])->values()->all(),
            'days' => $ordered,
            'filteredTo' => $contactId ? (string) $contactId : null,
            'generatedAt' => now()->toIso8601String(),
        ];
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
}
