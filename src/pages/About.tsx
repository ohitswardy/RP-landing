import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Reveal from '../components/Reveal';
import Newsletter from '../components/Newsletter';
import TeamTabs, { type TeamTab } from '../components/TeamTabs';
import { type Person } from '../components/PersonCard';

const timeline = [
  { y: '1999', t: 'Founded in Makati',                     d: 'Established by senior research and trading partners.' },
  { y: '2004', t: 'PSE seat acquired',                     d: 'Member firm of the Philippine Stock Exchange and SCCP.' },
  { y: '2009', t: 'First Manila Conference',               d: 'Inaugural institutional conference; 80 investors, 22 issuers.' },
  { y: '2014', t: 'Asia-wide corporate-access mandate',    d: 'Singapore and Hong Kong NDR series launched.' },
  { y: '2019', t: '20-year anniversary',                   d: 'Coverage universe crosses 100 PSE names.' },
  { y: '2024', t: 'Research portal modernized',            d: 'New institutional client portal with morning calls and replay.' },
  { y: '2026', t: 'Regis next',                            d: 'A renewed digital experience for the next quarter-century.' },
];

const boardOfDirectors: Person[] = [
  {
    n: 'Emmanuel O. Bautista',
    r: 'Chairman of the Board',
    e: [
      'Noel Bautista is the Chairman of Regis Partners Inc. (formerly Deutsche Regis Partners Inc.). He joined the Deutsche Bank Group in 1994 as Head of Office and concurrent Head of Sales and Trading at Deutsche Morgan Grenfell Philippines. In 1999, he co-founded the joint venture, Deutsche Regis Partners Inc., and oversaw the growth of the company into one of the largest equity houses in the Philippine Stock Exchange.',
      'Noel brings to the business a wealth of experience in corporate strategy, financial analysis, and planning, from the various positions he held during his seven years at PepsiCo International in New York and the Philippines. Noel earned his MBA from Georgetown University and a Bachelor of Science degree in Management Engineering from the Ateneo de Manila University.',
    ],
    phone: '+63 2 8894 6602',
    email: 'noel.bautista@regis.ph',
    img: '/People of Regis/Board of Directors/Emmanuel O. Bautista.jpg',
  },
  {
    n: 'Michael Angelo B. Macale',
    r: 'President',
    e: [
      'Michael Macale is the President at Regis Partners Inc. He joined the company in 2001 as Director of Institutional Sales. He currently oversees the sales team, marketing Philippine equities to institutional investors domestically and overseas, driving the overall account management process of the company. He is also responsible for the group\’s trading and execution branch.',
      'Mike\’s professional experience in the equities business is extensive. He joined the industry in 1992, and worked as an equity sales specialist at Citigroup, ING Barings, and Socgen Securities. Mike graduated from the Ateneo de Manila University with a Bachelor of Science Degree in Management.',
    ],
    phone: '+63 2 8894 6653',
    email: 'michael.macale@regis.ph',
    img: '/People of Regis/Board of Directors/Micheal Angelo B. Macale.jpg',
  },
  {
    n: 'Giovanni L. Dela Rosa, CFA',
    r: ['Managing Director', 'Head of Research'],
    e: [
      'Giovanni dela Rosa is the Head of Research of Regis Partners Inc. Gio brings to the business a wealth of experience in financial planning and analysis. He started his career in 1994 as an equity research analyst, where he covered a variety of sectors during his stints at DBS Securities, ING Barings, and W.I. Carr from 1994 to 2002. In 2002, Gio moved to the corporate side, where he worked as a senior analyst for the Corporate Planning Division of San Miguel Corporation.',
      'Gio joined Regis in 2004, as a senior analyst covering the telecoms, power, and utilities sectors. Today, he maintains coverage of telecoms, power and conglomerates while fulfilling his principal role as Head of Research.',
      'Gio holds a Bachelor of Science Degree in Management Engineering from the Ateneo de Manila University. He is a CFA Charterholder.',
    ],
    phone: '+63 2 8894 6642',
    email: 'gio.delarosa@regis.ph',
    img: '/People of Regis/Board of Directors/Giovanni L. Dela Rosa, CFA.jpg',
  },
  {
    n: 'Rafael P. Garchitorena',
    r: ['Managing Director', 'Research Chief Strategist'],
    e: [
      'Rafael Garchitorena is Chief Strategist and co-Head of Research of Regis Partners Inc.',
      'Rafa\’s experience in the equities industry is extensive. He began his career as a research analyst at BZW in Manila from 1993 to 1998. He then worked for W.I. Carr as an equity sales person based in London from 1998 to 2002. Rafa joined Regis Partners as a senior analyst in 2002. He was, then, the industry specialist for Philippine banks and the property sector. While he continues to cover the Philippine Banking sector, Rafa is now principally responsible for the company\’s overall equities strategy.',
      'Rafael graduated from the Ateneo de Manila University with a Bachelor of Science degree in Management Engineering.',
    ],
    phone: '+63 2 8894 6644',
    email: 'rafael.garchitorena@regis.ph',
    img: '/People of Regis/Board of Directors/Rafeal P. Garchitorena.jpg',
  },
  {
    n: 'Camille J. Vergara',
    r: 'Independent Director',
    e: [
      'Camille Vergara has been an independent director of Regis Partners, Inc. since 2021. She is a member of the Audit Committee. Camille\‘s experience in the capital markets is extensive. Her career spans over 34 years in equity research and fund management: Financial Analyst (San Miguel Corp,1984-1985), Analyst (Center for Research & Communication, 1988), Investment manager (HSBC Asset Mgt., 1989-1993), Senior Vice President (TCW Asia Ltd, 1993-1998), Deputy Director (Fortis Investment Management Asia Ltd., 2000-2002), Member of the emerging market equity investment team (Wells Capital, 2004-2006), Senior Investment Analyst (WMG Asia Ltd., 2007-2010) and Portfolio Manager (GAM, 2010-2018). She holds a MSc in Economics from the London School of Economics and graduated with a BSc degree in Economics magna cum laude from De La Salle University.',
    ],
    phone: '',
    email: 'vjcamille@gmail.com',
    img: '/People of Regis/Board of Directors/Camille J. Vergara.jpg',
  },
  {
    n: 'Jose Salvador Y. Mirasol',
    r: 'Corporate Secretary',
    e: [
      'Jose Salvador Y. Mirasol is the Corporate Secretary of Regis Partners Inc. Zaldy is supervising partner of the Corporate Banking & Finance Group of the Romulo, Mabanta, Buenaventura, Sayoc & de los Angeles Law Offices. His practice focuses on banking and finance, corporate law, and real estate. Zaldy is particularly consulted by corporate clients on structuring, nationality compliance, capital raising, counterparty negotiation, and other difficult corporate issues. He is likewise engaged by major foreign banks, multilaterals, and financial institutions on derivatives and structured products, cross-border advisory and investments, franchise expansion, multi-creditor cross-currency refinancing, and other complex financial transactions. His advice is sought for its comprehensiveness, creativity, and practicability.',
      'Zaldy earned his bachelor’s degree in Philosophy and Mathematics, cum laude and department awardee, from the Ateneo de Manila University in 1980. He received his bachelor of laws degree, cum laude and class valedictorian, from the University of the Philippines in 1988. He was admitted to the Philippine bar and joined the firm in 1989.',
    ],
    phone: '',
    email: 'Zaldy.Mirasol@Romulo.com',
    img: '/People of Regis/Board of Directors/Jose Salvador Y. Mirasol.jpg',
  },
  {
    n: 'Juan Ricardo B. Tan',
    r: 'Assistant Corporate Secretary',
    e: [
      'Rico Tan is the Assistant Corporate Secretary of Regis Partners Inc. He is a partner in the Corporate Banking & Finance department of law firm Romulo, Mabanta, Buenaventura, Sayoc & De Los Angeles.',
      'Rico is a regular adviser to various multilateral financial institutions, offshore banking units, and most foreign banks in the Philippines. Mr. Tan has extensive debt capital market experience, having been recognized as a preferred Philippine counsel to the managers and dealers in all the recent global bond issuances in foreign currency as well as global Peso notes, bond exchanges, and tender offers by the Republic of the Philippines and other government-owned and -controlled corporations.',
      'Rico received his Bachelor of Science degree in 1988 from the Ateneo de Manila University and his juris doctor degree in 1992 from the Ateneo School of Law with a Silver Medal for academic excellence. He was admitted to the Philippine bar in 1993 and joined the firm in 1994.', 
    ],
    phone: '',
    email: 'Juan_Ricardo.Tan@Romulo.com',
    img: '/People of Regis/Board of Directors/Juan Ricardo B. Tan.jpg',
  },
];

