<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\Interaction;
use App\Models\Crms\OneOffMeeting;
use App\Services\Crms\InteractionTypeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Standalone meetings (the legacy `event` table): list, record, and hand-off to an interaction. */
class OneOffMeetingController extends CrmsController
{
    public function index(Request $request): JsonResponse
    {
        $q = OneOffMeeting::with(['client', 'corporate']);
        if ($year = $request->integer('year')) {
            $q->whereBetween('start_date', ["$year-01-01 00:00:00", "$year-12-31 23:59:59"]);
        }

        return response()->json([
            'items' => $q->orderByDesc('start_date')->orderByDesc('id')->limit(500)->get()->map->toWire()->values(),
        ]);
    }

    public function show(OneOffMeeting $meeting): JsonResponse
    {
        return response()->json(['item' => $meeting->load(['client', 'corporate'])->toWire()]);
    }

    /** Legacy rows are loose — only the slot and the kind are always required; the counterparty rule is per kind. */
    private function rules(): array
    {
        return [
            'clientId' => ['nullable', 'integer'],
            'corporateId' => ['nullable', 'integer'],
            'startDate' => ['required', 'date'],
            'endDate' => ['nullable', 'date', 'after_or_equal:startDate'],
            'timeStart' => ['nullable', 'date_format:H:i'],
            'timeEnd' => ['nullable', 'date_format:H:i'],
            'timezone' => ['nullable', 'string', 'max:20'],
            'location' => ['nullable', 'string', 'max:2000'],
            'meetingType' => ['nullable', 'string', 'max:255'],
            'classification' => ['required', Rule::in(OneOffMeeting::CLASSIFICATIONS)],
            'description' => ['nullable', 'string', 'max:5000'],
            'note' => ['nullable', 'string', 'max:5000'],
            'corporateAddress' => ['nullable', 'string', 'max:255'],
            'clientContactIds' => ['present', 'array', 'max:100'],
            'clientContactIds.*' => ['integer'],
            'corporateContactIds' => ['present', 'array', 'max:50'],
            'corporateContactIds.*' => ['integer'],
            'sellsideContactIds' => ['nullable', 'array', 'max:50'],
            'sellsideContactIds.*' => ['integer'],
        ];
    }

    /** What each kind must name, as the legacy form enforced it. */
    private function classificationError(array $d): ?string
    {
        return match ($d['classification']) {
            'corporate' => empty($d['corporateId']) ? 'A corporate meeting needs the issuer.' : null,
            'analyst' => empty($d['sellsideContactIds']) ? 'An analyst meeting needs at least one analyst.' : null,
            default => empty($d['clientId']) ? 'An expert meeting needs the client.' : (empty($d['description']) ? 'Describe the expert meeting.' : null),
        };
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        if ($error = $this->classificationError($data)) {
            return response()->json(['message' => $error], 422);
        }
        $meeting = OneOffMeeting::create($this->attributes($data) + ['user_id' => $this->legacyUserId(), 'created' => now()]);

        return $this->item($this->wire($meeting), $this->audit('Created one-off meeting', $meeting->subject()), 201, $this->authorMeta());
    }

    public function update(Request $request, OneOffMeeting $meeting): JsonResponse
    {
        $data = $request->validate($this->rules());
        if ($error = $this->classificationError($data)) {
            return response()->json(['message' => $error], 422);
        }
        $meeting->fill($this->attributes($data))->save();

        return $this->item($this->wire($meeting), $this->audit('Updated one-off meeting', $meeting->subject()));
    }

    public function destroy(OneOffMeeting $meeting): JsonResponse
    {
        $label = $meeting->load(['client', 'corporate'])->subject();
        $meeting->delete();

        return $this->deleted($this->audit('Deleted one-off meeting', $label));
    }

    /**
     * The meeting becomes an interaction — the record the firm is paid on.
     * Typed by the legacy mapping (analyst interaction, expert meeting,
     * bespoke access) with the meeting's analysts as the Regis party.
     */
    public function convert(OneOffMeeting $meeting, InteractionTypeResolver $types): JsonResponse
    {
        if ($meeting->interaction_id && Interaction::whereKey($meeting->interaction_id)->exists()) {
            return response()->json(['message' => 'This meeting was already logged.', 'interactionId' => (string) $meeting->interaction_id], 409);
        }
        $meeting->load(['client', 'corporate']);
        if (! $meeting->client_id) {
            return response()->json(['message' => 'Pick the client on the meeting first — an interaction is always logged against a client.'], 422);
        }
        $type = $types->resolve((int) $meeting->client_id, $types->candidatesForOneOff($meeting->classification));

        $interaction = Interaction::create([
            'client_id' => $meeting->client_id,
            'interactions_type_id' => $type?->id,
            'interaction_date' => $meeting->start_date,
            'time_start' => $meeting->time_start,
            'time_end' => $meeting->time_end,
            'duration' => self::minutesBetween($meeting->time_start, $meeting->time_end),
            'meeting_type' => $meeting->meeting_type,
            'description' => trim('One-Off Meeting · '.$meeting->subject()."\n".($meeting->descriptionText() ?? '')),
            'client_contact' => $meeting->client_contact,
            'sellside_contact' => $meeting->analysts(),
            'form' => [],
            'disposition' => Interaction::DISPOSITION_CLOSED,
            'user_id' => $this->legacyUserId(),
            'created' => now(),
        ]);
        $meeting->forceFill(['interaction_id' => $interaction->id])->save();

        return response()->json([
            'item' => $interaction->load(['client', 'type'])->toWire(),
            'meeting' => $this->wire($meeting),
            'audit' => $this->audit('Converted meeting to interaction', $interaction->reference())->toWire(),
            'meta' => $this->authorMeta(),
        ], 201);
    }

    private function attributes(array $d): array
    {
        // An analyst meeting keeps its analyst list in `description`, byte-compatible with the legacy app.
        $description = $d['classification'] === 'analyst'
            ? json_encode($this->sellsideSnapshots($d['sellsideContactIds'] ?? []), JSON_UNESCAPED_UNICODE)
            : ($d['description'] ?? null);

        return [
            'client_id' => $d['clientId'] ?? null,
            'corporate_id' => $d['corporateId'] ?? null,
            'start_date' => $d['startDate'].' 00:00:00',
            'end_date' => ($d['endDate'] ?? $d['startDate']).' 00:00:00',
            'time_start' => $d['timeStart'] ?? null,
            'time_end' => $d['timeEnd'] ?? null,
            'timezone' => $d['timezone'] ?? null,
            'location' => $d['location'] ?? '', // NOT NULL in the legacy table
            'meeting_type' => $d['meetingType'] ?? null,
            'classification' => $d['classification'],
            'description' => $description,
            'note' => $d['note'] ?? null,
            'corporate_address' => $d['corporateAddress'] ?? null,
            'client_contact' => $this->clientContactSnapshots($d['clientContactIds']),
            'corporate_contact' => $this->corporateContactSnapshots($d['corporateContactIds']),
        ];
    }

    private function wire(OneOffMeeting $m): array
    {
        return $m->refresh()->load(['client', 'corporate'])->toWire();
    }
}
