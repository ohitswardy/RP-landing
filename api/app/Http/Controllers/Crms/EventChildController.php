<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\CrmsModel;
use App\Models\Crms\Event;
use App\Models\Crms\Meeting;
use App\Models\Crms\SellsideContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * One controller for every child tab of an event — meetings, investors,
 * flights, ground transportation, accommodation and the REGIS party. The
 * URL segment picks the model, rules and column mapping.
 */
class EventChildController extends CrmsController
{
    public function store(Request $request, Event $event, string $type): JsonResponse
    {
        $model = $this->model($type);
        $data = $request->validate($this->rules($type));
        if ($error = $this->classificationError($type, $data)) {
            return response()->json(['message' => $error], 422);
        }
        $row = $model::create($this->attributes($type, $data) + ['roadshow_id' => $event->id]);

        return $this->item($this->wire($row), $this->audit("Added $type entry", $event->subject()), 201);
    }

    public function update(Request $request, Event $event, string $type, int $id): JsonResponse
    {
        $row = $this->model($type)::where('roadshow_id', $event->id)->findOrFail($id);
        $data = $request->validate($this->rules($type));
        if ($error = $this->classificationError($type, $data)) {
            return response()->json(['message' => $error], 422);
        }
        $row->fill($this->attributes($type, $data))->save();

        return $this->item($this->wire($row), $this->audit("Updated $type entry", $event->subject()));
    }

    public function destroy(Event $event, string $type, int $id): JsonResponse
    {
        $row = $this->model($type)::where('roadshow_id', $event->id)->findOrFail($id);
        $row->delete();

        return $this->deleted($this->audit("Removed $type entry", $event->subject()));
    }

    /** @return class-string<CrmsModel> */
    private function model(string $type): string
    {
        return Event::CHILDREN[$type] ?? abort(404);
    }

    private function rules(string $type): array
    {
        $time = ['nullable', 'date_format:H:i'];
        $ids = fn (int $max) => [['present', 'array', "max:$max"], ['integer']];

        return match ($type) {
            'meetings' => [
                'date' => ['required', 'date'],
                'timeStart' => ['required', 'date_format:H:i'],
                'timeEnd' => ['required', 'date_format:H:i'],
                'timezone' => ['nullable', 'string', 'max:20'],
                'location' => ['required', 'string', 'max:255'],
                'meetingType' => ['required', 'string', 'max:255'],
                'classification' => ['required', Rule::in(Meeting::CLASSIFICATIONS)],
                'description' => ['nullable', 'string', 'max:5000'],
                'contact' => ['nullable', 'string', 'max:5000'],
                'bookedBy' => ['nullable', 'string', 'max:255'],
                'note' => ['nullable', 'string', 'max:5000'],
                'corporateAddress' => ['nullable', 'string', 'max:2000'],
                'clientId' => ['nullable', 'integer'],
                'corporateId' => ['nullable', 'integer'],
                'clientContactIds' => $ids(100)[0], 'clientContactIds.*' => $ids(100)[1],
                'corporateContactIds' => $ids(50)[0], 'corporateContactIds.*' => $ids(50)[1],
            ],
            'investors' => [
                'clientId' => ['required', 'integer'],
                'clientContactIds' => $ids(100)[0], 'clientContactIds.*' => $ids(100)[1],
            ],
            'flights' => [
                'date' => ['required', 'date'],
                'time' => ['required', 'date_format:H:i'],
                'timezone' => ['nullable', 'string', 'max:20'],
                'location' => ['required', 'string', 'max:255'],
                'description' => ['nullable', 'string', 'max:2000'],
                'dateArrival' => ['nullable', 'date'],
                'timeArrival' => $time,
                'timezoneArrival' => ['nullable', 'string', 'max:20'],
                'locationArrival' => ['nullable', 'string', 'max:255'],
                'descriptionArrival' => ['nullable', 'string', 'max:2000'],
                'passenger' => ['nullable', 'string', 'max:5000'],
                'note' => ['nullable', 'string', 'max:5000'],
            ],
            'transportation' => [
                'date' => ['required', 'date'],
                'startTime' => ['required', 'date_format:H:i'],
                'endTime' => ['required', 'date_format:H:i'],
                'timezone' => ['nullable', 'string', 'max:20'],
                'location' => ['required', 'string', 'max:255'],
                'description' => ['nullable', 'string', 'max:2000'],
                'driverName' => ['required', 'string', 'max:255'],
                'driverMobile' => ['required', 'string', 'max:255'],
                'vehicleType' => ['required', 'string', 'max:255'],
                'confirmNo' => ['required', 'string', 'max:255'],
                'remarks' => ['nullable', 'string', 'max:2000'],
                'passenger' => ['nullable', 'string', 'max:5000'],
                'note' => ['nullable', 'string', 'max:5000'],
            ],
            'accommodation' => [
                'date' => ['required', 'date'],
                'timeIn' => $time,
                'dateOut' => ['nullable', 'date', 'after_or_equal:date'],
                'timeOut' => $time,
                'location' => ['nullable', 'string', 'max:255'],
                'description' => ['nullable', 'string', 'max:2000'],
                'accommodator' => ['nullable', 'string', 'max:5000'],
                'note' => ['nullable', 'string', 'max:5000'],
            ],
            'attendees' => [
                'sellsideContactId' => ['required', 'integer'],
            ],
            default => abort(404),
        };
    }

