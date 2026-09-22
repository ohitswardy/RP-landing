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
        // MySQL/MariaDB reduce the JSON in SQL so the ~1,900-issue archive never
        // loads its bodies; sqlite (phpunit) has no JSON_LENGTH, so it reads
        // `sections` and reduces in PHP — same shape, tiny tables only.
        $inSql = in_array(static::query()->getConnection()->getDriverName(), ['mysql', 'mariadb'], true);

        $query = static::query()->orderByDesc('date')->orderByDesc('id');
        $query = $inSql
            ? $query->selectRaw("id, cadence, date, subject, updated_at, JSON_LENGTH(sections) AS section_count, JSON_EXTRACT(sections, '$[*].badge') AS badge_list")
            : $query->select(['id', 'cadence', 'date', 'subject', 'updated_at', 'sections']);

        return $query->get()
            ->map(static function (self $row) use ($inSql): array {
                if ($inSql) {
                    $count = (int) $row->getAttribute('section_count');
                    $raw = json_decode((string) $row->getAttribute('badge_list'), true) ?: [];
                } else {
                    $sections = $row->getAttribute('sections');
                    $sections = is_array($sections) ? $sections : (json_decode((string) $sections, true) ?: []);
                    $count = count($sections);
                    $raw = array_map(fn ($s) => $s['badge'] ?? '', $sections);
                }

                $badges = [];
                foreach ($raw as $b) {
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
                    'sectionCount' => $count,
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
