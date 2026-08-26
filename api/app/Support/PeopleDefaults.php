<?php

namespace App\Support;

/**
 * Canonical seed copy for the People of Regis roster on /about. Shared by
 * the content seeder and by the migration that backfills existing installs.
 *
 * One row per card: a partner who sits on two teams gets an entry under
 * each, exactly as the About page has always rendered them, because the
 * photo and sector coverage differ between the two placements.
 */
class PeopleDefaults
{
    /** Every profile, in the order the About page lists them. */
    public static function all(): array
    {
        return [...self::board(), ...self::research(), ...self::salesTrading(), ...self::operations()];
    }

    private static function board(): array
    {
        $team = 'Board of Directors';
        $dir = '/People of Regis/Board of Directors/';

        return [
            [
                'name' => 'Emmanuel O. Bautista',
                'team' => $team,
                'roles' => ['Chairman of the Board'],
                'sectors' => [],
                'phone' => '+63 2 8894 6602',
                'email' => 'noel.bautista@regis.ph',
                'img' => $dir.'Emmanuel O. Bautista.jpg',
                'bio' => [
                    'Noel Bautista is the Chairman of Regis Partners Inc. (formerly Deutsche Regis Partners Inc.). He joined the Deutsche Bank Group in 1994 as Head of Office and concurrent Head of Sales and Trading at Deutsche Morgan Grenfell Philippines. In 1999, he co-founded the joint venture, Deutsche Regis Partners Inc., and oversaw the growth of the company into one of the largest equity houses in the Philippine Stock Exchange.',
                    'Noel brings to the business a wealth of experience in corporate strategy, financial analysis, and planning, from the various positions he held during his seven years at PepsiCo International in New York and the Philippines. Noel earned his MBA from Georgetown University and a Bachelor of Science degree in Management Engineering from the Ateneo de Manila University.',
                ],
            ],
            [
                'name' => 'Michael Angelo B. Macale',
                'team' => $team,
                'roles' => ['President'],
                'sectors' => [],
                'phone' => '+63 2 8894 6653',
                'email' => 'michael.macale@regis.ph',
                'img' => $dir.'Micheal Angelo B. Macale.jpg',
                'bio' => self::macaleBio(),
            ],
            [
                'name' => 'Giovanni L. Dela Rosa, CFA',
                'team' => $team,
                'roles' => ['Managing Director', 'Head of Research'],
                'sectors' => [],
                'phone' => '+63 2 8894 6642',
                'email' => 'gio.delarosa@regis.ph',
                'img' => $dir.'Giovanni L. Dela Rosa, CFA.jpg',
                'bio' => self::delaRosaBio(),
            ],
            [
                'name' => 'Rafael P. Garchitorena',
                'team' => $team,
                'roles' => ['Managing Director', 'Research Chief Strategist'],
                'sectors' => [],
                'phone' => '+63 2 8894 6644',
                'email' => 'rafael.garchitorena@regis.ph',
                'img' => $dir.'Rafeal P. Garchitorena.jpg',
                'bio' => self::garchitorenaBio(),
            ],
            [
                'name' => 'Camille J. Vergara',
                'team' => $team,
                'roles' => ['Independent Director'],
                'sectors' => [],
                'phone' => '',
                'email' => 'vjcamille@gmail.com',
                'img' => $dir.'Camille J. Vergara.jpg',
                'bio' => [
                    'Camille Vergara has been an independent director of Regis Partners, Inc. since 2021. She is a member of the Audit Committee. Camille‘s experience in the capital markets is extensive. Her career spans over 34 years in equity research and fund management: Financial Analyst (San Miguel Corp,1984-1985), Analyst (Center for Research & Communication, 1988), Investment manager (HSBC Asset Mgt., 1989-1993), Senior Vice President (TCW Asia Ltd, 1993-1998), Deputy Director (Fortis Investment Management Asia Ltd., 2000-2002), Member of the emerging market equity investment team (Wells Capital, 2004-2006), Senior Investment Analyst (WMG Asia Ltd., 2007-2010) and Portfolio Manager (GAM, 2010-2018). She holds a MSc in Economics from the London School of Economics and graduated with a BSc degree in Economics magna cum laude from De La Salle University.',
                ],
            ],
            [
                'name' => 'Jose Salvador Y. Mirasol',
                'team' => $team,
                'roles' => ['Corporate Secretary'],
                'sectors' => [],
                'phone' => '',
                'email' => 'Zaldy.Mirasol@Romulo.com',
                'img' => $dir.'Jose Salvador Y. Mirasol.jpg',
                'bio' => [
                    'Jose Salvador Y. Mirasol is the Corporate Secretary of Regis Partners Inc. Zaldy is supervising partner of the Corporate Banking & Finance Group of the Romulo, Mabanta, Buenaventura, Sayoc & de los Angeles Law Offices. His practice focuses on banking and finance, corporate law, and real estate. Zaldy is particularly consulted by corporate clients on structuring, nationality compliance, capital raising, counterparty negotiation, and other difficult corporate issues. He is likewise engaged by major foreign banks, multilaterals, and financial institutions on derivatives and structured products, cross-border advisory and investments, franchise expansion, multi-creditor cross-currency refinancing, and other complex financial transactions. His advice is sought for its comprehensiveness, creativity, and practicability.',
                    'Zaldy earned his bachelor’s degree in Philosophy and Mathematics, cum laude and department awardee, from the Ateneo de Manila University in 1980. He received his bachelor of laws degree, cum laude and class valedictorian, from the University of the Philippines in 1988. He was admitted to the Philippine bar and joined the firm in 1989.',
                ],
            ],
            [
                'name' => 'Juan Ricardo B. Tan',
                'team' => $team,
                'roles' => ['Assistant Corporate Secretary'],
                'sectors' => [],
                'phone' => '',
                'email' => 'Juan_Ricardo.Tan@Romulo.com',
                'img' => $dir.'Juan Ricardo B. Tan.jpg',
                'bio' => [
                    'Rico Tan is the Assistant Corporate Secretary of Regis Partners Inc. He is a partner in the Corporate Banking & Finance department of law firm Romulo, Mabanta, Buenaventura, Sayoc & De Los Angeles.',
                    'Rico is a regular adviser to various multilateral financial institutions, offshore banking units, and most foreign banks in the Philippines. Mr. Tan has extensive debt capital market experience, having been recognized as a preferred Philippine counsel to the managers and dealers in all the recent global bond issuances in foreign currency as well as global Peso notes, bond exchanges, and tender offers by the Republic of the Philippines and other government-owned and -controlled corporations.',
                    'Rico received his Bachelor of Science degree in 1988 from the Ateneo de Manila University and his juris doctor degree in 1992 from the Ateneo School of Law with a Silver Medal for academic excellence. He was admitted to the Philippine bar in 1993 and joined the firm in 1994.',
                ],
            ],
        ];
    }

