<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsletterIssue extends Model
{
    protected $fillable = ['cadence', 'date', 'subject', 'intro', 'sections', 'rail', 'legacy_id'];

    /**
     * The list the desk browses: one light row per issue, with the story
     * count and badges read out of the JSON in SQL so the bodies — years
     * of daily mailers — never leave the database until an issue is opened.
     *
     * @return \Illuminate\Support\Collection<int, array>
     */
    public static function summaries(): \Illuminate\Support\Collection
    {
        return static::query()
            ->selectRaw("id, cadence, date, subject, updated_at, JSON_LENGTH(sections) AS section_count, JSON_EXTRACT(sections, '$[*].badge') AS badge_list")
            ->orderByDesc('date')->orderByDesc('id')
            ->get()
            ->map(static function (self $row): array {
                $badges = [];
                foreach (json_decode((string) $row->getAttribute('badge_list'), true) ?: [] as $b) {
                    $b = trim((string) $b);
                    if ($b !== '' && ! in_array($b, $badges, true)) {
                        $badges[] = $b;
                    }
                }

                return [
                    'id' => (string) $row->id,
                    'cadence' => $row->cadence,
                    'date' => $row->date->format('Y-m-d'),
                    'subject' => $row->subject,
                    'sectionCount' => (int) $row->getAttribute('section_count'),
                    'badges' => $badges,
                    'updated' => $row->updated_at?->toIso8601String() ?? now()->toIso8601String(),
                ];
            });
    }

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'sections' => 'array', 'rail' => 'array'];
    }

    public function toWire(): array
    {
        return [
            'id' => (string) $this->id,
            'cadence' => $this->cadence,
            'date' => $this->date->format('Y-m-d'),
            'subject' => $this->subject,
            'intro' => $this->intro,
            'sections' => $this->sections ?? [],
            // Monthly only, and empty on issues filed before the rail existed.
            'rail' => $this->rail ?? [],
            'updated' => $this->updated_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }
}
