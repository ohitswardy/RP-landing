<?php

namespace App\Services\Crms;

use App\Enums\Crms\EventCategory;
use App\Models\Crms\InteractionType;

/**
 * Picks the interaction type a converted meeting should carry. The legacy
 * Angular app mapped each event kind to a type by name; those names live in
 * the per-client `interactionsType` rows and are spelled inconsistently
 * ("Roadshow:Deal" and "Roadshow: Deal" both exist), so matching runs on a
 * normalised key. The client's own types win over the global ones.
 */
class InteractionTypeResolver
{
    /** Candidate type names per event kind, in preference order (legacy interaction-form mapping). */
    public const CANDIDATES = [
        'deal-roadshow' => ['Roadshow:Deal', 'Deal Related'],
        'non-deal-roadshow' => ['Roadshow:Non-Deal', 'Non Deal Roadshow'],
        'reverse-roadshow' => ['Bespoke Access', 'Bespoke'],
        'expert' => ['Expert Meeting', 'Industry Expert'],
        'analyst-marketing' => ['Analyst Meeting', 'Analyst Marketing'],
        'analyst-interaction' => ['Analyst Interaction'],
    ];

    public function resolve(?int $clientId, array $candidateNames): ?InteractionType
    {
        if ($candidateNames === []) {
            return null;
        }
        $types = InteractionType::where(fn ($q) => $q->whereNull('client_id')->when($clientId, fn ($w) => $w->orWhere('client_id', $clientId)))->get();
        if ($types->isEmpty()) {
            return null;
        }

        foreach ($candidateNames as $name) {
            $key = self::normalise($name);
            $matches = $types->filter(fn (InteractionType $t) => self::normalise((string) $t->type) === $key);
            if ($matches->isEmpty()) {
                continue;
            }

            // Client-scoped first, then global.
            return $matches->first(fn (InteractionType $t) => $t->client_id !== null) ?? $matches->first();
        }

        return null;
    }

    /** Candidates for a meeting inside a roadshow-family event. */
    public function candidatesForEvent(?EventCategory $category, ?string $classification, string $meetingKind): array
    {
        if ($meetingKind === 'expert_meeting') {
            return self::CANDIDATES['expert'];
        }

        return match ($category) {
            EventCategory::Roadshow => $classification === 'Deal Roadshow' ? self::CANDIDATES['deal-roadshow'] : self::CANDIDATES['non-deal-roadshow'],
            EventCategory::ReverseRoadshow => self::CANDIDATES['reverse-roadshow'],
            EventCategory::AnalystMarketing => self::CANDIDATES['analyst-marketing'],
            default => [],
        };
    }

    /** Candidates for a standalone (one-off) meeting by its classification. */
    public function candidatesForOneOff(?string $classification): array
    {
        return match ($classification) {
            'analyst' => self::CANDIDATES['analyst-interaction'],
            'expert_meeting' => self::CANDIDATES['expert'],
            // Legacy typed these as a reverse roadshow by accident; Bespoke Access is what they meant.
            'corporate' => self::CANDIDATES['reverse-roadshow'],
            default => [],
        };
    }

    public static function normalise(string $name): string
    {
        return preg_replace('/[^a-z0-9]+/', '', mb_strtolower($name)) ?? '';
    }
}