const researchTeam: Person[] = [
  {
    n: 'Giovanni L. Dela Rosa, CFA',
    r: ['Managing Director', 'Head of Research'],
    sectors: ['Telecom', 'Power and Utilities', 'Conglomerates'],
    e: [
      'Giovanni dela Rosa is the Head of Research of Regis Partners Inc. Gio brings to the business a wealth of experience in financial planning and analysis. He started his career in 1994 as an equity research analyst, where he covered a variety of sectors during his stints at DBS Securities, ING Barings, and W.I. Carr from 1994 to 2002. In 2002, Gio moved to the corporate side, where he worked as a senior analyst for the Corporate Planning Division of San Miguel Corporation.',
      'Gio joined Regis in 2004, as a senior analyst covering the telecoms, power, and utilities sectors. Today, he maintains coverage of telecoms, power and conglomerates while fulfilling his principal role as Head of Research.',
      'Gio holds a Bachelor of Science Degree in Management Engineering from the Ateneo de Manila University. He is a CFA Charterholder.',
    ],
    img: 'People of Regis/Research Team/Giovanni L. Dela Rosa, CFA.jpg',
    phone: '+63 2 8894 6642',
    email: 'gio.delarosa@regis.ph',
  },
  {
    n: 'Rafael P. Garchitorena',
    r: ['Managing Director', 'Research Chief Strategist'],
    sectors: ['Strategy', 'Banks'],
    e: [
      'Rafael Garchitorena is Chief Strategist and co-Head of Research of Regis Partners Inc.',
      'Rafa\’s experience in the equities industry is extensive. He began his career as a research analyst at BZW in Manila from 1993 to 1998. He then worked for W.I. Carr as an equity sales person based in London from 1998 to 2002. Rafa joined Regis Partners as a senior analyst in 2002. He was, then, the industry specialist for Philippine banks and the property sector. While he continues to cover the Philippine Banking sector, Rafa is now principally responsible for the company\’s overall equities strategy.',
      'Rafael graduated from the Ateneo de Manila University with a Bachelor of Science degree in Management Engineering.',    
    ],
    img: 'People of Regis/Research Team/Rafael P. Garchitorena.jpg',
    phone: '+63 2 8894 6644',
    email: 'rafael.garchitorena@regis.ph',
  },
  {
    n: 'Carl Stanley T. Sy, CFA',
    r: 'Director',
    sectors: ['Property'],
    e: [
      'Carl joined Regis Partners as an equity research analyst in June 2010 and was voted Best Equities Property Analyst by the Fund Managers Association of the Philippines (FMAP) from 2011 to 2022. Prior to joining Regis Partners, he had been working as an equity analyst for more than five years, covering Philippine financial and property companies. Carl is a CFA charterholder and graduated from the Ateneo de Manila University with a BSc Degree in Management Engineering.',
    ],
    img: 'People of Regis/Research Team/Carl Stanley T. Sy, CFA.jpg',
    phone: '+63 2 8894 6646',
    email: 'carl.sy@regis.ph',
  },
  {
    n: 'Cerre Klyne M. Resullar',
    r: 'Director',
    sectors: ['Infrastructure', 'Transport', 'Utilities', 'Mining'],
    e: [
      'Klyne joined Regis Partners in June 2008 and is currently responsible for coverage of the infrastructure and transport sector. She has an MSc Degree in Development Economics from the University of Birmingham and an Undergraduate Degree in Economics from the University of the Philippines.',
    ],
    img: 'People of Regis/Research Team/Cerre Klyne M. Resullar.jpg',
    phone: '+63 2 8894 6645',
    email: 'klyne.resullar@regis.ph',
  },
  {
    n: 'Paolo Gabriel D. Garcia',
    r: 'Research Analyst',
    sectors: ['Consumer/Discretionary Retail',],
    e: [
      'Pao joined Regis Partners in December 2024. Prior to joining the team, he was working as an equity analyst for two years in one of the fastest growing standalone trust corporations in the Philippines. He graduated with a Bachelor\'s Degree in Economics with a Minor in Financial Management from the Ateneo de Manila University.',
    ],
    img: 'People of Regis/Research Team/Paolo Gabriel D. Garcia.jpg',
    phone: '+632 8894 6636',
    email: 'paolo.garcia@regis.ph',
  },
  {
    n: 'Renalyn C. Chu',
    r: 'Executive Assistant',
    e: [
      '',
    ],
    img: 'People of Regis/Research Team/Renalyn C. Chu.jpg',
    phone: '+63 2 894 6637',
    email: 'renalyn.chu@regis.ph',
  },
];

