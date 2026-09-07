<?php

namespace App\Enums\Crms;

/**
 * roadshow.category — the discriminator on the shared `roadshow` table,
 * as the production data actually uses it: 1 Company Roadshow (corporate
 * subject), 2 Reverse Roadshow (client subject), 3 Analyst Marketing (the
 * seeded row is named "Meeting", but every category-3 event carries a
 * travelling analyst and no corporate or client). One-off meetings are not
 * roadshows at all — they live in the `event` table (OneOffMeeting).
 */
enum EventCategory: int
{
    case Roadshow = 1;
    case ReverseRoadshow = 2;
    case AnalystMarketing = 3;

    /** URL slug ⇄ category, the shape the /crms/events/{type} routes use. */
    public static function fromSlug(string $slug): ?self
    {
        return match ($slug) {
            'roadshows' => self::Roadshow,
            'reverse-roadshows' => self::ReverseRoadshow,
            'analyst-marketing' => self::AnalystMarketing,
            default => null,
        };
    }

    public function slug(): string
    {
        return match ($this) {
            self::Roadshow => 'roadshows',
            self::ReverseRoadshow => 'reverse-roadshows',
            self::AnalystMarketing => 'analyst-marketing',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Roadshow => 'Company Roadshow',
            self::ReverseRoadshow => 'Reverse Roadshow',
            self::AnalystMarketing => 'Analyst Marketing',
        };
    }
}
