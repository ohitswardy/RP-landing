<?php

namespace App\Http\Controllers\Crms;

use App\Models\Crms\Interaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The consumption record. Lists are paged and filtered server-side; every
 * save stores attendee snapshots and the captured form, and `disposition`
 * says whether the analyst filed it or flagged it for the Email desk.
 * `important` is a second, independent mark: it pins the record to the
 * dashboard and can be toggled on its own without re-sending the form.
 */
class InteractionController extends CrmsController
{
    private const PER_PAGE_MAX = 100;

    public function index(Request $request): JsonResponse
    {
        $q = Interaction::with(['client', 'type']);

        if ($id = $request->integer('clientId')) {
            $q->where('client_id', $id);
        }
        if ($id = $request->integer('typeId')) {
            $q->where('interactions_type_id', $id);
        }
        if ($year = $request->integer('year')) {
            $q->whereBetween('interaction_date', ["$year-01-01 00:00:00", "$year-12-31 23:59:59"]);
        }
        $q->between($request->query('from'), $request->query('to'));
        if ($request->boolean('important')) {
            $q->important();
        }
        if ($d = $request->query('disposition')) {
            $d === 'open'
                ? $q->where('disposition', Interaction::DISPOSITION_FLAGGED)->whereNull('actioned_at')
                : $q->where('disposition', $d);
        }
        if ($term = trim((string) $request->query('q'))) {
            $q->where(function ($w) use ($term) {
                $w->where('description', 'like', "%$term%")
                    ->orWhere('meeting_type', 'like', "%$term%")
                    ->orWhere('client_contact', 'like', "%$term%")
                    ->orWhere('sellside_contact', 'like', "%$term%")
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%$term%"));
                if (ctype_digit($term)) {
                    $w->orWhere('id', (int) $term);
                }
            });
        }

        $perPage = min(max($request->integer('perPage', 25), 1), self::PER_PAGE_MAX);
        $page = $q->orderByDesc('interaction_date')->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', max($request->integer('page', 1), 1));

        return response()->json([
            'items' => collect($page->items())->map->toWire()->values(),
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'pages' => max($page->lastPage(), 1),
            'minutes' => (int) $page->getCollection()->sum(fn (Interaction $i) => $i->minutes()),
        ]);
    }

    public function show(Interaction $interaction): JsonResponse
    {
        return response()->json(['item' => $interaction->load(['client', 'type'])->toWire()]);
    }

    private const RULES = [
        'clientId' => ['required', 'integer'],
        'typeId' => ['nullable', 'integer'],
        'date' => ['required', 'date'],
        'timeStart' => ['nullable', 'date_format:H:i'],
        'timeEnd' => ['nullable', 'date_format:H:i'],
        'duration' => ['nullable', 'integer', 'min:0', 'max:1440'],
        'meetingType' => ['nullable', 'string', 'max:255'],
        'description' => ['nullable', 'string', 'max:20000'],
        'internalNotes' => ['nullable', 'string', 'max:20000'],
        'actionPoint' => ['nullable', 'string', 'max:5000'],
        'recipients' => ['nullable', 'string', 'max:5000'],
        'clientContactIds' => ['present', 'array', 'max:100'],
        'clientContactIds.*' => ['integer'],
        'sellsideContactIds' => ['present', 'array', 'max:50'],
        'sellsideContactIds.*' => ['integer'],
        'form' => ['present', 'array', 'max:60'],
        'form.*.id' => ['nullable', 'integer'],
        'form.*.internalName' => ['required', 'string', 'max:80'],
        'form.*.label' => ['nullable', 'string', 'max:160'],
        'form.*.fieldType' => ['nullable', 'string', 'max:40'],
        'form.*.options' => ['nullable', 'array'],
        'form.*.multiSelect' => ['nullable', 'boolean'],
        'form.*.value' => ['nullable'],
        'disposition' => ['nullable', 'in:closed,flagged'],
        'important' => ['nullable', 'boolean'],
        'importantNote' => ['nullable', 'string', 'max:280'],
    ];

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(self::RULES);
        $interaction = new Interaction($this->attributes($data) + [
            'user_id' => $this->legacyUserId(),
            'created' => now(),
        ]);
        $interaction->markImportant((bool) ($data['important'] ?? false), $data['importantNote'] ?? null)->save();

