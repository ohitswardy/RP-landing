import type { ContactCopy as CmsContactCopy } from '../cms/data';
import { usePublicContent } from './publicContent';

/** One footer / contact-page social link, authored in the Pages module. */
export type SocialLink = { label: string; href: string };

/**
 * The public document is the CMS document plus the `social` array the
 * backend ships (empty until the desk adds links). Declared here so the
 * public site never depends on the CMS wire types gaining the key.
 */
export type ContactCopy = CmsContactCopy & { social: SocialLink[] };

/* ─────────────────────────────────────────────────────────────
   The Contact page's copy, authored in the Pages module. The
   bundled document below is the last-known-good fallback, so the
   page still renders in full if the API is unreachable.
   ───────────────────────────────────────────────────────────── */

export const CONTACT_FALLBACK: ContactCopy = {
  hero: {
    eyebrow: '',
    title: 'Open a conversation.',
    image: '/sunray.jpg',
  },
  inquiry: {
    eyebrow: 'Inquiry',
    heading: "Let's start\na conversation.",
    blurb: 'Reach our team directly. We respond to all institutional inquiries within one business day.',
    deskLabel: 'Market-hours dealing',
    deskName: 'Trading Desk',
    deskPhone: '+63 2 8848 0000',
    interests: ['Research', 'Sales', 'Trading', 'Corporate Access', 'Other'],
    submitLabel: 'Send inquiry',
    successHeading: 'Thank you.',
    successBody:
      'Your inquiry has been received. A confirmation has been sent to {email}. A partner will reach out within one business day. For urgent matters, call the trading desk on {desk}.',
  },
  offices: {
    eyebrow: 'Contact Us',
    heading: 'Every channel. One dedicated team.',
    addressLabel: 'Address',
    address: [
      'Regis Partners, Inc.',
      '23/F Tower One,',
      'Ayala Triangle, Ayala Avenue',
      '1226 Makati City, Philippines',
    ],
    contactLabel: 'Contact',
    channels: [
      { label: 'TEL', value: '+63 2 8894 6600' },
      { label: 'FAX', value: '+63 2 8894 6605\n+63 2 8894 6622' },
    ],
    emailLabel: 'Email',
    email: 'info@regis.ph',
  },
  // No social links until the desk adds them in the CMS: nothing renders.
  social: [],
};

type ContactContent = { copy: ContactCopy };

const FALLBACK: ContactContent = { copy: CONTACT_FALLBACK };

/** Only well-formed, absolute links survive — a half-typed row is not a button. */
export function normalizeSocial(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const r = (s ?? {}) as Partial<SocialLink>;
      return { label: String(r.label ?? '').trim(), href: String(r.href ?? '').trim() };
    })
    .filter((s) => s.label !== '' && /^(https?:\/\/|mailto:)/i.test(s.href));
}

/** Tolerate a partial payload rather than letting one missing section blank the page. */
function normalizeContact(raw: unknown): ContactContent {
  const r = raw as { copy?: Partial<ContactCopy> };
  const c = r.copy ?? {};
  return {
    copy: {
      hero: { ...CONTACT_FALLBACK.hero, ...(c.hero ?? {}) },
      inquiry: { ...CONTACT_FALLBACK.inquiry, ...(c.inquiry ?? {}) },
      offices: { ...CONTACT_FALLBACK.offices, ...(c.offices ?? {}) },
      social: normalizeSocial(c.social),
    },
  };
}

/**
 * Published Contact copy. The bundled fallback renders immediately and is
 * replaced the moment the live document lands, so the banner never flashes
 * empty while the request is in flight.
 */
export function useContactContent(): ContactCopy {
  const { data } = usePublicContent('/content/contact', FALLBACK, normalizeContact);
  return data.copy;
}

