import type { HomeCopy } from '../cms/data';
import { usePublicContent } from './publicContent';

/* ─────────────────────────────────────────────────────────────
   The landing page's copy and photography, authored in the CMS
   Landing page module. The bundled document below is the last-
   known-good fallback, so the home page still renders in full if
   the API is unreachable. It mirrors api/app/Support/HomeDefaults.
   ───────────────────────────────────────────────────────────── */

export const HOME_FALLBACK: HomeCopy = {
  hero: {
    enabled: true,
    eyebrow: 'Philippine Institutional Brokerage & Capital Markets',
    headline: "The Philippines'\npure-play institutional\nbrokerage & research house.",
    dek: '',
    image: '/hero-lobby.jpg',
  },
  numbers: {
    enabled: true,
    eyebrow: '',
    heading: 'Strength in numbers.',
    intro: '',
    stats: [
      { value: 1999, suffix: '', label: 'Founded, member of the PSE' },
      { value: 25, suffix: '+', label: 'Years of partnership' },
      { value: 120, suffix: '+', label: 'PSE names under coverage' },
      { value: 300, suffix: '+', label: 'Institutional counterparties' },
    ],
  },
  services: {
    enabled: true,
    eyebrow: 'What we do',
    heading: 'Deep expertise across the Philippine capital markets.',
    cta: { label: 'All services', href: '/services' },
    rows: [
      { title: 'Research Advisory', blurb: 'Original equity research across 120+ PSE names', href: '/services/research', image: '/Service1.1.jpg' },
      { title: 'Sales Advisory', blurb: 'High-touch institutional sales and idea generation', href: '/services/sales', image: '/Service 2.1.jpg' },
      { title: 'Trading & Execution', blurb: 'Block, agency, and algorithmic execution on the PSE', href: '/services/trading', image: '/Service 3.1.jpg' },
      { title: 'Corporate Access', blurb: 'Conferences, NDRs, and C-suite engagement', href: '/services/corporate', image: '/Service 3.2.jpg' },
      { title: 'Capital Markets', blurb: 'Equity issuance, follow-ons, and placements', href: '/services', image: '/Services 4.1.jpg' },
      { title: 'Advisory', blurb: 'Strategic and corporate finance counsel', href: '/services', image: '/Service 4.2.jpg' },
    ],
  },
  insights: {
    enabled: true,
    eyebrow: 'Insights',
    heading: 'Research that moves markets.',
    intro: '',
    cta: { label: '', href: '/insights' },
    featured: [
      {
        kicker: 'The Big Picture',
        title: 'How sovereign AI became the new arena for state power.',
        blurb: 'Compute is the new oil concession. We map the capital flowing into national AI programs and what it signals for emerging-market allocators.',
        meta: '24 AUG 2026 · 6 MIN READ',
        href: '/insights',
        image: '/AiBG.jpg',
      },
      {
        kicker: 'Boardroom Intelligence',
        title: 'The exit doors are open: liquidity returns to private markets.',
        blurb: "Secondaries, evergreen vehicles, and a reawakened IPO pipeline are rewriting private equity's next chapter across the region.",
        meta: '11 AUG 2026 · 5 MIN READ',
        href: '/insights',
        image: '/insight-exit.jpg',
      },
    ],
    rows: [
      { kicker: 'Sustainability & Culture', title: "Secondary market surge: how evergreen vehicles are writing PE's next chapter.", meta: '29 JUL 2026 · 4 MIN READ', href: '/insights' },
      { kicker: 'The Big Picture', title: "India's IPO market: signs point to a strong finish to 2026.", meta: '15 JUL 2026 · 3 MIN READ', href: '/insights' },
      { kicker: 'PSE Desk', title: 'Positioning ahead of the August MSCI rebalance.', meta: '02 JUL 2026 · 4 MIN READ', href: '/insights' },
    ],
  },
  culture: {
    enabled: true,
    eyebrow: 'Our story',
    heading: 'From a Makati desk to the house global allocators call first.',
    cta: { label: 'Get to know us better', href: '/about' },
    image: '/StockWork.png',
    imageAlt: 'The Regis trading floor during market hours',
  },
  community: {
    enabled: true,
    eyebrow: 'People & community',
    heading: 'Our people are our greatest contribution to the country.',
    body: 'As a people-driven business, our contribution flows through the teams and communities we serve across the Philippines, from Makati to Mindanao.',
    cta: { label: 'Explore our programs', href: '/about' },
    image: '/People of Regis.png',
    imageAlt: 'The people of Regis Partners',
  },
  quote: {
    enabled: true,
    eyebrow: 'A word from the President',
    quote: 'In a year defined by complexity and change, we believe it is essential to reflect on the principles that define us. At Regis, we prioritize clients, people, and insight, always.',
    name: 'Michael Angelo B. Macale',
    role: 'President',
    cta: { label: 'Meet our leadership', href: '/about#leadership' },
    image: '/President.png',
  },
  careers: {
    enabled: true,
    eyebrow: 'Careers',
    heading: 'We also invest in people.',
    body: 'Our partners are our most valuable asset. Build a craft that compounds across research, sales, trading, corporate access, and operations.',
    cta: { label: 'Answer your calling', href: '/contact' },
    image: '/CareersBG.png',
    imageAlt: 'Working at Regis Partners',
  },
};

type HomeContent = { copy: HomeCopy };

const FALLBACK: HomeContent = { copy: HOME_FALLBACK };

/** Tolerate a partial payload rather than letting one missing section blank the page. */
function normalizeHome(raw: unknown): HomeContent {
  const r = raw as { copy?: Partial<HomeCopy> };
  const c = r.copy ?? {};
  const section = <K extends keyof HomeCopy>(key: K): HomeCopy[K] =>
    ({ ...HOME_FALLBACK[key], ...(c[key] ?? {}) }) as HomeCopy[K];
  return {
    copy: {
      hero: section('hero'),
      numbers: section('numbers'),
      services: section('services'),
      insights: section('insights'),
      culture: section('culture'),
      community: section('community'),
      quote: section('quote'),
      careers: section('careers'),
    },
  };
}

/**
 * Published landing page document. `ready` flips once the live document
 * has landed (or the API has been given up on), so the hero can play its
 * reveal once with the right words rather than swapping mid-animation.
 */
export function useHomeContent(): { copy: HomeCopy; ready: boolean } {
  const { data, ready } = usePublicContent('/content/home', FALLBACK, normalizeHome);
  return { copy: data.copy, ready };
}

export type { HomeCopy };