const salesTradingTeam: Person[] = [
  {
    n: 'Michael Angelo B. Macale',
    r: ['President'],
    e: [
      'Michael Macale is the President at Regis Partners Inc. He joined the company in 2001 as Director of Institutional Sales. He currently oversees the sales team, marketing Philippine equities to institutional investors domestically and overseas, driving the overall account management process of the company. He is also responsible for the group\’s trading and execution branch.',
      'Mike/’s professional experience in the equities business is extensive. He joined the industry in 1992, and worked as an equity sales specialist at Citigroup, ING Barings, and Socgen Securities. Mike graduated from the Ateneo de Manila University with a Bachelor of Science Degree in Management.',
    ],
    img: 'People of Regis/Sales and Trading Team/Michael Angelo B. Macale.jpg',
    phone: '+63 2 8894 6653',
    email: 'michael.macale@regis.ph',
  },
  {
    n: 'Nadine Guinevere J. Cariño',
    r: ['Director - Equity Sales', 'Head of Sales'],
    e: [
      'Nadine has been with the Regis Partners sales desk since 2010, covering domestic and foreign institutional investors. She also leads the Corporate Access effort at Regis. Prior to her role in equity sales, Nadine held a research role from 2003 when she joined the industry. She worked in research in JP Morgan and Macquarie covering stocks in various sectors including banks, consumer, media, and gaming. Nadine graduated from the Ateneo de Manila University with a Bachelor\'s Degree in Management Economics.',
    ],
    img: 'People of Regis/Sales and Trading Team/Nadine Guinevere J. Cariño.jpg',
    phone: '+63 2 8894 6650',
    email: 'nadine.javellana@regis.ph',
  },
  {
    n: 'Patricia Isabel Tamase',
    r: 'Institutional Equity Sales',
    e: [
      'Patricia joined the sales desk in Regis Partners in December 2024. She started out in equity research in 2014 with Daiwa and Citigroup, before moving on to institutional equity sales roles in First Metro Securities and CLSA where she serviced domestic and foreign institutional accounts. She holds a Bachelor\'s Degree in Mathematics from the University of the Philippines.',
    ],
    img: 'People of Regis/Sales and Trading Team/Patricia Isabel Tamase.jpg',
    phone: '+63 2 8894 6651',
    email: 'patricia.tamase@regis.ph',
  },
  {
    n: 'Daisy A. Ng',
    r: ['Director', 'Head of Sales Trading'],
    e: [
      'Daisy joined Regis Partners\’ sales and trading team in February 2002. She covers mainly international buy side dealers based in HK and Singapore. She started her career as a dealer in Asia Equity in 1994, then in GK Goh Securities, SG Crosby and Merrill Lynch from 1996 to 2001. She joined Regis as a dealer and moved to sales trading in 2008. She graduated from the Ateneo de Manila University with a Bachelor\’s Degree in Management Economics.',
    ],
    img: 'People of Regis/Sales and Trading Team/Daisy A. Ng.jpg',
    phone: '+63 2 8894 6652',
    email: 'daisy.ng@regis.ph',
  },
  {
    n: 'Ken Isagani C. Mariano III',
    r: ['Director', 'Head of Dealing'],
    e: [
      'Ken joined Regis Partners in 2011 as a trading assistant and transitioned to a Dealer in 2012 where he is responsible for providing high touch execution. Prior to joining Regis, Ken worked in a local bank for 2 years. He holds a Bachelor\'s Degree in Financial Management from De la Salle Lipa.',
    ],
    img: 'People of Regis/Sales and Trading Team/Ken Isagani C. Mariano III.jpg',
    phone: '+63 2 8894 6689',
    email: 'ken.mariano@regis.ph',
  },
  {
    n: 'Ramon Emilio Y. Casano',
    r: 'Sales Trader / Equities Dealer',
    e: [
      'Mio started working as an Equities Dealer at Regis Partners in 2024. His role primarily involves providing high-touch execution. Before joining Regis, Mio served as a Senior Dealer for 11 years with another Broker-Dealer. He graduated with a Bachelor\'s Degree in Management Economics and a minor in Finance from Ateneo De Manila University.',
    ],
    img: 'People of Regis/Sales and Trading Team/Ramon Emilio Y. Casano.jpg',
    phone: '+632 8894 6621',
    email: 'ramon.casano@regis.ph',
  },
];

