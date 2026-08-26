import { usePublicContent } from './publicContent';

/* ──────────────────────────────────────────────────────────
   Legal copy — the Terms & Conditions and the Privacy & Cookies
   Policy shown in the site footer and on every login portal.

   Each document is one body of text, edited whole in the CMS Legal
   module: a line opening with '## ' starts a clause, and blank lines
   separate paragraphs. The copy below is the bundled fallback that
   renders when the API is unreachable, and mirrors what the backend
   ships as defaults.
   ────────────────────────────────────────────────────────── */

export type LegalKey = 'terms' | 'privacy';
export type LegalSection = { heading: string; body: string };
export type LegalDoc = {
  key: LegalKey;
  title: string;
  effective: string;
  body: string;
};

const TERMS_BODY = `## Acceptance of Terms

By accessing or using any services provided by Regis Partners, Inc. ("Regis Partners", "we", "us", or "our"), you agree to be bound by these Terms and Conditions and all applicable laws and regulations of the Republic of the Philippines. If you do not agree with any of these terms, you are prohibited from using or accessing this site and our services.

## Regulatory Standing

Regis Partners, Inc. is a registered corporation and licensed broker-dealer under the Securities Regulation Code of the Philippines (Republic Act No. 8799). We are regulated by the Securities and Exchange Commission (SEC) and are a licensed trading participant of the Philippine Stock Exchange (PSE). Our operations are subject to the rules and regulations of the Bangko Sentral ng Pilipinas (BSP) where applicable.

SEC Registration No.: AS-099-XXXXX
PSE Trading Participant License No.: [XXXXX]

## Investment Risk Disclosure

All securities trading and investment advisory services involve risk. Past performance is not indicative of future results. The value of investments and any income derived from them can fall as well as rise. You may not get back the amount originally invested.

This website and its contents do not constitute an offer to sell or a solicitation to buy any security in any jurisdiction where such offer or solicitation would be unlawful. Research reports and investment recommendations published by Regis Partners are for informational purposes only and should not be construed as investment advice within the meaning of Republic Act No. 8799 and its Implementing Rules and Regulations.

## Intellectual Property

All content on this website, including but not limited to research reports, market data analyses, proprietary indices, text, graphics, logos, and software, is the exclusive property of Regis Partners, Inc. and is protected under the Intellectual Property Code of the Philippines (Republic Act No. 8293).

No portion of this website may be reproduced, distributed, or transmitted in any form without prior written consent from Regis Partners, Inc. Unauthorized reproduction may constitute a violation of Republic Act No. 8293 and subject the infringing party to civil and criminal liability.

## Prohibited Conduct

You agree not to use our services or website to:

• Violate Republic Act No. 8799 (Securities Regulation Code), including prohibitions on insider trading and market manipulation
• Engage in conduct prohibited under Republic Act No. 9160 (Anti-Money Laundering Act) as amended by Republic Act No. 10365 and Republic Act No. 11521
• Transmit any material that infringes upon the rights of third parties under Republic Act No. 8293 (Intellectual Property Code)
• Engage in any activity that violates Republic Act No. 10175 (Cybercrime Prevention Act of 2012)
• Circumvent or attempt to circumvent any security measure implemented by Regis Partners

## Client Classification & Suitability

Regis Partners serves qualified institutional investors, professional investors, and eligible clients as defined under the Securities Regulation Code and SEC regulations. Access to certain services and research may be restricted to clients who meet applicable qualification thresholds. By accessing our research portal or requesting services, you represent and warrant that you meet the applicable eligibility requirements under Philippine law and regulation.

## Limitation of Liability

To the maximum extent permitted by applicable Philippine law, Regis Partners, Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, arising out of or in connection with your use of our services or this website, even if advised of the possibility of such damages.

Our total liability to you for any claim arising from these Terms shall not exceed the fees paid by you to Regis Partners in the twelve (12) months immediately preceding the claim.

## Anti-Money Laundering Compliance

Regis Partners is a covered institution under Republic Act No. 9160 (Anti-Money Laundering Act of 2001), as amended. We are required to perform customer due diligence, report suspicious transactions, and cooperate with the Anti-Money Laundering Council (AMLC). By engaging our services, you consent to the collection and processing of information required under AMLA and its implementing rules for compliance purposes.

## Governing Law & Dispute Resolution

These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the proper courts of Makati City, Metro Manila, Philippines, without prejudice to the right of Regis Partners to seek injunctive relief in any appropriate jurisdiction.

## Amendments

Regis Partners reserves the right to amend these Terms and Conditions at any time. Amendments shall be effective upon posting on this website. Continued use of our services after the posting of any amendment constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.

## Contact

For any queries regarding these Terms and Conditions, please contact our Compliance Department:

Regis Partners, Inc.
Compliance Department
[Address], Makati City, Metro Manila 1200
compliance@regispartners.com.ph`;