    /** Meeting classification decides which counterparty is mandatory (§4.3). */
    private function classificationError(string $type, array $d): ?string
    {
        if ($type !== 'meetings') {
            return null;
        }

        return match ($d['classification']) {
            'client' => empty($d['clientId']) ? 'A client meeting needs the client firm.' : null,
            'corporate' => empty($d['corporateId']) ? 'A corporate meeting needs the issuer.' : null,
            default => empty($d['description']) ? 'Describe the expert meeting or site visit.' : null,
        };
    }

    private function attributes(string $type, array $d): array
    {
        return match ($type) {
            'meetings' => [
                'date' => $d['date'].' 00:00:00',
                'time_start' => $d['timeStart'],
                'time_end' => $d['timeEnd'],
                'timezone' => $d['timezone'] ?? null,
                'location' => $d['location'],
                'meeting_type' => $d['meetingType'],
                'corporate_type' => $d['classification'],
                'description' => $d['description'] ?? null,
                'contact' => $d['contact'] ?? null,
                'booked_by' => $d['bookedBy'] ?? null,
                'note' => $d['note'] ?? null,
                'corporate_address' => $d['corporateAddress'] ?? null,
                'client_id' => $d['classification'] === 'client' ? $d['clientId'] : ($d['clientId'] ?? null),
                'corporate_id' => $d['classification'] === 'corporate' ? $d['corporateId'] : ($d['corporateId'] ?? null),
                'client_contact' => $this->clientContactSnapshots($d['clientContactIds']),
                'corporate_contact' => $this->corporateContactSnapshots($d['corporateContactIds']),
            ],
            'investors' => [
                'client_id' => $d['clientId'],
                'client_contact' => $this->clientContactSnapshots($d['clientContactIds']),
            ],
            'flights' => [
                'date' => $d['date'].' 00:00:00',
                'time' => $d['time'],
                'timezone' => $d['timezone'] ?? null,
                'location' => $d['location'],
                'description' => $d['description'] ?? null,
                'date_arrival' => isset($d['dateArrival']) ? $d['dateArrival'].' 00:00:00' : null,
                'time_arrival' => $d['timeArrival'] ?? null,
                'timezone_arrival' => $d['timezoneArrival'] ?? null,
                'location_arrival' => $d['locationArrival'] ?? null,
                'description_arrival' => $d['descriptionArrival'] ?? null,
                'passenger' => $d['passenger'] ?? null,
                'note' => $d['note'] ?? null,
            ],
            'transportation' => [
                'date' => $d['date'].' 00:00:00',
                'start_time' => $d['startTime'],
                'end_time' => $d['endTime'],
                'timezone' => $d['timezone'] ?? null,
                'location' => $d['location'],
                'description' => $d['description'] ?? null,
                'driver_name' => $d['driverName'],
                'driver_mobile' => $d['driverMobile'],
                'vehicle_type' => $d['vehicleType'],
                'confirm_no' => $d['confirmNo'],
                'remarks' => $d['remarks'] ?? null,
                'passenger' => $d['passenger'] ?? null,
                'note' => $d['note'] ?? null,
            ],
            'accommodation' => [
                'date' => $d['date'].' 00:00:00',
                'time_in' => $d['timeIn'] ?? null,
                'date_out' => isset($d['dateOut']) ? $d['dateOut'].' 00:00:00' : null,
                'time_out' => $d['timeOut'] ?? null,
                'location' => $d['location'] ?? null,
                'description' => $d['description'] ?? null,
                'accommodator' => $d['accommodator'] ?? null,
                'note' => $d['note'] ?? null,
            ],
            'attendees' => $this->attendeeAttributes((int) $d['sellsideContactId']),
        };
    }

    /** The REGIS party row snapshots the staff member's contact details. */
    private function attendeeAttributes(int $id): array
    {
        $s = SellsideContact::findOrFail($id);

        return [
            'sellside_contact_id' => $s->id,
            'position' => $s->position,
            'office_no' => $s->office_no,
            'mobile_no' => $s->mobile_no,
            'email' => $s->email,
        ];
    }

    private function wire($row): array
    {
        $row->refresh();
        if ($row instanceof Meeting) {
            $row->load(['client', 'corporate']);
        } elseif (method_exists($row, 'sellsideContact')) {
            $row->load('sellsideContact');
        } elseif (method_exists($row, 'client')) {
            $row->load('client');
        }

        return $row->toWire();
    }
}
