<?php

namespace App\Support;

/**
 * Canonical seed copy for the /services pages. Shared by the content
 * seeder and by the migration that backfills existing installs, so the
 * two can never drift.
 */
class ServiceDefaults
{
    /** The /services landing page. */
    public static function page(): array
    {
        return [
            'eyebrow' => 'What we do',
            'title' => 'Our Services',
            'dek' => '',
            'hero_image' => '/Services Hero.png',
            'card_cta' => 'Read the practice brief',
        ];
    }

    /** The four practice pages, in display order. */
    public static function lines(): array
    {
        return [
            [
                'slug' => 'research',
                'eyebrow' => 'Service',
                'title' => 'Research Advisory',
                'dek' => 'Original, conviction-led equity research with the institutional rigor of a global house and the ground-truth of a local one.',
                'intro_heading' => 'What the practice delivers.',
                'img' => '/Services1.jpg',
                'hero_images' => ['/Services1.jpg', '/Service1.1.jpg', '/service1.2.jpg'],
                'pillars' => [
                    ['title' => 'Single-name coverage', 'body' => 'Initiations, quarterly updates, and event-driven notes across 120+ PSE-listed names.'],
                    ['title' => 'Sector deep-dives', 'body' => 'Quarterly thematic work on banks, property, consumer, power, conglomerates, and TMT.'],
                    ['title' => 'Macro & strategy', 'body' => 'BSP, inflation, FX, fiscal, and politics translated into PSE positioning.'],
                    ['title' => 'Bespoke commissioned work', 'body' => 'Confidential research mandates for allocators with specific exposure questions.'],
                ],
                'proof' => [
                    ['value' => '120+', 'label' => 'names'],
                    ['value' => '1,400', 'label' => 'notes / yr'],
                    ['value' => '22 yrs', 'label' => 'avg PM tenure'],
                ],
            ],
            [
                'slug' => 'sales',
                'eyebrow' => 'Service',
                'title' => 'Sales Advisory',
                'dek' => 'A high-touch institutional dealing desk that knows your mandate, your benchmarks, and your reporting calendar.',
                'intro_heading' => 'What the practice delivers.',
                'img' => '/Services2.jpg',
                'hero_images' => ['/Services2.jpg', '/Service 2.1.jpg'],
                'pillars' => [
                    ['title' => 'Idea generation', 'body' => 'Daily morning calls and conviction lists, filtered to your risk appetite.'],
                    ['title' => 'Portfolio overlays', 'body' => 'Tactical pair trades, hedges, and rotations across PSE sectors.'],
                    ['title' => 'Cross-asset commentary', 'body' => 'How peso, rates, and Asian risk are positioning Philippine equities.'],
                    ['title' => 'Bespoke roadshows', 'body' => 'Custom NDRs assembled around portfolio gaps.'],
                ],
                'proof' => [
                    ['value' => '300+', 'label' => 'institutions'],
                    ['value' => '9', 'label' => 'global jurisdictions'],
                    ['value' => 'Partner-led', 'label' => 'coverage'],
                ],
            ],
            [
                'slug' => 'trading',
                'eyebrow' => 'Service',
                'title' => 'Trading & Execution',
                'dek' => 'Discreet block, agency, and program execution on the PSE by a desk that has traded through every regime since 1999.',
                'intro_heading' => 'What the practice delivers.',
                'img' => '/Services3.jpg',
                'hero_images' => ['/Services3.jpg', '/Service 3.1.jpg', '/Service 3.2.jpg'],
                'pillars' => [
                    ['title' => 'Block & facilitation', 'body' => 'Liquidity in size, with minimal information leakage.'],
                    ['title' => 'Algos & program', 'body' => 'VWAP, TWAP, and implementation-shortfall trajectories.'],
                    ['title' => 'Cross-border settlement', 'body' => 'DvP, omnibus, and segregated custody with global banks.'],
                    ['title' => 'After-hours liquidity', 'body' => 'Coordinated execution outside the PSE clock when it matters.'],
                ],
                'proof' => [
                    ['value' => 'Top 10', 'label' => 'PSE trading participant'],
                    ['value' => '<10bps', 'label' => 'avg slippage on blocks'],
                    ['value' => '24/5', 'label' => 'global desk coverage'],
                ],
            ],
            [
                'slug' => 'corporate',
                'eyebrow' => 'Service',
                'title' => 'Corporate Access',
                'dek' => 'The deepest C-suite rolodex in Philippine equities. Conferences, NDRs, site visits, and corporate days that move conviction.',
                'intro_heading' => 'What the practice delivers.',
                'img' => '/Services4.jpg',
                'hero_images' => ['/Services4.jpg', '/Services 4.1.jpg', '/Service 4.2.jpg'],
                'pillars' => [
                    ['title' => 'Annual Manila Conference', 'body' => 'Three days. 60+ issuers, 200+ investors, 4,000+ one-on-ones.'],
                    ['title' => 'C-suite NDRs', 'body' => 'Single-name roadshows for CEOs, CFOs, and IROs into Asia, the US, and Europe.'],
                    ['title' => 'Site visits & plant tours', 'body' => 'Operating-asset visits across power, food, logistics, and property.'],
                    ['title' => 'Thematic corporate days', 'body' => 'Banks, consumer, infrastructure, and ESG-themed calendars.'],
                ],
                'proof' => [
                    ['value' => '25 yrs', 'label' => 'C-suite relationships'],
                    ['value' => '60+', 'label' => 'issuers / conference'],
                    ['value' => 'Asia · EU · US', 'label' => 'NDR routes'],
                ],
            ],
        ];
    }
}