const PRIVACY_BODY = `## Data Privacy Act Compliance

Regis Partners, Inc. is committed to protecting and upholding your right to data privacy in accordance with Republic Act No. 10173 (Data Privacy Act of 2012) and its Implementing Rules and Regulations (IRR), as enforced by the National Privacy Commission (NPC) of the Philippines.

We are registered with the National Privacy Commission as a Personal Information Controller (PIC). Our Data Protection Officer (DPO) can be reached at dpo@regispartners.com.ph.

## Information We Collect

We collect personal information necessary to deliver our services and comply with applicable regulations, including:

• Identification information: full name, date of birth, nationality, government-issued ID numbers
• Contact information: email address, telephone number, mailing and business address
• Financial information: investment profile, risk tolerance, source of funds declarations required under AMLA
• Transaction data: order history, account activity, portfolio records
• Technical data: IP address, browser type, device identifiers, cookies and usage data
• Communications: records of correspondence with our team, meeting notes, and research requests

## Lawful Basis for Processing

Under the Data Privacy Act of 2012, we process your personal data on the following lawful bases:

• Contractual necessity: processing required to deliver brokerage and advisory services under our client agreement
• Legal obligation: compliance with the Securities Regulation Code (RA 8799), Anti-Money Laundering Act (RA 9160 as amended), Tax Code, and regulations of the SEC, PSE, and AMLC
• Legitimate interests: fraud prevention, security monitoring, and improvement of our services
• Consent: marketing communications and non-essential cookies (where applicable)

## How We Use Your Information

Your personal data is used to:

• Onboard you as a client and verify your identity in compliance with KYC requirements
• Execute securities transactions and provide settlement services
• Deliver research reports, market commentary, and investment recommendations
• Comply with regulatory reporting obligations to the SEC, PSE, AMLC, and BIR
• Communicate material changes to our services or your account
• Detect and prevent fraud, money laundering, and other illicit activities
• Analyse and improve the quality and relevance of our services

## Data Sharing & Disclosure

We do not sell your personal data. We may share your information only with:

• Regulatory authorities: SEC, PSE, AMLC, BIR, and other government bodies as required by law
• Service providers: third-party processors (clearing houses, custodians, technology vendors) bound by data processing agreements consistent with the DPA
• Professional advisers: lawyers, auditors, and compliance consultants under confidentiality obligations
• Affiliated entities: within the Regis Partners group for operational and compliance purposes

Any cross-border data transfer shall comply with Section 21 of the DPA and relevant NPC issuances regarding cross-border data flow.

## Cookies & Tracking Technologies

We use cookies and similar tracking technologies on this website. Cookies are small text files placed on your device that help us operate and improve our website.

Essential Cookies — Required for the website to function. These cannot be disabled.

Analytics Cookies — Help us understand how visitors interact with our website (e.g., pages visited, session duration). We use this data only in aggregate, anonymised form.

Functional Cookies — Remember your preferences to personalise your experience on the research portal.

You may configure your browser to refuse cookies, though this may limit the functionality of certain areas of this website. Our use of cookies is in accordance with Republic Act No. 10175 (Cybercrime Prevention Act) and relevant NPC advisories.

## Data Retention

We retain personal data for as long as necessary to fulfil the purposes for which it was collected, or as required by law:

• Client account records: minimum ten (10) years from account closure, in accordance with SEC regulations and BSP circulars
• Transaction records: minimum ten (10) years, in compliance with the Anti-Money Laundering Act
• Communication records: five (5) years
• Website usage data: up to twenty-four (24) months

Upon expiry of the applicable retention period, data is securely disposed of in accordance with NPC guidelines.

## Your Rights as a Data Subject

Under the Data Privacy Act of 2012, you have the following rights:

• Right to be Informed — to know what personal data we collect and how it is used
• Right of Access — to request a copy of your personal data held by us
• Right to Object — to object to processing based on legitimate interests
• Right to Erasure or Blocking — to request deletion of data no longer necessary for the stated purpose, subject to legal retention requirements
• Right to Rectification — to have inaccurate or incomplete data corrected
• Right to Data Portability — to receive your data in a structured, machine-readable format
• Right to Damages — to be indemnified for damages sustained due to unauthorised processing

To exercise any of these rights, please submit a written request to dpo@regispartners.com.ph. We will respond within fifteen (15) working days in accordance with NPC guidelines.

## Security Measures

Regis Partners implements physical, technical, and organisational security measures to protect your personal data against unauthorised access, disclosure, alteration, and destruction. Our security programme is designed in accordance with NPC Circular No. 16-01 and industry best practices, and includes access controls, encryption of data in transit and at rest, periodic security assessments, and mandatory data privacy training for all staff.

In the event of a personal data breach that may cause serious harm to data subjects, we will notify the NPC within seventy-two (72) hours of discovery, and affected data subjects as required under the DPA.

## Contact & Complaints

If you have questions about this Privacy Policy or wish to file a complaint regarding how we handle your personal data, contact our Data Protection Officer:

Data Protection Officer
Regis Partners, Inc.
[Address], Makati City, Metro Manila 1200
dpo@regispartners.com.ph

You also have the right to lodge a complaint with the National Privacy Commission (NPC) at www.privacy.gov.ph.`;

