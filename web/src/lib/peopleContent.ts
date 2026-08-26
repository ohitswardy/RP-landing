/* ─────────────────────────────────────────────────────────────
   The People of Regis roster on /about, authored in the CMS and
   served by the API. The bundled copy below is the last-known-good
   fallback: if the API is unreachable the About page still renders
   its roster rather than collapsing to empty tabs.
   ───────────────────────────────────────────────────────────── */

export type StaffTeam = 'Board of Directors' | 'Research' | 'Sales & Trading' | 'Operations';

export type StaffProfile = {
  id: string;
  name: string;
  /** Stacked titles — directors carry two. */
  roles: string[];
  /** First title, mirrored for convenience. */
  role: string;
  /** Summary paragraphs; the first doubles as the card hover teaser. */
  bio: string[];
  sectors: string[];
  phone: string;
  email: string;
  team: StaffTeam;
  img: string;
};

export const TEAM_ORDER: StaffTeam[] = ['Board of Directors', 'Research', 'Sales & Trading', 'Operations'];

export const PEOPLE_FALLBACK: StaffProfile[] = [
    {
      "id": "seed-0",
      "name": "Emmanuel O. Bautista",
      "roles": [
        "Chairman of the Board"
      ],
      "role": "Chairman of the Board",
      "bio": [
        "Noel Bautista is the Chairman of Regis Partners Inc. (formerly Deutsche Regis Partners Inc.). He joined the Deutsche Bank Group in 1994 as Head of Office and concurrent Head of Sales and Trading at Deutsche Morgan Grenfell Philippines. In 1999, he co-founded the joint venture, Deutsche Regis Partners Inc., and oversaw the growth of the company into one of the largest equity houses in the Philippine Stock Exchange.",
        "Noel brings to the business a wealth of experience in corporate strategy, financial analysis, and planning, from the various positions he held during his seven years at PepsiCo International in New York and the Philippines. Noel earned his MBA from Georgetown University and a Bachelor of Science degree in Management Engineering from the Ateneo de Manila University."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6602",
      "email": "noel.bautista@regis.ph",
      "team": "Board of Directors",
      "img": "/People of Regis/Board of Directors/Emmanuel O. Bautista.jpg"
    },
    {
      "id": "seed-1",
      "name": "Michael Angelo B. Macale",
      "roles": [
        "President"
      ],
      "role": "President",
      "bio": [
        "Michael Macale is the President at Regis Partners Inc. He joined the company in 2001 as Director of Institutional Sales. He currently oversees the sales team, marketing Philippine equities to institutional investors domestically and overseas, driving the overall account management process of the company. He is also responsible for the group’s trading and execution branch.",
        "Mike’s professional experience in the equities business is extensive. He joined the industry in 1992, and worked as an equity sales specialist at Citigroup, ING Barings, and Socgen Securities. Mike graduated from the Ateneo de Manila University with a Bachelor of Science Degree in Management."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6653",
      "email": "michael.macale@regis.ph",
      "team": "Board of Directors",
      "img": "/People of Regis/Board of Directors/Micheal Angelo B. Macale.jpg"
    },
    {
      "id": "seed-2",
      "name": "Giovanni L. Dela Rosa, CFA",
      "roles": [
        "Managing Director",
        "Head of Research"
      ],
      "role": "Managing Director",
      "bio": [
        "Giovanni dela Rosa is the Head of Research of Regis Partners Inc. Gio brings to the business a wealth of experience in financial planning and analysis. He started his career in 1994 as an equity research analyst, where he covered a variety of sectors during his stints at DBS Securities, ING Barings, and W.I. Carr from 1994 to 2002. In 2002, Gio moved to the corporate side, where he worked as a senior analyst for the Corporate Planning Division of San Miguel Corporation.",
        "Gio joined Regis in 2004, as a senior analyst covering the telecoms, power, and utilities sectors. Today, he maintains coverage of telecoms, power and conglomerates while fulfilling his principal role as Head of Research.",
        "Gio holds a Bachelor of Science Degree in Management Engineering from the Ateneo de Manila University. He is a CFA Charterholder."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6642",
      "email": "gio.delarosa@regis.ph",
      "team": "Board of Directors",
      "img": "/People of Regis/Board of Directors/Giovanni L. Dela Rosa, CFA.jpg"
    },
    {
      "id": "seed-3",
      "name": "Rafael P. Garchitorena",
      "roles": [
        "Managing Director",
        "Research Chief Strategist"
      ],
      "role": "Managing Director",
      "bio": [
        "Rafael Garchitorena is Chief Strategist and co-Head of Research of Regis Partners Inc.",
        "Rafa’s experience in the equities industry is extensive. He began his career as a research analyst at BZW in Manila from 1993 to 1998. He then worked for W.I. Carr as an equity sales person based in London from 1998 to 2002. Rafa joined Regis Partners as a senior analyst in 2002. He was, then, the industry specialist for Philippine banks and the property sector. While he continues to cover the Philippine Banking sector, Rafa is now principally responsible for the company’s overall equities strategy.",
        "Rafael graduated from the Ateneo de Manila University with a Bachelor of Science degree in Management Engineering."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6644",
      "email": "rafael.garchitorena@regis.ph",
      "team": "Board of Directors",
      "img": "/People of Regis/Board of Directors/Rafeal P. Garchitorena.jpg"
    },
    {
      "id": "seed-4",
      "name": "Camille J. Vergara",
      "roles": [
        "Independent Director"
      ],
      "role": "Independent Director",
      "bio": [
        "Camille Vergara has been an independent director of Regis Partners, Inc. since 2021. She is a member of the Audit Committee. Camille‘s experience in the capital markets is extensive. Her career spans over 34 years in equity research and fund management: Financial Analyst (San Miguel Corp,1984-1985), Analyst (Center for Research & Communication, 1988), Investment manager (HSBC Asset Mgt., 1989-1993), Senior Vice President (TCW Asia Ltd, 1993-1998), Deputy Director (Fortis Investment Management Asia Ltd., 2000-2002), Member of the emerging market equity investment team (Wells Capital, 2004-2006), Senior Investment Analyst (WMG Asia Ltd., 2007-2010) and Portfolio Manager (GAM, 2010-2018). She holds a MSc in Economics from the London School of Economics and graduated with a BSc degree in Economics magna cum laude from De La Salle University."
      ],
      "sectors": [],
      "phone": "",
      "email": "vjcamille@gmail.com",
      "team": "Board of Directors",
      "img": "/People of Regis/Board of Directors/Camille J. Vergara.jpg"
    },
    {
      "id": "seed-5",
      "name": "Jose Salvador Y. Mirasol",
      "roles": [
        "Corporate Secretary"
      ],
      "role": "Corporate Secretary",
      "bio": [
        "Jose Salvador Y. Mirasol is the Corporate Secretary of Regis Partners Inc. Zaldy is supervising partner of the Corporate Banking & Finance Group of the Romulo, Mabanta, Buenaventura, Sayoc & de los Angeles Law Offices. His practice focuses on banking and finance, corporate law, and real estate. Zaldy is particularly consulted by corporate clients on structuring, nationality compliance, capital raising, counterparty negotiation, and other difficult corporate issues. He is likewise engaged by major foreign banks, multilaterals, and financial institutions on derivatives and structured products, cross-border advisory and investments, franchise expansion, multi-creditor cross-currency refinancing, and other complex financial transactions. His advice is sought for its comprehensiveness, creativity, and practicability.",
        "Zaldy earned his bachelor’s degree in Philosophy and Mathematics, cum laude and department awardee, from the Ateneo de Manila University in 1980. He received his bachelor of laws degree, cum laude and class valedictorian, from the University of the Philippines in 1988. He was admitted to the Philippine bar and joined the firm in 1989."
      ],
      "sectors": [],
      "phone": "",
      "email": "Zaldy.Mirasol@Romulo.com",
      "team": "Board of Directors",
      "img": "/People of Regis/Board of Directors/Jose Salvador Y. Mirasol.jpg"
    },
    {
      "id": "seed-6",
      "name": "Juan Ricardo B. Tan",
      "roles": [
        "Assistant Corporate Secretary"
      ],
      "role": "Assistant Corporate Secretary",
      "bio": [
        "Rico Tan is the Assistant Corporate Secretary of Regis Partners Inc. He is a partner in the Corporate Banking & Finance department of law firm Romulo, Mabanta, Buenaventura, Sayoc & De Los Angeles.",
        "Rico is a regular adviser to various multilateral financial institutions, offshore banking units, and most foreign banks in the Philippines. Mr. Tan has extensive debt capital market experience, having been recognized as a preferred Philippine counsel to the managers and dealers in all the recent global bond issuances in foreign currency as well as global Peso notes, bond exchanges, and tender offers by the Republic of the Philippines and other government-owned and -controlled corporations.",
        "Rico received his Bachelor of Science degree in 1988 from the Ateneo de Manila University and his juris doctor degree in 1992 from the Ateneo School of Law with a Silver Medal for academic excellence. He was admitted to the Philippine bar in 1993 and joined the firm in 1994."
      ],
      "sectors": [],
      "phone": "",
      "email": "Juan_Ricardo.Tan@Romulo.com",
      "team": "Board of Directors",
      "img": "/People of Regis/Board of Directors/Juan Ricardo B. Tan.jpg"
    },
    {
      "id": "seed-7",
      "name": "Giovanni L. Dela Rosa, CFA",
      "roles": [
        "Managing Director",
        "Head of Research"
      ],
      "role": "Managing Director",
      "bio": [
        "Giovanni dela Rosa is the Head of Research of Regis Partners Inc. Gio brings to the business a wealth of experience in financial planning and analysis. He started his career in 1994 as an equity research analyst, where he covered a variety of sectors during his stints at DBS Securities, ING Barings, and W.I. Carr from 1994 to 2002. In 2002, Gio moved to the corporate side, where he worked as a senior analyst for the Corporate Planning Division of San Miguel Corporation.",
        "Gio joined Regis in 2004, as a senior analyst covering the telecoms, power, and utilities sectors. Today, he maintains coverage of telecoms, power and conglomerates while fulfilling his principal role as Head of Research.",
        "Gio holds a Bachelor of Science Degree in Management Engineering from the Ateneo de Manila University. He is a CFA Charterholder."
      ],
      "sectors": [
        "Telecom",
        "Power and Utilities",
        "Conglomerates"
      ],
      "phone": "+63 2 8894 6642",
      "email": "gio.delarosa@regis.ph",
      "team": "Research",
      "img": "/People of Regis/Research Team/Giovanni L. Dela Rosa, CFA.jpg"
    },
    {
      "id": "seed-8",
      "name": "Rafael P. Garchitorena",
      "roles": [
        "Managing Director",
        "Research Chief Strategist"
      ],
      "role": "Managing Director",
      "bio": [
        "Rafael Garchitorena is Chief Strategist and co-Head of Research of Regis Partners Inc.",
        "Rafa’s experience in the equities industry is extensive. He began his career as a research analyst at BZW in Manila from 1993 to 1998. He then worked for W.I. Carr as an equity sales person based in London from 1998 to 2002. Rafa joined Regis Partners as a senior analyst in 2002. He was, then, the industry specialist for Philippine banks and the property sector. While he continues to cover the Philippine Banking sector, Rafa is now principally responsible for the company’s overall equities strategy.",
        "Rafael graduated from the Ateneo de Manila University with a Bachelor of Science degree in Management Engineering."
      ],
      "sectors": [
        "Strategy",
        "Banks"
      ],
      "phone": "+63 2 8894 6644",
      "email": "rafael.garchitorena@regis.ph",
      "team": "Research",
      "img": "/People of Regis/Research Team/Rafael P. Garchitorena.jpg"
    },
    {
      "id": "seed-9",
      "name": "Carl Stanley T. Sy, CFA",
      "roles": [
        "Director"
      ],
      "role": "Director",
      "bio": [
        "Carl joined Regis Partners as an equity research analyst in June 2010 and was voted Best Equities Property Analyst by the Fund Managers Association of the Philippines (FMAP) from 2011 to 2022. Prior to joining Regis Partners, he had been working as an equity analyst for more than five years, covering Philippine financial and property companies. Carl is a CFA charterholder and graduated from the Ateneo de Manila University with a BSc Degree in Management Engineering."
      ],
      "sectors": [
        "Property"
      ],
      "phone": "+63 2 8894 6646",
      "email": "carl.sy@regis.ph",
      "team": "Research",
      "img": "/People of Regis/Research Team/Carl Stanley T. Sy, CFA.jpg"
    },
    {
      "id": "seed-10",
      "name": "Cerre Klyne M. Resullar",
      "roles": [
        "Director"
      ],
      "role": "Director",
      "bio": [
        "Klyne joined Regis Partners in June 2008 and is currently responsible for coverage of the infrastructure and transport sector. She has an MSc Degree in Development Economics from the University of Birmingham and an Undergraduate Degree in Economics from the University of the Philippines."
      ],
      "sectors": [
        "Infrastructure",
        "Transport",
        "Utilities",
        "Mining"
      ],
      "phone": "+63 2 8894 6645",
      "email": "klyne.resullar@regis.ph",
      "team": "Research",
      "img": "/People of Regis/Research Team/Cerre Klyne M. Resullar.jpg"
    },
    {
      "id": "seed-11",
      "name": "Paolo Gabriel D. Garcia",
      "roles": [
        "Research Analyst"
      ],
      "role": "Research Analyst",
      "bio": [
        "Pao joined Regis Partners in December 2024. Prior to joining the team, he was working as an equity analyst for two years in one of the fastest growing standalone trust corporations in the Philippines. He graduated with a Bachelor's Degree in Economics with a Minor in Financial Management from the Ateneo de Manila University."
      ],
      "sectors": [
        "Consumer/Discretionary Retail"
      ],
      "phone": "+632 8894 6636",
      "email": "paolo.garcia@regis.ph",
      "team": "Research",
      "img": "/People of Regis/Research Team/Paolo Gabriel D. Garcia.jpg"
    },
    {
      "id": "seed-12",
      "name": "Renalyn C. Chu",
      "roles": [
        "Executive Assistant"
      ],
      "role": "Executive Assistant",
      "bio": [],
      "sectors": [],
      "phone": "+63 2 894 6637",
      "email": "renalyn.chu@regis.ph",
      "team": "Research",
      "img": "/People of Regis/Research Team/Renalyn C. Chu.jpg"
    },
    {
      "id": "seed-13",
      "name": "Michael Angelo B. Macale",
      "roles": [
        "President"
      ],
      "role": "President",
      "bio": [
        "Michael Macale is the President at Regis Partners Inc. He joined the company in 2001 as Director of Institutional Sales. He currently oversees the sales team, marketing Philippine equities to institutional investors domestically and overseas, driving the overall account management process of the company. He is also responsible for the group’s trading and execution branch.",
        "Mike’s professional experience in the equities business is extensive. He joined the industry in 1992, and worked as an equity sales specialist at Citigroup, ING Barings, and Socgen Securities. Mike graduated from the Ateneo de Manila University with a Bachelor of Science Degree in Management."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6653",
      "email": "michael.macale@regis.ph",
      "team": "Sales & Trading",
      "img": "/People of Regis/Sales and Trading Team/Michael Angelo B. Macale.jpg"
    },
    {
      "id": "seed-14",
      "name": "Nadine Guinevere J. Cariño",
      "roles": [
        "Director - Equity Sales",
        "Head of Sales"
      ],
      "role": "Director - Equity Sales",
      "bio": [
        "Nadine has been with the Regis Partners sales desk since 2010, covering domestic and foreign institutional investors. She also leads the Corporate Access effort at Regis. Prior to her role in equity sales, Nadine held a research role from 2003 when she joined the industry. She worked in research in JP Morgan and Macquarie covering stocks in various sectors including banks, consumer, media, and gaming. Nadine graduated from the Ateneo de Manila University with a Bachelor's Degree in Management Economics."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6650",
      "email": "nadine.javellana@regis.ph",
      "team": "Sales & Trading",
      "img": "/People of Regis/Sales and Trading Team/Nadine Guinevere J. Cariño.jpg"
    },
    {
      "id": "seed-15",
      "name": "Patricia Isabel Tamase",
      "roles": [
        "Institutional Equity Sales"
      ],
      "role": "Institutional Equity Sales",
      "bio": [
        "Patricia joined the sales desk in Regis Partners in December 2024. She started out in equity research in 2014 with Daiwa and Citigroup, before moving on to institutional equity sales roles in First Metro Securities and CLSA where she serviced domestic and foreign institutional accounts. She holds a Bachelor's Degree in Mathematics from the University of the Philippines."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6651",
      "email": "patricia.tamase@regis.ph",
      "team": "Sales & Trading",
      "img": "/People of Regis/Sales and Trading Team/Patricia Isabel Tamase.jpg"
    },
    {
      "id": "seed-16",
      "name": "Daisy A. Ng",
      "roles": [
        "Director",
        "Head of Sales Trading"
      ],
      "role": "Director",
      "bio": [
        "Daisy joined Regis Partners’ sales and trading team in February 2002. She covers mainly international buy side dealers based in HK and Singapore. She started her career as a dealer in Asia Equity in 1994, then in GK Goh Securities, SG Crosby and Merrill Lynch from 1996 to 2001. She joined Regis as a dealer and moved to sales trading in 2008. She graduated from the Ateneo de Manila University with a Bachelor’s Degree in Management Economics."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6652",
      "email": "daisy.ng@regis.ph",
      "team": "Sales & Trading",
      "img": "/People of Regis/Sales and Trading Team/Daisy A. Ng.jpg"
    },
    {
      "id": "seed-17",
      "name": "Ken Isagani C. Mariano III",
      "roles": [
        "Director",
        "Head of Dealing"
      ],
      "role": "Director",
      "bio": [
        "Ken joined Regis Partners in 2011 as a trading assistant and transitioned to a Dealer in 2012 where he is responsible for providing high touch execution. Prior to joining Regis, Ken worked in a local bank for 2 years. He holds a Bachelor's Degree in Financial Management from De la Salle Lipa."
      ],
      "sectors": [],
      "phone": "+63 2 8894 6689",
      "email": "ken.mariano@regis.ph",
      "team": "Sales & Trading",
      "img": "/People of Regis/Sales and Trading Team/Ken Isagani C. Mariano III.jpg"
    },
    {
      "id": "seed-18",
      "name": "Ramon Emilio Y. Casano",
      "roles": [
        "Sales Trader / Equities Dealer"
      ],
      "role": "Sales Trader / Equities Dealer",
      "bio": [
        "Mio started working as an Equities Dealer at Regis Partners in 2024. His role primarily involves providing high-touch execution. Before joining Regis, Mio served as a Senior Dealer for 11 years with another Broker-Dealer. He graduated with a Bachelor's Degree in Management Economics and a minor in Finance from Ateneo De Manila University."
      ],
      "sectors": [],
      "phone": "+632 8894 6621",
      "email": "ramon.casano@regis.ph",
      "team": "Sales & Trading",
      "img": "/People of Regis/Sales and Trading Team/Ramon Emilio Y. Casano.jpg"
    },
    {
      "id": "seed-19",
      "name": "Daniel I. Orajay",
      "roles": [
        "Finance Director"
      ],
      "role": "Finance Director",
      "bio": [],
      "sectors": [],
      "phone": "+63 2 8894 6630",
      "email": "daniel.orajay@regis.ph",
      "team": "Operations",
      "img": "/People of Regis/Operations/Daniel I. Orajay.jpg"
    },
    {
      "id": "seed-20",
      "name": "Edward S. Dagal",
      "roles": [
        "Operations Director"
      ],
      "role": "Operations Director",
      "bio": [],
      "sectors": [],
      "phone": "+63 2 8894 6688",
      "email": "esdagal@regis.ph",
      "team": "Operations",
      "img": "/People of Regis/Operations/Edward S. Dagal.jpg"
    },
    {
      "id": "seed-21",
      "name": "Mark Anthony P. Salvador",
      "roles": [
        "Associated Person"
      ],
      "role": "Associated Person",
      "bio": [],
      "sectors": [],
      "phone": "+63 2 8894 6611",
      "email": "mark.salvador@regis.ph",
      "team": "Operations",
      "img": "/People of Regis/Operations/Mark Anthony P. Salvador.jpg"
    },
    {
      "id": "seed-22",
      "name": "Alma U. Montenegro",
      "roles": [
        "Settlements Head"
      ],
      "role": "Settlements Head",
      "bio": [],
      "sectors": [],
      "phone": "+63 2 8894 6626",
      "email": "alma.montenegro@regis.ph",
      "team": "Operations",
      "img": "/People of Regis/Operations/Alma U. Montenegro.jpg"
    },
    {
      "id": "seed-23",
      "name": "Ronabil M. Diaron",
      "roles": [
        "Head of Administration"
      ],
      "role": "Head of Administration",
      "bio": [],
      "sectors": [],
      "phone": "+63 2 8894 6632",
      "email": "rona.diaron@regis.ph",
      "team": "Operations",
      "img": "/People of Regis/Operations/Ronabil M. Diaron.jpg"
    }
  ];

/** Tolerate a partial payload rather than letting one missing key blank a card. */
export function normalizePeople(raw: StaffProfile[]): StaffProfile[] {
  return (raw ?? []).map((p) => ({
    ...p,
    roles: p.roles ?? [],
    role: p.role ?? p.roles?.[0] ?? '',
    bio: p.bio ?? [],
    sectors: p.sectors ?? [],
    phone: p.phone ?? '',
    email: p.email ?? '',
    img: p.img ?? '',
  }));
}