const operationsTeam: Person[] = [
  {
    n: 'Daniel I. Orajay',
    r: 'Finance Director',
    e: [
      '',
    ],
    img: 'People of Regis/Operations/Daniel I. Orajay.jpg',
    phone: '+63 2 8894 6630',
    email: 'daniel.orajay@regis.ph',
  },
  {
    n: 'Edward S. Dagal',
    r: 'Operations Director',
    e: [
      '',
    ],
    img: 'People of Regis/Operations/Edward S. Dagal.jpg',
    phone: '+63 2 8894 6688',
    email: 'esdagal@regis.ph',
  },
  {
    n: 'Mark Anthony P. Salvador',
    r: 'Associated Person',
    e: [
      '',
    ],
    img: 'People of Regis/Operations/Mark Anthony P. Salvador.jpg',
    phone: '+63 2 8894 6611',
    email: 'mark.salvador@regis.ph',
  },
  {
    n: 'Alma U. Montenegro',
    r: 'Settlements Head',
    e: [
      '',
    ],
    img: 'People of Regis/Operations/Alma U. Montenegro.jpg',
    phone: '+63 2 8894 6626',
    email: 'alma.montenegro@regis.ph',
  },
  {
    n: 'Ronabil M. Diaron',
    r: 'Head of Administration',
    e: [
      '',
    ],
    img: 'People of Regis/Operations/Ronabil M. Diaron.jpg',
    phone: '+63 2 8894 6632',
    email: 'rona.diaron@regis.ph',
  },
];

