<?php

namespace App\Http\Controllers\Crms;

use App\Enums\Crms\EventCategory;
use App\Models\Crms\Event;
use App\Models\Crms\Interaction;
use App\Models\Crms\Meeting;
use App\Services\Crms\ScheduleAggregator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The four event types share one table and one controller; the category
 * slug decides which subject (corporate, client, analyst) is required.
 */
class EventController extends CrmsController
{
    public function index(Request $request): JsonResponse
    {
        $q = Event::with(['corporate', 'client'])->withCount('meetings');

        if ($slug = $request->query('category')) {
            $cat = EventCategory::fromSlug($slug);
            abort_unless($cat, 404);
            $q->where('category', $cat->value);
        }
        if ($year = $request->integer('year')) {
            $q->whereBetween('start_date', ["$year-01-01 00:00:00", "$year-12-31 23:59:59"]);
        }

        return response()->json([
            'items' => $q->orderByDesc('start_date')->orderByDesc('id')->limit(500)->get()->map->toWire()->values(),
        ]);
    }

    public function show(Event $event): JsonResponse
    {
        return response()->json($this->detail($event));
    }

    private function rules(): array
    {
        return [
            'category' => ['required', Rule::in(array_map(fn ($c) => $c->slug(), EventCategory::cases()))],
            'classification' => ['nullable', 'in:Deal Roadshow,Non-Deal Roadshow'],
            'startDate' => ['required', 'date'],
            'endDate' => ['nullable', 'date', 'after_or_equal:startDate'],
            'coordinator' => ['nullable', 'string', 'max:255'],
            'telNo' => ['nullable', 'string', 'max:255'],
            'mobileNo' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'corporateId' => ['nullable', 'integer'],
            'clientId' => ['nullable', 'integer'],
            'clientContactIds' => ['present', 'array', 'max:100'],
            'clientContactIds.*' => ['integer'],
            'sellsideContactIds' => ['present', 'array', 'max:50'],
            'sellsideContactIds.*' => ['integer'],
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        if ($error = $this->subjectError($data)) {
            return response()->json(['message' => $error], 422);
        }
        $event = Event::create($this->attributes($data));

        return $this->item($this->wire($event), $this->audit('Created '.$event->category()->label(), $event->subject()), 201);
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate($this->rules());
        if ($error = $this->subjectError($data)) {
            return response()->json(['message' => $error], 422);
        }
        $event->fill($this->attributes($data))->save();

        return $this->item($this->wire($event), $this->audit('Updated '.$event->category()->label(), $event->subject()));
    }

    public function destroy(Event $event): JsonResponse
    {
        $label = ($event->category()?->label() ?? 'event').' · '.$event->subject();
        foreach (Event::CHILDREN as $model) {
            $model::where('roadshow_id', $event->id)->delete();
        }
        $event->delete();

        return $this->deleted($this->audit('Deleted event', $label));
    }

    /** Everything the print view needs, optionally filtered to one client contact. */
    public function itinerary(Request $request, Event $event, ScheduleAggregator $aggregator): JsonResponse
    {
        $contactId = $request->integer('contactId') ?: null;

        return response()->json($aggregator->build($event, $contactId));
    }

    /** A meeting becomes an interaction — the record the firm is paid on. */
    public function convert(Meeting $meeting): JsonResponse
    {
        if ($meeting->interaction_id && Interaction::whereKey($meeting->interaction_id)->exists()) {
            return response()->json(['message' => 'This meeting was already converted.', 'interactionId' => (string) $meeting->interaction_id], 409);
        }
        $meeting->load(['event.client', 'client', 'corporate']);
        $clientId = $meeting->client_id ?: $meeting->event?->client_id;
        if (! $clientId) {
            return response()->json(['message' => 'Pick the client on the meeting first — an interaction is always logged against a client.'], 422);
        }

        $interaction = Interaction::create([
            'client_id' => $clientId,
            'interaction_date' => $meeting->date,
            'time_start' => $meeting->time_start,
            'time_end' => $meeting->time_end,
            'meeting_type' => $meeting->meeting_type,
            'description' => trim(($meeting->event?->category()?->label() ?? 'Event').' · '.$meeting->counterparty()."\n".($meeting->description ?? '')),
            'client_contact' => $meeting->client_contact ?: $meeting->event?->client_contact ?? [],
            'sellside_contact' => $meeting->event?->sellside_contact ?? [],
            'form' => [],
            'disposition' => Interaction::DISPOSITION_CLOSED,
            'user_id' => $this->legacyUserId(),
            'created' => now(),
        ]);
        $meeting->forceFill(['interaction_id' => $interaction->id])->save();

        return response()->json([
            'item' => $interaction->load(['client', 'type'])->toWire(),
            'meeting' => $meeting->toWire(),
            'audit' => $this->audit('Converted meeting to interaction', $interaction->reference())->toWire(),
        ], 201);
    }

    private function subjectError(array $d): ?string
    {
        return match (EventCategory::fromSlug($d['category'])) {
            EventCategory::Roadshow => empty($d['corporateId']) ? 'A Company Roadshow needs the corporate it presents.' : null,
            EventCategory::ReverseRoadshow => empty($d['clientId']) ? 'A Reverse Roadshow needs the visiting client.' : null,
            EventCategory::AnalystMarketing => empty($d['sellsideContactIds']) ? 'Analyst Marketing needs at least one travelling analyst.' : null,
            default => empty($d['corporateId']) && empty($d['clientId']) ? 'A meeting needs a client or a corporate.' : null,
        };
    }

    private function attributes(array $d): array
    {
        $cat = EventCategory::fromSlug($d['category']);

        return [
            'category' => $cat->value,
            'classification' => $cat === EventCategory::Roadshow ? ($d['classification'] ?? 'Non-Deal Roadshow') : null,
            'start_date' => $d['startDate'].' 00:00:00',
            'end_date' => isset($d['endDate']) ? $d['endDate'].' 00:00:00' : $d['startDate'].' 00:00:00',
            'coordinator' => $d['coordinator'] ?? null,
            'tel_no' => $d['telNo'] ?? null,
            'mobile_no' => $d['mobileNo'] ?? null,
            'email' => $d['email'] ?? null,
            'corporate_id' => $d['corporateId'] ?? null,
            'client_id' => $d['clientId'] ?? null,
            'client_contact' => $this->clientContactSnapshots($d['clientContactIds']),
            'sellside_contact' => $this->sellsideSnapshots($d['sellsideContactIds']),
        ];
    }

    private function wire(Event $event): array
    {
        return $event->refresh()->load(['corporate', 'client'])->loadCount('meetings')->toWire();
    }

    private function detail(Event $event): array
    {
        $event->load(['corporate', 'client', 'meetings.client', 'meetings.corporate', 'investors.client', 'flights', 'transportation', 'accommodation', 'attendees.sellsideContact'])->loadCount('meetings');

        return [
            'item' => $event->toWire(),
            'children' => [
                'meetings' => $event->meetings->map->toWire()->values(),
                'investors' => $event->investors->map->toWire()->values(),
                'flights' => $event->flights->map->toWire()->values(),
                'transportation' => $event->transportation->map->toWire()->values(),
                'accommodation' => $event->accommodation->map->toWire()->values(),
                'attendees' => $event->attendees->map->toWire()->values(),
            ],
        ];
    }
}