    private static function research(): array
    {
        $team = 'Research';
        $dir = '/People of Regis/Research Team/';

        return [
            [
                'name' => 'Giovanni L. Dela Rosa, CFA',
                'team' => $team,
                'roles' => ['Managing Director', 'Head of Research'],
                'sectors' => ['Telecom', 'Power and Utilities', 'Conglomerates'],
                'phone' => '+63 2 8894 6642',
                'email' => 'gio.delarosa@regis.ph',
                'img' => $dir.'Giovanni L. Dela Rosa, CFA.jpg',
                'bio' => self::delaRosaBio(),
            ],
            [
                'name' => 'Rafael P. Garchitorena',
                'team' => $team,
                'roles' => ['Managing Director', 'Research Chief Strategist'],
                'sectors' => ['Strategy', 'Banks'],
                'phone' => '+63 2 8894 6644',
                'email' => 'rafael.garchitorena@regis.ph',
                'img' => $dir.'Rafael P. Garchitorena.jpg',
                'bio' => self::garchitorenaBio(),
            ],
            [
                'name' => 'Carl Stanley T. Sy, CFA',
                'team' => $team,
                'roles' => ['Director'],
                'sectors' => ['Property'],
                'phone' => '+63 2 8894 6646',
                'email' => 'carl.sy@regis.ph',
                'img' => $dir.'Carl Stanley T. Sy, CFA.jpg',
                'bio' => [
                    'Carl joined Regis Partners as an equity research analyst in June 2010 and was voted Best Equities Property Analyst by the Fund Managers Association of the Philippines (FMAP) from 2011 to 2022. Prior to joining Regis Partners, he had been working as an equity analyst for more than five years, covering Philippine financial and property companies. Carl is a CFA charterholder and graduated from the Ateneo de Manila University with a BSc Degree in Management Engineering.',
                ],
            ],
            [
                'name' => 'Cerre Klyne M. Resullar',
                'team' => $team,
                'roles' => ['Director'],
                'sectors' => ['Infrastructure', 'Transport', 'Utilities', 'Mining'],
                'phone' => '+63 2 8894 6645',
                'email' => 'klyne.resullar@regis.ph',
                'img' => $dir.'Cerre Klyne M. Resullar.jpg',
                'bio' => [
                    'Klyne joined Regis Partners in June 2008 and is currently responsible for coverage of the infrastructure and transport sector. She has an MSc Degree in Development Economics from the University of Birmingham and an Undergraduate Degree in Economics from the University of the Philippines.',
                ],
            ],
            [
                'name' => 'Paolo Gabriel D. Garcia',
                'team' => $team,
                'roles' => ['Research Analyst'],
                'sectors' => ['Consumer/Discretionary Retail'],
                'phone' => '+632 8894 6636',
                'email' => 'paolo.garcia@regis.ph',
                'img' => $dir.'Paolo Gabriel D. Garcia.jpg',
                'bio' => [
                    'Pao joined Regis Partners in December 2024. Prior to joining the team, he was working as an equity analyst for two years in one of the fastest growing standalone trust corporations in the Philippines. He graduated with a Bachelor\'s Degree in Economics with a Minor in Financial Management from the Ateneo de Manila University.',
                ],
            ],
            [
                'name' => 'Renalyn C. Chu',
                'team' => $team,
                'roles' => ['Executive Assistant'],
                'sectors' => [],
                'phone' => '+63 2 894 6637',
                'email' => 'renalyn.chu@regis.ph',
                'img' => $dir.'Renalyn C. Chu.jpg',
                'bio' => [],
            ],
        ];
    }