const teamTabs: TeamTab[] = [
  { id: 'board',      label: 'Board of Directors', people: boardOfDirectors },
  { id: 'research',   label: 'Research',           people: researchTeam },
  { id: 'sales',      label: 'Sales & Trading',    people: salesTradingTeam },
  { id: 'operations', label: 'Operations',         people: operationsTeam },
];


const firmProfile = [
  { label: 'Established',      value: '1999, Makati City' },
  { label: 'Formerly',         value: 'Deutsche Regis Partners Inc.' },
  { label: 'PSE Membership',   value: 'Member since 2004; SCCP affiliated' },
  { label: 'Global Partner',   value: 'Jefferies Financial Group (since 2020)' },
  { label: 'Research Coverage',value: '120+ PSE-listed names' },
  { label: 'Clients',          value: 'Domestic and international institutional' },
] as const;

const awards = [
  {
    org: 'Fund Managers Association of the Philippines (FMAP)',
    items: [
      { name: 'Best Equities House',           years: '2007 to 2010, 2012 to 2014, 2016 to 2023' },
      { name: 'Best Equities Research',        years: '2007 to 2014, 2016 to 2018, 2023, 2024' },
      { name: 'Best Equities Sales',           years: '2006 to 2009, 2015, 2017, 2021' },
      { name: 'Best Equities Sales Execution', years: '2010, 2016, 2018, 2023' },
    ],
  },
  {
    org: 'Philippine Stock Exchange (PSE)',
    items: [
      { name: 'Bell Award for Corporate Governance',              years: '2014 to 2017' },
      { name: 'Best Compliance Program for Trading Participants', years: '2017' },
    ],
  },
  {
    org: 'Asiamoney',
    items: [
      { name: 'Best Domestic Brokerage', years: '2002 to 2005, 2011 to 2015, 2017 to 2023' },
    ],
  },
  {
    org: 'All-Asia Institutional Investor Survey',
    items: [
      { name: '#1 Ranked Research Team', years: '2015, 2017' },
    ],
  },
];

