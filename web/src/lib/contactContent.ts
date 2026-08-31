import type { ContactCopy } from '../cms/data';
import { usePublicContent } from './publicContent';

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
  newsletter: { enabled: true },
};

type ContactContent = { copy: ContactCopy };

const FALLBACK: ContactContent = { copy: CONTACT_FALLBACK };

/** Tolerate a partial payload rather than letting one missing section blank the page. */
function normalizeContact(raw: unknown): ContactContent {
  const r = raw as { copy?: Partial<ContactCopy> };
  const c = r.copy ?? {};
  return {
    copy: {
      hero: { ...CONTACT_FALLBACK.hero, ...(c.hero ?? {}) },
      inquiry: { ...CONTACT_FALLBACK.inquiry, ...(c.inquiry ?? {}) },
      offices: { ...CONTACT_FALLBACK.offices, ...(c.offices ?? {}) },
      newsletter: { ...CONTACT_FALLBACK.newsletter, ...(c.newsletter ?? {}) },
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

export type { ContactCopy };
