<?php

namespace App\Support;

/**
 * Canonical seed copy for the About page — every text block the page
 * renders outside the People of Regis roster. Shared by the content
 * seeder and by AboutPage::current(), so the two can never drift.
 */
class AboutDefaults
{
    public static function content(): array
    {
        return [
            'hero' => [
                'eyebrow' => '',
                'title' => 'About Us',
                'image' => '/lobby.jpg',
            ],

            'overview' => [
                'heading' => 'Company Overview',
                'paragraphs' => [
                    'Regis Partners, Inc. (formerly Deutsche Regis Partners Inc.) is one of the largest equity brokerage houses in the Philippine Stock Exchange. Its country-based team provides research, sales, trading, and execution services to a broad base of foreign and domestic institutional clients.',
                    'Organized in 1999 as a joint venture between local management (51%) and The Deutsche Bank Group (49%), Regis Partners grew to become the dominant equities house in the PSE for over a decade. Following the decision by Deutsche Bank to exit the equities business globally in 2019, management took full control of Regis Partners, and in August 2020, signed an exclusive cooperation with Jefferies Financial Group, one of the largest independent equities houses in the USA.',
                    'With over 20 years of experience and coverage of Philippine equities, Regis Partners prides itself in providing cutting edge research and advisory services, as well as top-level corporate access to its institutional clients. Its primary goal is to provide sound financial advice that challenges conventional wisdom and the consensus view.',
                    'Regis Partners has received numerous awards for Best Equity House and Best Research House from institutions such as The Fund Managers Association of the Philippines (FMAP), and from publications including Institutional Investor and Asiamoney. Regis Partners has also been a recipient of the Philippine Stock Exchange Bell Award for Good Governance.',
                ],
                'profile' => [
                    ['label' => 'Established', 'value' => '1999, Makati City'],
                    ['label' => 'Formerly', 'value' => 'Deutsche Regis Partners Inc.'],
                    ['label' => 'PSE Membership', 'value' => 'Member since 2004; SCCP affiliated'],
                    ['label' => 'Global Partner', 'value' => 'Jefferies Financial Group (since 2020)'],
                    ['label' => 'Research Coverage', 'value' => '120+ PSE-listed names'],
                    ['label' => 'Clients', 'value' => 'Domestic and international institutional'],
                ],
            ],

            'heritage' => [
                'eyebrow' => 'Heritage',
                'heading' => 'Twenty-five years, no shortcuts.',
                'timeline' => [
                    ['year' => '1999', 'title' => 'Founded in Makati', 'body' => 'Established by senior research and trading partners.'],
                    ['year' => '2004', 'title' => 'PSE seat acquired', 'body' => 'Member firm of the Philippine Stock Exchange and SCCP.'],
                    ['year' => '2009', 'title' => 'First Manila Conference', 'body' => 'Inaugural institutional conference; 80 investors, 22 issuers.'],
                    ['year' => '2014', 'title' => 'Asia-wide corporate-access mandate', 'body' => 'Singapore and Hong Kong NDR series launched.'],
                    ['year' => '2019', 'title' => '20-year anniversary', 'body' => 'Coverage universe crosses 100 PSE names.'],
                    ['year' => '2024', 'title' => 'Research portal modernized', 'body' => 'New institutional client portal with morning calls and replay.'],
                    ['year' => '2026', 'title' => 'Regis next', 'body' => 'A renewed digital experience for the next quarter-century.'],
                ],
            ],

            'leadership' => [
                'heading' => 'The people behind the platform.',
            ],

            'awards' => [
                'eyebrow' => 'Recognition',
                'heading' => 'Awards and accolades from industry peers and institutions.',
                'groups' => [
                    [
                        'org' => 'Fund Managers Association of the Philippines (FMAP)',
                        'items' => [
                            ['name' => 'Best Equities House', 'years' => '2007 to 2010, 2012 to 2014, 2016 to 2023'],
                            ['name' => 'Best Equities Research', 'years' => '2007 to 2014, 2016 to 2018, 2023, 2024'],
                            ['name' => 'Best Equities Sales', 'years' => '2006 to 2009, 2015, 2017, 2021'],
                            ['name' => 'Best Equities Sales Execution', 'years' => '2010, 2016, 2018, 2023'],
                        ],
                    ],
                    [
                        'org' => 'Philippine Stock Exchange (PSE)',
                        'items' => [
                            ['name' => 'Bell Award for Corporate Governance', 'years' => '2014 to 2017'],
                            ['name' => 'Best Compliance Program for Trading Participants', 'years' => '2017'],
                        ],
                    ],
                    [
                        'org' => 'Asiamoney',
                        'items' => [
                            ['name' => 'Best Domestic Brokerage', 'years' => '2002 to 2005, 2011 to 2015, 2017 to 2023'],
                        ],
                    ],
                    [
                        'org' => 'All-Asia Institutional Investor Survey',
                        'items' => [
                            ['name' => '#1 Ranked Research Team', 'years' => '2015, 2017'],
                        ],
                    ],
                ],
            ],
        ];
    }
}