function CompanyOverview() {
  return (
    <section
      className="relative overflow-hidden text-paper"
      style={{ backgroundColor: 'var(--color-navy-deep)' }}
    >
      {/* Blueprint grid — atmosphere layer */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px),' +
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 2%, transparent) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />

      {/* Amber atmospheric glow — far right */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          right: '-240px',
          top: '20%',
          width: '560px',
          height: '560px',
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.09) 0%, transparent 70%)',
        }}
      />

      {/* Whisper glow — left edge */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: '-160px',
          bottom: '10%',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.045) 0%, transparent 70%)',
        }}
      />

      <div
        className="container-fluid relative"
        style={{
          paddingTop:    'clamp(5rem, 8vw, 7.5rem)',
          paddingBottom: 'clamp(5rem, 8vw, 7.5rem)',
        }}
      >
        {/* ── Section Header ──────────────────────────────────── */}

        <Reveal delay={0.05}>
          <h2
            className="text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] tracking-[-0.028em] font-medium"
            style={{ maxWidth: '22ch' }}
          >
            Company Overview
          </h2>
        </Reveal>

        {/* Full-width amber-to-line divider */}
        <Reveal delay={0.09}>
          <div
            aria-hidden
            className="mt-12 mb-14"
            style={{
              height: '1px',
              background: 'linear-gradient(to right, var(--color-amber) 0%, var(--color-navy-line) 55%, transparent 100%)',
            }}
          />
        </Reveal>

        {/* ── Editorial Two-Column ────────────────────────────── */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-14">

          {/* Left: narrative prose */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-8">

            <Reveal delay={0.11}>
              <p
                className="text-[17px] leading-[1.72]"
                style={{ color: 'oklch(0.992 0.003 80 / 0.72)', maxWidth: '65ch' }}
              >
                Regis Partners, Inc. (formerly Deutsche Regis Partners Inc.) is one of the largest
                equity brokerage houses in the Philippine Stock Exchange. Its country-based team
                provides research, sales, trading, and execution services to a broad base of
                foreign and domestic institutional clients.
              </p>
            </Reveal>

            <Reveal delay={0.14}>
              <div
                aria-hidden
                style={{ height: '1px', width: '36px', background: 'var(--color-amber)', opacity: 0.5 }}
              />
            </Reveal>

            <Reveal delay={0.17}>
              <p
                className="text-[17px] leading-[1.72]"
                style={{ color: 'oklch(0.992 0.003 80 / 0.72)', maxWidth: '65ch' }}
              >
                Organized in 1999 as a joint venture between local management (51%) and The 
                Deutsche Bank Group (49%), Regis Partners grew to become the dominant equities 
                house in the PSE for over a decade. Following the decision by Deutsche Bank to 
                exit the equities business globally in 2019, management took full control of Regis Partners, and in August 2020, signed an exclusive cooperation with Jefferies 
                Financial Group, one of the largest independent equities houses in the USA.
              </p>
            </Reveal>

            <Reveal delay={0.20}>
              <div
                aria-hidden
                style={{ height: '1px', width: '36px', background: 'var(--color-amber)', opacity: 0.5 }}
              />
            </Reveal>

            <Reveal delay={0.22}>
              <p
                className="text-[17px] leading-[1.72]"
                style={{ color: 'oklch(0.992 0.003 80 / 0.72)', maxWidth: '65ch' }}
              >
                With over 20 years of experience and coverage of Philippine equities, Regis 
                Partners prides itself in providing cutting edge research and advisory services, as 
                well as top-level corporate access to its institutional clients. Its primary goal is to 
                provide sound financial advice that challenges conventional wisdom and the consensus view.
              </p>
            </Reveal>

            <Reveal delay={0.25}>
              <div
                aria-hidden
                style={{ height: '1px', width: '36px', background: 'var(--color-amber)', opacity: 0.5 }}
              />
            </Reveal>

            <Reveal delay={0.28}>
              <p
                className="text-[17px] leading-[1.72]"
                style={{ color: 'oklch(0.992 0.003 80 / 0.72)', maxWidth: '65ch' }}
              >
                Regis Partners has received numerous awards for Best Equity House and Best R
                esearch House from institutions such as The Fund Managers Association of the 
                Philippines (FMAP), and from publications including Institutional Investor and Asiamoney. Regis Partners has also been a recipient of the Philippine Stock 
                Exchange Bell Award for Good Governance.
              </p>
            </Reveal>

          </div>

          {/* Right: firm profile registry */}
          <Reveal delay={0.16} className="col-span-12 lg:col-span-5">
            <div className="lg:pl-12">
              <div
                className="border-t pt-8"
                style={{ borderColor: 'var(--color-navy-line)' }}
              >
                <div
                  style={{
                    fontFamily:    'var(--font-mono)',
                    fontSize:      '10.5px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color:         'oklch(0.992 0.003 80 / 0.34)',
                    marginBottom:  '1.75rem',
                  }}
                >
                  Company Profile
                </div>

                <dl>
                  {firmProfile.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between items-baseline gap-4 py-4 border-b"
                      style={{ borderColor: 'var(--color-navy-line)' }}
                    >
                      <dt
                        style={{
                          fontFamily:    'var(--font-mono)',
                          fontSize:      '10.5px',
                          letterSpacing: '0.09em',
                          textTransform: 'uppercase',
                          color:         'oklch(0.992 0.003 80 / 0.38)',
                          flexShrink:    0,
                        }}
                      >
                        {label}
                      </dt>
                      <dd
                        className="text-right"
                        style={{
                          fontSize:   '13.5px',
                          lineHeight: '1.45',
                          color:      'oklch(0.992 0.003 80 / 0.80)',
                        }}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   About Hero — cinematic split-panel with portrait lobby image
───────────────────────────────────────────────────────────── */
const heroEase = [0.25, 1, 0.5, 1] as const;

function AboutHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  /* Parallax layers — image drifts up, content holds steady */
  const imgY      = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const contentY  = useTransform(scrollYProgress, [0, 1], ['0%', '-5%']);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden text-paper"
      style={{ minHeight: 'clamp(580px, 82vh, 820px)', backgroundColor: 'var(--color-navy)' }}
    >

      {/* ── Left panel: navy + blueprint grid ─────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 lg:right-[42%]"
        style={{
          backgroundColor: 'var(--color-navy)',
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 4%, transparent) 1px, transparent 1px),' +
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />

      {/* ── Amber atmospheric glow — bottom-left ─────────────── */}
      <div
        aria-hidden
        className="absolute -left-60 -bottom-60 w-225 h-225 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.22) 0%, transparent 70%)' }}
      />

      {/* ── Amber whisper accent — upper-left ────────────────── */}
      <div
        aria-hidden
        className="absolute left-[6%] top-[18%] w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.055) 0%, transparent 70%)' }}
      />

      {/* ── RIGHT PANEL: portrait image — desktop only ────────── */}
      <div
        aria-hidden
        className="hidden lg:block absolute right-0 top-0 bottom-0"
        style={{ width: '44%' }}
      >
        <div className="absolute inset-0 overflow-hidden">

          {/* Parallax image — oversized for travel headroom */}
          <motion.div
            className="absolute"
            style={{ top: '-12%', bottom: '-12%', left: 0, right: 0, y: imgY }}
          >
            <img
              src="/lobby.jpg"
              alt=""
              aria-hidden
              className="w-full h-full object-cover"
              style={{ objectPosition: '50% 18%' }}
            />
          </motion.div>

          {/* Left-edge hard blend: navy → image (the panel seam) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to right,' +
                  'oklch(0.215 0.048 260 / 1.00)  0%,' +
                  'oklch(0.215 0.048 260 / 0.84) 10%,' +
                  'oklch(0.215 0.048 260 / 0.46) 26%,' +
                  'oklch(0.215 0.048 260 / 0.10) 46%,' +
                  'transparent 68%)',
            }}
          />

          {/* Right-edge fade to deep navy */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to left,' +
                  'oklch(0.165 0.040 260 / 0.72) 0%,' +
                  'oklch(0.165 0.040 260 / 0.22) 30%,' +
                  'transparent 58%)',
            }}
          />

          {/* Top vignette */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: '38%',
              background: 'linear-gradient(to bottom, oklch(0.215 0.048 260 / 0.84) 0%, transparent 100%)',
            }}
          />

          {/* Bottom vignette — blends to next section */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: '50%',
              background:
                'linear-gradient(to top,' +
                  'oklch(0.165 0.040 260 / 0.96) 0%,' +
                  'oklch(0.165 0.040 260 / 0.48) 50%,' +
                  'transparent 100%)',
            }}
          />

          {/* Navy tint for OKLCH colour-space harmony */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'oklch(0.215 0.048 260 / 0.14)', mixBlendMode: 'multiply' }}
          />
        </div>
      </div>

      {/* ── MOBILE: full-bleed image backdrop ────────────────── */}
      <div aria-hidden className="lg:hidden absolute inset-0">
        <img
          src="/lobby.jpg"
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: '42% 22%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(155deg,' +
                'oklch(0.165 0.040 260 / 0.97)  0%,' +
                'oklch(0.165 0.040 260 / 0.92) 42%,' +
                'oklch(0.215 0.048 260 / 0.80) 72%,' +
                'oklch(0.215 0.048 260 / 0.68) 100%)',
          }}
        />
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div
        className="container-fluid relative"
        style={{ paddingTop: 'clamp(5rem, 9vw, 7.5rem)', paddingBottom: 'clamp(4.5rem, 7vw, 6.5rem)' }}
      >
        <motion.div style={{ y: contentY }}>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: heroEase }}
            className="eyebrow eyebrow-paper mb-10"
          >
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: heroEase, delay: 0.05 }}
            className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[1.03] tracking-[-0.028em] font-medium"
            style={{ maxWidth: '18ch' }}
          >
            About Us
          </motion.h1>

          {/* Dek */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: heroEase, delay: 0.20 }}
            className="mt-9 text-[17px] leading-[1.65]"
            style={{ maxWidth: '50ch', color: 'oklch(0.992 0.003 80 / 0.70)' }}
          >
            Regis Partners is an independent institutional brokerage, research, and capital markets
            firm, founded in Makati in 1999.
          </motion.p>

          {/* Amber gradient divider rule */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 1.0, ease: heroEase, delay: 0.38 }}
            aria-hidden
            className="origin-left mt-12 mb-10"
            style={{
              height: '1px',
              width: 'min(300px, 100%)',
              background: 'linear-gradient(to right, var(--color-amber), transparent)',
            }}
          />

        </motion.div>
      </div>
    </section>
  );
}

