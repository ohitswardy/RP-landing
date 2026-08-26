<?php

namespace App\Support;

/**
 * Canonical seed copy for the /insights journal page — every block the
 * page renders around the note ledger itself. Shared by the migration
 * and by InsightPage::current(), so the two can never drift.
 */
class InsightsDefaults
{
    /** Sector tags offered in the CMS and, by default, on the public filter rail. */
    public const TAGS = ['Macro', 'Banks', 'Consumer', 'Property', 'Power', 'Single name', 'Policy', 'Strategy'];

    public static function content(): array
    {
        return [
            'hero' => [
                'eyebrow' => 'The journal',
                'title' => 'Research worth being early on.',
                'dek' => '',
                'image' => '/InsightsBG.png',
            ],

            'filters' => [
                'enabled' => true,
                'allLabel' => 'All',
                'tags' => self::TAGS,
            ],

            'list' => [
                'limit' => 0,               // 0 = every published note
                'showExcerpt' => true,
                'showAuthor' => true,
                'showDate' => true,
                'featureLead' => true,
                'noteHref' => '/login',
                'emptyText' => 'No notes published under this sector yet.',
            ],

            'cta' => [
                'enabled' => true,
                'label' => 'Sign in for the full archive',
                'href' => '/login',
            ],

            'newsletter' => [
                'enabled' => true,
            ],
        ];
    }
}