    private static function salesTrading(): array
    {
        $team = 'Sales & Trading';
        $dir = '/People of Regis/Sales and Trading Team/';

        return [
            [
                'name' => 'Michael Angelo B. Macale',
                'team' => $team,
                'roles' => ['President'],
                'sectors' => [],
                'phone' => '+63 2 8894 6653',
                'email' => 'michael.macale@regis.ph',
                'img' => $dir.'Michael Angelo B. Macale.jpg',
                'bio' => self::macaleBio(),
            ],
            [
                'name' => 'Nadine Guinevere J. Cariño',
                'team' => $team,
                'roles' => ['Director - Equity Sales', 'Head of Sales'],
                'sectors' => [],
                'phone' => '+63 2 8894 6650',
                'email' => 'nadine.javellana@regis.ph',
                'img' => $dir.'Nadine Guinevere J. Cariño.jpg',
                'bio' => [
                    'Nadine has been with the Regis Partners sales desk since 2010, covering domestic and foreign institutional investors. She also leads the Corporate Access effort at Regis. Prior to her role in equity sales, Nadine held a research role from 2003 when she joined the industry. She worked in research in JP Morgan and Macquarie covering stocks in various sectors including banks, consumer, media, and gaming. Nadine graduated from the Ateneo de Manila University with a Bachelor\'s Degree in Management Economics.',
                ],
            ],
            [
                'name' => 'Patricia Isabel Tamase',
                'team' => $team,
                'roles' => ['Institutional Equity Sales'],
                'sectors' => [],
                'phone' => '+63 2 8894 6651',
                'email' => 'patricia.tamase@regis.ph',
                'img' => $dir.'Patricia Isabel Tamase.jpg',
                'bio' => [
                    'Patricia joined the sales desk in Regis Partners in December 2024. She started out in equity research in 2014 with Daiwa and Citigroup, before moving on to institutional equity sales roles in First Metro Securities and CLSA where she serviced domestic and foreign institutional accounts. She holds a Bachelor\'s Degree in Mathematics from the University of the Philippines.',
                ],
            ],
            [
                'name' => 'Daisy A. Ng',
                'team' => $team,
                'roles' => ['Director', 'Head of Sales Trading'],
                'sectors' => [],
                'phone' => '+63 2 8894 6652',
                'email' => 'daisy.ng@regis.ph',
                'img' => $dir.'Daisy A. Ng.jpg',
                'bio' => [
                    'Daisy joined Regis Partners’ sales and trading team in February 2002. She covers mainly international buy side dealers based in HK and Singapore. She started her career as a dealer in Asia Equity in 1994, then in GK Goh Securities, SG Crosby and Merrill Lynch from 1996 to 2001. She joined Regis as a dealer and moved to sales trading in 2008. She graduated from the Ateneo de Manila University with a Bachelor’s Degree in Management Economics.',
                ],
            ],
            [
                'name' => 'Ken Isagani C. Mariano III',
                'team' => $team,
                'roles' => ['Director', 'Head of Dealing'],
                'sectors' => [],
                'phone' => '+63 2 8894 6689',
                'email' => 'ken.mariano@regis.ph',
                'img' => $dir.'Ken Isagani C. Mariano III.jpg',
                'bio' => [
                    'Ken joined Regis Partners in 2011 as a trading assistant and transitioned to a Dealer in 2012 where he is responsible for providing high touch execution. Prior to joining Regis, Ken worked in a local bank for 2 years. He holds a Bachelor\'s Degree in Financial Management from De la Salle Lipa.',
                ],
            ],
            [
                'name' => 'Ramon Emilio Y. Casano',
                'team' => $team,
                'roles' => ['Sales Trader / Equities Dealer'],
                'sectors' => [],
                'phone' => '+632 8894 6621',
                'email' => 'ramon.casano@regis.ph',
                'img' => $dir.'Ramon Emilio Y. Casano.jpg',
                'bio' => [
                    'Mio started working as an Equities Dealer at Regis Partners in 2024. His role primarily involves providing high-touch execution. Before joining Regis, Mio served as a Senior Dealer for 11 years with another Broker-Dealer. He graduated with a Bachelor\'s Degree in Management Economics and a minor in Finance from Ateneo De Manila University.',
                ],
            ],
        ];
    }