export default function About() {
  return (
    <>
      <AboutHero />
      <CompanyOverview />

      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            <Reveal className="col-span-12 lg:col-span-4">
              <div className="eyebrow mb-6">Heritage</div>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.02em]">
                Twenty-five years, no shortcuts.
              </h2>
            </Reveal>
            <ol className="col-span-12 lg:col-span-8 border-t rule">
              {timeline.map((e, i) => (
                <Reveal key={i} delay={i * 0.05} className="grid grid-cols-12 gap-x-6 items-baseline border-b rule py-7">
                  <div className="col-span-3 md:col-span-2 num text-2xl md:text-3xl tracking-[-0.02em]">{e.y}</div>
                  <div className="col-span-9 md:col-span-4 text-lg md:text-xl tracking-[-0.012em] font-medium">{e.t}</div>
                  <div className="col-span-12 md:col-span-6 text-slate text-[14.5px] leading-relaxed mt-2 md:mt-0">{e.d}</div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-bone">
        <div className="container-fluid py-24 md:py-32">
          <Reveal className="max-w-3xl mb-10">
            <div className="eyebrow mb-6">Board of Directors</div>
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-tight">
              The people behind the platform.
            </h2>
          </Reveal>
          <TeamTabs tabs={teamTabs} />
        </div>
      </section>

      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <Reveal className="max-w-3xl mb-12">
            <div className="eyebrow mb-6">Recognition</div>
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
              Selected awards & rankings.
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            {awards.map((group) => (
              <Reveal key={group.org} className="border-b rule pt-6 pb-8">
                <p
                  className="font-mono text-[13px] font-semibold tracking-[0.1em] uppercase mb-4"
                  style={{ color: 'var(--color-slate)' }}
                >
                  {group.org}
                </p>
                <ul>
                  {group.items.map((item) => (
                    <motion.li
                      key={item.name}
                      className="relative flex items-baseline justify-between gap-4 py-3 border-t rule first:border-t-0 cursor-default overflow-hidden"
                      whileHover="hovered"
                      initial="rest"
                    >
                      {/* Amber wash on hover */}
                      <motion.div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundColor: 'var(--color-amber)' }}
                        variants={{ rest: { opacity: 0 }, hovered: { opacity: 0.055 } }}
                        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                      />
                      {/* Left accent bar */}
                      <motion.div
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-0.5 pointer-events-none"
                        style={{ backgroundColor: 'var(--color-amber)' }}
                        variants={{ rest: { scaleY: 0, originY: 0 }, hovered: { scaleY: 1, originY: 0 } }}
                        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                      />
                      <motion.span
                        className="relative pl-3 text-[15px] tracking-[-0.01em] font-medium"
                        variants={{ rest: { x: 0 }, hovered: { x: 3 } }}
                        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                      >
                        {item.name}
                      </motion.span>
                      <motion.span
                        className="relative text-[13px] text-right shrink-0 tabular-nums"
                        style={{ color: 'var(--color-slate)' }}
                        variants={{ rest: { opacity: 0.65 }, hovered: { opacity: 1 } }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.years}
                      </motion.span>
                    </motion.li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
