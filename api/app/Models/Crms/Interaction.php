<?php

namespace App\Models\Crms;

use App\Casts\LegacyJson;
use App\Casts\LegacyTime;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The MiFID II consumption record — one row per client touchpoint. The
 * attendee columns are snapshots taken at save time and are never rewritten
 * (Database.md §4). `disposition` records how the analyst closed the entry:
 * closed (filed) or flagged (handed to the Email desk for sales to act on).
 * `important` pins the record to the CRMS dashboard, with a one-line note on
 * why it matters and the moment it was first marked.
 */
class Interaction extends CrmsModel
{
    protected $table = 'interactions';

    public const DISPOSITION_CLOSED = 'closed';

    public const DISPOSITION_FLAGGED = 'flagged';

    protected $casts = [
        'interaction_date' => 'datetime',
        'actioned_at' => 'datetime',
        'important' => 'boolean',
        'important_at' => 'datetime',
        'time_start' => LegacyTime::class,
        'time_end' => LegacyTime::class,
        'form' => LegacyJson::class,
        'client_contact' => LegacyJson::class,
        'sellside_contact' => LegacyJson::class,
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(InteractionType::class, 'interactions_type_id');
    }

    public function scopeImportant(Builder $q): Builder
    {
        return $q->where('important', true);
    }

    /**
     * Set or clear the important mark. The note lives only while marked;
     * important_at is the first time it was marked and survives re-saves.
     */
    public function markImportant(bool $important, ?string $note = null): static
    {
        $note = $note === null ? null : trim($note);
        $this->important = $important;
        $this->important_note = $important && $note !== '' ? $note : null;
        $this->important_at = $important ? ($this->important_at ?? now()) : null;

        return $this;
    }

    public function scopeBetween(Builder $q, ?string $from, ?string $to): Builder
    {
        if ($from) {
            $q->where('interaction_date', '>=', $from.' 00:00:00');
        }
        if ($to) {
            $q->where('interaction_date', '<=', $to.' 23:59:59');
        }

        return $q;
    }

    /**
     * recipients is free text today; the legacy blaster stored a JSON list of
     * contacts there. Either way it reads back as a comma-separated address line.
     */
    public function recipientsText(): ?string
    {
        $raw = $this->recipients;
        if ($raw === null || trim((string) $raw) === '') {
            return null;
        }
        $decoded = json_decode((string) $raw, true);
        if (! is_array($decoded)) {
            return (string) $raw;
        }
        $parts = array_map(fn ($r) => is_array($r) ? ($r['email'] ?? $r['name'] ?? '') : (string) $r, $decoded);

        return implode(', ', array_filter($parts)) ?: null;
    }

    /** Interaction ids are shown zero-padded to ten digits everywhere. */
    public function reference(): string
    {
        return str_pad((string) $this->id, 10, '0', STR_PAD_LEFT);
    }

    /** Minutes of contact: the typed duration, else end − start. */
    public function minutes(): int
    {
        if (is_numeric($this->duration)) {
            return max(0, (int) $this->duration);
        }
        if ($this->time_start && $this->time_end) {
            [$sh, $sm] = explode(':', $this->time_start);
            [$eh, $em] = explode(':', $this->time_end);
            $diff = ((int) $eh * 60 + (int) $em) - ((int) $sh * 60 + (int) $sm);
            if ($diff > 0) {
                return $diff;
            }
        }

        return 0;
    }

    /**
     * One captured form value by its stable internalName, flattened to text.
     * Legacy values are strings, a lookup snapshot object, or a list of
     * either; lookups read as their ticker, else their name.
     */
    public function formValue(string $internalName): ?string
    {
        foreach ($this->form as $field) {
            if (($field['internalName'] ?? null) === $internalName) {
                $text = implode(', ', array_map(fn ($x) => self::valueText($x), self::valueList($field['value'] ?? null)));

                return $text === '' ? null : $text;
            }
        }

        return null;
    }

    /**
     * Every corporate named on the form — the "Companies Discussed" lookups
     * and the stock1–stock5 fields — as [id, ticker, name] rows.
     */
    public function corporatesDiscussed(): array
    {
        $out = [];
        foreach ($this->form as $field) {
            $isCorporate = ($field['options']['value'] ?? null) === 'Corporate'
                || preg_match('/^stock[1-5]$/', (string) ($field['internalName'] ?? ''));
            if (! $isCorporate) {
                continue;
            }
            foreach (self::valueList($field['value'] ?? null) as $v) {
                if (is_array($v)) {
                    $out[] = ['id' => isset($v['id']) ? (int) $v['id'] : null, 'ticker' => $v['ticker'] ?? null, 'name' => $v['name'] ?? null];
                } elseif (trim((string) $v) !== '') {
                    $out[] = ['id' => null, 'ticker' => trim((string) $v), 'name' => null];
                }
            }
        }

        return $out;
    }

    /** A legacy value as a list: '' → [], scalar → [scalar], object → [object], list → list. */
    public static function valueList(mixed $v): array
    {
        if ($v === null || $v === '' || $v === []) {
            return [];
        }
        if (! is_array($v)) {
            return [$v];
        }

        return array_is_list($v) ? $v : [$v];
    }

    private static function valueText(mixed $x): string
    {
        if (is_array($x)) {
            return (string) ($x['ticker'] ?? $x['name'] ?? '');
        }

        return (string) $x;
    }

    public function toWire(): array
    {
        return [
            'id' => $this->wireId(),
            'reference' => $this->reference(),
            'date' => self::day($this->interaction_date),
            'timeStart' => $this->time_start,
            'timeEnd' => $this->time_end,
            'duration' => $this->duration,
            'minutes' => $this->minutes(),
            'meetingType' => $this->meeting_type,
            'description' => $this->description,
            'internalNotes' => $this->internal_notes,
            'actionPoint' => $this->action_point,
            'recipients' => $this->recipientsText(),
            'clientContacts' => $this->client_contact,
            'sellsideContacts' => $this->sellside_contact,
            'form' => $this->form,
            'clientId' => (string) $this->client_id,
            'clientName' => $this->relationLoaded('client') ? $this->client?->name : null,
            'typeId' => self::idOrNull($this->interactions_type_id),
            'typeName' => $this->relationLoaded('type') ? $this->type?->type : null,
            'authorId' => self::idOrNull($this->user_id),
            'disposition' => $this->disposition ?: self::DISPOSITION_CLOSED,
            'actionedAt' => $this->actioned_at?->toIso8601String(),
            'important' => (bool) $this->important,
            'importantNote' => $this->important_note,
            'importantAt' => $this->important_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