    private static function operations(): array
    {
        $team = 'Operations';
        $dir = '/People of Regis/Operations/';

        $rows = [
            ['Daniel I. Orajay', 'Finance Director', '+63 2 8894 6630', 'daniel.orajay@regis.ph', 'Daniel I. Orajay.jpg'],
            ['Edward S. Dagal', 'Operations Director', '+63 2 8894 6688', 'esdagal@regis.ph', 'Edward S. Dagal.jpg'],
            ['Mark Anthony P. Salvador', 'Associated Person', '+63 2 8894 6611', 'mark.salvador@regis.ph', 'Mark Anthony P. Salvador.jpg'],
            ['Alma U. Montenegro', 'Settlements Head', '+63 2 8894 6626', 'alma.montenegro@regis.ph', 'Alma U. Montenegro.jpg'],
            ['Ronabil M. Diaron', 'Head of Administration', '+63 2 8894 6632', 'rona.diaron@regis.ph', 'Ronabil M. Diaron.jpg'],
        ];

        return array_map(fn ($r) => [
            'name' => $r[0],
            'team' => $team,
            'roles' => [$r[1]],
            'sectors' => [],
            'phone' => $r[2],
            'email' => $r[3],
            'img' => $dir.$r[4],
            'bio' => [],
        ], $rows);
    }

    /* ── Bios shared by a partner's two team placements ───────── */

    private static function macaleBio(): array
    {
        return [
            'Michael Macale is the President at Regis Partners Inc. He joined the company in 2001 as Director of Institutional Sales. He currently oversees the sales team, marketing Philippine equities to institutional investors domestically and overseas, driving the overall account management process of the company. He is also responsible for the group’s trading and execution branch.',
            'Mike’s professional experience in the equities business is extensive. He joined the industry in 1992, and worked as an equity sales specialist at Citigroup, ING Barings, and Socgen Securities. Mike graduated from the Ateneo de Manila University with a Bachelor of Science Degree in Management.',
        ];
    }

    private static function delaRosaBio(): array
    {
        return [
            'Giovanni dela Rosa is the Head of Research of Regis Partners Inc. Gio brings to the business a wealth of experience in financial planning and analysis. He started his career in 1994 as an equity research analyst, where he covered a variety of sectors during his stints at DBS Securities, ING Barings, and W.I. Carr from 1994 to 2002. In 2002, Gio moved to the corporate side, where he worked as a senior analyst for the Corporate Planning Division of San Miguel Corporation.',
            'Gio joined Regis in 2004, as a senior analyst covering the telecoms, power, and utilities sectors. Today, he maintains coverage of telecoms, power and conglomerates while fulfilling his principal role as Head of Research.',
            'Gio holds a Bachelor of Science Degree in Management Engineering from the Ateneo de Manila University. He is a CFA Charterholder.',
        ];
    }

    private static function garchitorenaBio(): array
    {
        return [
            'Rafael Garchitorena is Chief Strategist and co-Head of Research of Regis Partners Inc.',
            'Rafa’s experience in the equities industry is extensive. He began his career as a research analyst at BZW in Manila from 1993 to 1998. He then worked for W.I. Carr as an equity sales person based in London from 1998 to 2002. Rafa joined Regis Partners as a senior analyst in 2002. He was, then, the industry specialist for Philippine banks and the property sector. While he continues to cover the Philippine Banking sector, Rafa is now principally responsible for the company’s overall equities strategy.',
            'Rafael graduated from the Ateneo de Manila University with a Bachelor of Science degree in Management Engineering.',
        ];
    }
}
