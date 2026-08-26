import { usePublicContent } from './publicContent';

/* ─────────────────────────────────────────────────────────────
   /services content, authored in the CMS and served by the API.
   The bundled copy below is the last-known-good fallback: if the
   API is unreachable the marketing page still renders rather than
   collapsing to an empty shell.
   ───────────────────────────────────────────────────────────── */

export type ServicePillar = { title: string; body: string };
export type ServiceProof = { value: string; label: string };

export type ServiceLine = {
  id: string;
  slug: string;
  eyebrow: string;
  title: string;
  dek: string;
  introHeading: string;
  img: string;
  heroImages: string[];
  pillars: ServicePillar[];
  proof: ServiceProof[];
};

export type ServicePage = {
  eyebrow: string;
  title: string;
  dek: string;
  heroImage: string;
  cardCta: string;
};

export type ServicesContent = { page: ServicePage; services: ServiceLine[] };

export const SERVICES_FALLBACK: ServicesContent = {
  page: {
    eyebrow: 'What we do',
    title: 'Our Services',
    dek: '',
    heroImage: '/Services Hero.png',
    cardCta: 'Read the practice brief',
  },
  services: [
    {
      id: 'research',
      slug: 'research',
      eyebrow: 'Service',
      title: 'Research Advisory',
      dek: 'Original, conviction-led equity research with the institutional rigor of a global house and the ground-truth of a local one.',
      introHeading: 'What the practice delivers.',
      img: '/Services1.jpg',
      heroImages: ['/Services1.jpg', '/Service1.1.jpg', '/service1.2.jpg'],
      pillars: [
        { title: 'Single-name coverage', body: 'Initiations, quarterly updates, and event-driven notes across 120+ PSE-listed names.' },
        { title: 'Sector deep-dives', body: 'Quarterly thematic work on banks, property, consumer, power, conglomerates, and TMT.' },
        { title: 'Macro & strategy', body: 'BSP, inflation, FX, fiscal, and politics translated into PSE positioning.' },
        { title: 'Bespoke commissioned work', body: 'Confidential research mandates for allocators with specific exposure questions.' },
      ],
      proof: [
        { value: '120+', label: 'names' },
        { value: '1,400', label: 'notes / yr' },
        { value: '22 yrs', label: 'avg PM tenure' },
      ],
    },
    {
      id: 'sales',
      slug: 'sales',
      eyebrow: 'Service',
      title: 'Sales Advisory',
      dek: 'A high-touch institutional dealing desk that knows your mandate, your benchmarks, and your reporting calendar.',
      introHeading: 'What the practice delivers.',
      img: '/Services2.jpg',
      heroImages: ['/Services2.jpg', '/Service 2.1.jpg'],
      pillars: [
        { title: 'Idea generation', body: 'Daily morning calls and conviction lists, filtered to your risk appetite.' },
        { title: 'Portfolio overlays', body: 'Tactical pair trades, hedges, and rotations across PSE sectors.' },
        { title: 'Cross-asset commentary', body: 'How peso, rates, and Asian risk are positioning Philippine equities.' },
        { title: 'Bespoke roadshows', body: 'Custom NDRs assembled around portfolio gaps.' },
      ],
      proof: [
        { value: '300+', label: 'institutions' },
        { value: '9', label: 'global jurisdictions' },
        { value: 'Partner-led', label: 'coverage' },
      ],
    },
    {
      id: 'trading',
      slug: 'trading',
      eyebrow: 'Service',
      title: 'Trading & Execution',
      dek: 'Discreet block, agency, and program execution on the PSE by a desk that has traded through every regime since 1999.',
      introHeading: 'What the practice delivers.',
      img: '/Services3.jpg',
      heroImages: ['/Services3.jpg', '/Service 3.1.jpg', '/Service 3.2.jpg'],
      pillars: [
        { title: 'Block & facilitation', body: 'Liquidity in size, with minimal information leakage.' },
        { title: 'Algos & program', body: 'VWAP, TWAP, and implementation-shortfall trajectories.' },
        { title: 'Cross-border settlement', body: 'DvP, omnibus, and segregated custody with global banks.' },
        { title: 'After-hours liquidity', body: 'Coordinated execution outside the PSE clock when it matters.' },
      ],
      proof: [
        { value: 'Top 10', label: 'PSE trading participant' },
        { value: '<10bps', label: 'avg slippage on blocks' },
        { value: '24/5', label: 'global desk coverage' },
      ],
    },
    {
      id: 'corporate',
      slug: 'corporate',
      eyebrow: 'Service',
      title: 'Corporate Access',
      dek: 'The deepest C-suite rolodex in Philippine equities. Conferences, NDRs, site visits, and corporate days that move conviction.',
      introHeading: 'What the practice delivers.',
      img: '/Services4.jpg',
      heroImages: ['/Services4.jpg', '/Services 4.1.jpg', '/Service 4.2.jpg'],
      pillars: [
        { title: 'Annual Manila Conference', body: 'Three days. 60+ issuers, 200+ investors, 4,000+ one-on-ones.' },
        { title: 'C-suite NDRs', body: 'Single-name roadshows for CEOs, CFOs, and IROs into Asia, the US, and Europe.' },
        { title: 'Site visits & plant tours', body: 'Operating-asset visits across power, food, logistics, and property.' },
        { title: 'Thematic corporate days', body: 'Banks, consumer, infrastructure, and ESG-themed calendars.' },
      ],
      proof: [
        { value: '25 yrs', label: 'C-suite relationships' },
        { value: '60+', label: 'issuers / conference' },
        { value: 'Asia · EU · US', label: 'NDR routes' },
      ],
    },
  ],
};

/** Tolerate a partial payload rather than letting one missing key blank the page. */
function normalize(rawIn: unknown): ServicesContent {
  const raw = rawIn as ServicesContent;
  return {
    page: { ...SERVICES_FALLBACK.page, ...(raw.page ?? {}) },
    services: (raw.services ?? []).map((s) => ({
      ...s,
      heroImages: s.heroImages ?? [],
      pillars: s.pillars ?? [],
      proof: s.proof ?? [],
    })),
  };
}

/** Published /services content, or null until the first response lands. */
export function useServicesContent(): ServicesContent | null {
  const { data, ready } = usePublicContent('/content/services', SERVICES_FALLBACK, normalize);
  return ready ? data : null;
}
