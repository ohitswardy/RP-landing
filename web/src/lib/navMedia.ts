import { ABOUT_FALLBACK } from './aboutContent';
import { CONTACT_FALLBACK } from './contactContent';
import { INSIGHTS_FALLBACK } from './insightsContent';
import { usePublicContent } from './publicContent';
import { SERVICES_FALLBACK } from './servicesContent';

/* ─────────────────────────────────────────────────────────────
   The photography behind the navbar's mega-menu panels. Each
   menu shows the hero image of the page it opens onto, so a hero
   replaced in the CMS re-dresses its menu with the same shot.

   The navbar renders on every public page, so this rides its own
   endpoint rather than pulling four whole content documents.
   ───────────────────────────────────────────────────────────── */

export type NavMenuKey = 'services' | 'insights' | 'about' | 'contact';
export type NavMedia = Record<NavMenuKey, string>;

/** The same bundled documents the pages themselves fall back to. */
export const NAV_MEDIA_FALLBACK: NavMedia = {
  services: SERVICES_FALLBACK.page.heroImage,
  insights: INSIGHTS_FALLBACK.page.hero.image,
  about: ABOUT_FALLBACK.hero.image,
  contact: CONTACT_FALLBACK.hero.image,
};

/** A hero cleared in the CMS leaves the menu on its bundled shot. */
function normalize(raw: unknown): NavMedia {
  const media = (raw as { media?: Partial<NavMedia> })?.media ?? {};
  const pick = (k: NavMenuKey) => {
    const v = media[k];
    return typeof v === 'string' && v.trim() !== '' ? v : NAV_MEDIA_FALLBACK[k];
  };
  return { services: pick('services'), insights: pick('insights'), about: pick('about'), contact: pick('contact') };
}

/** Published mega-menu photography; the bundled shots until it lands. */
export function useNavMedia(): NavMedia {
  const { data } = usePublicContent('/content/nav', NAV_MEDIA_FALLBACK, normalize);
  return data;
}