        return $this->item($this->wire($interaction), $this->audit('Logged interaction', $this->label($interaction)), 201);
    }

    public function update(Request $request, Interaction $interaction): JsonResponse
    {
        $data = $request->validate(self::RULES);
        $interaction->fill($this->attributes($data))
            ->markImportant((bool) ($data['important'] ?? false), $data['importantNote'] ?? null)
            ->save();

        return $this->item($this->wire($interaction), $this->audit('Updated interaction', $this->label($interaction)));
    }

    public function destroy(Interaction $interaction): JsonResponse
    {
        $label = $this->label($interaction);
        $interaction->delete();

        return $this->deleted($this->audit('Deleted interaction', $label));
    }

    /** A flagged interaction has been handed to the Email desk composer. */
    public function actioned(Interaction $interaction): JsonResponse
    {
        $interaction->forceFill(['disposition' => Interaction::DISPOSITION_FLAGGED, 'actioned_at' => now()])->save();

        return $this->item($this->wire($interaction), $this->audit('Sent interaction to recipients', $this->label($interaction)));
    }

    /**
     * Toggle the important mark on its own — from the list, the dashboard or
     * the record page — without re-submitting the whole form. Omitting `note`
     * keeps the note already stored.
     */
    public function important(Request $request, Interaction $interaction): JsonResponse
    {
        $data = $request->validate([
            'important' => ['required', 'boolean'],
            'note' => ['nullable', 'string', 'max:280'],
        ]);
        $interaction->markImportant($data['important'], array_key_exists('note', $data) ? $data['note'] : $interaction->important_note)->save();

        return $this->item(
            $this->wire($interaction),
            $this->audit($data['important'] ? 'Marked interaction important' : 'Cleared important mark', $this->label($interaction)),
        );
    }

    private function attributes(array $d): array
    {
        return [
            'client_id' => $d['clientId'],
            'interactions_type_id' => $d['typeId'] ?? null,
            'interaction_date' => $d['date'].' 00:00:00',
            'time_start' => $d['timeStart'] ?? null,
            'time_end' => $d['timeEnd'] ?? null,
            'duration' => isset($d['duration']) ? (string) $d['duration'] : null,
            'meeting_type' => $d['meetingType'] ?? null,
            'description' => $d['description'] ?? null,
            'internal_notes' => $d['internalNotes'] ?? null,
            'action_point' => $d['actionPoint'] ?? null,
            'recipients' => $d['recipients'] ?? null,
            'client_contact' => $this->clientContactSnapshots($d['clientContactIds']),
            'sellside_contact' => $this->sellsideSnapshots($d['sellsideContactIds']),
            // The legacy shape, so reports and the Angular app read it back unchanged.
            'form' => array_values(array_map(fn ($f, $i) => [
                'id' => (int) ($f['id'] ?? $i + 1),
                'internalName' => $f['internalName'],
                'label' => $f['label'] ?? $f['internalName'],
                'fieldType' => $f['fieldType'] ?? 'textBox',
                'options' => $f['options'] ?? ['type' => '', 'bindLabel' => 'name', 'value' => ''],
                'multiSelect' => (bool) ($f['multiSelect'] ?? false),
                'value' => $f['value'] ?? '',
            ], $d['form'], array_keys($d['form']))),
            'disposition' => $d['disposition'] ?? Interaction::DISPOSITION_CLOSED,
        ];
    }

    private function wire(Interaction $i): array
    {
        return $i->refresh()->load(['client', 'type'])->toWire();
    }

    private function label(Interaction $i): string
    {
        return $i->reference().' · '.($i->client?->name ?? $i->loadMissing('client')->client?->name ?? 'client');
    }
}
