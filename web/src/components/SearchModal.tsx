import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.25, 1, 0.5, 1] as const;

// ─── Search index ────────────────────────────────────────────────────────────

type SearchEntry = {
  title: string;
  desc: string;
  href: string;
  category: string;
  keywords: string[];
};

const SEARCH_INDEX: SearchEntry[] = [

  // ────────────────────────────────────────────────────────────────
  // PAGES
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Home',
    desc: "The Philippines' pure-play institutional brokerage and research firm.",
    href: '/',
    category: 'Pages',
    keywords: [
      'home', 'regis', 'partners', 'regis partners', 'philippine', 'philippines', 'equities',
      'pse', 'institutional', 'brokerage', 'capital markets', 'pure-play', 'research firm',
      '25 years', '120 names', '300 counterparties', '1 trillion', 'flow facilitated',
      'makati', 'partnership', 'history',
    ],
  },
  {
    title: 'Our Services',
    desc: 'Research Advisory, Sales Advisory, Trading & Execution, Corporate Access.',
    href: '/services',
    category: 'Pages',
    keywords: [
      'services', 'what we do', 'research', 'sales', 'trading', 'corporate access',
      'advisory', 'execution', 'institutional', 'practice', 'desk', 'equities',
    ],
  },
  {
    title: 'Our Insights',
    desc: 'Research worth being early on — the Regis Partners journal.',
    href: '/insights',
    category: 'Pages',
    keywords: [
      'insights', 'research', 'journal', 'market', 'notes', 'commentary', 'equities',
      'analysis', 'reports', 'morning calls', 'archive', 'publications', 'macro',
      'banks', 'property', 'consumer', 'power', 'strategy', 'policy',
    ],
  },
  {
    title: 'About Regis Partners',
    desc: 'Heritage, leadership, team, awards, and company overview.',
    href: '/about',
    category: 'Pages',
    keywords: [
      'about', 'heritage', 'history', 'team', 'leadership', 'regis', 'overview',
      'directors', 'board', 'research team', 'sales trading', 'operations',
      'awards', 'rankings', 'founded', '1999', 'makati', 'deutsche regis', 'jefferies',
    ],
  },
  {
    title: 'Contact Us',
    desc: 'Get in touch — institutional enquiries, offices, trading desk.',
    href: '/contact',
    category: 'Pages',
    keywords: [
      'contact', 'enquiry', 'inquiry', 'offices', 'compliance', 'makati', 'reach out',
      'message', 'form', 'institutional email', 'trading desk', 'phone', 'address',
      'kyc', 'onboarding', 'open a conversation',
    ],
  },
  {
    title: 'Client Login',
    desc: 'Sign in to access the full institutional research portal.',
    href: '/login',
    category: 'Pages',
    keywords: [
      'login', 'sign in', 'client', 'portal', 'access', 'research portal',
      'password', 'email', 'institutional', 'account', 'log in',
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // SERVICES
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Research Advisory',
    desc: 'Original equity research across 120+ PSE names — initiations, deep-dives, macro & bespoke mandates.',
    href: '/services/research',
    category: 'Services',
    keywords: [
      'research', 'advisory', 'equity research', 'pse', 'analyst', '120 names', 'coverage',
      'initiations', 'quarterly updates', 'event-driven', 'sector deep-dives',
      'banks', 'property', 'consumer', 'power', 'conglomerates', 'tmt', 'telecoms',
      'macro', 'strategy', 'bsp', 'inflation', 'fx', 'fiscal', 'bespoke',
      'commissioned work', 'allocators', '1400 notes', '22 years pm tenure',
      'single name', 'conviction', 'morning calls',
    ],
  },
  {
    title: 'Sales Advisory',
    desc: 'High-touch institutional sales — morning calls, conviction lists, pair trades, NDRs.',
    href: '/services/sales',
    category: 'Services',
    keywords: [
      'sales', 'advisory', 'institutional', 'high-touch', 'morning calls', 'conviction lists',
      'portfolio overlays', 'pair trades', 'hedges', 'rotations', 'pse sectors',
      'cross-asset commentary', 'peso', 'rates', 'asian risk', 'bespoke roadshows',
      'ndr', 'non-deal roadshow', '300 institutions', '9 jurisdictions', 'partner-led',
      'risk appetite', 'benchmarks', 'reporting calendar', 'idea generation',
    ],
  },
  {
    title: 'Trading & Execution',
    desc: 'Block, agency, and algorithmic execution on the PSE — VWAP, TWAP, cross-border settlement.',
    href: '/services/trading',
    category: 'Services',
    keywords: [
      'trading', 'execution', 'block', 'agency', 'algorithmic', 'algo', 'program trading',
      'pse', 'vwap', 'twap', 'implementation shortfall', 'information leakage',
      'cross-border settlement', 'dvp', 'omnibus', 'segregated custody', 'global banks',
      'after-hours liquidity', 'top 10 pse', 'slippage', '24/5', 'global desk',
      'facilitation', 'dealing', 'dealer',
    ],
  },
  {
    title: 'Corporate Access',
    desc: 'Manila Conference, C-suite NDRs, site visits — 60+ issuers, 4,000+ one-on-ones per year.',
    href: '/services/corporate',
    category: 'Services',
    keywords: [
      'corporate access', 'manila conference', 'annual conference', 'c-suite', 'ceo', 'cfo', 'iro',
      'ndr', 'roadshow', 'site visits', 'plant tours', 'thematic corporate days',
      '60 issuers', '200 investors', '4000 one-on-ones', 'three days',
      'asia', 'us', 'europe', 'singapore', 'hong kong',
      'banks', 'consumer', 'infrastructure', 'esg', 'power', 'food', 'logistics', 'property',
      '25 years relationships', 'rolodex', 'conviction', 'issuer',
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // ABOUT — Sections
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Our Heritage',
    desc: 'Founded 1999 in Makati — 25 years of milestones on the Philippine Stock Exchange.',
    href: '/about#heritage',
    category: 'About',
    keywords: [
      'heritage', 'history', 'founded', '1999', 'makati', 'milestones', 'anniversary',
      '25 years', 'twenty-five', 'quarter century', 'pse seat 2004', 'sccp',
      'deutsche regis', 'deutsche bank', 'first manila conference 2009',
      'asia-wide mandate 2014', 'singapore', 'hong kong', '100 names 2019',
      'research portal 2024', 'morning calls replay', '2026',
    ],
  },
  {
    title: 'Leadership & Team',
    desc: 'Board of Directors, Research, Sales & Trading, and Operations teams.',
    href: '/about#leadership',
    category: 'About',
    keywords: [
      'leadership', 'team', 'board of directors', 'research team', 'sales trading',
      'operations', 'partners', 'directors', 'managing director', 'president', 'chairman',
      'bautista', 'macale', 'dela rosa', 'garchitorena', 'vergara', 'mirasol',
      'cfa', 'charterholder', 'head of research', 'head of sales', 'head of dealing',
    ],
  },
  {
    title: 'Awards & Rankings',
    desc: 'FMAP Best Equities House, Asiamoney Best Domestic Brokerage, #1 All-Asia Research.',
    href: '/about#awards',
    category: 'About',
    keywords: [
      'awards', 'rankings', 'fmap', 'fund managers association philippines',
      'best equities house', 'best equities research', 'best equities sales',
      'best equities sales execution', 'asiamoney', 'best domestic brokerage',
      'all-asia', 'institutional investor', 'number 1 research team', '#1 ranked',
      'bell award', 'corporate governance', 'pse bell award', 'compliance program',
      'financeasia', 'recognition', '2007', '2023', '2024',
    ],
  },
  {
    title: 'Company Overview',
    desc: 'Established 1999. Jefferies partner. 120+ PSE names. Domestic & international institutional clients.',
    href: '/about',
    category: 'About',
    keywords: [
      'company overview', 'established', '1999', 'makati city', 'formerly deutsche regis',
      'pse membership', 'member 2004', 'sccp affiliated', 'jefferies', 'jefferies financial group',
      '2020', 'global partner', 'research coverage', '120 names', 'domestic', 'international',
      'institutional clients', 'broker', 'broker-dealer',
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // PEOPLE — Board of Directors
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Emmanuel O. Bautista — Chairman',
    desc: 'Chairman of the Board. Co-founded Deutsche Regis Partners Inc. in 1999. MBA Georgetown.',
    href: '/about?tab=board#leadership',
    category: 'People',
    keywords: [
      'emmanuel bautista', 'noel bautista', 'chairman', 'chairman of the board',
      'deutsche regis', 'deutsche bank', 'deutsche morgan grenfell', 'head of sales and trading',
      'co-founder', '1999', 'pepsi', 'pepsico', 'new york', 'georgetown university',
      'mba', 'management engineering', 'ateneo de manila', 'ateneo',
      'corporate strategy', 'financial analysis', 'planning',
    ],
  },
  {
    title: 'Michael Angelo B. Macale — President',
    desc: 'President. Oversees sales, trading, and execution. Joined 1992. Citigroup, ING Barings, Socgen.',
    href: '/about?tab=board#leadership',
    category: 'People',
    keywords: [
      'michael macale', 'mike macale', 'president', 'institutional sales', 'director of sales',
      'sales team', 'trading execution', 'citigroup', 'ing barings', 'socgen securities',
      '1992', '2001', 'ateneo de manila', 'management', 'equity sales specialist',
      'account management', 'overseas marketing',
    ],
  },
  {
    title: 'Giovanni L. Dela Rosa, CFA — Head of Research',
    desc: 'Managing Director, Head of Research. Covers telecom, power, conglomerates. CFA charterholder.',
    href: '/about?tab=board#leadership',
    category: 'People',
    keywords: [
      'giovanni dela rosa', 'gio dela rosa', 'head of research', 'managing director',
      'telecom', 'power', 'utilities', 'conglomerates', 'cfa', 'charterholder',
      'dbs securities', 'ing barings', 'wi carr', 'san miguel corporation', 'corporate planning',
      '1994', '2002', '2004', 'ateneo de manila', 'management engineering',
      'financial planning', 'equity research analyst',
    ],
  },
  {
    title: 'Rafael P. Garchitorena — Chief Strategist',
    desc: 'Managing Director, Research Chief Strategist. Covers strategy & banks. BZW, W.I. Carr.',
    href: '/about?tab=board#leadership',
    category: 'People',
    keywords: [
      'rafael garchitorena', 'rafa garchitorena', 'chief strategist', 'co-head of research',
      'managing director', 'strategy', 'banks', 'philippine banking', 'property sector',
      'bzw', 'wi carr', 'london', '1993', '1998', '2002', 'ateneo de manila',
      'management engineering', 'equities strategy', 'overall strategy',
    ],
  },
  {
    title: 'Camille J. Vergara — Independent Director',
    desc: 'Independent Director. 34+ years in equity research and fund management. LSE, De La Salle.',
    href: '/about?tab=board#leadership',
    category: 'People',
    keywords: [
      'camille vergara', 'independent director', 'audit committee', 'fund management',
      'equity research', 'hsbc', 'tcw asia', 'fortis investment management', 'wells capital',
      'wmg asia', 'gam', 'portfolio manager', 'emerging market', 'san miguel',
      'london school of economics', 'lse', 'de la salle university', 'dlsu',
      'economics', 'msc', 'bsc', 'magna cum laude', '34 years', '2021',
    ],
  },
  {
    title: 'Jose Salvador Y. Mirasol — Corporate Secretary',
    desc: 'Corporate Secretary. Romulo Law. Banking, finance, corporate law, real estate.',
    href: '/about?tab=board#leadership',
    category: 'People',
    keywords: [
      'jose salvador mirasol', 'zaldy mirasol', 'corporate secretary', 'romulo law',
      'romulo mabanta buenaventura sayoc', 'banking finance', 'corporate law', 'real estate',
      'derivatives', 'structured products', 'capital raising', 'cross-border',
      'ateneo de manila', 'university of the philippines', 'up', 'philosophy mathematics',
      'cum laude', 'valedictorian', '1980', '1988', '1989', 'philippine bar',
    ],
  },
  {
    title: 'Juan Ricardo B. Tan — Assistant Corporate Secretary',
    desc: 'Assistant Corporate Secretary. Romulo Law. Debt capital markets, bond issuances.',
    href: '/about?tab=board#leadership',
    category: 'People',
    keywords: [
      'juan ricardo tan', 'rico tan', 'assistant corporate secretary', 'romulo law',
      'debt capital markets', 'bond issuances', 'global bonds', 'foreign currency',
      'global peso notes', 'bond exchanges', 'tender offers', 'republic of the philippines',
      'multilateral financial institutions', 'offshore banking units',
      'ateneo de manila', 'ateneo school of law', 'silver medal', '1988', '1992', '1993', '1994',
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // PEOPLE — Research Team
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Carl Stanley T. Sy, CFA — Property Analyst',
    desc: 'Director. Property sector analyst. FMAP Best Equities Property Analyst 2011–2022. CFA.',
    href: '/about?tab=research#leadership',
    category: 'People',
    keywords: [
      'carl sy', 'carl stanley sy', 'property analyst', 'director', 'cfa',
      'fmap best equities property analyst', 'best property analyst', '2011', '2022',
      'philippine financial', 'property companies', 'ateneo de manila', 'management engineering',
      '2010', 'research analyst',
    ],
  },
  {
    title: 'Cerre Klyne M. Resullar — Infrastructure & Mining',
    desc: 'Director. Infrastructure, transport, utilities, and mining coverage. MSc Birmingham.',
    href: '/about?tab=research#leadership',
    category: 'People',
    keywords: [
      'klyne resullar', 'cerre klyne resullar', 'director', 'infrastructure', 'transport',
      'utilities', 'mining', 'university of birmingham', 'msc development economics',
      'university of the philippines', 'economics', '2008',
    ],
  },
  {
    title: 'Paolo Gabriel D. Garcia — Consumer & Retail Analyst',
    desc: 'Research Analyst. Consumer and discretionary retail coverage. Ateneo Economics.',
    href: '/about?tab=research#leadership',
    category: 'People',
    keywords: [
      'paolo garcia', 'pao garcia', 'research analyst', 'consumer', 'discretionary retail',
      'ateneo de manila', 'economics', 'financial management', 'trust corporation',
      'equity analyst', '2024',
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // PEOPLE — Sales & Trading
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Nadine Guinevere J. Cariño — Head of Sales',
    desc: 'Director – Equity Sales, Head of Sales. Leads Corporate Access. JP Morgan, Macquarie.',
    href: '/about?tab=sales#leadership',
    category: 'People',
    keywords: [
      'nadine carino', 'nadine javellana', 'head of sales', 'director equity sales',
      'corporate access', 'jp morgan', 'macquarie', 'domestic institutional', 'foreign institutional',
      'banks', 'consumer', 'media', 'gaming', 'ateneo de manila', 'management economics', '2010',
    ],
  },
  {
    title: 'Patricia Isabel Tamase — Institutional Equity Sales',
    desc: 'Institutional Equity Sales. Daiwa, Citigroup, First Metro, CLSA. UP Mathematics.',
    href: '/about?tab=sales#leadership',
    category: 'People',
    keywords: [
      'patricia tamase', 'institutional equity sales', 'daiwa', 'citigroup',
      'first metro securities', 'clsa', 'equity research', 'domestic accounts', 'foreign accounts',
      'university of the philippines', 'mathematics', '2014', '2024',
    ],
  },
  {
    title: 'Daisy A. Ng — Head of Sales Trading',
    desc: 'Director, Head of Sales Trading. Covers HK and Singapore buy-side. Asia Equity, Merrill Lynch.',
    href: '/about?tab=sales#leadership',
    category: 'People',
    keywords: [
      'daisy ng', 'head of sales trading', 'director', 'sales trading',
      'hong kong', 'singapore', 'buy side dealers', 'asia equity',
      'gk goh securities', 'sg crosby', 'merrill lynch', 'dealer', '2002', '2008',
      'ateneo de manila', 'management economics',
    ],
  },
  {
    title: 'Ken Isagani C. Mariano III — Head of Dealing',
    desc: 'Director, Head of Dealing. High-touch execution specialist. De La Salle Lipa.',
    href: '/about?tab=sales#leadership',
    category: 'People',
    keywords: [
      'ken mariano', 'ken isagani mariano', 'head of dealing', 'director', 'dealing',
      'dealer', 'trading assistant', 'high-touch execution', 'de la salle lipa',
      'financial management', '2011', '2012',
    ],
  },
  {
    title: 'Ramon Emilio Y. Casano — Sales Trader / Equities Dealer',
    desc: 'Sales Trader and Equities Dealer. 11 years prior broker-dealer experience.',
    href: '/about?tab=sales#leadership',
    category: 'People',
    keywords: [
      'ramon casano', 'mio casano', 'sales trader', 'equities dealer', 'dealer',
      'high-touch execution', 'broker-dealer', 'senior dealer', 'ateneo de manila',
      'management economics', 'finance', '2024',
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // PEOPLE — Operations
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Daniel I. Orajay — Finance Director',
    desc: 'Finance Director at Regis Partners.',
    href: '/about?tab=operations#leadership',
    category: 'People',
    keywords: ['daniel orajay', 'finance director', 'finance', 'operations'],
  },
  {
    title: 'Edward S. Dagal — Operations Director',
    desc: 'Operations Director at Regis Partners.',
    href: '/about?tab=operations#leadership',
    category: 'People',
    keywords: ['edward dagal', 'operations director', 'operations'],
  },
  {
    title: 'Alma U. Montenegro — Settlements Head',
    desc: 'Settlements Head at Regis Partners.',
    href: '/about?tab=operations#leadership',
    category: 'People',
    keywords: ['alma montenegro', 'settlements', 'settlements head', 'operations', 'clearing'],
  },
  {
    title: 'Ronabil M. Diaron — Head of Administration',
    desc: 'Head of Administration at Regis Partners.',
    href: '/about?tab=operations#leadership',
    category: 'People',
    keywords: ['ronabil diaron', 'rona diaron', 'head of administration', 'administration', 'admin', 'operations'],
  },

  // ────────────────────────────────────────────────────────────────
  // CONTACT — Sections
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Send an Enquiry',
    desc: 'Qualified institutional inquiries welcome. We respond within one business day.',
    href: '/contact#enquiry',
    category: 'Contact',
    keywords: [
      'enquiry', 'inquiry', 'send', 'message', 'form', 'contact', 'reach out',
      'institutional email', 'name', 'firm', 'area of interest', 'one business day',
      'response', 'research', 'sales', 'trading', 'corporate access',
    ],
  },
  {
    title: 'Our Offices',
    desc: 'Makati HQ and regional locations.',
    href: '/contact#offices',
    category: 'Contact',
    keywords: [
      'offices', 'office', 'makati', 'makati hq', 'headquarters', 'location', 'address',
      'regional', 'asia', 'philippines',
    ],
  },
  {
    title: 'Compliance & KYC',
    desc: 'Regulatory and compliance contact for institutional onboarding and KYC.',
    href: '/contact#compliance',
    category: 'Contact',
    keywords: [
      'compliance', 'kyc', 'regulatory', 'onboarding', 'aml', 'know your client',
      'institutional', 'regulation', 'sec', 'pse rules',
    ],
  },
  {
    title: 'Trading Desk — Market Hours',
    desc: 'Direct line to the trading desk: +63 2 8848 0000. Market-hours dealing.',
    href: '/contact',
    category: 'Contact',
    keywords: [
      'trading desk', 'dealing', 'phone', 'market hours', '+63 2 8848 0000', 'direct line',
      'urgent', 'dealer', 'execution', 'call',
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // HOME — Sections
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Culture & Growth Story',
    desc: 'From Makati to the institution global allocators call first.',
    href: '/about',
    category: 'Home',
    keywords: [
      'culture', 'growth', 'story', 'makati', 'global allocators', 'trading floor',
      'people', 'partners', 'firm culture', 'institutional',
    ],
  },
  {
    title: 'Community & People',
    desc: 'Our people are our greatest contribution — from Makati to Mindanao.',
    href: '/about',
    category: 'Home',
    keywords: [
      'community', 'people', 'mindanao', 'makati', 'country', 'programs',
      'contribution', 'teams', 'philippines', 'corporate social responsibility', 'csr',
    ],
  },
  {
    title: 'Careers at Regis Partners',
    desc: 'Explore careers in research, sales, trading, corporate access, and operations.',
    href: '/contact',
    category: 'Home',
    keywords: [
      'careers', 'jobs', 'join', 'hiring', 'research', 'sales', 'trading',
      'corporate access', 'operations', 'build a craft', 'compounds', 'opportunities',
      'work at regis', 'apply',
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // RESEARCH — All insight articles
  // ────────────────────────────────────────────────────────────────
  {
    title: 'Beyond the Rate Cycle: Philippine Consumption 2026–2028',
    desc: 'Why Philippine consumption is the durable trade for 2026–2028.',
    href: '/insights',
    category: 'Research',
    keywords: [
      'rate cycle', 'philippine consumption', 'consumption', 'durable trade',
      '2026', '2028', 'macro', 'bautista', 'm. bautista', 'gdp', 'retail', 'spending',
      'beyond the rate', 'consumer', 'may 2026',
    ],
  },
  {
    title: 'NIMs Have Peaked: What Survives the Compression',
    desc: 'Philippine banking — net interest margins have peaked. What survives the compression.',
    href: '/insights',
    category: 'Research',
    keywords: [
      'nims', 'nim', 'net interest margin', 'peaked', 'compression', 'banks', 'banking',
      'philippine banks', 'bsp', 'rates', 'bautista', 'm. bautista', 'may 2026',
      'financial', 'spread', 'deposit', 'loan',
    ],
  },
  {
    title: 'ICT: Underappreciated Optionality on Manila Port Volumes',
    desc: 'Single-name research note on ICT and Manila Port volume exposure.',
    href: '/insights',
    category: 'Research',
    keywords: [
      'ict', 'international container terminal', 'port', 'manila port', 'volumes',
      'optionality', 'underappreciated', 'single name', 'j. reyes', 'logistics',
      'throughput', 'container', 'may 2026',
    ],
  },
  {
    title: "BSP's Quiet Pivot — In Five Charts",
    desc: "Bangko Sentral ng Pilipinas' quiet policy pivot decoded in five charts.",
    href: '/insights',
    category: 'Research',
    keywords: [
      'bsp', 'bangko sentral ng pilipinas', 'quiet pivot', 'policy', 'rate cut',
      'five charts', 'monetary policy', 'central bank', 'rate', 'inflation',
      'bautista', 'm. bautista', 'fx', 'peso', 'may 2026',
    ],
  },
  {
    title: 'Office Vacancy Has Bottomed: Why the Next Leg Is Selective',
    desc: 'Philippine property market — office vacancy inflection and selective recovery.',
    href: '/insights',
    category: 'Research',
    keywords: [
      'office vacancy', 'bottomed', 'property', 'real estate', 'selective', 'next leg',
      'philippine property', 'reit', 'developer', 'bgc', 'ortigas', 'makati cbd',
      'a. lim', 'may 2026', 'vacancy rate', 'absorption',
    ],
  },
  {
    title: 'Mid-Cap Consumer: Where the Re-Rating Is Just Starting',
    desc: 'Philippine mid-cap consumer stocks — re-rating thesis just underway.',
    href: '/insights',
    category: 'Research',
    keywords: [
      'mid-cap consumer', 'mid cap', 'consumer', 're-rating', 'rerating', 'just starting',
      'p. cruz', 'philippine consumer', 'fmcg', 'retail', 'brands', 'may 2026',
      'small cap', 'growth', 'valuation',
    ],
  },
  {
    title: 'After Malampaya: The LNG Transition the Market Is Mispricing',
    desc: 'Philippine power sector — the post-Malampaya LNG transition and market mispricing.',
    href: '/insights',
    category: 'Research',
    keywords: [
      'malampaya', 'lng', 'liquefied natural gas', 'power', 'energy', 'transition',
      'mispricing', 'gas', 'post-malampaya', 'a. lim', 'may 2026',
      'electricity', 'power sector', 'shell', 'meralco', 'energy mix',
    ],
  },
  {
    title: 'PSEi Targets, Sector Weights, Conviction List — Q2 2026',
    desc: 'Quarterly strategy update: PSEi targets, sector weights, and conviction list.',
    href: '/insights',
    category: 'Research',
    keywords: [
      'psei', 'pse index', 'targets', 'index target', 'sector weights', 'conviction list',
      'q2 2026', 'strategy', 'quarterly update', 'bautista', 'm. bautista',
      'may 2026', 'overweight', 'underweight', 'outlook', 'market call',
    ],
  },
];

export const TRENDING = [
  'Research Advisory',
  'PSEi targets',
  'Corporate Access',
  'BSP pivot',
  'Awards',
  'Careers',
  'Client Login',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const re = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark
            key={i}
            style={{
              background: 'var(--color-amber)',
              color: 'var(--color-navy-deep)',
              fontWeight: 600,
              borderRadius: '2px',
              padding: '0 1px',
            }}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// ─── Category icon ────────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: string }) {
  const paths: Record<string, React.ReactNode> = {
    Pages: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    Services: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
    About: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>,
    People: <><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></>,
    Contact: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z" /></>,
    Research: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></>,
    Home: <><rect x="3" y="9" width="18" height="11" rx="1" /><path d="M3 9l9-6 9 6" /></>,
  };
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[category] ?? <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

// ─── Exported scoring + width ─────────────────────────────────────────────────

export const SEARCH_PANEL_WIDTH = 320;

export function computeResults(query: string): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX.map((entry) => {
    let score = 0;
    const tl = entry.title.toLowerCase();
    const dl = entry.desc.toLowerCase();
    if (tl === q) score += 20;
    else if (tl.startsWith(q)) score += 12;
    else if (tl.includes(q)) score += 6;
    if (dl.includes(q)) score += 3;
    if (entry.keywords.some((k) => k.includes(q))) score += 2;
    if (entry.category.toLowerCase().includes(q)) score += 1;
    return { entry, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  activeIndex: number;
  onActiveIndex: (i: number) => void;
  onSelect: (href: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchModal({ open, query, onQueryChange, activeIndex, onActiveIndex, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLButtonElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const results = useMemo<SearchEntry[]>(() => computeResults(query), [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchEntry[]>();
    for (const entry of results) {
      if (!map.has(entry.category)) map.set(entry.category, []);
      map.get(entry.category)!.push(entry);
    }
    return map;
  }, [results]);

  const empty = query.trim() === '';
  const noResults = !empty && results.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease }}
          className="absolute right-0 z-50 overflow-hidden shadow-2xl"
          style={{
            top: 'calc(100% + 1px)',
            width: SEARCH_PANEL_WIDTH,
            background: '#ffffff',
            border: '1px solid color-mix(in oklab, var(--color-ink) 10%, transparent)',
          }}
        >
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '68vh' }}>

            {/* Default — trending only */}
            {empty && (
              <div className="py-4 px-4">
                <div className="mono text-[10px] tracking-[0.2em] uppercase mb-2.5" style={{ color: 'var(--color-graphite)' }}>
                  Trending
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TRENDING.map((t) => (
                    <button
                      key={t}
                      onClick={() => onQueryChange(t)}
                      className="flex items-center gap-1 mono text-[10.5px] tracking-[0.06em] px-2.5 py-1 border rule transition-colors duration-150"
                      style={{ color: 'var(--color-slate)', background: 'var(--color-bone)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklab, var(--color-amber) 12%, var(--color-bone))';
                        (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in oklab, var(--color-amber) 35%, transparent)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--color-bone)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--color-slate)';
                        (e.currentTarget as HTMLElement).style.borderColor = '';
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                      </svg>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {noResults && (
              <div className="px-4 py-10 text-center">
                <p className="text-[13.5px]" style={{ color: 'var(--color-graphite)' }}>
                  No results for{' '}
                  <span className="font-medium" style={{ color: 'var(--color-ink)' }}>"{query}"</span>
                </p>
                <p className="text-[11.5px] mt-1" style={{ color: 'var(--color-silver)' }}>
                  Try a page, service, person, or topic.
                </p>
              </div>
            )}

            {/* Results */}
            {!empty && !noResults && (
              <div className="py-1">
                {Array.from(grouped.entries()).map(([cat, entries]) => (
                  <div key={cat}>
                    <div
                      className="mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 flex items-center gap-1.5"
                      style={{ color: 'var(--color-graphite)' }}
                    >
                      <CategoryIcon category={cat} />
                      {cat}
                    </div>
                    {entries.map((entry) => {
                      const idx = results.indexOf(entry);
                      const isActive = idx === activeIndex;
                      return (
                        <button
                          key={`${entry.href}-${entry.title}`}
                          data-active={isActive}
                          onClick={() => onSelect(entry.href)}
                          onMouseEnter={() => onActiveIndex(idx)}
                          className="w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors duration-100"
                          style={{
                            background: isActive
                              ? 'color-mix(in oklab, var(--color-amber) 8%, var(--color-bone))'
                              : 'transparent',
                          }}
                        >
                          <span
                            className="mt-0.5 flex-shrink-0 transition-colors duration-100"
                            style={{ color: isActive ? 'var(--color-amber)' : 'var(--color-silver)' }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[13px] tracking-[-0.005em] leading-snug"
                              style={{ color: isActive ? 'var(--color-ink)' : 'var(--color-slate)' }}
                            >
                              <Highlight text={entry.title} query={query} />
                            </div>
                            <div className="text-[11px] leading-snug mt-0.5 truncate" style={{ color: 'var(--color-graphite)' }}>
                              <Highlight text={entry.desc} query={query} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-3 px-4 py-2"
            style={{ borderTop: '1px solid color-mix(in oklab, var(--color-ink) 8%, transparent)' }}
          >
            <span className="mono text-[9.5px] tracking-[0.1em] uppercase flex items-center gap-1" style={{ color: 'var(--color-silver)' }}>
              <kbd className="px-1 border rule" style={{ background: 'var(--color-bone)' }}>↑↓</kbd>
              nav
            </span>
            <span className="mono text-[9.5px] tracking-[0.1em] uppercase flex items-center gap-1" style={{ color: 'var(--color-silver)' }}>
              <kbd className="px-1 border rule" style={{ background: 'var(--color-bone)' }}>↵</kbd>
              go
            </span>
            <span className="mono text-[9.5px] tracking-[0.1em] uppercase flex items-center gap-1" style={{ color: 'var(--color-silver)' }}>
              <kbd className="px-1 border rule" style={{ background: 'var(--color-bone)' }}>esc</kbd>
              close
            </span>
          </div>

          {/* Amber conviction line */}
          <div
            className="h-[2px]"
            style={{ background: 'linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-deep) 55%, transparent 100%)' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