export const LEGAL_FALLBACK: LegalDoc[] = [
  {
    key: 'terms',
    title: 'Terms & Conditions',
    effective: 'Effective 1 January 2025',
    body: TERMS_BODY,
  },
  {
    key: 'privacy',
    title: 'Privacy & Cookies Policy',
    effective: 'Effective 1 January 2025',
    body: PRIVACY_BODY,
  },
];

/** A '## ' line opens a clause; anything before the first one runs untitled. */
export function parseLegalBody(body: string): LegalSection[] {
  const sections: LegalSection[] = [];

  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^ {0,3}#{1,6} +(.*)$/.exec(line);
    if (heading) {
      sections.push({ heading: heading[1].trim(), body: '' });
      continue;
    }
    if (!sections.length) sections.push({ heading: '', body: '' });
    const last = sections[sections.length - 1];
    last.body = last.body ? `${last.body}\n${line}` : line;
  }

  return sections
    .map((s) => ({ heading: s.heading, body: s.body.trim() }))
    .filter((s) => s.heading || s.body);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v : fallback;
}

/** A document the API returns empty keeps the bundled copy. */
function normalize(raw: unknown): LegalDoc[] {
  const list = (raw as { documents?: unknown[] } | null)?.documents;
  if (!Array.isArray(list)) return LEGAL_FALLBACK;

  return LEGAL_FALLBACK.map((bundled) => {
    const doc = list.find((d) => (d as { key?: string })?.key === bundled.key) as
      | { title?: unknown; effective?: unknown; body?: unknown }
      | undefined;
    const body = str(doc?.body);
    if (!body) return bundled;

    return {
      key: bundled.key,
      title: str(doc?.title, bundled.title),
      effective: str(doc?.effective, bundled.effective),
      body,
    };
  });
}

/**
 * `enabled` is false until the reader actually opens a document — the footer
 * sits on every page and the policies are only ever read on demand.
 */
export function useLegalContent(enabled = true) {
  return usePublicContent<LegalDoc[]>('/content/legal', LEGAL_FALLBACK, normalize, enabled);
}
